# Service Composition & Interaction Map - MyAIAgentPrivate v1.3.0

**Date:** November 27, 2025  
**Purpose:** Visual guide to service architecture and data flow

---

## Service Ecosystem Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    HANDLER LAYER (Entry Points)                   │
│                                                                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │   Query    │  │  Indexing  │  │  Health    │  │  Session   │ │
│  │  Handler   │  │  Handler   │  │  Handler   │  │  Handler   │ │
│  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘ │
└─────────┼───────────────┼─────────────────┼─────────────┼────────┘
          │               │                 │             │
          └───────────────┼─────────────────┴─────────────┘
                          │
                          ↓
┌──────────────────────────────────────────────────────────────────┐
│           ServiceContainer (Dependency Injection)                 │
│                                                                    │
│  Single source of truth for all service instantiation            │
│  All dependencies are wired here, not in handlers                │
└──────────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ↓               ↓               ↓
    ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐
    │  Services   │  │ Repositories │  │ Infrastructure   │
    │  (Business  │  │ (Data Access)│  │ (Configuration)  │
    │   Logic)    │  │              │  │                  │
    └─────────────┘  └──────────────┘  └──────────────────┘
```

---

## Detailed Service Interaction Map

### Query Execution Flow

```
HTTP Request
     ↓
┌────────────────────┐
│  queryHandler      │
│  (thin layer)      │
└──────────┬─────────┘
           ↓
    ┌──────────────────────────────────────────┐
    │  Step 1: VALIDATION                      │
    │                                          │
    │  questionValidator.validate(query)       │
    │  ↓                                       │
    │  ProjectDetectionResult                 │
    └────────────┬─────────────────────────────┘
                 ↓
    ┌──────────────────────────────────────────┐
    │  Step 2: PROJECT DETECTION               │
    │                                          │
    │  projectDetector.detect(query)           │
    │  ↓                                       │
    │  { isProjectSpecific, projectName }      │
    └────────────┬─────────────────────────────┘
                 ↓
    ┌──────────────────────────────────────────┐
    │  Step 3: QUERY SERVICE ORCHESTRATION     │
    │                                          │
    │  queryService.execute(query)             │
    │  ┌────────────────────────────────────┐  │
    │  │ 3a. Generate embedding             │  │
    │  │     embedding ← embeddingService   │  │
    │  │                 .embed(query)      │  │
    │  └────────────────────────────────────┘  │
    │  ┌────────────────────────────────────┐  │
    │  │ 3b. Vector search                  │  │
    │  │     results ← vectorStore          │  │
    │  │                .query(embedding)   │  │
    │  └────────────────────────────────────┘  │
    │  ┌────────────────────────────────────┐  │
    │  │ 3c. Rank & filter results          │  │
    │  │     skillMatches ← rank(results)   │  │
    │  └────────────────────────────────────┘  │
    │  ↓                                       │
    │  SkillMatch[]                           │
    └────────────┬─────────────────────────────┘
                 ↓
    ┌──────────────────────────────────────────┐
    │  Step 4: PROMPT BUILDING                 │
    │                                          │
    │  promptBuilder.buildSystemPrompt()       │
    │  promptBuilder.buildUserPrompt()         │
    │  ↓                                       │
    │  Message[]                              │
    └────────────┬─────────────────────────────┘
                 ↓
    ┌──────────────────────────────────────────┐
    │  Step 5: AI INFERENCE                    │
    │                                          │
    │  aiInference.infer(messages)             │
    │  ↓                                       │
    │  String (AI response)                   │
    └────────────┬─────────────────────────────┘
                 ↓
    ┌──────────────────────────────────────────┐
    │  Step 6: RESPONSE VALIDATION             │
    │                                          │
    │  responseValidator.validate(response)    │
    │  ↓                                       │
    │  ValidationResult                       │
    └────────────┬─────────────────────────────┘
                 ↓
    ┌──────────────────────────────────────────┐
    │  Step 7: FORMAT & RETURN                 │
    │                                          │
    │  Response (200/400/500)                  │
    └──────────────────────────────────────────┘
                 ↓
           HTTP Response
```

### Data Access Abstraction

```
QueryService
    │
    ├─→ d1Repository.getSkill(id)
    │   ├─→ env.DB.prepare('SELECT * FROM skills ...')
    │   └─→ Skill object
    │
    ├─→ vectorStore.query(embedding, topK)
    │   ├─→ Try Vectorize first
    │   │   └─→ env.VECTORIZE.query(...)
    │   ├─→ If Vectorize unavailable, KV fallback
    │   │   └─→ kvRepository.query(...)
    │   └─→ VectorSearchResult[]
    │
    └─→ cacheService.get(key)
        └─→ kvRepository.get(key)
            └─→ env.KV.get(key)
