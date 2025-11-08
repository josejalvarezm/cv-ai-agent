/**
 * AI quota management endpoint handlers
 *
 * Phase 1-3 Migration: Uses segregated Env, ServiceContainer, typed errors, structured logging
 */

import { createServiceContainer } from '../services/container';
import { getLogger, createContext, Timer } from '../utils/logger';
import { errorToResponse, ValidationError, AuthenticationError } from '../types/errors';
import { type FullEnv } from '../types/env';
import { getQuotaStatus, resetQuota, syncQuotaFromDashboard } from '../ai-quota';
import { CORS_CONFIG } from '../config';

const corsHeaders = {
  'Access-Control-Allow-Origin': CORS_CONFIG.ALLOWED_ORIGINS,
  'Access-Control-Allow-Methods': CORS_CONFIG.ALLOWED_METHODS,
  'Access-Control-Allow-Headers': CORS_CONFIG.ALLOWED_HEADERS,
};

/**
 * GET /quota - Get current AI quota status
 */
export async function handleQuotaStatus(env: FullEnv): Promise<Response> {
  const requestId = crypto.randomUUID();
  const logger = getLogger();
  const timer = new Timer();

  const context = createContext(requestId, { handler: 'handleQuotaStatus' });

  try {
    logger.apiRequest('GET', '/quota', context);

    // Create services (even though we don't use them here, for consistency)
    createServiceContainer(env);

    const quotaStatus = await getQuotaStatus(env.KV);

    logger.apiResponse('GET', '/quota', 200, timer.duration(), context);

    return new Response(JSON.stringify(quotaStatus), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error('Quota status request failed', error, context);
    return errorToResponse(error);
  }
}

/**
 * GET /admin/quota - Admin endpoint with authentication
 */
export async function handleAdminQuota(request: Request, env: FullEnv): Promise<Response> {
  const requestId = crypto.randomUUID();
  const logger = getLogger();
  const timer = new Timer();

  const context = createContext(requestId, { handler: 'handleAdminQuota' });

  try {
    logger.apiRequest('GET', '/admin/quota', context);

    // ============================================================
    // PHASE 3: AUTHENTICATION WITH TYPED ERRORS
    // ============================================================
    const authHeader = request.headers.get('Authorization');
    if (env.JWT_SECRET) {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.apiError('Admin quota: missing authorization', context);
        throw new AuthenticationError('Bearer token required');
      }
      const token = authHeader.substring(7);
      if (token !== env.JWT_SECRET) {
        logger.apiError('Admin quota: invalid token', context);
        throw new AuthenticationError('Invalid token');
      }
    }

    createServiceContainer(env);
    const quota = await getQuotaStatus(env.KV);

    logger.apiResponse('GET', '/admin/quota', 200, timer.duration(), context);

    return new Response(JSON.stringify({ success: true, quota }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error('Admin quota request failed', error, context);
    return errorToResponse(error);
  }
}

/**
 * POST /quota/reset - Reset quota manually
 */
export async function handleQuotaReset(env: FullEnv): Promise<Response> {
  const requestId = crypto.randomUUID();
  const logger = getLogger();
  const timer = new Timer();

  const context = createContext(requestId, { handler: 'handleQuotaReset' });

  try {
    logger.apiRequest('POST', '/quota/reset', context);

    createServiceContainer(env);
    await resetQuota(env.KV);
    const newStatus = await getQuotaStatus(env.KV);

    logger.apiResponse('POST', '/quota/reset', 200, timer.duration(), context);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Quota reset successfully',
        status: newStatus,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.error('Quota reset failed', error, context);
    return errorToResponse(error);
  }
}

/**
 * POST /quota/sync - Sync quota from dashboard
 * Usage: POST /quota/sync with body: { "neurons": 137.42 }
 */
export async function handleQuotaSync(request: Request, env: FullEnv): Promise<Response> {
  const requestId = crypto.randomUUID();
  const logger = getLogger();
  const timer = new Timer();

  const context = createContext(requestId, { handler: 'handleQuotaSync' });

  try {
    logger.apiRequest('POST', '/quota/sync', context);

    // ============================================================
    // PHASE 3: INPUT VALIDATION WITH TYPED ERRORS
    // ============================================================
    const body = (await request.json()) as any;
    const neurons = parseFloat(body.neurons);

    if (isNaN(neurons) || neurons < 0) {
      logger.apiError('Quota sync: invalid neurons value', context);
      throw new ValidationError('Neurons must be a positive number');
    }

    createServiceContainer(env);
    await syncQuotaFromDashboard(env.KV, neurons);
    const newStatus = await getQuotaStatus(env.KV);

    logger.apiResponse('POST', '/quota/sync', 200, timer.duration(), context);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Quota synced successfully. Updated to ${neurons} neurons.`,
        status: newStatus,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.error('Quota sync failed', error, context);
    return errorToResponse(error);
  }
}
