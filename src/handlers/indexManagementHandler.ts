/**
 * Index management endpoint handlers
 * Utility endpoints for monitoring and controlling indexing operations
 */

import { handleIndex } from './indexHandler';
import { ENDPOINTS } from '../config';
import { D1Repository, KVRepository } from '../repositories';

interface Env {
  DB: D1Database;
  KV: KVNamespace;
}

/**
 * GET /index/progress - Get indexing progress from checkpoint
 */
export async function handleIndexProgress(request: Request, env: Env): Promise<Response> {
  const kvRepo = new KVRepository(env.KV);
  const url = new URL(request.url);
  const itemType = url.searchParams.get('type') || 'technology';
  const checkpoint = await kvRepo.getIndexCheckpoint(itemType);
  
  if (!checkpoint) {
    return new Response(JSON.stringify({ found: false }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
  
  return new Response(JSON.stringify(checkpoint), { 
    headers: { 'Content-Type': 'application/json' } 
  });
}

/**
 * POST /index/resume - Resume indexing from checkpoint
 */
export async function handleIndexResume(request: Request, env: Env): Promise<Response> {
  const kvRepo = new KVRepository(env.KV);
  const url = new URL(request.url);
  const bodyAny = await request.json().catch(() => ({})) as any;
  const itemType = bodyAny.type || 'technology';
  const checkpoint = await kvRepo.getIndexCheckpoint(itemType) || { nextOffset: 0 };
  const batchSize = bodyAny.batchSize || 20;

  // trigger one batch by calling handleIndex directly
  const req = new Request(`${url.origin}${ENDPOINTS.INDEX}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: itemType, batchSize, offset: checkpoint.nextOffset || 0 }),
  });
  const res = await handleIndex(req, env as any);
  
  return new Response(JSON.stringify({ triggered: true, status: res.status }), { 
    headers: { 'Content-Type': 'application/json' } 
  });
}

/**
 * POST /index/stop - Stop indexing by updating checkpoint status
 */
export async function handleIndexStop(request: Request, env: Env): Promise<Response> {
  const kvRepo = new KVRepository(env.KV);
  const bodyAny = await request.json().catch(() => ({})) as any;
  const itemType = bodyAny.type || 'technology';
  const checkpoint = await kvRepo.getIndexCheckpoint(itemType) || { nextOffset: 0 };
  checkpoint.status = 'stopped';
  await kvRepo.setIndexCheckpoint(itemType, checkpoint);
  
  return new Response(JSON.stringify({ stopped: true }), { 
    headers: { 'Content-Type': 'application/json' } 
  });
}

/**
 * GET /ids - Get technology IDs for remote orchestration
 */
export async function handleIds(env: Env): Promise<Response> {
  const d1Repo = new D1Repository(env.DB);
  const ids = await d1Repo.getAllTechnologyIds();
  
  return new Response(JSON.stringify({ ids }), { 
    headers: { 'Content-Type': 'application/json' } 
  });
}

/**
 * GET /debug/vector - Debug endpoint to inspect raw vector data
 */
export async function handleDebugVector(env: Env): Promise<Response> {
  const d1Repo = new D1Repository(env.DB);
  const embeddingInfo = await d1Repo.getVectorDebugInfo();
  return Response.json(embeddingInfo);
}
