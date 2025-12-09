/**
 * Utility functions
 */

import { D1Repository } from './repositories/d1Repository';
import { KVRepository } from './repositories/kvRepository';

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

/**
 * Acquire a KV lock for indexing to prevent concurrent runs
 */
export async function acquireIndexLock(itemType: string, kvRepo: KVRepository, ttlSeconds = 60): Promise<boolean> {
  const lockKey = `index:lock:${itemType}`;
  return await kvRepo.acquireLock(lockKey, ttlSeconds);
}

/**
 * Release a KV lock for indexing
 */
export async function releaseIndexLock(itemType: string, kvRepo: KVRepository): Promise<void> {
  const lockKey = `index:lock:${itemType}`;
  await kvRepo.releaseLock(lockKey);
}

/**
 * Fetch canonical skill-like record by id using D1Repository
 */
export async function fetchCanonicalById(id: number, d1Repo: D1Repository): Promise<Skill | null> {
  // Try skills first
  const skill = await d1Repo.getSkillById(id);
  if (skill) return skill;

  // Fall back to technology
  return await d1Repo.getTechnologyById(id);
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
  } catch (error) {
    console.error('Turnstile validation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}
