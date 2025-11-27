# Service Composition & Interaction Map - MyAIAgentPrivate v1.3.0

**Date:** November 27, 2025  
**Purpose:** Visual guide to service architecture and data flow

---

## Service Ecosystem Overview

```mermaid
graph TB
    subgraph "Handler Layer (Entry Points)"
        QH[Query Handler]
        IH[Indexing Handler]
        HH[Health Handler]
        SH[Session Handler]
    end
    
    subgraph "ServiceContainer (DIP)"
        SC[Dependency Injection<br/>Single source of truth]
    end
    
    subgraph "Services (Business Logic)"
        QS[QueryService]
        IS[IndexingService]
        ES[EmbeddingService]
        AI[AIInference]
        PB[PromptBuilder]
    end
    
    subgraph "Repthe candidateries (Data Access)"
        D1R[D1Repthe candidatery]
        VR[VectorizeRepthe candidatery]
        KVR[KVRepthe candidatery]
        SR[SkillRepthe candidatery]
    end
    
    subgraph "Infrastructure"
        CS[CacheService]
        VS[VectorStore]
    end
    
    QH --> SC
    IH --> SC
    HH --> SC
    SH --> SC
    
    SC --> QS
    SC --> IS
    SC --> ES
    SC --> AI
    SC --> PB
    
    SC --> D1R
    SC --> VR
    SC --> KVR
    SC --> SR
    
    SC --> CS
    SC --> VS
    
    QS --> ES
    QS --> VS
    QS --> CS
    QS --> SR
    
    IS --> ES
    IS --> VS
    IS --> D1R
```

---

## Query Execution Flow

```mermaid
sequenceDiagram
    participant Client
    participant Handler as queryHandler
    participant QV as QuestionValidator
    participant PD as ProjectDetector
    participant QS as QueryService
    participant ES as EmbeddingService
    participant VS as VectorStore
    participant PB as PromptBuilder
    participant AI as AIInference
    participant RV as ResponseValidator
    
    Client->>Handler: HTTP Request
    Handler->>QV: validate(query)
    QV-->>Handler: ValidationResult
    
    Handler->>PD: detect(query)
    PD-->>Handler: ProjectDetectionResult
    
    Handler->>QS: execute(query)
    QS->>ES: embed(query)
    ES-->>QS: embedding[768]
    
    QS->>VS: query(embedding, topK)
    VS-->>QS: VectorSearchResult[]
    
    QS-->>Handler: SkillMatch[]
    
    Handler->>PB: buildMessages(context)
    PB-->>Handler: Message[]
    
    Handler->>AI: infer(messages)
    AI-->>Handler: response
    
    Handler->>RV: validate(response)
    RV-->>Handler: ValidationResult
    
    Handler-->>Client: HTTP Response
```

---

## Data Access Abstraction

```mermaid
flowchart TD
    QS[QueryService] --> D1R[d1Repthe candidatery.getSkill]
    QS --> VS[vectorStore.query]
    QS --> CS[cacheService.get]
    
    D1R --> DB[(env.DB<br/>D1 Database)]
    
    VS --> VZ{Vectorize<br/>Available?}
    VZ -->|Yes| VEC[(env.VECTORIZE)]
    VZ -->|No| KVF[kvRepthe candidatery<br/>Fallback]
    KVF --> KV[(env.KV)]
    
    CS --> KVR[kvRepthe candidatery]
    KVR --> KV
    
    style DB fill:#e8f5e9
    style VEC fill:#e3f2fd
    style KV fill:#fff3e0
```

---

## Service Directory (13 Services)

### Architecture Layers

```mermaid
graph LR
    subgraph "Layer 1: Handlers"
        H1[queryHandler]
        H2[indexHandler]
        H3[healthHandler]
        H4[sessionHandler]
    end
    
    subgraph "Layer 2: Services"
        S1[queryService]
        S2[indexingService]
        S3[embeddingService]
        S4[aiInference]
        S5[promptBuilder]
        S6[questionValidator]
        S7[responseValidator]
        S8[projectDetector]
    end
    
    subgraph "Layer 3: Repthe candidateries"
        R1[d1Repthe candidatery]
        R2[vectorStore]
        R3[kvRepthe candidatery]
        R4[skillRepthe candidatery]
    end
    
    subgraph "Layer 4: Bindings"
        B1[env.DB]
        B2[env.VECTORIZE]
        B3[env.KV]
        B4[env.AI]
    end
    
    H1 --> S1
    H2 --> S2
    
    S1 --> R1
    S1 --> R2
    S2 --> R1
    S2 --> R2
    
    R1 --> B1
    R2 --> B2
    R2 --> B3
```

---

## Group 1: Core Query Processing

### queryService.ts

```mermaid
classDiagram
    class QueryService {
        -embeddingService: EmbeddingService
        -vectorStore: IVectorStore
        -cacheService: CacheService
        -skillRepthe candidatery: SkillRepthe candidatery
        +execute(query: string) SkillMatch[]
        -generateEmbedding(text: string) number[]
        -searchVectors(embedding: number[]) VectorSearchResult[]
        -rankResults(results: VectorSearchResult[]) SkillMatch[]
    }
    
    QueryService --> EmbeddingService
    QueryService --> IVectorStore
    QueryService --> CacheService
    QueryService --> SkillRepthe candidatery
```

