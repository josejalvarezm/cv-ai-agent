/**
 * Index management endpoint handlers
 * Utility endpoints for monitoring and controlling indexing operations
 */

import { handleIndex } from './indexHandler';
import { ENDPOINTS } from '../config';

interface Env {
  DB: D1Database;
  KV: KVNamespace;
}

/**
 * GET /index/progress - Get indexing progress from checkpoint
 */
export async function handleIndexProgress(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const itemType = url.searchParams.get('type') || 'technology';
  const checkpointKey = `index:checkpoint:${itemType}`;
  const data = await env.KV.get(checkpointKey);
  
  if (!data) {
    return new Response(JSON.stringify({ found: false }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
  
  return new Response(data, { 
    headers: { 'Content-Type': 'application/json' } 
  });
}

/**
 * POST /index/resume - Resume indexing from checkpoint
 */
export async function handleIndexResume(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const bodyAny = await request.json().catch(() => ({})) as any;
  const itemType = bodyAny.type || 'technology';
  const checkpointKey = `index:checkpoint:${itemType}`;
  const checkpointRaw = await env.KV.get(checkpointKey);
  const checkpoint = checkpointRaw ? JSON.parse(checkpointRaw) : { nextOffset: 0 };
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
  const bodyAny = await request.json().catch(() => ({})) as any;
  const itemType = bodyAny.type || 'technology';
  const checkpointKey = `index:checkpoint:${itemType}`;
  const checkpointRaw = await env.KV.get(checkpointKey);
  const checkpoint = checkpointRaw ? JSON.parse(checkpointRaw) : { nextOffset: 0 };
  checkpoint.status = 'stopped';
  await env.KV.put(checkpointKey, JSON.stringify(checkpoint));
  
  return new Response(JSON.stringify({ stopped: true }), { 
    headers: { 'Content-Type': 'application/json' } 
  });
}

/**
 * GET /ids - Get technology IDs for remote orchestration
 */
export async function handleIds(env: Env): Promise<Response> {
  const rows = await env.DB.prepare('SELECT id FROM technology ORDER BY id').all();
  const ids = (rows.results || []).map((r: any) => r.id);
  
  return new Response(JSON.stringify({ ids }), { 
    headers: { 'Content-Type': 'application/json' } 
  });
}

/**
 * GET /debug/vector - Debug endpoint to inspect raw vector data
 */
export async function handleDebugVector(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare('SELECT id, item_id, LENGTH(embedding) as size, typeof(embedding) as type FROM vectors LIMIT 1').all();
  const vec = results[0] as any;
  const { results: vecData } = await env.DB.prepare('SELECT * FROM vectors LIMIT 1').all();
  const fullVec = vecData[0] as any;

  const embeddingInfo: any = {
    id: vec.id,
    item_id: vec.item_id,
    size: vec.size,
    sqlType: vec.type,
    jsType: typeof fullVec.embedding,
    isArrayBuffer: fullVec.embedding instanceof ArrayBuffer,
    isUint8Array: fullVec.embedding instanceof Uint8Array,
    constructorName: fullVec.embedding?.constructor?.name,
  };

  if (ArrayBuffer.isView(fullVec.embedding)) {
    embeddingInfo.byteLength = (fullVec.embedding as any).byteLength;
    embeddingInfo.byteOffset = (fullVec.embedding as any).byteOffset;
  }

  return Response.json(embeddingInfo);
}
