# CV Assistant on the Edge

A production-ready AI-powered CV assistant built on Cloudflare's edge platform. Features semantic search with vector embeddings and outcome-driven responses using Workers AI.

**Built to demonstrate:** How to architect, deploy, and operate AI applications at the edge with predictable costs, low latency, and minimal operational overhead.

---

## Features

- **Semantic Search:** Vector embeddings enable meaning-based search, not just keyword matching
- **Outcome-Driven Responses:** AI generates answers focused on measurable business impact
- **Edge-Native:** Runs on Cloudflare Workers with global distribution
- **Cost-Effective:** <£1/month for moderate traffic on free tier
- **Production-Ready:** Includes automation, testing, and security
- **Self-Contained:** No external vector databases or complex infrastructure

---

## Architecture

```
User Query → Cloudflare Edge → Worker
                                  ↓
                    Generate Query Embedding (Workers AI)
                                  ↓
                    Vector Search in D1 (SQLite)
                                  ↓
                    LLM Response Generation (Llama 3.2)
                                  ↓
                    JSON Response (results + AI answer)
```

**Technology Stack:**

- **Cloudflare Workers:** Edge compute platform
- **D1:** Distributed SQLite database
- **Workers AI:** Embedding generation + LLM responses
- **TypeScript:** Type-safe development
- **Turnstile:** Bot protection (optional)

---

## Quick Start

### Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- Node.js 18+ and npm
- Basic understanding of TypeScript and SQL

### Installation

```bash
# Clone repository
git clone https://github.com/josejalvarezm/cv-ai-agent.git
cd cv-ai-agent

# Install dependencies
npm install

# Copy configuration templates
cp .env.example .env
cp wrangler.toml.example wrangler.toml

# Edit .env and wrangler.toml with your Cloudflare credentials
```

### Deploy

```bash
# Full deployment (builds, deploys, seeds data, indexes vectors)
npm run deploy:full

# Quick redeploy (code changes only)
npm run deploy:quick
```

### Test

```bash
# Health check
curl https://your-worker.workers.dev/health

# Query the assistant
curl "https://your-worker.workers.dev/query?q=Tell me about your Python experience"
```

**Expected Response:**

```json
{
  "query": "Tell me about your Python experience",
  "results": [
    {
      "name": "Python",
      "similarity": "0.89",
      "years": 5,
      "level": "Expert"
    }
  ],
  "assistantReply": "With 5 years of expert-level Python experience, I built RESTful APIs and data pipelines that reduced processing time from hours to minutes, handling 100k requests/day with 99.9% uptime on an e-commerce platform.",
  "source": "d1-vectors",
  "timestamp": "2025-10-23T16:00:00.000Z"
}
```

---

## Project Structure

```
cv-ai-agent/
├── src/
│   ├── index.ts                    # Main worker entry point
│   ├── query-d1-vectors.ts         # Vector search + LLM generation
│   ├── types.ts                    # TypeScript interfaces
│   └── utils/
│       ├── embeddings.ts           # Embedding generation utilities
│       └── similarity.ts           # Cosine similarity calculation
├── migrations/
│   ├── 001_initial_schema.sql      # Database schema
│   └── 002_seed_data_generic.sql   # Sample skill data
├── scripts/
│   ├── deploy.ps1                  # Automated deployment (TODO)
│   └── index-vectors.js            # Vector indexing automation (TODO)
├── src/services/
│   └── embeddingService.test.ts    # Unit tests
└── wrangler.toml.example           # Cloudflare configuration template
```

---

## How It Works

### 1. Embedding Generation

Text is converted to 768-dimensional vectors using the BGE-base-en-v1.5 model:

```typescript
const embedding = await ai.run('@cf/baai/bge-base-en-v1.5', {
  text: ['Python programming'],
});
// Returns: [0.234, -0.456, 0.671, ...] (768 numbers)
```

### 2. Vector Search

Query vector is compared against stored skill vectors using cosine similarity:

```typescript
const similarity = cosineSimilarity(queryVector, skillVector);
// Returns: 0.89 (higher = more similar)
```

### 3. LLM Response

Top matching skills are sent to Llama 3.2 with an outcome-focused prompt:

```typescript
const response = await ai.run('@cf/meta/llama-3.2-3b-instruct', {
  messages: [
    { role: 'system', content: outcomePrompt },
    { role: 'user', content: query }
  ]
});
```

---

## Customization

### Adding Your Own Skills

Edit `migrations/002_seed_data_generic.sql`:

```sql
INSERT INTO technology (name, experience_years, level, summary, action, effect, outcome, related_project) 
VALUES (
  'Your Skill',
  3,
  'Advanced',
  'Brief summary of your experience',
  'What you did',
  'Technical impact',
  'Business outcome with metrics',
  'Project name'
);
```

Then redeploy:

```bash
npm run deploy:full
```

### Modifying the Outcome Template

Edit the prompt in `src/query-d1-vectors.ts`:

```typescript
const systemPrompt = `You are a CV assistant. For each skill, follow this template:
Action → Effect → Outcome → Project

Focus on measurable results...`;
```

---

## Performance Metrics

Based on production deployment with 64 skills:

- **Response Time:** <2s P95 (embedding + search + LLM)
- **Search Latency:** <20ms for 64 vectors
- **Cost:** <£1/month for 100 queries/day
- **Deployment Time:** ~2-3 minutes (automated)
- **Database Size:** ~250 KB

---

## Blog Series

This repository accompanies a technical blog series on building production-ready AI at the edge:

1. **[AI Fundamentals](https://blog.josealvarez.dev/blog/ai-agent-post-0)** - Understanding vectors, embeddings, and LLMs

---

## Testing

```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage
```

---

## Contributing

Issues and pull requests are welcome!

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

## Acknowledgements

Built with:

- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Workers AI](https://developers.cloudflare.com/workers-ai/)

---

## Support

- **Issues:** [GitHub Issues](https://github.com/josejalvarezm/cv-ai-agent/issues)
- **Blog:** [josealvarez.dev](https://josealvarez.dev)
- **Contact:** Through GitHub issues or blog

---

**Built to demonstrate production-ready AI on the edge. No fluff, just practical engineering.**
