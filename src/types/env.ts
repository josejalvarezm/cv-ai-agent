/**
 * Segregated Environment Interfaces
 *
 * Following Interface Segregation Principle (ISP), we split the monolithic Env interface
 * into focused, minimal interfaces. Each handler only receives what it needs.
 *
 * Benefits:
 * - Reduced coupling: handlers don't depend on unused bindings
 * - Easier testing: mock only necessary bindings
 * - Better type safety: IDE provides relevant completions
 * - Clear dependencies: interface shows exactly what's required
 */

/**
 * Database bindings
 * Required by handlers that read/write skill and technology data
 */
export interface DatabaseEnv {
  DB: D1Database;
}

/**
 * Vector search and storage bindings
 * Required by query and indexing operations
 */
export interface VectorEnv {
  VECTORIZE: Vectorize;
  VECTORIZE_FALLBACK?: string; // When 'true', enables KV fallback
}

/**
 * Cache bindings and configuration
 * Required by query caching and rate limiting
 */
export interface CacheEnv {
  KV: KVNamespace;
  CACHE_TTL?: string; // Default cache TTL in seconds
}

/**
 * AI model bindings and configuration
 * Required by embedding generation and AI reply generation
 */
export interface AIEnv {
  AI: Ai;
  AI_REPLY_ENABLED?: string; // When 'true', generates AI responses
}

/**
 * Authentication and security
 * Required by session creation and query verification
 */
export interface AuthEnv {
  TURNSTILE_SECRET_KEY?: string; // Cloudflare Turnstile secret
  JWT_SECRET?: string; // Secret for signing JWTs
}

/**
 * Analytics and monitoring
 * Required by analytics handlers (AWS SQS integration)
 */
export interface AnalyticsEnv {
  AWS_SQS_URL?: string;
  AWS_REGION?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
}

/**
 * Composed Env for query operations
 * Query needs: DB access, vector search, caching, authentication
 */
export interface QueryEnv extends DatabaseEnv, VectorEnv, CacheEnv, AuthEnv {}

/**
 * Composed Env for indexing operations
 * Indexing needs: DB access, vector storage, AI models, caching for locks
 */
export interface IndexEnv extends DatabaseEnv, VectorEnv, AIEnv, CacheEnv {}

/**
 * Composed Env for session creation
 * Sessions need: authentication secrets, caching
 */
export interface SessionEnv extends AuthEnv, CacheEnv {}

/**
 * Composed Env for health checks
 * Health checks typically need nothing (or minimal DB for connectivity test)
 */
export type HealthEnv = Record<string, never>;

/**
 * Composed Env for quota operations
 * Quota needs: caching for quota state
 */
export type QuotaEnv = CacheEnv;

/**
 * Composed Env for analytics
 * Analytics needs: database, caching, AWS credentials
 */
export interface AnalyticsHandlerEnv extends DatabaseEnv, CacheEnv, AnalyticsEnv {}

/**
 * Full Env for internal use only (service container initialization)
 * Only the root Worker should deal with full Env
 */
export interface FullEnv
  extends DatabaseEnv,
    VectorEnv,
    CacheEnv,
    AIEnv,
    AuthEnv,
    AnalyticsEnv {}
