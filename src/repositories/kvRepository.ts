/**
 * KV Repository - Abstraction layer for KV namespace operations
 * Implements repository pattern for key-value storage
 */

export class KVRepository {
  constructor(private kv: KVNamespace) {}

  /**
   * Get a value by key
   */
  async get(key: string): Promise<string | null> {
    return await this.kv.get(key);
  }

  /**
   * Get a JSON value by key
   */
  async getJSON<T = any>(key: string): Promise<T | null> {
    const value = await this.kv.get(key);
    return value ? JSON.parse(value) : null;
  }

  /**
   * Put a value with optional TTL
   */
  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    await this.kv.put(key, value, options);
  }

  /**
   * Put a JSON value with optional TTL
   */
  async putJSON(key: string, value: any, options?: { expirationTtl?: number }): Promise<void> {
    await this.kv.put(key, JSON.stringify(value), options);
  }

  /**
   * Delete a key
   */
  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }

  /**
   * Lock operations
   */
  async acquireLock(lockKey: string, ttlSeconds: number = 60): Promise<boolean> {
    const existing = await this.get(lockKey);
    if (existing) return false; // lock already held
    await this.put(lockKey, new Date().toISOString(), { expirationTtl: ttlSeconds });
    return true;
  }

  async releaseLock(lockKey: string): Promise<void> {
    await this.delete(lockKey);
  }

  /**
   * Index checkpoint operations
   */
  async getIndexCheckpoint(itemType: string) {
    const checkpointKey = `index:checkpoint:${itemType}`;
    return await this.getJSON(checkpointKey);
  }

  async setIndexCheckpoint(itemType: string, checkpoint: any): Promise<void> {
    const checkpointKey = `index:checkpoint:${itemType}`;
    await this.putJSON(checkpointKey, checkpoint);
  }

  /**
   * Vector storage operations (fallback)
   */
  async storeVector(vectorKey: string, embedding: number[], metadata: any, ttl: number): Promise<void> {
    await this.putJSON(`vector:${vectorKey}`, { values: embedding, metadata }, { expirationTtl: ttl });
  }

  async getVector(vectorKey: string) {
    return await this.getJSON(`vector:${vectorKey}`);
  }

  /**
   * AI Quota operations
   */
  async getQuotaData() {
    return await this.getJSON('ai_quota');
  }

  async setQuotaData(quotaData: any): Promise<void> {
    await this.putJSON('ai_quota', quotaData);
  }
}
