/**
 * Vectorize Repository - Abstraction layer for Vectorize index operations
 * Implements repository pattern for vector search
 */

export interface VectorMetadata {
  id: number;
  version: number;
  name: string;
  mastery?: string;
  years?: number;
  category?: string;
}

export interface VectorMatch {
  id: string;
  score: number;
  metadata: VectorMetadata;
}

export class VectorizeRepository {
  constructor(private vectorize: Vectorize) {}

  /**
   * Query vectors by embedding
   */
  async query(embedding: number[], topK: number = 3): Promise<VectorMatch[]> {
    const results = await this.vectorize.query(embedding, {
      topK,
      returnMetadata: true,
    });

    return results.matches.map((match: any) => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata as VectorMetadata,
    }));
  }

  /**
   * Upsert vectors into the index
   */
  async upsert(vectors: Array<{ id: string; values: number[]; metadata: any }>): Promise<void> {
    await this.vectorize.upsert(vectors as any);
  }

  /**
   * Get index info (if supported)
   */
  async getInfo(): Promise<any> {
    // Vectorize doesn't have a getInfo method, but we can return basic info
    return {
      type: 'vectorize',
      dimension: 768, // text-embedding-ada-002 dimension
    };
  }
}
