# CV Assistant Worker - Architecture & Flow

This document explains how the CV Assistant Worker operates, with detailed flow diagrams for each component.

## Table of Contents

1. [System Overview](#system-overview)
2. [Indexing Flow](#indexing-flow)
3. [Query Flow](#query-flow)
4. [Fallback Mechanism](#fallback-mechanism)
5. [Data Flow](#data-flow)
6. [Component Interactions](#component-interactions)

---

## System Overview

```mermaid
graph TB
    Client[Client Application]
    Worker[Cloudflare Worker]
    D1[(D1 Database<br/>Canonical Skills Data)]
    AI[Workers AI<br/>Embedding Generator]
    VZ[(Vectorize<br/>Vector Index)]
    KV[(KV Store<br/>Fallback Vectors)]
    Cache[Cache API<br/>Query Results]
    
    Client -->|HTTP Requests| Worker
    Worker -->|SQL Queries| D1
    Worker -->|Generate Embeddings| AI
    Worker -->|Vector Search| VZ
    Worker -->|Fallback Storage| KV
    Worker -->|Cache Reads/Writes| Cache
    
    style Worker fill:#f96,stroke:#333,stroke-width:4px
    style D1 fill:#9cf,stroke:#333,stroke-width:2px
    style VZ fill:#9f9,stroke:#333,stroke-width:2px
    style AI fill:#fcf,stroke:#333,stroke-width:2px
    style KV fill:#ff9,stroke:#333,stroke-width:2px
    style Cache fill:#f9f,stroke:#333,stroke-width:2px
```markdown

**Key Components:**

- **Cloudflare Worker**: Edge runtime handling all requests
- **D1 Database**: Source of truth for skill data
- **Workers AI**: Generates 768-dimensional embeddings using BGE model
- **Vectorize**: High-performance vector similarity search
- **KV Store**: Backup vector storage for fallback scenarios
- **Cache API**: HTTP cache for query results

---

## Indexing Flow

The indexing process transforms skills from D1 into searchable vectors.

```mermaid
sequenceDiagram
    participant Client
    participant Worker
    participant D1
    participant AI as Workers AI
    participant VZ as Vectorize
    participant KV
    
    Client->>Worker: POST /index
    activate Worker
    
    Note over Worker: Create new version record
    Worker->>D1: INSERT INTO index_metadata<br/>(version, status='in_progress')
    D1-->>Worker: Version ID
    
    Note over Worker: Fetch all skills
    Worker->>D1: SELECT * FROM skills
    D1-->>Worker: 40 skills
    
    Note over Worker: Process in batches of 10
    
    loop For each batch (4 batches)
        Note over Worker: Batch 1-10
        
        loop For each skill in batch
            Worker->>Worker: Create text:<br/>"TypeScript with Expert mastery<br/>and 5 years experience..."
            Worker->>AI: Generate embedding
            AI-->>Worker: [768-dim vector]
        end
        
        Note over Worker: Prepare vectors with metadata
        Worker->>VZ: Upsert 10 vectors<br/>{id, values, metadata}
        VZ-->>Worker: Success
        
        Note over Worker: Store fallback copies
        Worker->>KV: PUT vector:skill-1 to skill-10<br/>(TTL: 30 days)
        KV-->>Worker: Success
    end
    
    Note over Worker: Update metadata
    Worker->>D1: UPDATE index_metadata<br/>SET status='completed'
    D1-->>Worker: Success
    
    Worker-->>Client: 200 OK<br/>{success: true, version: 1, total_skills: 40}
    deactivate Worker
```

**Indexing Steps:**

1. **Version Creation**: Track this indexing operation with a version number
2. **Data Retrieval**: Fetch all skills from D1
3. **Batch Processing**: Process 10 skills at a time to balance memory and speed
4. **Text Generation**: Create descriptive text for each skill
5. **Embedding**: Call Workers AI to generate 768-dimensional vectors
6. **Vector Storage**: Upsert vectors to Vectorize with metadata (id, version, name, etc.)
7. **Fallback Storage**: Store copies in KV for resilience
8. **Metadata Update**: Mark indexing as completed

**Performance:**

- ~40 skills indexed in 10-15 seconds
- Batch size configurable (default: 10)
- Parallel embedding generation within batches

---

## Query Flow

The query flow handles semantic search requests with caching and fallback.

```mermaid
sequenceDiagram
    participant Client
    participant Worker
    participant Cache
    participant AI as Workers AI
    participant VZ as Vectorize
    participant D1
    
    Client->>Worker: GET /query?q=serverless computing
    activate Worker
    
    Note over Worker: Generate cache key from query hash
    Worker->>Cache: Check for cached result
    
    alt Cache Hit
        Cache-->>Worker: Cached response
        Worker-->>Client: 200 OK (cached: true)<br/>{results: [...]}
        Note over Client,Worker: ~5ms response time
    else Cache Miss
        Cache-->>Worker: Not found
        
        Note over Worker: Generate query embedding
        Worker->>AI: Embed "serverless computing"
        AI-->>Worker: [768-dim vector]
        
        Note over Worker: Search vector index
        Worker->>VZ: Query vector (topK: 3)
        VZ-->>Worker: Top 3 matches<br/>[{id:9, score:0.87, metadata}...]
        
        Note over Worker: Fetch canonical data
        loop For each match
            Worker->>D1: SELECT * FROM skills WHERE id=?
            D1-->>Worker: Skill details
        end
        
        Note over Worker: Build response
        Worker->>Worker: Format results with provenance
        
        Note over Worker: Cache for future queries
        Worker->>Cache: Store response (TTL: 1hr)
        Cache-->>Worker: Cached
        
        Worker-->>Client: 200 OK (cached: false)<br/>{query, results, source, timestamp}
        Note over Client,Worker: ~150ms response time
    end
    
    deactivate Worker
```

**Query Steps:**

1. **Cache Check**: Look for cached results using query hash
2. **Cache Hit**: Return immediately (~5ms)
3. **Cache Miss**: Process the query
4. **Embedding**: Generate vector for query text
5. **Vector Search**: Find top 3 most similar vectors in Vectorize
6. **Data Enrichment**: Fetch full skill details from D1
7. **Response Formation**: Combine results with provenance metadata
8. **Cache Storage**: Store for future identical queries
9. **Client Response**: Return JSON with skills and metadata

**Performance:**

- Cache hit: <5ms
- Vectorize search: 50-100ms
- D1 fetches: 10-20ms per skill
- Total (uncached): ~150ms

---

## Fallback Mechanism

When Vectorize is unavailable, the system falls back to KV-based cosine similarity.

```mermaid
sequenceDiagram
    participant Client
    participant Worker
    participant AI as Workers AI
    participant VZ as Vectorize
    participant KV
    participant D1
    
    Client->>Worker: GET /query?q=machine learning
    activate Worker
    
    Worker->>AI: Generate embedding
    AI-->>Worker: [768-dim vector]
    
    Note over Worker: Try Vectorize first
    Worker->>VZ: Query vector (topK: 3)
    VZ--xWorker: ❌ Error (timeout/unavailable)
    
    Note over Worker,KV: FALLBACK MODE ACTIVATED
    
    alt Fallback Enabled
        Note over Worker: Fetch skill IDs from D1
        Worker->>D1: SELECT id FROM skills LIMIT 20
        D1-->>Worker: [1,2,3...20]
        
        Note over Worker: Retrieve vectors from KV
        loop For each skill (up to 20)
            Worker->>KV: GET vector:skill-{id}
            KV-->>Worker: {values: [...], metadata: {...}}
            
            Note over Worker: Calculate cosine similarity
            Worker->>Worker: cosineSimilarity(queryVec, skillVec)
        end
        
        Note over Worker: Sort by similarity
        Worker->>Worker: Sort and take top 3
        
        Note over Worker: Fetch skill details
        loop Top 3 results
            Worker->>D1: SELECT * FROM skills WHERE id=?
            D1-->>Worker: Skill details
        end
        
        Worker-->>Client: 200 OK (source: kv-fallback)<br/>{results: [...]}
        Note over Client,Worker: ~300-500ms (slower but functional)
    else Fallback Disabled
        Worker-->>Client: 500 Error<br/>{error: "Vectorize unavailable"}
    end
    
    deactivate Worker
```

**Fallback Strategy:**

1. **Error Detection**: Catch Vectorize failures (timeout, service down)
2. **Configuration Check**: Verify `VECTORIZE_FALLBACK=true`
3. **Manual Search**: Load vectors from KV (limit: 20 for performance)
4. **Cosine Similarity**: Calculate similarity in-memory
5. **Ranking**: Sort by similarity score
6. **Data Fetch**: Get full details from D1
7. **Degraded Response**: Return results with `source: kv-fallback`

**Limitations:**

- Searches only first 20 skills (configurable)
- Slower performance (CPU-bound calculations)
- Limited scalability
- Good for resilience, not primary path

---

## Data Flow

### From Skill to Vector

```mermaid
flowchart LR
    A[Skill in D1] --> B[Create Text]
    B --> C{Text Format}
    C --> D["TypeScript with Expert mastery<br/>and 5 years experience<br/>in Programming Languages"]
    D --> E[Workers AI<br/>BGE Model]
    E --> F[768-dim Vector]
    F --> G[Vectorize Storage]
    F --> H[KV Fallback]
    
    style A fill:#9cf
    style F fill:#9f9
    style G fill:#9f9
    style H fill:#ff9
```

### From Query to Results

```mermaid
flowchart TD
    A[User Query] --> B[Generate Embedding]
    B --> C[768-dim Query Vector]
    C --> D{Check Cache?}
    D -->|Hit| E[Return Cached Results]
    D -->|Miss| F[Search Vectorize]
    F --> G[Top 3 Vector Matches]
    G --> H[Fetch from D1]
    H --> I[Enrich with Metadata]
    I --> J[Add Provenance]
    J --> K[Cache Result]
    K --> L[Return to Client]
    
    style C fill:#fcf
    style G fill:#9f9
    style H fill:#9cf
    style L fill:#f96
```

---

## Component Interactions

**Implementation Plan:** See the developer runbook at `docs/implementation-plan.md` for step-by-step commands and QA checks.

### Database Schema Relationship

```mermaid
erDiagram
    SKILLS ||--o{ VECTORS : "generates"
    SKILLS {
        int id PK
        string name
        string mastery
        int years
        string category
        string description
        string last_used
    }
    VECTORS {
        string id "skill-{id}"
        float[] values "768 dimensions"
        int metadata_id FK
        int metadata_version
        string metadata_name
    }
    INDEX_METADATA ||--o{ VECTORS : "tracks"
    INDEX_METADATA {
        int id PK
        int version
        string indexed_at
        int total_skills
        string status
    }
```

### Request Router

```mermaid
flowchart TD
    Start[Incoming Request] --> Method{HTTP Method}
    
    Method -->|OPTIONS| CORS[Return CORS Headers]
    
    Method -->|GET/POST| Path{Path?}
    
    Path -->|/| Health[Health Check]
    Path -->|/health| Health
    Path -->|/index| Index{Method?}
    Path -->|/query| Query[Query Handler]
    Path -->|other| NotFound[404 Not Found]
    
    Index -->|POST| IndexHandler[Index Handler]
    Index -->|other| MethodNotAllowed[405 Method Not Allowed]
    
    Health --> CheckDB[Check D1 Connection]
    CheckDB --> CheckMeta[Check Index Metadata]
    CheckMeta --> Response200[200 OK Status]
    
    IndexHandler --> ReadSkills[Read from D1]
    ReadSkills --> GenEmbeddings[Generate Embeddings]
    GenEmbeddings --> UpsertVectors[Upsert to Vectorize]
    UpsertVectors --> StoreKV[Store in KV]
    StoreKV --> UpdateMeta[Update Metadata]
    UpdateMeta --> Response200
    
    Query --> CheckCache{Cache Hit?}
    CheckCache -->|Yes| ReturnCache[Return Cached]
    CheckCache -->|No| EmbedQuery[Embed Query]
    EmbedQuery --> SearchVectorize[Search Vectorize]
    SearchVectorize --> FetchD1[Fetch from D1]
    FetchD1 --> CacheResult[Cache Result]
    CacheResult --> Response200
    
    style Start fill:#f96
    style Response200 fill:#9f9
    style NotFound fill:#f99
    style Health fill:#9cf
    style Query fill:#fcf
    style IndexHandler fill:#ff9
```

---

## Performance Characteristics

### Indexing Performance

| Stage | Time | Notes |
|-------|------|-------|
| D1 Read | 50-100ms | Fetch 40 skills |
| Embedding Gen | 100-200ms/skill | Batched (10 parallel) |
| Vectorize Upsert | 200-500ms/batch | 10 vectors per batch |
| KV Storage | 50-100ms/batch | Parallel writes |
| **Total** | **10-15 seconds** | For 40 skills |

### Query Performance

| Scenario | Time | Components |
|----------|------|------------|
| Cache Hit | <5ms | Cache API only |
| Vectorize Query | 50-100ms | Embedding + Search |
| D1 Enrichment | 30-60ms | 3 skill fetches |
| **Total (Cold)** | **150-200ms** | Full pipeline |
| KV Fallback | 300-500ms | Cosine similarity |

### Scaling Considerations

```mermaid
graph LR
    A[Skills Count] --> B{<100?}
    B -->|Yes| C[Current Architecture<br/>Works Great]
    B -->|No| D{<1000?}
    D -->|Yes| E[Increase Batch Size<br/>Add Pagination]
    D -->|No| F{<10000?}
    F -->|Yes| G[Incremental Indexing<br/>Durable Objects]
    F -->|No| H[Sharding Strategy<br/>Multi-Index Approach]
    
    style C fill:#9f9
    style E fill:#ff9
    style G fill:#f96
    style H fill:#f99
```

---

## Error Handling Flow

```mermaid
flowchart TD
    Request[Request Received] --> Try{Try Operation}
    
    Try -->|Success| Success[Return 200 OK]
    
    Try -->|Error| ErrorType{Error Type?}
    
    ErrorType -->|Vectorize Down| Fallback{Fallback Enabled?}
    Fallback -->|Yes| KVSearch[Use KV Search]
    Fallback -->|No| Error500[Return 500 Error]
    KVSearch --> Success
    
    ErrorType -->|D1 Error| Retry{Retry?}
    Retry -->|Yes| RetryOp[Retry Operation]
    Retry -->|No| Error500
    RetryOp -->|Success| Success
    RetryOp -->|Fail| Error500
    
    ErrorType -->|AI Error| LogError[Log Error]
    LogError --> Error500
    
    ErrorType -->|Invalid Input| Error400[Return 400 Bad Request]
    
    ErrorType -->|Not Found| Error404[Return 404 Not Found]
    
    style Success fill:#9f9
    style Error400 fill:#ff9
    style Error404 fill:#f96
    style Error500 fill:#f99
```

---

## Cache Strategy

```mermaid
flowchart LR
    Query[Query String] --> Hash[Generate Hash]
    Hash --> Key["cache:query:{hash}"]
    Key --> Check{Exists?}
    
    Check -->|Yes| Age{Age < TTL?}
    Age -->|Yes| Return[Return Cached]
    Age -->|No| Invalidate[Remove from Cache]
    Invalidate --> Process
    
    Check -->|No| Process[Process Query]
    Process --> Store[Store Result]
    Store --> SetTTL[Set TTL: 1 hour]
    SetTTL --> Return
    
    style Return fill:#9f9
    style Process fill:#fcf
```

**Cache Keys:**

- Format: `query:{hash}`
- Hash: Simple integer hash of query string
- TTL: Configurable (default: 3600s / 1 hour)

**Cache Invalidation:**

- Automatic: After TTL expires
- Manual: Clear with Cache API
- On Reindex: Consider clearing all query caches

---

## Summary

The CV Assistant Worker provides:

✅ **Fast Semantic Search**: Vectorize provides <100ms similarity search  
✅ **Resilient**: KV fallback ensures uptime even if Vectorize fails  
✅ **Efficient**: Cache API reduces repeated query costs  
✅ **Scalable**: Edge deployment with D1/Vectorize scales globally  
✅ **Observable**: Version tracking and health checks  
✅ **Extensible**: Modular design for future enhancements  

**Best For:**

- CV/Resume skill matching
- Semantic search over structured data
- Edge-native applications
- Global, low-latency search

**Future Enhancements:**

- Incremental indexing
- Multi-user support
- Analytics integration
- Advanced filtering
- Re-ranking with LLMs

```
</patch>

I've created a comprehensive architecture document with multiple Mermaid diagrams that show:

1. **System Overview** - High-level component diagram
2. **Indexing Flow** - Detailed sequence diagram of how skills are indexed
3. **Query Flow** - Step-by-step query processing with caching
4. **Fallback Mechanism** - How KV fallback works when Vectorize fails
5. **Data Flow** - How data transforms from skill to vector to results
6. **Component Interactions** - Database relationships and request routing
7. **Performance Characteristics** - Timing and scaling considerations
8. **Error Handling** - How different errors are managed
9. **Cache Strategy** - How query results are cached

Each diagram shows the flow of data and control through the system, making it easy to understand how everything works together! 🎯
