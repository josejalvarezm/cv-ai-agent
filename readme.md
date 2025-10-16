# CV Assistant - Outcome-Driven AI Agent

A semantic search engine and AI assistant for CV skills built on Cloudflare's edge platform. The assistant provides **outcome-driven, recruiter-ready answers** that focus on measurable business impact rather than generic claims.

## 🎯 Key Features

- **Outcome-Driven Responses**: Every answer follows the template: **Skill → Context → Action → Effect → Outcome → Project**
- **Semantic Search**: Vector-based similarity search using D1 + Workers AI embeddings
- **Edge-Native**: Runs on Cloudflare Workers with D1 database and Vectorize
- **AI-Powered Replies**: Optional LLM-generated responses via Workers AI
- **No Fluff**: Avoids recruiter buzzwords, focuses on measurable results

## 📖 Documentation

- **[Outcome-Driven CV Assistant Guide](docs/outcome-driven-cv-assistant.md)** - Complete implementation guide
- **[Quick Reference](docs/outcome-driven-quick-reference.md)** - Cheat sheet for usage
- **[Implementation Summary](OUTCOME_DRIVEN_SUMMARY.md)** - What changed and how to use it

## 🚀 Quick Start

### Deploy to Cloudflare

```bash
# Install dependencies
npm install

# Create D1 database
wrangler d1 create cv-assistant-db

# Apply schema
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
