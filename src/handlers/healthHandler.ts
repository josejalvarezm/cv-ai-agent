/**
 * Health check endpoint handler
 */

import { getQuotaStatus } from '../ai-quota';
import { isWithinBusinessHours } from '../input-validation';

interface Env {
  DB: D1Database;
  KV: KVNamespace;
}

export async function handleHealth(env: Env): Promise<Response> {
  try {
    // Check D1 connection
    const dbCheck = await env.DB.prepare('SELECT 1').first();
    
    // Get skill count
    let skillCount: { count: number } | null = null;
    try {
      skillCount = await env.DB.prepare('SELECT COUNT(*) as count FROM skills').first<{ count: number }>();
    } catch (e) {
      // skills table may not exist in this DB; fall back to technology count
      try {
        skillCount = await env.DB.prepare('SELECT COUNT(*) as count FROM technology').first<{ count: number }>();
      } catch {
        skillCount = { count: 0 };
      }
    }
    
    // Get last index version
    const lastIndex = await env.DB.prepare(
      'SELECT version, indexed_at, total_skills, status FROM index_metadata ORDER BY version DESC LIMIT 1'
    ).first();
    
    // Get AI quota status
    const quotaStatus = await getQuotaStatus(env.KV);
    
    // Get business hours status
    const businessHours = isWithinBusinessHours();
    
    return new Response(JSON.stringify({
      status: 'healthy',
      database: dbCheck ? 'connected' : 'error',
      total_skills: skillCount?.count || 0,
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
