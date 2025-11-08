/**
 * Provider Interfaces for Dependency Inversion Principle (DIP)
 * 
 * These abstractions allow for dependency injection and improved testability.
 * Concrete implementations can be swapped without changing dependent code.
 */

import type { Technology, VectorMetadata } from './types';

/**
 * Embedding provider abstraction
 * Allows swapping between different embedding services (Workers AI, OpenAI, etc.)
 */
export interface EmbeddingProvider {
  /**
   * Generate embedding vector from text
   * @param _text - Input text
   * @returns Embedding vector (typically 768 dimensions)
   */
  generate(_text: string): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts in batch
   * @param _texts - Array of input texts
   * @returns Array of embedding vectors
   */
  generateBatch(_texts: string[]): Promise<number[][]>;
}

/**
 * Vector storage abstraction
 * Allows swapping between D1, Vectorize, KV, or external vector databases
 */
export interface VectorStore {
  /**
   * Store a vector with metadata
   * @param _itemType - Type of item (e.g., 'technology', 'skill')
   * @param _itemId - ID of the item
   * @param _embedding - Vector embedding
   * @param _metadata - Associated metadata
   */
  store(_itemType: string, _itemId: number, _embedding: Float32Array, _metadata: VectorMetadata): Promise<void>;

  /**
   * Search for similar vectors
   * @param _queryVector - Query embedding
   * @param _topK - Number of results to return
   * @returns Array of similar vectors with scores
   */
  search(_queryVector: Float32Array, _topK: number): Promise<Array<{
    id: number;
    score: number;
    metadata: VectorMetadata;
  }>>;

  /**
   * Delete vectors for an item
   * @param _itemType - Type of item
   * @param _itemId - ID of the item
   */
  delete(_itemType: string, _itemId: number): Promise<void>;
}

/**
 * Data repository abstraction
 * Allows swapping between different database implementations
 */
export interface DataRepository {
  /**
   * Fetch all technologies
   */
  getTechnologies(): Promise<Technology[]>;

  /**
   * Fetch technology by ID
   * @param _id - Technology ID
   */
  getTechnologyById(_id: number): Promise<Technology | null>;

  /**
   * Insert or update a technology
   * @param _technology - Technology data
   */
  saveTechnology(_technology: Technology): Promise<void>;

  /**
   * Delete a technology
   * @param _id - Technology ID
   */
  deleteTechnology(_id: number): Promise<void>;
}

/**
 * LLM provider abstraction
 * Allows swapping between different language models
 */
export interface LLMProvider {
  /**
   * Generate a completion from a prompt
   * @param _systemPrompt - System instruction
   * @param _userPrompt - User message
   * @param _maxTokens - Maximum tokens to generate
   * @returns Generated text
   */
  generate(_systemPrompt: string, _userPrompt: string, _maxTokens?: number): Promise<string>;

  /**
   * Generate from a conversation history
   * @param _messages - Array of message objects
   * @param _maxTokens - Maximum tokens to generate
   * @returns Generated text
   */
  generateFromMessages(_messages: Array<{ role: string; content: string }>, _maxTokens?: number): Promise<string>;
}

/**
 * Cache provider abstraction
 * Allows swapping between Cache API, KV, or other caching solutions
 */
export interface CacheProvider {
  /**
   * Get cached value
   * @param _key - Cache key
   * @returns Cached value or null if not found
   */
  get<T>(_key: string): Promise<T | null>;

  /**
   * Set cached value
   * @param _key - Cache key
   * @param _value - Value to cache
   * @param _ttl - Time to live in seconds
   */
  set<T>(_key: string, _value: T, _ttl: number): Promise<void>;

  /**
   * Delete cached value
   * @param _key - Cache key
   */
  delete(_key: string): Promise<boolean>;
}
