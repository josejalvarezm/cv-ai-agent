/**
 * Embedding Service
 * Handles text-to-vector embedding generation using Workers AI
 */

import { AI_CONFIG } from '../config';

/**
 * Generate embedding vector from text using Workers AI
 * 
 * This function converts text into a 768-dimensional vector representation
 * using the BGE (BAAI General Embedding) model. These vectors enable
 * semantic similarity comparisons.
 * 
 * @param text - Input text to convert to embedding
 * @param ai - Workers AI binding
 * @returns 768-dimensional embedding vector
 * 
 * @example
 * const embedding = await generateEmbedding("Python programming", env.AI);
 * // Returns: [0.234, -0.456, 0.671, ...] (768 numbers)
 */
export async function generateEmbedding(text: string, ai: Ai): Promise<number[]> {
  const response = await ai.run(AI_CONFIG.EMBEDDING_MODEL, {
    text: [text],
  }) as { data: number[][] };
  
  return response.data[0]; // Returns array of AI_CONFIG.EMBEDDING_DIMENSIONS dimensions
}

/**
 * Generate embeddings for multiple texts in batch
 * 
 * More efficient than calling generateEmbedding() multiple times
 * when you need to process multiple texts at once.
 * 
 * @param texts - Array of texts to convert to embeddings
 * @param ai - Workers AI binding
 * @returns Array of embedding vectors
 * 
 * @example
 * const embeddings = await generateEmbeddingsBatch([
 *   "Python programming",
 *   "React development"
 * ], env.AI);
 * // Returns: [[...768 numbers...], [...768 numbers...]]
 */
export async function generateEmbeddingsBatch(texts: string[], ai: Ai): Promise<number[][]> {
  const response = await ai.run(AI_CONFIG.EMBEDDING_MODEL, {
    text: texts,
  }) as { data: number[][] };
  
  return response.data;
}

/**
 * Calculate cosine similarity between two vectors
 * 
 * Cosine similarity measures the cosine of the angle between two vectors.
 * Returns a value between 0 and 1, where:
 * - 1.0 = vectors are identical (0° angle)
 * - 0.8-0.9 = very similar
 * - 0.6-0.8 = moderately similar
 * - <0.6 = less similar
 * 
 * @param vecA - First vector
 * @param vecB - Second vector
 * @returns Similarity score between 0 and 1
 * 
 * @throws Error if vectors have different dimensions
 * 
 * @example
 * const similarity = cosineSimilarity(queryVector, skillVector);
 * // Returns: 0.89 (high similarity)
 */
export function cosineSimilarity(vecA: number[] | Float32Array, vecB: number[] | Float32Array): number {
  if (vecA.length !== vecB.length) {
    throw new Error(`Vectors must have same dimensions (got ${vecA.length} and ${vecB.length})`);
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  
  // Avoid division by zero
  if (denominator === 0) {
    return 0;
  }
  
  return dotProduct / denominator;
}

/**
 * Convert binary blob to Float32Array
 * 
 * When reading embeddings from D1 database (stored as BLOB),
 * they need to be converted back to Float32Array for calculations.
 * 
 * @param blob - ArrayBuffer containing float32 data
 * @returns Float32Array view of the data
 */
export function blobToFloat32Array(blob: ArrayBuffer): Float32Array {
  return new Float32Array(blob);
}
