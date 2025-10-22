/**
 * CORS middleware
 * Handles Cross-Origin Resource Sharing headers and preflight requests
 */

import { CORS_CONFIG } from '../config';

export const corsHeaders = {
  'Access-Control-Allow-Origin': CORS_CONFIG.ALLOWED_ORIGINS,
  'Access-Control-Allow-Methods': CORS_CONFIG.ALLOWED_METHODS,
  'Access-Control-Allow-Headers': CORS_CONFIG.ALLOWED_HEADERS,
};

/**
 * Handle CORS preflight OPTIONS request
 */
export function handleCORSPreflight(): Response {
  return new Response(null, { headers: corsHeaders });
}

/**
 * Add CORS headers to a response
 */
export function addCORSHeaders(response: Response): Response {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponseWithCORS(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
