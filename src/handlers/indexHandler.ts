/**
 * Indexing endpoint handler
 * POST /index - Index skills/technology into Vectorize, KV, and D1
 *
 * Phase 1-3 Migration: Uses segregated Env, ServiceContainer, IndexingService, typed errors, structured logging
 */

import { createServiceContainer } from '../services/container';
import { getLogger, createContext, Timer } from '../utils/logger';
import { errorToResponse, ValidationError, ConflictError } from '../types/errors';
import { type FullEnv } from '../types/env';

/**
 * POST /index - Index all skills/technology into vector stores
 * Supports batched indexing with checkpoint/resume capability
 */
export async function handleIndex(request: Request, env: FullEnv): Promise<Response> {
  // ============================================================
  // PHASE 3: REQUEST CONTEXT & LOGGING
  // ============================================================
  const requestId = crypto.randomUUID();
  const logger = getLogger();
  const timer = new Timer();

  const context = createContext(requestId, { handler: 'handleIndex' });

  const lockAcquired = { value: false, itemType: 'skills' as string };

  try {
    logger.apiRequest('POST', '/index', context);

    // ============================================================
    // PHASE 1: SERVICE CONTAINER
    // ============================================================
    const services = createServiceContainer(env);

    // ============================================================
    // PHASE 3: INPUT VALIDATION WITH TYPED ERRORS
    // ============================================================
    // Parse optional body for batched indexing
    let params: { type?: string; batchSize?: number; offset?: number } = {};
    try {
      if (request.headers.get('content-type')?.includes('application/json')) {
        params = await request.json();
      }
    } catch {
      params = {};
    }

    const itemType = params.type === 'technology' ? 'technology' : 'skills';
    lockAcquired.itemType = itemType;

    if (!['technology', 'skills'].includes(itemType)) {
      logger.apiError('Index: invalid type parameter', context);
      throw new ValidationError('Type must be "technology" or "skills"');
    }

    // ============================================================
    // PHASE 2: USE INDEXING SERVICE FOR ORCHESTRATION
    // ============================================================
    logger.service(`Starting indexing process for ${itemType}`, context);

    const indexResult = await services.indexingService.execute({
      type: itemType,
      batchSize: params.batchSize,
      offset: params.offset,
    });

    // Mark that lock was acquired (indexingService acquires it internally)
    lockAcquired.value = true;

    logger.service(
      `Index completed: ${indexResult.processed} items processed, version ${indexResult.version}`,
      context
    );

    logger.apiResponse('POST', '/index', 200, timer.duration(), context);

    return new Response(
      JSON.stringify({
        success: true,
        version: indexResult.version,
        processed: indexResult.processed,
        message: indexResult.message,
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
    // Special handling for lock conflicts
    if (error instanceof ConflictError) {
      logger.apiError('Index already in progress', context);
      return new Response(
        JSON.stringify({
          error: 'Indexing already in progress',
          message: 'Another indexing operation is currently running',
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    logger.error('Index handler failed', error, context);
    return errorToResponse(error);
  }
}
