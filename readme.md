# CV Assistant - Outcome-Driven AI Agent

A semantic search engine and AI assistant for CV skills built on Cloudflare's edge platform. The assistant provides **outcome-driven, recruiter-ready answers** that focus on measurable business impact rather than generic claims.

## 🎯 Key Features

- **Outcome-Driven Responses**: Every answer follows the template: **Skill → Context → Action → Effect → Outcome → Project**
- **Semantic Search**: Vector-based similarity search using D1 + Workers AI embeddings
- **Edge-Native**: Runs on Cloudflare Workers with D1 database and Vectorize
- **AI-Powered Replies**: LLM-generated responses via Workers AI (@cf/meta/llama-3.2-3b-instruct)
- **No Fluff**: Avoids recruiter buzzwords, focuses on measurable results
- **Fully Automated**: One-command deployment with PowerShell automation
- **Turnstile Protected**: Cloudflare Turnstile prevents bot abuse

## 🚀 Quick Start (Automated)

### One-Command Deployment

```powershell
# Full automated deployment (recommended)
npm run deploy:full
```

This single command:
1. ✅ Builds TypeScript
2. ✅ Deploys to Cloudflare Workers
3. ✅ Checks/applies database migrations
4. ✅ Seeds data if needed
5. ✅ Generates embeddings (64 records)
6. ✅ Runs health checks
7. ✅ Takes ~2-3 minutes total

### Alternative: Manual Setup

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Deploy worker
npm run deploy

# Apply schema migration
wrangler d1 execute cv_assistant_db --remote --file=migrations/003_add_outcome_fields.sql

# Seed database
wrangler d1 execute cv_assistant_db --remote --file=migrations/002_seed_data_tech_only.sql

# Index vectors
npm run index:remote
wrangler d1 execute cv-assistant-db --file=migrations/001_initial_schema.sql

# Seed data
wrangler d1 execute cv-assistant-db --file=migrations/002_seed_data.sql

# Deploy
npm run deploy
```

### Query the Assistant

```bash
curl "https://your-worker.workers.dev/query?q=Tell me about your microservices experience"
```

**Response**:
```json
{
  "query": "Tell me about your microservices experience",
  "results": [...],
  "assistantReply": "With 5+ years of advanced experience in Full‑Stack Service Decomposition at CCHQ, I broke down monolithic applications into modular services. This enabled teams to deploy independently, cutting release cycles from weeks to days.",
  "source": "d1-vectors",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## 🎨 Answer Philosophy

### ❌ Before (Activity-Driven)
> "I'm an exceptional engineer with a proven track record in microservices."

### ✅ After (Outcome-Driven)
> "With 5+ years of advanced experience in Full-Stack Service Decomposition at CCHQ, I broke down monolithic applications into modular services, cutting release cycles from weeks to days."

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
  related_project TEXT,     -- Project context
  -- ... other fields
);
```

## 🔧 Configuration

Set environment variables in `wrangler.toml`:

```toml
[vars]
AI_REPLY_ENABLED = "true"
```

## 📚 API Endpoints

- `GET /` or `GET /health` - Health check
- `POST /query` or `GET /query?q=<query>` - Semantic search with AI reply
- `POST /index` - Index all skills into vectors

## 🛠️ Tech Stack

- **Cloudflare Workers** - Edge compute
- **D1** - SQLite-based database
- **Workers AI** - Embedding generation and LLM responses
- **Vectorize** - Vector similarity search (optional)
- **TypeScript** - Type-safe development

## 📖 Learn More

- [Architecture](docs/architecture.md)
- [Database Deployment](docs/database-deployment-guide.md)
- [Database Seeding](docs/database-seeding-guide.md)

---

**Built with ❤️ on Cloudflare's edge platform**
