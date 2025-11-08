/**
 * Vector Search Service
 * Handles semantic search operations using vector embeddings
 */

import { cosineSimilarity } from './embeddingService';
import type { Technology } from '../types';

export interface VectorSearchResult {
  id: number;
  item_id: number;
  similarity: number;
  technology: Technology;
}

/**
 * Search vectors in D1 database and calculate similarities
 * 
 * @param queryVector - Query embedding vector
 * @param db - D1 database binding
 * @param topK - Number of top results to return
 * @returns Array of search results sorted by similarity
 */
export async function searchVectorsInD1(
  queryVector: Float32Array,
  db: D1Database,
  topK: number = 5
): Promise<VectorSearchResult[]> {
  // Fetch all vectors from D1
  const { results: vectors } = await db.prepare(`
    SELECT v.id, v.item_id, v.embedding, v.metadata, 
           t.name, t.experience, t.experience_years,
           t.proficiency_percent, t.level, t.summary, t.category, t.recency,
           t.action, t.effect, t.outcome, t.related_project, t.employer
    FROM vectors v
    JOIN technology t ON v.item_id = t.id
    WHERE v.item_type = 'technology'
  `).all();

  if (!vectors || vectors.length === 0) {
    return [];
  }

  console.log(`Found ${vectors.length} vectors to compare`);

  // Calculate similarities
  const similarities: VectorSearchResult[] = [];

  for (const vector of vectors) {
    try {
      const embedding = parseEmbeddingFromD1(vector.embedding);

      if (embedding.length !== queryVector.length) {
        console.error(`Vector ${vector.id}: Dimension mismatch`);
        continue;
      }

      const similarity = cosineSimilarity(queryVector, embedding);

      if (isNaN(similarity)) {
        continue;
      }

      similarities.push({
        id: vector.id as number,
        item_id: vector.item_id as number,
        similarity,
        technology: {
          id: vector.item_id as number,
          name: vector.name as string,
          experience: vector.experience as string,
          experience_years: vector.experience_years as number,
          proficiency_percent: vector.proficiency_percent as number,
          level: vector.level as string,
          summary: vector.summary as string,
          category: vector.category as string,
          recency: vector.recency as string,
          action: vector.action as string,
          effect: vector.effect as string,
          outcome: vector.outcome as string,
          related_project: vector.related_project as string,
          employer: vector.employer as string,
        },
      });
    } catch (error: any) {
      console.error(`Error processing vector ${vector.id}:`, error.message);
      continue;
    }
  }

  // Sort by similarity and return top K
  similarities.sort((a, b) => b.similarity - a.similarity);
  return similarities.slice(0, topK);
}

/**
 * Parse embedding data from D1 BLOB storage
 * 
 * D1 returns BLOBs in various formats - this function handles all cases
 * 
 * @param embeddingData - Raw embedding data from D1
 * @returns Float32Array of embedding values
 */
function parseEmbeddingFromD1(embeddingData: any): Float32Array {
  if (Array.isArray(embeddingData)) {
    // D1 returns as array of bytes
    const uint8 = new Uint8Array(embeddingData);
    return new Float32Array(uint8.buffer);
  } else if (embeddingData instanceof ArrayBuffer) {
    return new Float32Array(embeddingData);
  } else if (ArrayBuffer.isView(embeddingData)) {
    return new Float32Array(
      embeddingData.buffer,
      embeddingData.byteOffset,
      embeddingData.byteLength / 4
    );
  } else {
    throw new Error('Unexpected embedding data type');
  }
}
