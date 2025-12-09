/**
 * AI Quota Management & Circuit Breaker
 * 
 * Tracks daily AI model inference calls and implements circuit breaker pattern
 * to prevent quota exhaustion (10,000 neurons/day free tier)
 * 
 * Since Cloudflare doesn't provide real-time API access to neuron usage,
 * we estimate neurons based on official pricing page:
 * https://developers.cloudflare.com/workers-ai/platform/pricing/
 */

export interface QuotaStatus {
  date: string;
  neuronsUsed: number;
  neuronsLimit: number;
  neuronsRemaining: number;
  isExceeded: boolean;
  resetAt: string;
  inferenceCount: number;
}

// Neuron costs per model (from Cloudflare pricing page)
// https://developers.cloudflare.com/workers-ai/platform/pricing/
export const NEURON_COSTS = {
  // Mistral 7B: 10,000 neurons per M input tokens, 17,300 per M output tokens
  // Estimated average per call: ~50-100 neurons (depends on input/output length)
  'mistral-7b-instruct': 75, // Conservative estimate: 75 neurons per inference

  // Llama 3.1 70B: 6,667 neurons per M input tokens, 13,889 per M output tokens
  // With max_tokens=80 and aggressive laconic enforcement:
  // Input: ~500 tokens × 0.006667 = ~3.3 neurons
  // Output: ~50 tokens × 0.013889 = ~0.7 neurons
  // Total: ~4-5 neurons per query (user input adds minimal ~0.5-0.8 neurons)
  'llama-3.1-70b-instruct': 5, // Conservative estimate with safety buffer (PRIMARY MODEL)

  // Embeddings: bge-base-en-v1.5: 6,058 neurons per M input tokens
  // Typical CV skill text: ~50-100 tokens = ~0.3-0.6 neurons per call
  'bge-base-en-v1.5': 0.6, // Conservative estimate

  // llama 3.2-3b (if we fall back): 4,625 input, 30,475 output neurons per M tokens
  'llama-3.2-3b-instruct': 35,
};

const DAILY_NEURON_LIMIT = 9500; // Set below 10k for safety margin (500 buffer)
const CIRCUIT_BREAKER_KEY = 'ai:quota:daily';

/**
 * Get current quota status from KV
 */
export async function getQuotaStatus(kv: KVNamespace): Promise<QuotaStatus> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const key = `${CIRCUIT_BREAKER_KEY}:${today}`;

  const data = await kv.get(key);
  const neuronsUsed = data ? parseFloat(data) : 0;

  // Also get inference count for monitoring
  const countData = await kv.get(`${key}:count`);
  const inferenceCount = countData ? parseInt(countData, 10) : 0;

  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);

  return {
    date: today,
    neuronsUsed,
    neuronsLimit: DAILY_NEURON_LIMIT,
    neuronsRemaining: Math.max(0, DAILY_NEURON_LIMIT - neuronsUsed),
    isExceeded: neuronsUsed >= DAILY_NEURON_LIMIT,
    resetAt: tomorrow.toISOString(),
    inferenceCount,
  };
}

/**
 * Increment quota counter with neuron cost
 * @param kv KV namespace
 * @param neurons Number of neurons to add (default: Mistral 7B cost)
 */
export async function incrementQuota(kv: KVNamespace, neurons: number = NEURON_COSTS['mistral-7b-instruct']): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const key = `${CIRCUIT_BREAKER_KEY}:${today}`;
  const countKey = `${key}:count`;

  // Get current neuron count
  const data = await kv.get(key);
  const currentNeurons = data ? parseFloat(data) : 0;
  const newNeurons = currentNeurons + neurons;

  // Get current inference count
  const countData = await kv.get(countKey);
  const currentCount = countData ? parseInt(countData, 10) : 0;
  const newCount = currentCount + 1;

  // Store with expiration at end of day (UTC)
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const expirationTtl = Math.floor((tomorrow.getTime() - Date.now()) / 1000);

  await Promise.all([
    kv.put(key, newNeurons.toFixed(2), { expirationTtl }),
    kv.put(countKey, newCount.toString(), { expirationTtl }),
  ]);
}

/**
 * Check if AI inference should be allowed (circuit breaker check)
 */
export async function canUseAI(kv: KVNamespace): Promise<{ allowed: boolean; status: QuotaStatus }> {
  const status = await getQuotaStatus(kv);
  return {
    allowed: !status.isExceeded,
    status,
  };
}

/**
 * Generate friendly fallback message when quota is exceeded
 */
export function getQuotaExceededMessage(query: string, topResults: Array<{ technology?: { name: string }; name?: string }>): string {
  if (topResults.length === 0) {
    return "I found relevant skills in the database, but I've reached my daily AI response limit (10,000 neurons). The system will reset at midnight UTC. You can still see the raw skill matches above.";
  }

  const skillNames = topResults.slice(0, 3).map((r) => r.technology?.name || r.name || 'Unknown').join(', ');

  return `I've found highly relevant skills matching your query: **${skillNames}**. However, I've reached my daily AI response limit (10,000 neurons/day). The system will reset at midnight UTC. In the meantime, you can review the detailed skill information provided above, including years of experience, proficiency levels, and specific outcomes.`;
}

/**
 * Manually sync quota from dashboard (admin function)
 * Use this to update the counter if dashboard shows different usage
 */
export async function syncQuotaFromDashboard(kv: KVNamespace, actualNeurons: number): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const key = `${CIRCUIT_BREAKER_KEY}:${today}`;

  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const expirationTtl = Math.floor((tomorrow.getTime() - Date.now()) / 1000);

  await kv.put(key, actualNeurons.toFixed(2), { expirationTtl });
}

/**
 * Admin function to manually reset quota (use sparingly)
 */
export async function resetQuota(kv: KVNamespace): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const key = `${CIRCUIT_BREAKER_KEY}:${today}`;
  const countKey = `${key}:count`;
  await Promise.all([
    kv.delete(key),
    kv.delete(countKey),
  ]);
}
