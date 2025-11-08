/**
 * Example Handler: Demonstrating Phase 1-3 Integration
 *
 * This handler shows the recommended pattern for all handlers after SOLID refactoring:
 * - Phase 1: Use segregated Env interface, ServiceContainer
 * - Phase 2: Leverage extracted services (QueryService, IndexingService)
 * - Phase 3: Use typed errors, structured logging, context tracking
 *
 * Copy this pattern to all handlers in src/handlers/
 */

import { createServiceContainer } from '../services/container';
import { getLogger, createContext, Timer } from '../utils/logger';
import { errorToResponse } from '../types/errors';
import { ValidationError, NotFoundError } from '../types/errors';
import { type FullEnv } from '../types/env';

/**
 * Example: Semantic Search Query Handler
 *
 * Pattern:
 * 1. Create request context for tracking
 * 2. Initialize logger and services
 * 3. Validate input with typed errors
 * 4. Execute business logic using services
 * 5. Track performance
 * 6. Return response or handle errors
 */
export async function handleSemanticSearch(
  request: Request,
  env: FullEnv
): Promise<Response> {
  // ============================================================
  // PHASE 3: REQUEST CONTEXT & LOGGING
  // ============================================================
  // Generate unique request ID for distributed tracing
  const requestId = crypto.randomUUID();
  const logger = getLogger();
  const timer = new Timer();

  // Create context with all tracking info
  const context = createContext(requestId, {
    handler: 'handleSemanticSearch',
    userId: extractUserIdFromRequest(request),
  });

  // Log incoming request
  try {
    logger.apiRequest('POST', '/search', context);

    // ============================================================
    // PHASE 1: SERVICE CONTAINER & SEGREGATED ENV
    // ============================================================
    // Handler only requires QueryEnv (ISP)
    // If this was an indexing handler, it would use IndexEnv instead
    const services = createServiceContainer(env);

    // ============================================================
    // PHASE 3: INPUT VALIDATION WITH TYPED ERRORS
    // ============================================================
    const url = new URL(request.url);
    const query = url.searchParams.get('q');

    if (!query || query.trim().length === 0) {
      // Typed error with automatic HTTP status (400)
      logger.apiError('Search validation failed: empty query', context);
      throw new ValidationError('Query parameter "q" is required');
    }

    // ============================================================
    // PHASE 2: USE EXTRACTED SERVICES
    // ============================================================
    // QueryService handles all semantic search orchestration
    // (embedding generation, vector search, caching, AI reply)
    const result = await services.queryService.execute(
      { query, topK: 5 },
      url.toString()
    );

    // ============================================================
    // PHASE 3: TRACK PERFORMANCE
    // ============================================================
    logger.apiResponse('POST', '/search', 200, timer.duration(), context);

    // ============================================================
    // RESPONSE
    // ============================================================
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // ============================================================
    // PHASE 3: STRUCTURED ERROR HANDLING & LOGGING
    // ============================================================
    // Log with full context
    logger.error('Search handler failed', error, context);

    // Return typed error response (correct HTTP status automatically)
    return errorToResponse(error);
  }
}

/**
 * Example: Batch Index Handler
 *
 * Demonstrates indexing-specific patterns with locking and conflict errors
 */
export async function handleBatchIndex(
  request: Request,
  env: FullEnv
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const logger = getLogger();
  const timer = new Timer();

  const context = createContext(requestId, {
    handler: 'handleBatchIndex',
  });

  try {
    logger.apiRequest('POST', '/index/batch', context);

    // PHASE 1: Service container + segregated env
    const services = createServiceContainer(env);

    // Parse request body
    const body = (await request.json()) as any;

    // PHASE 3: Validation with typed errors
    if (!body.type || !['skills', 'technology'].includes(body.type)) {
      logger.apiError('Index validation failed: invalid type', context);
      throw new ValidationError('Type must be "skills" or "technology"');
    }

    // PHASE 2: Use IndexingService
    // Service handles locking, batching, metadata, etc.
    const result = await services.indexingService.execute({
      type: body.type,
      batchSize: body.batchSize || 100,
    });

    logger.apiResponse('POST', '/index/batch', 200, timer.duration(), context);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // PHASE 3: Structured error logging and response
    logger.error('Index handler failed', error, context);
    return errorToResponse(error);
  }
}

