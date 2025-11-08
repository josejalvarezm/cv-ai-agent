/**
 * Health check endpoint handler
 *
 * Phase 1-3 Migration: Uses segregated Env, ServiceContainer, typed errors, structured logging
 */

import { createServiceContainer } from '../services/container';
import { getLogger, createContext, Timer } from '../utils/logger';
import { errorToResponse } from '../types/errors';
import { type FullEnv } from '../types/env';
import { isWithinBusinessHours } from '../input-validation';
import { getQuotaStatus } from '../ai-quota';

export async function handleHealth(env: FullEnv): Promise<Response> {
  // ============================================================
  // PHASE 3: REQUEST CONTEXT & LOGGING
  // ============================================================
  const requestId = crypto.randomUUID();
  const logger = getLogger();
  const timer = new Timer();

  const context = createContext(requestId, { handler: 'handleHealth' });

  try {
    logger.apiRequest('GET', '/health', context);

    // ============================================================
    // PHASE 1: SERVICE CONTAINER (all services initialized here)
    // ============================================================
    const services = createServiceContainer(env);

    // ============================================================
    // EXECUTE HEALTH CHECKS
    // ============================================================
    // Check D1 connection
    const dbCheck = await services.d1Repository.testConnection();

    // Get skill count (uses UnifiedSkillRepository fallback)
    let skillCount = 0;
    try {
      const skills = await services.skillRepository.getAll(1000);
      skillCount = skills.length;
    } catch {
      logger.service('Failed to get skill count, setting to 0', context);
      skillCount = 0;
    }

    // Get last index metadata
    const lastIndex = await services.d1Repository.getLastIndexMetadata();

    // Get AI quota status
    const quotaStatus = await getQuotaStatus(env.KV);

    // Get business hours status
    const businessHours = isWithinBusinessHours();

    // ============================================================
    // PHASE 3: LOG RESPONSE
    // ============================================================
    logger.apiResponse('GET', '/health', 200, timer.duration(), context);

    // ============================================================
    // RETURN RESPONSE
    // ============================================================
    return new Response(
      JSON.stringify({
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
        requestId,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    // ============================================================
    // PHASE 3: STRUCTURED ERROR HANDLING & LOGGING
    // ============================================================
    logger.error('Health check failed', error, context);
    return errorToResponse(error);
  }
}
