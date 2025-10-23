/**
 * CORS middleware
 * Handles Cross-Origin Resource Sharing headers and preflight requests
 * 
 * This middleware enables the API to be called from web browsers
 * across different domains (e.g., from your portfolio site).
 */

import { CORS_CONFIG } from '../config';

/**
 * Standard CORS headers for all responses
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': CORS_CONFIG.ALLOWED_ORIGINS,
  'Access-Control-Allow-Methods': CORS_CONFIG.ALLOWED_METHODS,
  'Access-Control-Allow-Headers': CORS_CONFIG.ALLOWED_HEADERS,
};

/**
 * Handle CORS preflight OPTIONS request
 * 
 * Browsers send OPTIONS requests before actual requests to check
 * if the cross-origin request is allowed.
 * 
 * @returns Empty response with CORS headers
 */
export function handleCORSPreflight(): Response {
  return new Response(null, { headers: corsHeaders });
}

/**
 * Add CORS headers to an existing response
 * 
 * Use this to wrap any response before returning to client.
 * 
 * @param response - Response to add headers to
 * @returns Same response with CORS headers added
 * 
 * @example
 * return addCORSHeaders(await handleQuery(request, env));
 */
export function addCORSHeaders(response: Response): Response {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

/**
 * Create a JSON response with CORS headers
 * 
 * Convenience function to create JSON responses that are
 * automatically CORS-enabled.
 * 
 * @param data - Data to serialize as JSON
 * @param status - HTTP status code (default: 200)
 * @returns Response with JSON body and CORS headers
 * 
 * @example
 * return jsonResponseWithCORS({ error: 'Not found' }, 404);
 */
export function jsonResponseWithCORS(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
