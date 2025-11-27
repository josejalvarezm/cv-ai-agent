/**
 * Authentication middleware
 * Handles JWT and Turnstile token validation
 */

import { verifyJWT } from '../jwt';
import { validateTurnstileToken } from '../utils';
import { jsonResponseWithCORS } from './cors';

interface Env {
  JWT_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
}

export interface AuthResult {
  authorized: boolean;
  response?: Response;
  sessionId?: string;
}

/**
 * Verify JWT or Turnstile token for authentication
 * Returns { authorized: true } if valid, or { authorized: false, response } with error response
 */
export async function verifyAuth(request: Request, env: Env): Promise<AuthResult> {
  // Check for JWT in Authorization header first
  const authHeader = request.headers.get('Authorization');
  const hasJWT = authHeader && authHeader.startsWith('Bearer ');
  
  if (hasJWT && env.JWT_SECRET) {
    // Verify JWT
    const token = authHeader!.substring(7); // Remove 'Bearer ' prefix
    const payload = await verifyJWT(token, env.JWT_SECRET);
    
    if (!payload) {
      return {
        authorized: false,
        response: jsonResponseWithCORS({
          error: 'Unauthorized',
          message: 'Invalid or expired session token. Please refresh the page.',
        }, 401),
      };
    }
    
    console.log(`Query authorized with JWT session: ${payload.sessionId}`);
    return { authorized: true, sessionId: payload.sessionId };
  }
  
  // Fall back to Turnstile token validation (backward compatibility)
  const turnstileToken = request.headers.get('X-Turnstile-Token');
  
  if (env.TURNSTILE_SECRET_KEY) {
    if (!turnstileToken) {
      return {
        authorized: false,
        response: jsonResponseWithCORS({
          error: 'Forbidden',
          message: 'Turnstile verification required. Please complete the human verification.',
        }, 403),
      };
    }

    // Validate token
    const clientIp = request.headers.get('CF-Connecting-IP') || undefined;
    const validation = await validateTurnstileToken(turnstileToken, env.TURNSTILE_SECRET_KEY, clientIp);
    
    if (!validation.success) {
      return {
        authorized: false,
        response: jsonResponseWithCORS({
          error: 'Forbidden',
          message: 'Turnstile verification failed. Please refresh and try again.',
          details: validation.error,
        }, 403),
      };
    }
    
    console.log('Query authorized with Turnstile token');
  }
  
  return { authorized: true };
}
