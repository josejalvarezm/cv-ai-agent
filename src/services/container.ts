/**
 * Service Container (Dependency Injection)
 *
 * Centralizes the creation and management of all services and repositories.
 * Implements Dependency Inversion Principle (DIP):
 * - High-level modules (handlers) depend on the ServiceContainer
 * - ServiceContainer manages low-level module creation (DB, AI, etc.)
 * - Services are created once and shared across handlers
 *
 * Benefits:
 * - Single source of truth for service instantiation
 * - Easy to mock for testing: inject mock container
 * - Reduces coupling: handlers don't instantiate repos manually
 * - Enables easy service upgrades: change only in this file
 */

import { D1Repository } from '../repositories/d1Repository';
import { VectorizeRepository } from '../repositories/vectorizeRepository';
import { KVRepository } from '../repositories/kvRepository';
import { EmbeddingService } from './embeddingService';
import { CacheService } from './cacheService';
import { type FullEnv } from '../types/env';

/**
 * Service container interface
 * Exposes all services available to handlers
 */
export interface ServiceContainer {
  // Repositories
  d1Repository: D1Repository;
  vectorizeRepository: VectorizeRepository;
  kvRepository: KVRepository;

  // Services
  embeddingService: EmbeddingService;
  cacheService: CacheService;
}

/**
 * Create and return service container
 *
 * This is the single place where all services and repositories are instantiated.
 * Call this once per request in the Worker's fetch handler.
 *
 * @param env - Full Cloudflare environment with all bindings
 * @returns Configured ServiceContainer ready for use
 */
export function createServiceContainer(env: FullEnv): ServiceContainer {
  // Instantiate repositories (data access layer)
  const d1Repository = new D1Repository(env.DB);
  const vectorizeRepository = new VectorizeRepository(env.VECTORIZE);
  const kvRepository = new KVRepository(env.KV);

  // Instantiate services (business logic layer)
  const embeddingService = new EmbeddingService(env.AI);
  const cacheService = new CacheService(env.KV);

  return {
    d1Repository,
    vectorizeRepository,
    kvRepository,
    embeddingService,
    cacheService,
  };
}

/**
 * Mock service container for testing
 * Replace services with test doubles
 */
export function createMockServiceContainer(): ServiceContainer {
  // In actual tests, these would be mocked implementations
  // For now, this is a placeholder structure
  return {
    d1Repository: undefined as any,
    vectorizeRepository: undefined as any,
    kvRepository: undefined as any,
    embeddingService: undefined as any,
    cacheService: undefined as any,
  };
}
