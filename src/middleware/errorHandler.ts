/**
 * Error handling middleware
 * Standardized error responses
 */

import { jsonResponseWithCORS } from './cors';

/**
 * Handle worker errors with standardized response format
 */
export function handleWorkerError(error: any): Response {
  console.error('Worker error:', error);
  
  return jsonResponseWithCORS({
    error: 'Internal server error',
    message: error.message || 'An unexpected error occurred',
  }, 500);
}

/**
 * Create a 404 Not Found response with available endpoints
 */
export function handle404(): Response {
  return jsonResponseWithCORS({
    error: 'Not found',
    available_endpoints: [
      'GET / - Health check',
      'GET /health - Health check',
      'POST /session - Create session with Turnstile token',
      'POST /index - Index all skills into Vectorize',
      'GET /query?q=<query> - Semantic search',
      'POST /query - Semantic search (body as query)',
      'GET /quota - AI quota status',
    ],
  }, 404);
}