```

---

## Service Directory (11 Services)

### Group 1: Core Query Processing

#### 1. queryService.ts
```typescript
class QueryService {
  async execute(query: string): Promise<SkillMatch[]> {
    // 1. Generate embedding from query
    // 2. Search vector index
    // 3. Rank results
    // 4. Return top matches
  }
}

Dependencies Injected:
  - embeddingService     → Generate embeddings
  - vectorStore          → Search vectors
  - cacheService         → Cache results
  - skillRepository      → Hydrate skill details
```

**Single Responsibility:** Orchestrate query execution

---

#### 2. embeddingService.ts
```typescript
class EmbeddingService {
  async embed(text: string): Promise<number[]> {
    // Call Cloudflare AI with embedding model
    // @cf/baai/bge-base-en-v1.5
    // Return 768-dimensional vector
  }
}

Dependencies Injected:
  - env.AI               → AI bindings
```

**Single Responsibility:** Generate embeddings via AI

---

### Group 2: Data Access Layer

#### 3. vectorStore.ts (IVectorStore)
```typescript
interface IVectorStore {
  query(embedding: number[], topK: number, threshold: number): Promise<VectorSearchResult[]>;
  upsert(vectors: VectorRecord[]): Promise<void>;
}

Implementations:
  - VectorizeStore       → Production (Vectorize)
  - KVVectorStore        → Fallback (KV storage)
  - MockVectorStore      → Testing

Single Responsibility: Abstract vector search operations
```

---

#### 4. d1Repository.ts
```typescript
class D1Repository {
  async getSkill(id: number): Promise<Skill | null> { }
  async getAllSkills(): Promise<Skill[]> { }
  async getTechnology(id: number): Promise<Technology | null> { }
}

Dependencies Injected:
  - env.DB               → D1 database
```

**Single Responsibility:** SQL query execution

---

#### 5. kvRepository.ts
```typescript
class KVRepository {
  async get(key: string): Promise<string | null> { }
  async put(key: string, value: string, ttl?: number): Promise<void> { }
  async delete(key: string): Promise<void> { }
}

Dependencies Injected:
  - env.KV               → KV namespace
```

**Single Responsibility:** KV storage operations

---

#### 6. skillRepository.ts (ISkillRepository)
```typescript
class UnifiedSkillRepository {
  async getById(id: number): Promise<Skill | null> {
    // Try skills table first
    let skill = await d1Repository.getSkill(id);
    // Fall back to technologies table
    if (!skill) skill = await d1Repository.getTechnology(id);
    return skill;
  }
}

Dependencies Injected:
  - d1Repository        → Unified data access
```

**Single Responsibility:** Unified skill interface

---

### Group 3: AI Integration

#### 7. aiInference.ts
```typescript
class AIInferenceService {
  async infer(messages: Message[]): Promise<string> {
    // Send messages to Cloudflare AI
    // @cf/meta/llama-3.1-70b-instruct
    // Return AI response
  }
}

Dependencies Injected:
  - env.AI               → AI bindings
```

**Single Responsibility:** AI inference orchestration

---

#### 8. promptBuilder.ts (IPromptBuilder)
```typescript
class PromptBuilderService {
  buildSystemPrompt(projectDetection?: ProjectDetectionResult): string { }
  buildUserPrompt(context: PromptContext): string { }
  buildMessages(context: PromptContext): Message[] { }
}

Dependencies: None (pure prompt engineering)
```

**Single Responsibility:** Prompt construction

---

### Group 4: Validation & Detection

#### 9. questionValidator.ts (IQuestionValidator)
```typescript
class QuestionValidatorService {
  validate(question: string): ValidationResult {
    // Check length, format, language
    // Return { isValid, errors?, normalized? }
  }
}

Dependencies: None (pure validation)
```

**Single Responsibility:** Input validation

---

#### 10. responseValidator.ts (IResponseValidator)
```typescript
class ResponseValidatorService {
  validate(response: string): ValidationResult {
    // Check response format, length, completeness
    // Return { isValid, errors? }
  }
}

Dependencies: None (pure validation)
```

**Single Responsibility:** Output validation

---

#### 11. projectDetector.ts (IProjectDetector)
```typescript
class ProjectDetectorService {
  detect(question: string): ProjectDetectionResult {
    // Analyze question for project mentions
    // Return { isProjectSpecific, projectName?, confidence? }
  }
}

Dependencies: None (pure detection)
```

**Single Responsibility:** Project context detection

---

### Group 5: Infrastructure

#### 12. cacheService.ts
```typescript
class CacheService {
  async get(key: string): Promise<T | null> { }
  async set(key: string, value: T, ttl?: number): Promise<void> { }
}

Dependencies Injected:
  - kvRepository         → KV operations