**Single Responsibility:** Orchestrate query execution

---

### embeddingService.ts

```mermaid
classDiagram
    class EmbeddingService {
        -ai: Ai
        +embed(text: string) Promise~number[]~
    }
    
    EmbeddingService --> Ai : uses @cf/baai/bge-base-en-v1.5
```

**Single Responsibility:** Generate embeddings via AI

---

## Group 2: Data Access Layer

### vectorStore.ts (IVectorStore)

```mermaid
classDiagram
    class IVectorStore {
        <<interface>>
        +query(embedding: number[], topK: number, threshold: number) Promise~VectorSearchResult[]~
        +upsert(vectors: VectorRecord[]) Promise~void~
    }
    
    class VectorizeStore {
        +query() Promise~VectorSearchResult[]~
        +upsert() Promise~void~
    }
    
    class KVVectorStore {
        +query() Promise~VectorSearchResult[]~
        +upsert() Promise~void~
    }
    
    class MockVectorStore {
        +query() Promise~VectorSearchResult[]~
        +upsert() Promise~void~
    }
    
    IVectorStore <|.. VectorizeStore : implements
    IVectorStore <|.. KVVectorStore : implements
    IVectorStore <|.. MockVectorStore : implements
```

**Single Responsibility:** Abstract vector search operations (LSP)

---

## Group 3: AI Integration

```mermaid
flowchart LR
    subgraph "AI Services"
        ES[EmbeddingService<br/>Generate vectors]
        AI[AIInference<br/>Chat completion]
        PB[PromptBuilder<br/>Prompt engineering]
    end
    
    subgraph "Cloudflare AI"
        EM[bge-base-en-v1.5<br/>768 dimensions]
        LLM[llama-3.1-70b<br/>Chat model]
    end
    
    ES -->|embed| EM
    AI -->|infer| LLM
    PB -->|builds prompts for| AI
```

---

## Group 4: Validation & Detection

```mermaid
flowchart TD
    Q[User Question] --> QV[QuestionValidator]
    QV -->|if valid| PD[ProjectDetector]
    PD -->|context| QS[QueryService]
    QS -->|results| PB[PromptBuilder]
    PB -->|messages| AI[AIInference]
    AI -->|response| RV[ResponseValidator]
    RV -->|if valid| R[HTTP Response]
    
    QV -->|if invalid| E1[400 ValidationError]
    RV -->|if invalid| E2[500 ServiceError]
```

---

## Group 5: Infrastructure

### ServiceContainer (container.ts)

```mermaid
flowchart TD
    ENV[FullEnv] --> SC[createServiceContainer]
    
    SC --> D1R[D1Repthe candidatery]
    SC --> VR[VectorizeRepthe candidatery]
    SC --> KVR[KVRepthe candidatery]
    
    D1R --> SR[UnifiedSkillRepthe candidatery]
    VR --> VS[VectorStore]
    KVR --> CS[CacheService]
    
    SC --> ES[EmbeddingService]
    ES --> QS[QueryService]
    VS --> QS
    CS --> QS
    SR --> QS
    
    SC --> IS[IndexingService]
    
    SC --> AI[AIInference]
    SC --> PB[PromptBuilder]
    SC --> QV[QuestionValidator]
    SC --> RV[ResponseValidator]
    SC --> PD[ProjectDetector]
    
    SC --> CONTAINER[ServiceContainer]
```

**Single Responsibility:** Dependency wiring (single source of truth)

---

## Service Dependency Graph

```mermaid
graph TD
    QS[queryService<br/>Orchestrator]
    
    QS --> ES[embeddingService<br/>Generate embeddings]
    QS --> VS[vectorStore<br/>Search vectors]
    QS --> CS[cacheService<br/>Cache results]
    QS --> SR[skillRepthe candidatery<br/>Get skill details]
    
    ES --> AI_BIND[env.AI]
    
    VS --> VZ[Vectorize]
    VS --> KV_FALL[KV Fallback]
    
    VZ --> VEC_BIND[env.VECTORIZE]
    KV_FALL --> KV_BIND[env.KV]
    
    CS --> KVR[kvRepthe candidatery]
    KVR --> KV_BIND
    
    SR --> D1R[d1Repthe candidatery]
    D1R --> DB_BIND[env.DB]
    
    style QS fill:#e3f2fd
    style ES fill:#f3e5f5
    style VS fill:#e8f5e9
    style CS fill:#fff3e0
    style SR fill:#fce4ec
```

---

## Handler-Service-Repthe candidatery Mapping

### Query Flow

```mermaid
flowchart LR
    subgraph "Query Flow"
        QH[queryHandler]
        QS[queryService]
        AI[aiInference]
        PB[promptBuilder]
        ES[embeddingService]
        VS[vectorStore]
        SR[skillRepthe candidatery]
        D1R[d1Repthe candidatery]
        
        QH --> QS
        QH --> AI
        QH --> PB
        QS --> ES
        QS --> VS
        QS --> SR
        SR --> D1R
    end
    
    subgraph "Bindings"
        VS --> VEC[env.VECTORIZE]
        D1R --> DB[env.DB]
        ES --> AII[env.AI]
    end
```

