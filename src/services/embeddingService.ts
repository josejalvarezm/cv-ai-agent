/**
 * Embedding Service
 * Handles text-to-vector embedding generation using Workers AI
 */

import { AI_CONFIG } from '../config';

/**
 * Generate embedding vector from text using Workers AI
 * @param text - Input text to convert to embedding
 * @param ai - Workers AI binding
 * @returns 768-dimensional embedding vector
 */
export async function generateEmbedding(text: string, ai: Ai): Promise<number[]> {
  const response = await ai.run(AI_CONFIG.EMBEDDING_MODEL, {
    text: [text],
  }) as { data: number[][] };
  
  return response.data[0]; // Returns array of AI_CONFIG.EMBEDDING_DIMENSIONS dimensions
}

/**
 * Generate embeddings for multiple texts in batch
 * @param texts - Array of texts to convert to embeddings
 * @param ai - Workers AI binding
 * @returns Array of embedding vectors
 */
export async function generateEmbeddingsBatch(texts: string[], ai: Ai): Promise<number[][]> {
  const response = await ai.run(AI_CONFIG.EMBEDDING_MODEL, {
    text: texts,
  }) as { data: number[][] };
  
  return response.data;
}

/**
 * Calculate cosine similarity between two vectors
 * @param vecA - First vector
 * @param vecB - Second vector
 * @returns Similarity score between 0 and 1
 */
export function cosineSimilarity(vecA: number[] | Float32Array, vecB: number[] | Float32Array): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have same dimensions');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Convert binary blob to Float32Array
 * @param blob - ArrayBuffer containing float32 data
 * @returns Float32Array view of the data
 */
export function blobToFloat32Array(blob: ArrayBuffer): Float32Array {
  return new Float32Array(blob);
}
