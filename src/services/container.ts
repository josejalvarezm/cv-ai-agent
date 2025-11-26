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
import { UnifiedSkillRepository } from '../repositories/skillRepository';
import { VectorizeAdapter, KVVectorAdapter, CompositeVectorStore, type IVectorStore } from '../repositories/vectorStore';
import { EmbeddingService, cosineSimilarity } from './embeddingService';
import { CacheService } from './cacheService';
import { QueryService } from './queryService';
import { IndexingService } from './indexingService';
import { type FullEnv } from '../types/env';

// New SOLID-compliant services
import { QuestionValidatorService } from './questionValidator';
import { ResponseValidatorService } from './responseValidator';
import { ProjectDetectorService } from './projectDetector';
import { PromptBuilderService } from './promptBuilder';
import { AIInferenceService } from './aiInference';
import type {
  IQuestionValidator,
  IResponseValidator,
  IProjectDetector,
  IPromptBuilder,
  IAIInference,
} from '../types/validators';

/**
 * Service container interface
 * Exposes all services available to handlers
 */
export interface ServiceContainer {
  // Data Access Repositories
  d1Repository: D1Repository;
  vectorizeRepository: VectorizeRepository;
  kvRepository: KVRepository;
  skillRepository: UnifiedSkillRepository;

  // Vector Store (abstraction layer)
  vectorStore: IVectorStore;

  // Core Services
  embeddingService: EmbeddingService;
  cacheService: CacheService;
  queryService: QueryService;
  indexingService: IndexingService;

  // Validator Services (SOLID-compliant)
  questionValidator: IQuestionValidator;
  responseValidator: IResponseValidator;
  projectDetector: IProjectDetector;
  promptBuilder: IPromptBuilder;
  aiInference: IAIInference;
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
  // Instantiate base repositories (data access layer)
  const d1Repository = new D1Repository(env.DB);
  const vectorizeRepository = new VectorizeRepository(env.VECTORIZE);
  const kvRepository = new KVRepository(env.KV);

  // Instantiate specialized repositories
  const skillRepository = new UnifiedSkillRepository(d1Repository, true);

  // Instantiate services (business logic layer)
  const embeddingService = new EmbeddingService(env.AI);
  const cacheService = new CacheService(env.KV);

  // Create composite vector store with fallback
  const vectorizeAdapter = new VectorizeAdapter(env.VECTORIZE);
  const kvAdapter = new KVVectorAdapter(env.KV, cosineSimilarity);
  const vectorStore = new CompositeVectorStore(vectorizeAdapter, kvAdapter);

  // Instantiate SOLID-compliant validator services
  const questionValidator = new QuestionValidatorService();
  const responseValidator = new ResponseValidatorService();
  const projectDetector = new ProjectDetectorService();
  const promptBuilder = new PromptBuilderService();
  const aiInference = new AIInferenceService(env.AI);

  // Create base container for orchestration services
  const baseContainer = {
    d1Repository,
    vectorizeRepository,
    kvRepository,
    skillRepository,
    vectorStore,
    embeddingService,
    cacheService,
    questionValidator,
    responseValidator,
    projectDetector,
    promptBuilder,
    aiInference,
  } as unknown as ServiceContainer;

  // Create high-level orchestration services
  const queryService = new QueryService(baseContainer, true);
  const indexingService = new IndexingService(baseContainer, env.AI);

  return {
    d1Repository,
    vectorizeRepository,
    kvRepository,
    skillRepository,
    vectorStore,
    embeddingService,
    cacheService,
    queryService,
    indexingService,
    questionValidator,
    responseValidator,
    projectDetector,
    promptBuilder,
    aiInference,
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
    skillRepository: undefined as any,
    vectorStore: undefined as any,
    embeddingService: undefined as any,
    cacheService: undefined as any,
    queryService: undefined as any,
    indexingService: undefined as any,
    questionValidator: undefined as any,
    responseValidator: undefined as any,
    projectDetector: undefined as any,
    promptBuilder: undefined as any,
    aiInference: undefined as any,
  };
}