```

**Single Responsibility:** Cache management

---

#### 13. container.ts (ServiceContainer)
```typescript
function createServiceContainer(env: FullEnv): ServiceContainer {
  // Instantiate all repositories
  const d1Repository = new D1Repository(env.DB);
  const vectorizeRepository = new VectorizeRepository(env.VECTORIZE);
  const kvRepository = new KVRepository(env.KV);
  
  // Instantiate all services
  const embeddingService = new EmbeddingService(env.AI);
  const queryService = new QueryService(
    embeddingService,
    vectorizeRepository,
    kvRepository,
    skillRepository
  );
  
  // Return container with all services wired
  return {
    queryService,
    embeddingService,
    vectorStore,
    // ... all 13 services
  };
}
```

**Single Responsibility:** Dependency wiring

---

## Service Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                  queryService (Orchestrator)                │
│                                                             │
│  Depends on:                                               │
│  ├─→ embeddingService     (Generate embeddings)            │
│  ├─→ vectorStore          (Search vectors)                 │
│  ├─→ cacheService         (Cache results)                  │
│  └─→ skillRepository      (Get skill details)              │
└─────────────────────────────────────────────────────────────┘
                            ↓
    ┌───────────────────────┼───────────────────────┐
    ↓                       ↓                       ↓
embeddingService       vectorStore           cacheService
    │                       │                       │
    └─→ env.AI          ┌───┴────┐            kvRepository
                        │        │                 │
                    Vectorize  KVRepo        env.KV
                        │        │
                    env.VECTORIZE │
                               env.KV
```

---

## Handler-Service-Repository Mapping

```
queryHandler
  ↓
serviceContainer.queryService ───┐
serviceContainer.aiInference     ├─→ Query → Response
serviceContainer.promptBuilder ──┘
      │
      ├─→ embeddingService ──→ vectorStore ──→ env.VECTORIZE
      ├─→ skillRepository ──→ d1Repository ──→ env.DB
      └─→ cacheService ──→ kvRepository ──→ env.KV

indexHandler
  ↓
serviceContainer.indexingService ──→ Query → Index
      │
      ├─→ embeddingService ──→ vectorStore ──→ env.VECTORIZE
      ├─→ d1Repository ──→ env.DB
      └─→ kvRepository ──→ env.KV
```

---

## Configuration Flow

```
config.ts (Centralized settings)
    │
    ├─→ AI_CONFIG
    │   ├─→ EMBEDDING_MODEL: @cf/baai/bge-base-en-v1.5
    │   └─→ CHAT_MODEL: @cf/meta/llama-3.1-70b-instruct
    │
    ├─→ SEARCH_CONFIG
    │   ├─→ TOP_K_EXTENDED: 10
    │   ├─→ HIGH_CONFIDENCE: 0.75
    │   └─→ MIN_SIMILARITY: 0.50
    │
    ├─→ CACHE_CONFIG
    │   ├─→ DEFAULT_TTL: 3600
    │   └─→ QUERY_PREFIX: 'query'
    │
    └─→ ENDPOINTS
        ├─→ /query
        ├─→ /index
        ├─→ /health
        └─→ /session
```

---

## Error Handling Flow

```
Service Operation
    │
    ├─→ Throw specific error type
    │   ├─→ ValidationError (400)
    │   ├─→ NotFoundError (404)
    │   ├─→ ServiceError (500)
    │   └─→ ... (10 total types)
    │
    ↓
Handler Catch Block
    │
    ├─→ isApplicationError(error)?
    │   ├─→ Yes: Use error.statusCode
    │   └─→ No: Use 500 (InternalError)
    │
    ↓
Logger.error(category, message, context)
    │
    ├─→ Log to console with context
    └─→ Export to analytics engine
    
    ↓
errorToResponse(error) → JSON response
    │
    └─→ { error: code, message, statusCode }
```

---

## Testing Setup

```
Test File Structure:
├── queryService.test.ts
│   └─→ Mock: embeddingService, vectorStore, skillRepository
│
├── promptBuilder.test.ts
│   └─→ No mocks needed (pure function)
│
├── projectDetector.test.ts
│   └─→ No mocks needed (pure function)
│
└── integration/
    └─→ queryHandler.test.ts
        └─→ Mock: entire ServiceContainer
```

---

## Summary

**Service Count:** 13 services  
**Lines of Code per Service:** <200 LOC average  
**Dependencies per Service:** 1-4 injected  
**God Objects:** 0 (excellent isolation)  

**Key Principles:**
- ✅ Single Responsibility: Each service does one thing
- ✅ Dependency Injection: No hardcoded dependencies
- ✅ Interface Segregation: Only inject what's needed
- ✅ Repository Pattern: Data access abstracted
- ✅ Container Pattern: Single source of truth for wiring

---

**This architecture exemplifies clean, maintainable, SOLID-compliant TypeScript.**
