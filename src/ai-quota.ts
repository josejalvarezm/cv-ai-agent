/**
 * AI Quota Management & Circuit Breaker
 * 
 * Tracks daily AI model inference calls and implements circuit breaker pattern
 * to prevent quota exhaustion (10,000 neurons/day free tier)
 */

export interface QuotaStatus {
  date: string;
  count: number;
  limit: number;
  remaining: number;
  isExceeded: boolean;
  resetAt: string;
}

const DAILY_QUOTA_LIMIT = 9500; // Set slightly below 10k for safety margin
const CIRCUIT_BREAKER_KEY = 'ai:quota:daily';

/**
 * Get current quota status from KV
 */
export async function getQuotaStatus(kv: KVNamespace): Promise<QuotaStatus> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const key = `${CIRCUIT_BREAKER_KEY}:${today}`;
  
  const data = await kv.get(key);
  const count = data ? parseInt(data, 10) : 0;
  
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  
  return {
    date: today,
    count,
    limit: DAILY_QUOTA_LIMIT,
    remaining: Math.max(0, DAILY_QUOTA_LIMIT - count),
    isExceeded: count >= DAILY_QUOTA_LIMIT,
    resetAt: tomorrow.toISOString(),
  };
}

/**
 * Increment quota counter (call AFTER successful AI inference)
 */
export async function incrementQuota(kv: KVNamespace): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const key = `${CIRCUIT_BREAKER_KEY}:${today}`;
  
  // Get current count
  const data = await kv.get(key);
  const currentCount = data ? parseInt(data, 10) : 0;
  const newCount = currentCount + 1;
  
  // Store with expiration at end of day (UTC)
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const expirationTtl = Math.floor((tomorrow.getTime() - Date.now()) / 1000);
  
  await kv.put(key, newCount.toString(), { expirationTtl });
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
export function getQuotaExceededMessage(query: string, topResults: any[]): string {
  if (topResults.length === 0) {
    return "I found relevant skills in the database, but I've reached my daily AI response limit. The system will reset at midnight UTC. You can still see the raw skill matches above.";
  }
  
  const topSkill = topResults[0];
  const skillNames = topResults.slice(0, 3).map((r: any) => r.technology?.name || r.name).join(', ');
  
  return `I've found highly relevant skills matching your query: ${skillNames}. However, I've reached my daily AI response limit (10,000 inferences). The system will reset at midnight UTC. In the meantime, you can review the detailed skill information provided above, including years of experience, proficiency levels, and specific outcomes.`;
}

/**
 * Admin function to manually reset quota (use sparingly)
 */
export async function resetQuota(kv: KVNamespace): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const key = `${CIRCUIT_BREAKER_KEY}:${today}`;
  await kv.delete(key);
}
