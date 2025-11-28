# CV Assistant - Evidence-Based AI Agent

A semantic search engine and AI assistant for professional skills built on Cloudflare's edge platform. Uses **evidence-based responses** that focus on factual outcomes rather than self-assessed labels.

## 🏗️ SOLID Architecture (A+ Grade)

This project demonstrates clean architecture with 13 single-responsibility services:

| Service | Responsibility |
|---------|---------------|
| `PromptBuilderService` | Constructs AI prompts |
| `ProjectDetectorService` | Detects project-specific queries |
| `QuestionValidatorService` | Validates query appropriateness |
| `ResponseValidatorService` | Ensures response quality |
| `QueryService` | Orchestrates semantic search |
| `IndexingService` | Manages vector indexing |
| `D1Repository` | Database operations |
| `VectorRepository` | Vector storage operations |
| `CacheService` | Response caching |
| `EmbeddingService` | AI embedding generation |
| `AIReplyService` | LLM response generation |
| `RoutingService` | Request routing |
| `Logger` | Structured logging |

## 🎯 Key Features

- **Evidence-Based Responses**: Facts speak for themselves—no self-assessed labels like "senior" or "expert"
- **Semantic Search**: Vector-based similarity search using D1 + Workers AI embeddings
- **Edge-Native**: Runs on Cloudflare Workers with D1 database and Vectorize
- **AI-Powered Replies**: LLM-generated responses via Workers AI
- **No Fluff**: Banned phrases like "extensive experience", "strong foundation"
- **Turnstile Protected**: Cloudflare Turnstile prevents bot abuse

## 🚀 Quick Start

### Prerequisites

1. [Cloudflare account](https://dash.cloudflare.com/sign-up)
2. [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed
3. Node.js 18+

### Setup

```bash
# Clone and install
npm install

# Copy example config
cp wrangler.example.toml wrangler.toml

# Create D1 database
wrangler d1 create cv_assistant_db
# Copy the database_id into wrangler.toml

# Create Vectorize index
wrangler vectorize create cv-skills-index --dimensions=768 --metric=cosine

# Apply schema
wrangler d1 execute cv_assistant_db --file=migrations/001_schema.sql

# Seed with your data
wrangler d1 execute cv_assistant_db --file=migrations/sample_seed_data.sql

# Build and deploy
npm run build
npm run deploy
```

### Query the Assistant

```bash
curl "https://your-worker.workers.dev/query?q=Tell me about your microservices experience"
```

**Response:**

```json
{
  "query": "Tell me about your microservices experience",
  "results": [...],
  "assistantReply": "I engineered microservices achieving 99.9% uptime at Acme Corp, cutting release cycles from weeks to days.",
  "source": "d1-vectors",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## 🎨 Answer Philosophy

### ❌ Before (Activity-Driven)

> "I'm an exceptional engineer with a proven track record in microservices."

### ✅ After (Evidence-Based)

> "I engineered microservices achieving 99.9% uptime at Acme Corp, cutting release cycles from weeks to days."

## 📋 Database Schema

The `technology` table includes outcome-driven fields:

```sql
CREATE TABLE technology (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  experience_years INTEGER,
  level TEXT,
  summary TEXT,
  action TEXT,              -- What was done
  effect TEXT,              -- Technical effect
  outcome TEXT,             -- Business result
  employer TEXT,            -- Where it was done
  related_project TEXT      -- Project context
);
```

## 🔧 Configuration

Copy `wrangler.example.toml` to `wrangler.toml` and fill in your resource IDs.

## 📚 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` or `/health` | GET | Health check |
| `/query?q=<query>` | GET/POST | Semantic search with AI reply |
| `/index` | POST | Index all skills into vectors |

## 🛠️ Tech Stack

- **Cloudflare Workers** - Edge compute
- **D1** - SQLite-based database
- **Workers AI** - Embedding generation and LLM responses
- **Vectorize** - Vector similarity search
- **TypeScript** - Type-safe development

## 📖 Documentation

See the `docs/architecture/` folder for detailed architecture documentation.

---

Built on Cloudflare's edge platform
