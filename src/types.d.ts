/// <reference types="@cloudflare/workers-types" />

declare module '@cloudflare/ai' {
  export class Ai {
    run(_model: string, _options: any): Promise<any> {
      return Promise.resolve(null);
    }
  }
}

/**
 * Core environment bindings required by all handlers
 */
export interface BaseEnv {
  DB: D1Database;
  AI: Ai;
}

/**
 * Optional configuration for caching and AI features
 */
export interface OptionalConfig {
  CACHE_TTL?: string;
  AI_REPLY_ENABLED?: string;
  VECTORIZE_FALLBACK?: string;
}

/**
 * Optional service bindings
 */
export interface OptionalBindings {
  VECTORIZE?: Vectorize;
  KV?: KVNamespace;
}

/**
 * Security and authentication config
 */
export interface SecurityConfig {
  TURNSTILE_SECRET_KEY?: string;
  JWT_SECRET?: string;
}

/**
 * Complete worker environment (all bindings + config)
 */
export interface WorkerEnv extends BaseEnv, OptionalConfig, OptionalBindings, SecurityConfig {}

/**
 * Environment for query operations
 */
export interface QueryEnv extends BaseEnv, OptionalConfig {
  KV?: KVNamespace;
}

/**
 * Environment for indexing operations
 */
export interface IndexEnv extends BaseEnv {}

/**
 * Environment for health checks
 */
export interface HealthEnv {
  DB: D1Database;
  KV?: KVNamespace;
}

/**
 * Environment for session management
 */
export interface SessionEnv extends SecurityConfig {}

/**
 * Skill record from D1
 */
export interface Skill {
  id: number;
  name: string;
  mastery: string;
  years: number;
  category?: string;
  description?: string;
  last_used?: string;
  action?: string;
  effect?: string;
  outcome?: string;
  related_project?: string;
}

/**
 * Technology record from D1
 */
export interface Technology {
  id: number;
  name: string;
  experience?: string;
  experience_years?: number;
  proficiency_percent?: number;
  level?: string;
  summary?: string;
  category?: string;
  recency?: string;
  action?: string;
  effect?: string;
  outcome?: string;
  related_project?: string;
  employer?: string;
}

/**
 * Vector metadata
 */
export interface VectorMetadata {
  id: number;
  version?: number;
  name: string;
  mastery?: string;
  years?: number;
  category?: string;
}

/**
 * Query result with provenance
 */
export interface QueryResult {
  skill: Skill;
  distance: number;
  provenance: {
    id: number;
    distance: number;
    source: 'vectorize' | 'kv-fallback' | 'd1-vectors';
  };
}
