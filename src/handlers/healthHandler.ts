/**
 * Health check endpoint handler
 * 
 * Provides basic health status and system information.
 * Use this to verify the Worker is running and database is accessible.
 */

import type { HealthEnv } from '../types';

/**
 * Handle health check requests
 * 
 * Returns system status including:
 * - Worker status (always 'healthy' if responding)
 * - Database connection status
 * - Skill count (from database)
 * - Timestamp
 * 
 * @param env - Worker environment bindings (only needs DB access)
 * @returns JSON response with health status
 * 
 * @example
 * curl https://your-worker.workers.dev/health
 * // Returns:
 * // {
 * //   "status": "healthy",
 * //   "database": "connected",
 * //   "total_skills": 15,
 * //   "timestamp": "2025-10-23T16:00:00.000Z"
 * // }
 */
export async function handleHealth(env: HealthEnv): Promise<Response> {
  try {
    // Check D1 connection by querying skill count
    let skillCount = 0;
    let dbStatus = 'connected';
    
    try {
      const result = await env.DB.prepare('SELECT COUNT(*) as count FROM technology').first<{ count: number }>();
      skillCount = result?.count || 0;
    } catch (dbError) {
      console.error('Database check failed:', dbError);
      dbStatus = 'error';
    }
    
    return new Response(JSON.stringify({
      status: 'healthy',
      database: dbStatus,
      total_skills: skillCount,
      timestamp: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
