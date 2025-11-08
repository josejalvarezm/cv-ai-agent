/**
 * Session management endpoint handler
 * /session endpoint: Exchange Turnstile token for session JWT
 *
 * Phase 1-3 Migration: Uses segregated Env, ServiceContainer, typed errors, structured logging
 */

import { createServiceContainer } from '../services/container';
import { getLogger, createContext, Timer } from '../utils/logger';
import { errorToResponse, AuthenticationError, ServiceError } from '../types/errors';
import { type FullEnv } from '../types/env';
import { signJWT, generateSessionId, type JWTPayload } from '../jwt';
import { AUTH_CONFIG } from '../config';

/**
 * Validate Turnstile token with Cloudflare's API
 */
async function validateTurnstileToken(
  token: string,
  secret: string,
  remoteIp?: string
): Promise<{ success: boolean; error?: string }> {
  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  if (remoteIp) {
    formData.append('remoteip', remoteIp);
  }

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
  });

  const data = (await response.json()) as any;
  return {
    success: data.success || false,
    error: data['error-codes']?.join(', '),
  };
}

/**
 * POST /session - Exchange Turnstile token for JWT
 */
export async function handleSession(request: Request, env: FullEnv): Promise<Response> {
  // ============================================================
  // PHASE 3: REQUEST CONTEXT & LOGGING
  // ============================================================
  const requestId = crypto.randomUUID();
  const logger = getLogger();
  const timer = new Timer();

  const context = createContext(requestId, { handler: 'handleSession' });

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Turnstile-Token',
  };

  try {
    logger.apiRequest('POST', '/session', context);

    // ============================================================
    // PHASE 1: SERVICE CONTAINER
    // ============================================================
    createServiceContainer(env);

    // ============================================================
    // PHASE 3: INPUT VALIDATION WITH TYPED ERRORS
    // ============================================================
    // Get Turnstile token from header
    const turnstileToken = request.headers.get('X-Turnstile-Token');

    if (!turnstileToken) {
      logger.apiError('Session: missing Turnstile token', context);
      throw new AuthenticationError('Turnstile token required');
    }

    // Validate Turnstile is configured
    if (!env.TURNSTILE_SECRET_KEY) {
      logger.apiError('Session: Turnstile not configured', context);
      throw new ServiceError('Turnstile not configured');
    }

    // ============================================================
    // VALIDATE TURNSTILE TOKEN
    // ============================================================
    const clientIp = request.headers.get('CF-Connecting-IP') || undefined;
    const validation = await validateTurnstileToken(
      turnstileToken,
      env.TURNSTILE_SECRET_KEY,
      clientIp
    );

    if (!validation.success) {
      logger.apiError(
        'Session: Turnstile verification failed',
        context,
      );
      throw new AuthenticationError(
        `Turnstile verification failed: ${validation.error || 'unknown error'}`
      );
    }

    // ============================================================
    // ISSUE JWT
    // ============================================================
    if (!env.JWT_SECRET) {
      logger.apiError('Session: JWT not configured', context);
      throw new ServiceError('JWT not configured');
    }

    const now = Math.floor(Date.now() / 1000);
    const sessionId = generateSessionId();
    const payload: JWTPayload = {
      sub: 'cv-chat-session',
      iat: now,
      exp: now + AUTH_CONFIG.JWT_EXPIRY,
      sessionId,
    };

    const jwt = await signJWT(payload, env.JWT_SECRET);

    logger.service(`Session created: ${sessionId}, expires in 15 minutes`, context);
    logger.apiResponse('POST', '/session', 200, timer.duration(), context);

    // ============================================================
    // RETURN RESPONSE
    // ============================================================
    return new Response(
      JSON.stringify({
        success: true,
        token: jwt,
        expiresIn: AUTH_CONFIG.JWT_EXPIRY,
        expiresAt: new Date((now + AUTH_CONFIG.JWT_EXPIRY) * 1000).toISOString(),
        requestId,
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    // ============================================================
    // PHASE 3: STRUCTURED ERROR HANDLING & LOGGING
    // ============================================================
    logger.error('Session creation failed', error, context);
    return errorToResponse(error);
  }
}
