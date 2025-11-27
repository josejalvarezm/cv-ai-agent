/**
 * Vector Store Abstraction
 *
 * Addresses Liskov Substitution Principle (LSP) by providing a consistent interface
 * for vector search operations across different storage backends (Vectorize, KV, future ones).
 *
 * Before:
 *   - Callers had to know whether to use Vectorize or KV
 *   - Error handling for Vectorize fallback was in query logic
 *   - Metadata handling was inconsistent between sources
 *
 * After:
 *   - Single VectorStore interface
 *   - Implementations handle backend-specific details
 *   - Fallback logic is encapsulated
 */

/**
 * Vector match result with consistent interface
 */
export interface VectorMatch {
  id: string;
  score: number;
  metadata: {
    id: number;
    version: number;
    name: string;
    mastery?: string;
    years?: number;
    category?: string;
  };
}

/**
 * Vector store interface
 * Defines contract for vector search operations
 */
export interface IVectorStore {
  /**
   * Query vectors by embedding
   * @param embedding - Query embedding vector
   * @param topK - Number of top results to return
   * @returns Ranked vector matches
   */
  query(embedding: number[], topK: number): Promise<VectorMatch[]>;

  /**
   * Upsert vectors into the index
   * @param vectors - Vectors to insert or update
   */
  upsert(vectors: Array<{ id: string; values: number[]; metadata: any }>): Promise<void>;

  /**
   * Get store info (dimensions, count, etc.)
   */
  getInfo(): Promise<{
    type: string;
    dimension: number;
    vectorCount?: number;
  }>;

  /**
   * Check if store is available/healthy
   */
  isHealthy(): Promise<boolean>;
}

/**
 * Vectorize adapter
 * Implements VectorStore interface for Cloudflare Vectorize
 */
export class VectorizeAdapter implements IVectorStore {
  constructor(private vectorize: Vectorize) {}

  async query(embedding: number[], topK: number = 3): Promise<VectorMatch[]> {
    try {
      const results = await this.vectorize.query(embedding, {
        topK,
        returnMetadata: true,
      });

      return results.matches.map((match: any) => ({
        id: match.id,
        score: match.score,
        metadata: {
          id: match.metadata?.id ?? 0,
          version: match.metadata?.version ?? 0,
          name: match.metadata?.name ?? '',
          mastery: match.metadata?.mastery,
          years: match.metadata?.years,
          category: match.metadata?.category,
        },
      }));
    } catch (error) {
      console.error('Vectorize query failed:', error);
      throw new Error(`Vectorize query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async upsert(vectors: Array<{ id: string; values: number[]; metadata: any }>): Promise<void> {
    try {
      await this.vectorize.upsert(vectors as any);
    } catch (error) {
      console.error('Vectorize upsert failed:', error);
      throw new Error(`Vectorize upsert failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getInfo(): Promise<{ type: string; dimension: number; vectorCount?: number }> {
    return {
      type: 'vectorize',
      dimension: 768, // BGE-base-en-v1.5 dimension
    };
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Try a simple query with a zero vector
      const zeroVec = new Array(768).fill(0);
      await this.vectorize.query(zeroVec, { topK: 1 });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * KV Vector adapter
 * Implements VectorStore interface for KV fallback
 */
export class KVVectorAdapter implements IVectorStore {
  constructor(
    private kv: KVNamespace,
    private cosineSimilarity: (a: number[], b: number[]) => number
  ) {}

  async query(embedding: number[], topK: number = 3): Promise<VectorMatch[]> {
    try {
      // List all technology records from KV (prefixed with 'vector:')
      const vectorKeys = await this.kv.list({ prefix: 'vector:' });

      const similarities: Array<{ id: string; score: number; metadata: any }> = [];

      // Calculate cosine similarity for each stored vector
      for (const key of vectorKeys.keys) {
        try {
          const vectorData = await this.kv.get(key.name, 'json') as {
            values: number[];
            metadata: any;
          } | null;

          if (vectorData && Array.isArray(vectorData.values)) {
            const score = this.cosineSimilarity(embedding, vectorData.values);
            similarities.push({
              id: key.name,
              score,
              metadata: vectorData.metadata ?? {},
            });
          }
        } catch (error) {
          console.warn(`Error processing KV vector ${key.name}:`, error);
        }
      }

      // Sort by similarity and take top K
      similarities.sort((a, b) => b.score - a.score);
      const topMatches = similarities.slice(0, topK);

      return topMatches.map((match) => ({
        id: match.id,
        score: match.score,
        metadata: {
          id: match.metadata?.id ?? 0,
          version: match.metadata?.version ?? 0,
          name: match.metadata?.name ?? '',
          mastery: match.metadata?.mastery,
          years: match.metadata?.years,
          category: match.metadata?.category,
        },
      }));
    } catch (error) {
      console.error('KV vector query failed:', error);
      throw new Error(`KV vector query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async upsert(vectors: Array<{ id: string; values: number[]; metadata: any }>): Promise<void> {
    try {
      for (const vector of vectors) {
        const keyName = `vector:${vector.id}`;
        await this.kv.put(
          keyName,
          JSON.stringify({
            values: vector.values,
            metadata: vector.metadata,
          }),
          { expirationTtl: 86400 * 30 } // 30 day TTL
        );
      }
    } catch (error) {
      console.error('KV vector upsert failed:', error);
      throw new Error(`KV vector upsert failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getInfo(): Promise<{ type: string; dimension: number; vectorCount?: number }> {
    try {
      const keys = await this.kv.list({ prefix: 'vector:', limit: 1 });
      return {
        type: 'kv-fallback',
        dimension: 768,
        vectorCount: keys.list_complete ? undefined : keys.cursor ? -1 : 0,
      };
    } catch {
      return {
        type: 'kv-fallback',
        dimension: 768,
      };
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.kv.get('health-check');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Composite Vector Store with fallback
 * Tries primary store first, falls back to secondary
 */
export class CompositeVectorStore implements IVectorStore {
  constructor(
    private primary: IVectorStore,
    private fallback?: IVectorStore
  ) {}

  async query(embedding: number[], topK: number = 3): Promise<VectorMatch[]> {
    try {
      if (await this.primary.isHealthy()) {
        return await this.primary.query(embedding, topK);
      }
    } catch (error) {
      console.warn('Primary vector store failed, trying fallback:', error);
    }

    if (this.fallback && (await this.fallback.isHealthy())) {
      try {
        return await this.fallback.query(embedding, topK);
      } catch (error) {
        console.error('Fallback vector store also failed:', error);
        throw new Error('All vector stores failed');
      }
    }

    throw new Error('No available vector store');
  }

  async upsert(vectors: Array<{ id: string; values: number[]; metadata: any }>): Promise<void> {
    try {
      await this.primary.upsert(vectors);
    } catch (error) {
      console.warn('Primary store upsert failed:', error);
      if (this.fallback) {
        await this.fallback.upsert(vectors);
      } else {
        throw error;
      }
    }
  }

  async getInfo(): Promise<{ type: string; dimension: number; vectorCount?: number }> {
    const primaryInfo = await this.primary.getInfo();
    if (this.fallback) {
      const fallbackInfo = await this.fallback.getInfo();
      return {
        type: `${primaryInfo.type} (fallback: ${fallbackInfo.type})`,
        dimension: primaryInfo.dimension,
      };
    }
    return primaryInfo;
  }

  async isHealthy(): Promise<boolean> {
    return (
      (await this.primary.isHealthy()) ||
      (this.fallback !== undefined && (await this.fallback.isHealthy()))
    );
  }
}
