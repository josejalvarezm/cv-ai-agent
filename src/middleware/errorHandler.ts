/**
 * Error Handler Middleware
 * Centralizes error handling with consistent error responses
 */

import { jsonResponseWithCORS } from './cors';

/**
 * Handle Worker errors with consistent error responses
 * 
 * @param error - Error object
 * @returns JSON error response with CORS headers
 */
export function handleWorkerError(error: any): Response {
  console.error('Worker error:', error);
  
  return jsonResponseWithCORS({
    error: 'Internal Server Error',
    message: error.message || 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  }, 500);
}

/**
 * Handle 404 Not Found errors
 * 
 * @returns JSON 404 response with CORS headers
 */
export function handle404(): Response {
  return jsonResponseWithCORS({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    availableEndpoints: [
      'GET  /health - Health check',
      'GET  /query?q=<query> - Semantic search',
      'POST /index - Index vectors (requires auth)',
      'POST /session - Create session (Turnstile)',
    ],
  }, 404);
}
