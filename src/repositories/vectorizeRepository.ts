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

export interface VectorRecord {
  id: string;
  values: number[];
  metadata: VectorMetadata;
}

export interface VectorizeInfo {
  type: string;
  dimension: number;
}

export class VectorizeRepository {
  constructor(private vectorize: Vectorize) { }

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
  async upsert(vectors: VectorRecord[]): Promise<void> {
    // Vectorize API expects a specific format - cast metadata to compatible type
    const vectorizeVectors = vectors.map(v => ({
      id: v.id,
      values: v.values,
      metadata: v.metadata as unknown as Record<string, VectorizeVectorMetadata>,
    }));
    await this.vectorize.upsert(vectorizeVectors);
  }

  /**
   * Get index info (if supported)
   */
  async getInfo(): Promise<VectorizeInfo> {
    // Vectorize doesn't have a getInfo method, but we can return basic info
    return {
      type: 'vectorize',
      dimension: 768, // text-embedding-ada-002 dimension
    };
  }
}
