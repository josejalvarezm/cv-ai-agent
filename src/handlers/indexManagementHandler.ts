/**
 * Index management endpoint handlers
 * Utility endpoints for monitoring and controlling indexing operations
 *
 * Phase 1-3 Migration: Uses segregated Env, ServiceContainer, typed errors, structured logging
 */

import { createServiceContainer } from '../services/container';
import { getLogger, createContext, Timer } from '../utils/logger';
import { errorToResponse, ValidationError } from '../types/errors';
import { type FullEnv } from '../types/env';
import { handleIndex } from './indexHandler';
import { ENDPOINTS } from '../config';

/**
 * GET /index/progress - Get indexing progress from checkpoint
 */
export async function handleIndexProgress(request: Request, env: FullEnv): Promise<Response> {
  const requestId = crypto.randomUUID();
  const logger = getLogger();
  const timer = new Timer();

  const context = createContext(requestId, { handler: 'handleIndexProgress' });

  try {
    logger.apiRequest('GET', '/index/progress', context);

    const services = createServiceContainer(env);
    const url = new URL(request.url);
    const itemType = url.searchParams.get('type') || 'technology';

    // ============================================================
    // PHASE 3: INPUT VALIDATION
    // ============================================================
    if (!['technology', 'skills'].includes(itemType)) {
      logger.apiError('Index progress: invalid type', context);
      throw new ValidationError('Type must be "technology" or "skills"');
    }

    const checkpoint = await services.kvRepository.getIndexCheckpoint(itemType);

    logger.apiResponse('GET', '/index/progress', 200, timer.duration(), context);

    if (!checkpoint) {
      return new Response(JSON.stringify({ found: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(checkpoint), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error('Index progress request failed', error, context);
    return errorToResponse(error);
  }
}

/**
 * POST /index/resume - Resume indexing from checkpoint
 */
export async function handleIndexResume(request: Request, env: FullEnv): Promise<Response> {
  const requestId = crypto.randomUUID();
  const logger = getLogger();
  const timer = new Timer();

  const context = createContext(requestId, { handler: 'handleIndexResume' });

  try {
    logger.apiRequest('POST', '/index/resume', context);

    const services = createServiceContainer(env);
    const url = new URL(request.url);
    const bodyAny = (await request.json().catch(() => ({}))) as any;
    const itemType = bodyAny.type || 'technology';

    // ============================================================
    // PHASE 3: INPUT VALIDATION
    // ============================================================
    if (!['technology', 'skills'].includes(itemType)) {
      logger.apiError('Index resume: invalid type', context);
      throw new ValidationError('Type must be "technology" or "skills"');
    }

    const checkpoint = (await services.kvRepository.getIndexCheckpoint(itemType)) || { nextOffset: 0 };
    const batchSize = bodyAny.batchSize || 20;

    logger.service(`Resuming index from offset ${checkpoint.nextOffset} for ${itemType}`, context);

    // Trigger one batch by calling handleIndex directly
    const req = new Request(`${url.origin}${ENDPOINTS.INDEX}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: itemType,
        batchSize,
        offset: checkpoint.nextOffset || 0,
      }),
    });

    const res = await handleIndex(req, env);

    logger.apiResponse('POST', '/index/resume', res.status, timer.duration(), context);

    return new Response(JSON.stringify({ triggered: true, status: res.status }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error('Index resume request failed', error, context);
    return errorToResponse(error);
  }
}

/**
 * POST /index/stop - Stop indexing by updating checkpoint status
 */
export async function handleIndexStop(request: Request, env: FullEnv): Promise<Response> {
  const requestId = crypto.randomUUID();
  const logger = getLogger();
  const timer = new Timer();

  const context = createContext(requestId, { handler: 'handleIndexStop' });

  try {
    logger.apiRequest('POST', '/index/stop', context);

    const services = createServiceContainer(env);
    const bodyAny = (await request.json().catch(() => ({}))) as any;
    const itemType = bodyAny.type || 'technology';

    // ============================================================
    // PHASE 3: INPUT VALIDATION
    // ============================================================
    if (!['technology', 'skills'].includes(itemType)) {
      logger.apiError('Index stop: invalid type', context);
      throw new ValidationError('Type must be "technology" or "skills"');
    }

    const checkpoint = (await services.kvRepository.getIndexCheckpoint(itemType)) || { nextOffset: 0 };
    checkpoint.status = 'stopped';
    await services.kvRepository.setIndexCheckpoint(itemType, checkpoint);

    logger.service(`Stopped indexing for ${itemType}`, context);
    logger.apiResponse('POST', '/index/stop', 200, timer.duration(), context);

    return new Response(JSON.stringify({ stopped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error('Index stop request failed', error, context);
    return errorToResponse(error);
  }
}

/**
 * GET /ids - Get technology IDs for remote orchestration
 */
export async function handleIds(env: FullEnv): Promise<Response> {
  const requestId = crypto.randomUUID();
  const logger = getLogger();
  const timer = new Timer();

  const context = createContext(requestId, { handler: 'handleIds' });

  try {
    logger.apiRequest('GET', '/ids', context);

    const services = createServiceContainer(env);
    const ids = await services.d1Repository.getAllTechnologyIds();

    logger.apiResponse('GET', '/ids', 200, timer.duration(), context);

    return new Response(JSON.stringify({ ids }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error('Get IDs request failed', error, context);
    return errorToResponse(error);
  }
}

/**
 * GET /debug/vector - Debug endpoint to inspect raw vector data
 */
export async function handleDebugVector(env: FullEnv): Promise<Response> {
  const requestId = crypto.randomUUID();
  const logger = getLogger();
  const timer = new Timer();

  const context = createContext(requestId, { handler: 'handleDebugVector' });

  try {
    logger.apiRequest('GET', '/debug/vector', context);

    const services = createServiceContainer(env);
    const embeddingInfo = await services.d1Repository.getVectorDebugInfo();

    logger.apiResponse('GET', '/debug/vector', 200, timer.duration(), context);

    return Response.json(embeddingInfo, { status: 200 });
  } catch (error) {
    logger.error('Debug vector request failed', error, context);
    return errorToResponse(error);
  }
}

/**
 * POST /debug/test-upsert - Test vector upsert with a single technology
 */
export async function handleTestUpsert(request: Request, env: FullEnv): Promise<Response> {
  const logger = getLogger();

  try {
    const { id } = await request.json() as { id: number };
    if (!id) {
      return Response.json({ error: 'id required' }, { status: 400 });
    }

    const services = createServiceContainer(env);

    // Fetch the technology from D1
    const allTech = await services.d1Repository.getTechnology(100, 0);
    const found = allTech.results?.find((t: any) => t.id === id);
    if (!found) {
      return Response.json({ error: `Technology ${id} not found` }, { status: 404 });
    }

    const item = found;

    // Generate embedding
    const text = `${item.name} ${item.experience || ''} ${item.summary || ''} ${item.action || ''}`;
    const embeddingResult = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [text] }) as { data: number[][] };
    const embedding = embeddingResult.data[0];

    // Try direct Vectorize upsert
    const vectorId = `technology-${item.id}`;
    const vector = {
      id: vectorId,
      values: embedding,
      metadata: { id: item.id, name: item.name, version: 999 }
    };

    console.log(`Test upsert: ${vectorId}, embedding length: ${embedding.length}`);

    // Direct upsert to Vectorize
    await env.VECTORIZE.upsert([vector]);

    return Response.json({
      success: true,
      vectorId,
      embeddingLength: embedding.length,
      text: text.substring(0, 200),
      item: { id: item.id, name: item.name }
    });
  } catch (error) {
    logger.error('Test upsert failed', error);
    return Response.json({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
