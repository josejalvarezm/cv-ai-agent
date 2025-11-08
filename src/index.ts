/**
 * CV Assistant Worker
 *
 * A semantic search engine for CV skills using Cloudflare's edge stack:
 * - D1: Canonical SQL database for skills data
 * - Vectorize: Semantic vector index
 * - Workers AI: Embedding generation
 * - KV: Fallback vector storage
 * - Cache API: Query result caching
 *
 * This is a demonstration project showing how to build an AI-powered CV assistant
 * at the edge with zero-cost infrastructure.
 */

import { handleD1VectorQuery } from './query-d1-vectors';
import { ENDPOINTS } from './config';
import { handleHealth } from './handlers/healthHandler';
import { handleSession } from './handlers/sessionHandler';
import { handleIndex } from './handlers/indexHandler';
import { handleCORSPreflight, addCORSHeaders, handleWorkerError, handle404 } from './middleware';
import { checkRateLimit } from './middleware/rateLimiter';
import type { WorkerEnv } from './types';

/**
 * Main Worker entry point
 */
export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORSPreflight();
    }
    
    try {
      // Route handling
      if (path === ENDPOINTS.SESSION && request.method === 'POST') {
        return addCORSHeaders(await handleSession(request, env));
      }
      
      if (path === ENDPOINTS.INDEX && request.method === 'POST') {
        return addCORSHeaders(await handleIndex(request, env));
      }
      
      if (path === ENDPOINTS.QUERY && (request.method === 'GET' || request.method === 'POST')) {
        // Rate limiting check (if KV is available)
        if (env.KV) {
          const rateLimitResult = await checkRateLimit(request, env.KV);
          if (!rateLimitResult.allowed) {
            return addCORSHeaders(new Response(JSON.stringify({
              error: rateLimitResult.message,
              retryAfter: rateLimitResult.retryAfter,
            }), {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
              },
            }));
          }
        }

        // Use D1 vectors for all queries
        return addCORSHeaders(await handleD1VectorQuery(request, env));
      }
      
      if (path === ENDPOINTS.HEALTH || path === ENDPOINTS.ROOT) {
        return addCORSHeaders(await handleHealth(env));
      }
      
      // 404 for unknown routes
      return handle404();
      
    } catch (error: any) {
      return handleWorkerError(error);
    }
  },
};