### Index Flow

```mermaid
flowchart LR
    subgraph "Index Flow"
        IH[indexHandler]
        IS[indexingService]
        ES[embeddingService]
        VS[vectorStore]
        D1R[d1Repthe candidatery]
        KVR[kvRepthe candidatery]
        
        IH --> IS
        IS --> ES
        IS --> VS
        IS --> D1R
        IS --> KVR
    end
    
    subgraph "Bindings"
        VS --> VEC[env.VECTORIZE]
        D1R --> DB[env.DB]
        KVR --> KV[env.KV]
    end
```

---

## Configuration Flow

```mermaid
flowchart TD
    CFG[config.ts<br/>Centralized settings]
    
    CFG --> AI_CFG[AI_CONFIG]
    CFG --> SEARCH_CFG[SEARCH_CONFIG]
    CFG --> CACHE_CFG[CACHE_CONFIG]
    CFG --> EP[ENDPOINTS]
    
    AI_CFG --> EM[EMBEDDING_MODEL<br/>@cf/baai/bge-base-en-v1.5]
    AI_CFG --> CM[CHAT_MODEL<br/>@cf/meta/llama-3.1-70b-instruct]
    
    SEARCH_CFG --> TK[TOP_K_EXTENDED: 10]
    SEARCH_CFG --> HC[HIGH_CONFIDENCE: 0.75]
    SEARCH_CFG --> MS[MIN_SIMILARITY: 0.50]
    
    CACHE_CFG --> TTL[DEFAULT_TTL: 3600]
    CACHE_CFG --> QP[QUERY_PREFIX: 'query']
    
    EP --> E1[/query]
    EP --> E2[/index]
    EP --> E3[/health]
    EP --> E4[/session]
```

---

## Error Handling Flow

```mermaid
flowchart TD
    OP[Service Operation] --> ERR{Error?}
    
    ERR -->|Yes| TYPE[Throw Typed Error]
    ERR -->|No| SUCCESS[Return Result]
    
    TYPE --> VE[ValidationError<br/>400]
    TYPE --> NF[NotFoundError<br/>404]
    TYPE --> SE[ServiceError<br/>500]
    TYPE --> TE[TimeoutError<br/>504]
    TYPE --> OT[... 10 types total]
    
    VE --> CATCH[Handler Catch Block]
    NF --> CATCH
    SE --> CATCH
    TE --> CATCH
    OT --> CATCH
    
    CATCH --> CHECK{isApplicationError?}
    CHECK -->|Yes| USE_CODE[Use error.statusCode]
    CHECK -->|No| DEFAULT[Use 500]
    
    USE_CODE --> LOG[Logger.error]
    DEFAULT --> LOG
    
    LOG --> RESP[errorToResponse]
    RESP --> JSON[JSON Response<br/>error, message, statusCode]
```

---

## Testing Setup

```mermaid
flowchart TD
    subgraph "Unit Tests"
        QST[queryService.test.ts]
        PBT[promptBuilder.test.ts]
        PDT[projectDetector.test.ts]
    end
    
    subgraph "Mocks Required"
        QST --> M1[Mock: embeddingService]
        QST --> M2[Mock: vectorStore]
        QST --> M3[Mock: skillRepthe candidatery]
        
        PBT --> NM1[No mocks<br/>Pure function]
        PDT --> NM2[No mocks<br/>Pure function]
    end
    
    subgraph "Integration Tests"
        INT[queryHandler.test.ts]
        INT --> MSC[Mock: entire ServiceContainer]
    end
```

---

## SOLID Principles Visualization

```mermaid
mindmap
  root((SOLID))
    SRP
      queryService
        Query orchestration only
      embeddingService
        AI embeddings only
      promptBuilder
        Prompt construction only
      validators
        Validation only
    OCP
      RouteRegistry
        Extend via registration
      Error Hierarchy
        Extend without modification
    LSP
      IVectorStore
        VectorizeStore
        KVVectorStore
        MockVectorStore
    ISP
      QueryEnv
        Only DB, Vector, AI, Cache
      HealthEnv
        Minimal bindings
      IndexEnv
        Only DB, Vector, Cache
    DIP
      ServiceContainer
        All dependencies injected
      Handlers
        Never access env directly
```

---

## Summary

| Metric | Value |
|--------|-------|
| **Service Count** | 13 services |
| **LOC per Service** | <200 average |
| **Dependencies per Service** | 1-4 injected |
| **God Objects** | 0 (excellent isolation) |

### Key Principles Applied

```mermaid
pie title SOLID Compliance
    "SRP - Single Responsibility" : 20
    "OCP - Open/Closed" : 20
    "LSP - Liskov Substitution" : 20
    "ISP - Interface Segregation" : 20
    "DIP - Dependency Inversion" : 20
```

---

**This architecture exemplifies clean, maintainable, SOLID-compliant TypeScript.**
