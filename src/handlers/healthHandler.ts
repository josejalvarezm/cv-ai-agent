/**
 * Health check endpoint handler
 */

import { getQuotaStatus } from '../ai-quota';
import { isWithinBusinessHours } from '../input-validation';
import { D1Repository } from '../repositories/d1Repository';

interface Env {
  DB: D1Database;
  KV: KVNamespace;
}

export async function handleHealth(env: Env): Promise<Response> {
  const d1Repo = new D1Repository(env.DB);
  
  try {
    // Check D1 connection
    const dbCheck = await d1Repo.testConnection();
    
    // Get skill count (try skills first, fall back to technology)
    let skillCount = 0;
    try {
      skillCount = await d1Repo.getSkillCount();
    } catch {
      try {
        skillCount = await d1Repo.getTechnologyCount();
      } catch {
        skillCount = 0;
      }
    }
    
    // Get last index version
    const lastIndex = await d1Repo.getLastIndexMetadata();
    
    // Get AI quota status
    const quotaStatus = await getQuotaStatus(env.KV);
    
    // Get business hours status
    const businessHours = isWithinBusinessHours();
    
    return new Response(JSON.stringify({
      status: 'healthy',
      database: dbCheck ? 'connected' : 'error',
      total_skills: skillCount || 0,
      last_index: lastIndex || null,
      ai_quota: quotaStatus,
      business_hours: {
        isWithinHours: businessHours.isWithinHours,
        timezone: businessHours.timezone,
        hours: '08:00-20:00 Mon-Fri UK (GMT/BST)',
      },
      timestamp: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      status: 'unhealthy',
      error: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
