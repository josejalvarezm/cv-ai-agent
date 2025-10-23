/**
 * Application Configuration
 * Centralized configuration constants for CV Assistant Worker
 */

/**
 * Cache configuration
 */
export const CACHE_CONFIG = {
  /** Default cache TTL in seconds (1 hour) */
  DEFAULT_TTL: 3600,
  /** Cache key prefix for query results */
  QUERY_PREFIX: 'query:',
} as const;

/**
 * AI Model configuration
 */
export const AI_CONFIG = {
  /** Embedding model for semantic search */
  EMBEDDING_MODEL: '@cf/baai/bge-base-en-v1.5',
  /** Chat/response model */
  CHAT_MODEL: '@cf/meta/llama-3.1-70b-instruct',
  /** Fallback chat model */
  FALLBACK_MODEL: '@hf/mistral/mistral-7b-instruct-v0.2',
  /** Maximum tokens for AI responses */
  MAX_TOKENS: 150,
  /** Embedding dimensions */
  EMBEDDING_DIMENSIONS: 768,
} as const;

/**
 * Search and query configuration
 */
export const SEARCH_CONFIG = {
  /** Number of top results to return from vector search */
  TOP_K: 3,
  /** Maximum results for detailed analysis */
  TOP_K_EXTENDED: 5,
  /** Maximum results for multi-skill synthesis */
  TOP_K_SYNTHESIS: 10,
  /** Minimum similarity score threshold */
  MIN_SIMILARITY: 0.50,
  /** High confidence threshold */
  HIGH_CONFIDENCE: 0.80,
  /** Medium confidence threshold */
  MEDIUM_CONFIDENCE: 0.65,
} as const;

/**
 * Indexing configuration
 */
export const INDEX_CONFIG = {
  /** Default batch size for indexing */
  DEFAULT_BATCH_SIZE: 10,
  /** Batch size for technology indexing */
  TECHNOLOGY_BATCH_SIZE: 20,
  /** Index lock TTL in seconds */
  LOCK_TTL: 120,
  /** KV expiration for vectors (30 days) */
  VECTOR_KV_TTL: 86400 * 30,
} as const;

/**
 * Session and authentication configuration
 */
export const AUTH_CONFIG = {
  /** JWT expiration in seconds (15 minutes) */
  JWT_EXPIRY: 15 * 60,
  /** Session ID length in bytes */
  SESSION_ID_LENGTH: 16,
} as const;

/**
 * API endpoints
 */
export const ENDPOINTS = {
  INDEX: '/index',
  QUERY: '/query',
  QUERY_D1: '/query-d1',
  QUERY_VECTORIZE: '/query-vectorize',
  SESSION: '/session',
  HEALTH: '/health',
  ROOT: '/',
} as const;

/**
 * CORS configuration
 */
export const CORS_CONFIG = {
  ALLOWED_ORIGINS: '*',
  ALLOWED_METHODS: 'GET, POST, OPTIONS',
  ALLOWED_HEADERS: 'Content-Type, X-Turnstile-Token, Authorization',
} as const;

/**
 * Turnstile verification URL
 */
export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Database table names
 */
export const DB_TABLES = {
  SKILLS: 'skills',
  TECHNOLOGY: 'technology',
  VECTORS: 'vectors',
} as const;

/**
 * Item types for indexing
 */
export const ITEM_TYPES = {
  SKILLS: 'skills',
  TECHNOLOGY: 'technology',
} as const;
