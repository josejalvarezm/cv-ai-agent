/**
 * Indexing endpoint handler
 * POST /index - Index skills/technology into Vectorize, KV, and D1
 */

import { generateEmbedding } from '../services/embeddingService';
import { INDEX_CONFIG } from '../config';
import { createSkillText, type Skill } from '../utils';
import { D1Repository, KVRepository, VectorizeRepository } from '../repositories';

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
  
  // Initialize repositories
  const d1Repo = new D1Repository(env.DB);
  const kvRepo = new KVRepository(env.KV);
  const vectorizeRepo = new VectorizeRepository(env.VECTORIZE);
  
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
    const lockKey = `index:lock:${itemType}`;
    const acquired = await kvRepo.acquireLock(lockKey, 120);
    if (!acquired) {
      return new Response(JSON.stringify({ error: 'Indexing already in progress', itemType }), { 
        status: 409, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    lockAcquired.value = true;

    const ai = env.AI;

    // ensure index_metadata table exists
    await d1Repo.ensureIndexMetadataTable();

    // determine version
    const version = (await d1Repo.getMaxIndexVersion()) + 1;

    // create indexing record
    await d1Repo.createIndexMetadata(version);

    // batching params
    const batchSize = params.batchSize && params.batchSize > 0 ? params.batchSize : (params.type === 'technology' ? INDEX_CONFIG.TECHNOLOGY_BATCH_SIZE : INDEX_CONFIG.DEFAULT_BATCH_SIZE);
    let offset = params.offset && params.offset >= 0 ? params.offset : 0;

    // fetch batch from D1 using repository
    const itemsResult = itemType === 'technology'
      ? await d1Repo.getTechnology(batchSize, offset)
      : await d1Repo.getSkills(batchSize, offset);
    const items = itemsResult.results || [];

    if (!items.length) {
      // nothing to do
      await d1Repo.updateIndexMetadata(version, 0, 'completed');
      return new Response(JSON.stringify({ success: true, message: 'No items to index', version, processed: 0 }), { 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const vectors: any[] = [];
    const kvPromises: Promise<any>[] = [];

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

      // Store in KV and D1 vectors table
      kvPromises.push(kvRepo.storeVector(idKey, embedding, metadata, INDEX_CONFIG.VECTOR_KV_TTL));
      
      const embeddingBlob = new Float32Array(embedding).buffer;
      kvPromises.push(d1Repo.insertVector(itemType, item.id, embeddingBlob, metadata));
    }

    // upsert into Vectorize, KV, and D1
    await vectorizeRepo.upsert(vectors);
    await Promise.all(kvPromises);

    // update metadata
    await d1Repo.updateIndexMetadata(version, items.length, 'in_progress');

    // write checkpoint to KV for resumability
    try {
      const total = itemType === 'technology' 
        ? await d1Repo.getTechnologyCount()
        : await d1Repo.getSkillCount();
      const nextOffset = offset + items.length;
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
      await kvRepo.setIndexCheckpoint(itemType, checkpoint);
    } catch (e) {
      console.error('Failed to write checkpoint to KV', e);
    }

    // release lock
    if (lockAcquired.value) {
      const lockKey = `index:lock:${lockAcquired.itemType}`;
      await kvRepo.releaseLock(lockKey);
    }

    return new Response(JSON.stringify({ success: true, version, processed: items.length, offset }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
    
  } catch (error: any) {
    console.error('Indexing error:', error);
    
    // release lock on error
    if (lockAcquired.value) {
      const lockKey = `index:lock:${lockAcquired.itemType}`;
      await kvRepo.releaseLock(lockKey);
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
