/**
 * Indexing endpoint handler
 * POST /index - Index skills/technology into Vectorize, KV, and D1
 */

import { generateEmbedding } from '../services/embeddingService';
import { INDEX_CONFIG } from '../config';
import { acquireIndexLock, releaseIndexLock, createSkillText, type Skill } from '../utils';

interface Env {
  DB: D1Database;
  VECTORIZE: Vectorize;
  KV: KVNamespace;
  AI: Ai;
}

/**
 * POST /index - Index all skills/technology into vector stores
 * Supports batched indexing with checkpoint/resume capability
 */
export async function handleIndex(request: Request, env: Env): Promise<Response> {
  const lockAcquired = { value: false, itemType: 'skills' as string };
  
  try {
    console.log('Starting indexing process...');

    // parse optional body for batched indexing
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

    // acquire lock to prevent concurrent indexing
    const acquired = await acquireIndexLock(itemType, env, 120);
    if (!acquired) {
      return new Response(JSON.stringify({ error: 'Indexing already in progress', itemType }), { 
        status: 409, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    lockAcquired.value = true;

    const ai = env.AI;

    // ensure index_metadata table exists (no-op if already present)
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS index_metadata (
        version INTEGER PRIMARY KEY,
        indexed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        total_skills INTEGER,
        status TEXT
      )`
    ).run();

    // determine version
    const lastVersion = await env.DB.prepare('SELECT MAX(version) as last_version FROM index_metadata').first();
    const version = (lastVersion?.last_version as number || 0) + 1;

    // create indexing record
    await env.DB.prepare('INSERT INTO index_metadata (version, total_skills, status) VALUES (?, ?, ?)').bind(version, 0, 'in_progress').run();

    // batching params
    const batchSize = params.batchSize && params.batchSize > 0 ? params.batchSize : (params.type === 'technology' ? INDEX_CONFIG.TECHNOLOGY_BATCH_SIZE : INDEX_CONFIG.DEFAULT_BATCH_SIZE);
    let offset = params.offset && params.offset >= 0 ? params.offset : 0;

    // fetch batch from D1 using LIMIT/OFFSET
    const selectSql = itemType === 'technology'
      ? 'SELECT id, category_id, name, experience, experience_years FROM technology ORDER BY id LIMIT ? OFFSET ?'
      : 'SELECT id, name, mastery, years, category, description, last_used FROM skills ORDER BY id LIMIT ? OFFSET ?';

    const { results: rows } = await env.DB.prepare(selectSql).bind(batchSize, offset).all<any>();
    const items = rows as any[] || [];

    if (!items.length) {
      // nothing to do
      await env.DB.prepare('UPDATE index_metadata SET status = ? WHERE version = ?').bind('completed', version).run();
      return new Response(JSON.stringify({ success: true, message: 'No items to index', version, processed: 0 }), { 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const vectors: any[] = [];
    const kvPromises: Promise<any>[] = [];
    const d1Promises: Promise<any>[] = [];

    for (const item of items) {
      const text = itemType === 'technology'
        ? `${item.name} (${item.experience || ''})`
        : createSkillText(item as Skill);

      const embedding = await generateEmbedding(text, ai);
      const idKey = `${itemType}-${item.id}`;
      const metadata = {
        id: item.id,
        version,
        name: item.name,
        category: itemType === 'technology' ? item.category_id : (item as Skill).category || '',
      };

      vectors.push({ id: idKey, values: embedding, metadata });

      kvPromises.push(env.KV.put(`vector:${idKey}`, JSON.stringify({ values: embedding, metadata }), { expirationTtl: INDEX_CONFIG.VECTOR_KV_TTL }));
      
      // Store embedding in D1 vectors table (id is auto-increment, don't specify it)
      const embeddingBlob = new Float32Array(embedding).buffer;
      d1Promises.push(
        env.DB.prepare(
          'INSERT INTO vectors (item_type, item_id, embedding, metadata) VALUES (?, ?, ?, ?)'
        ).bind(itemType, item.id, embeddingBlob, JSON.stringify(metadata)).run()
      );
    }

    // upsert into Vectorize, KV, and D1
    await env.VECTORIZE.upsert(vectors as any);
    await Promise.all([...kvPromises, ...d1Promises]);

    // update metadata: increment total_skills by processed count and mark as in_progress
    await env.DB.prepare('UPDATE index_metadata SET total_skills = COALESCE(total_skills,0) + ?, status = ? WHERE version = ?').bind(items.length, 'in_progress', version).run();

    // write checkpoint to KV for resumability
    try {
      const totalRow = await env.DB.prepare(itemType === 'technology' ? 'SELECT COUNT(*) as total FROM technology' : 'SELECT COUNT(*) as total FROM skills').first<any>();
      const total = totalRow?.total || 0;
      const nextOffset = offset + items.length;
      const checkpointKey = `index:checkpoint:${itemType}`;
      const checkpoint = {
        version,
        nextOffset,
        processed: nextOffset,
        total,
        status: nextOffset >= total ? 'completed' : 'in_progress',
        lastBatchAt: new Date().toISOString(),
        lastProcessedCount: items.length,
        errors: [] as any[],
      };
      await env.KV.put(checkpointKey, JSON.stringify(checkpoint));
    } catch (e) {
      console.error('Failed to write checkpoint to KV', e);
    }

    // release lock
    if (lockAcquired.value) {
      await releaseIndexLock(lockAcquired.itemType, env);
    }

    return new Response(JSON.stringify({ success: true, version, processed: items.length, offset }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
    
  } catch (error: any) {
    console.error('Indexing error:', error);
    
    // release lock on error
    if (lockAcquired.value) {
      await releaseIndexLock(lockAcquired.itemType, env);
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Indexing failed',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
