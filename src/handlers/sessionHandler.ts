/**
 * Session management endpoint handler
 * /session endpoint: Exchange Turnstile token for session JWT
 */

import { signJWT, generateSessionId, type JWTPayload } from '../jwt';
import { AUTH_CONFIG } from '../config';

interface Env {
  TURNSTILE_SECRET_KEY?: string;
  JWT_SECRET?: string;
}

/**
 * Validate Turnstile token with Cloudflare's API
 */
async function validateTurnstileToken(token: string, secret: string, remoteIp?: string): Promise<{ success: boolean; error?: string }> {
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

  const data = await response.json() as any;
  return {
    success: data.success || false,
    error: data['error-codes']?.join(', '),
  };
}

/**
 * POST /session - Exchange Turnstile token for JWT
 */
export async function handleSession(request: Request, env: Env): Promise<Response> {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Turnstile-Token',
  };

  try {
    // Get Turnstile token from header
    const turnstileToken = request.headers.get('X-Turnstile-Token');
    
    if (!turnstileToken) {
      return new Response(JSON.stringify({
        error: 'Forbidden',
        message: 'Turnstile token required',
      }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // Validate Turnstile token
    if (!env.TURNSTILE_SECRET_KEY) {
      return new Response(JSON.stringify({
        error: 'Server configuration error',
        message: 'Turnstile not configured',
      }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const clientIp = request.headers.get('CF-Connecting-IP') || undefined;
    const validation = await validateTurnstileToken(turnstileToken, env.TURNSTILE_SECRET_KEY, clientIp);
    
    if (!validation.success) {
      return new Response(JSON.stringify({
        error: 'Forbidden',
        message: 'Turnstile verification failed. Please refresh and try again.',
        details: validation.error,
      }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // Issue JWT
    if (!env.JWT_SECRET) {
      return new Response(JSON.stringify({
        error: 'Server configuration error',
        message: 'JWT not configured',
      }), {
        status: 500,
        headers: corsHeaders,
      });
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

    console.log(`Session created: ${sessionId}, expires in 15 minutes`);

    return new Response(JSON.stringify({
      success: true,
      token: jwt,
      expiresIn: AUTH_CONFIG.JWT_EXPIRY,
      expiresAt: new Date((now + AUTH_CONFIG.JWT_EXPIRY) * 1000).toISOString(),
    }), {
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('Session creation error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: 'Failed to create session',
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