/**
 * Example: Get Skill Handler
 *
 * Demonstrates repository access with proper error handling
 */
export async function handleGetSkill(
  request: Request,
  env: FullEnv
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const logger = getLogger();

  const context = createContext(requestId, {
    handler: 'handleGetSkill',
  });

  try {
    logger.apiRequest('GET', '/skills/:id', context);

    // PHASE 1: Services with segregated env
    const services = createServiceContainer(env);

    // Extract skill ID from URL
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();

    // PHASE 3: Validation
    if (!id || isNaN(Number(id))) {
      logger.apiError('Skill validation failed: invalid ID', context);
      throw new ValidationError('Skill ID must be a valid number');
    }

    const skillId = Number(id);

    // PHASE 2: Use repository from container
    const skill = await services.skillRepository.getById(skillId);

    // PHASE 3: Handle not found with typed error
    if (!skill) {
      logger.apiError(`Skill not found: ${skillId}`, context);
      throw new NotFoundError('Skill', skillId);
    }

    logger.apiResponse('GET', '/skills/:id', 200, 0, context);

    return new Response(JSON.stringify(skill), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error('Get skill handler failed', error, context);
    return errorToResponse(error);
  }
}

/**
 * Example: Health Check Handler
 *
 * Demonstrates simple handler with logging
 */
export async function handleHealthCheck(
  request: Request,
  env: FullEnv
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const logger = getLogger();
  const timer = new Timer();

  const context = createContext(requestId, { handler: 'handleHealthCheck' });

  try {
    logger.apiRequest('GET', '/health', context);

    // PHASE 1: Services
    const services = createServiceContainer(env);

    // Check if vector store is healthy
    const isHealthy = await services.vectorStore.isHealthy();

    // PHASE 3: Log performance
    logger.apiResponse('GET', '/health', 200, timer.duration(), context);

    return new Response(
      JSON.stringify({
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        requestId,
      }),
      {
        status: isHealthy ? 200 : 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.error('Health check failed', error, context);
    return errorToResponse(error);
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Extract user ID from request (e.g., from JWT in Authorization header)
 * Replace with actual authentication logic
 */
function extractUserIdFromRequest(request: Request): string | undefined {
  const _authHeader = request.headers.get('Authorization');
  // TODO: Parse JWT and extract user ID
  // For now, return undefined
  return undefined;
}

// ============================================================
// PATTERN SUMMARY
// ============================================================

/**
 * STANDARD HANDLER PATTERN (All 3 Phases)
 *
 * 1. CREATE CONTEXT
 *    const requestId = crypto.randomUUID();
 *    const logger = getLogger();
 *    const context = createContext(requestId, { handler: 'name' });
 *
 * 2. LOG REQUEST
 *    logger.apiRequest('METHOD', '/path', context);
 *
 * 3. INITIALIZE SERVICES
 *    const services = createServiceContainer(env);
 *
 * 4. VALIDATE INPUT
 *    if (!valid) throw new ValidationError('message');
 *
 * 5. EXECUTE BUSINESS LOGIC
 *    const result = await services.service.method(...);
 *
 * 6. LOG RESPONSE
 *    logger.apiResponse('METHOD', '/path', 200, duration, context);
 *
 * 7. RETURN RESPONSE
 *    return new Response(JSON.stringify(result), { status: 200, ... });
 *
 * 8. CATCH ERRORS
 *    } catch (error) {
 *      logger.error('description', error, context);
 *      return errorToResponse(error);
 *    }
 *
 * KEY POINTS:
 * - Use segregated Env interface (ISP) - handlers only see what they need
 * - Use ServiceContainer for all services (DIP) - no manual instantiation
 * - Use typed errors (ApplicationError hierarchy) - correct HTTP codes
 * - Use logger with context (structured logging) - track requests
 * - Use context objects (distributed tracing) - correlate operations
 */
