/**
 * Utility functions for index.ts
 */

// Skill record from D1
export interface Skill {
  id: number;
  name: string;
  mastery: string;
  years: number;
  category?: string;
  description?: string;
  last_used?: string;
  action?: string;              // What was done with this skill
  effect?: string;              // Operational/technical effect
  outcome?: string;             // Business outcome or measurable result
  related_project?: string;     // Optional project/context anchor
}

interface Env {
  DB: D1Database;
  KV: KVNamespace;
}

/**
 * Acquire a KV lock for indexing to prevent concurrent runs
 */
export async function acquireIndexLock(itemType: string, env: Env, ttlSeconds = 60): Promise<boolean> {
  const lockKey = `index:lock:${itemType}`;
  const existing = await env.KV.get(lockKey);
  if (existing) return false; // lock already held
  await env.KV.put(lockKey, new Date().toISOString(), { expirationTtl: ttlSeconds });
  return true;
}

/**
 * Release a KV lock for indexing
 */
export async function releaseIndexLock(itemType: string, env: Env): Promise<void> {
  const lockKey = `index:lock:${itemType}`;
  await env.KV.delete(lockKey);
}

/**
 * Fetch canonical skill-like record by id. Tries `skills` first, then `technology`.
 */
export async function fetchCanonicalById(id: number, env: Env): Promise<Skill | null> {
  try {
    const s = await env.DB.prepare('SELECT * FROM skills WHERE id = ?').bind(id).first<Skill>();
    if (s) return s;
  } catch (_) {
    // ignore
  }

  try {
    const t = await env.DB.prepare('SELECT id, name, experience as description, experience_years as years FROM technology WHERE id = ?').bind(id).first<any>();
    if (t) {
      const mapped: Skill = {
        id: t.id,
        name: t.name,
        mastery: typeof t.experience === 'string' ? t.experience : '',
        years: t.years || 0,
        category: undefined,
        description: t.description || t.experience || undefined,
        action: t.action,
        effect: t.effect,
        outcome: t.outcome,
        related_project: t.related_project,
      };
      return mapped;
    }
  } catch (_) {
    // ignore
  }

  return null;
}

/**
 * Create skill text for embedding
 */
export function createSkillText(skill: Skill): string {
  return `${skill.name} with ${skill.mastery} mastery level and ${skill.years} years of experience${skill.category ? ` in ${skill.category}` : ''}`;
}

/**
 * Validate Turnstile token with Cloudflare's siteverify API
 */
export async function validateTurnstileToken(
  token: string,
  secretKey: string,
  clientIp?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (clientIp) {
      formData.append('remoteip', clientIp);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json() as { success: boolean; 'error-codes'?: string[] };
    
    if (!result.success) {
      console.warn('Turnstile validation failed:', result['error-codes']);
      return { success: false, error: result['error-codes']?.join(', ') || 'Validation failed' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Turnstile validation error:', error);
    return { success: false, error: error.message };
  }
}
