# CV Skills Ops

> **Location**: `cv-skills-ops/`  
> **Last Updated**: November 2025  
> **Purpose**: All database seeding, indexing, and maintenance operations

## 📁 Folder Structure

```
cv-skills-ops/
├── README.md              # This file - complete guide
├── reindex.ps1            # Main script to re-index vectors
├── add-technology.ps1     # Interactive helper to add new tech
├── verify-sync.ps1        # Check D1 and Vectorize are in sync
├── seed-cv-skills.sql     # Full database seed (reference)
├── seed-missing-skills.sql # Gap-fill migrations
└── seed-database.js       # Node seeding script (legacy)
```

---

## 🚀 Quick Start

### Re-index All Vectors (Most Common Operation)

After adding/modifying data in D1, run this to update the search index:

```powershell
cd D:\Code\GCPDashboard\MyAIAgentPrivate\cv-skills-ops
.\reindex.ps1 -Environment production
```

### Add a New Technology

```powershell
cd D:\Code\GCPDashboard\MyAIAgentPrivate\cv-skills-ops
.\add-technology.ps1 -Name "Kubernetes" -Years 3
# Then follow the prompts to complete the entry
```

---

## 📋 Complete Workflow: Adding New Skills

### Step 1: Plan Your Technology Entry

Each technology needs these fields for optimal semantic search:

| Field | Required | Purpose | Example |
|-------|----------|---------|---------|
| `name` | ✅ | Technology name | "AWS Lambda" |
| `experience` | ✅ | Experience summary | "3 years hands-on" |
| `experience_years` | ✅ | Numeric years | 3 |
| `level` | ⬚ | Proficiency level | "Expert" |
| `category_id` | ⬚ | Category (1-9) | 3 |
| `summary` | ✅ | What you know | "Serverless compute" |
| `action` | ✅ | What you did | "Built event-driven functions" |
| `effect` | ⬚ | Technical impact | "12ms P99 latency" |
| `outcome` | ✅ | Business result | "10:1 cost reduction" |
| `related_project` | ⬚ | Project name | "Portfolio Analytics" |

### Step 2: Insert into D1

**Option A: Using the helper script (recommended)**
```powershell
.\add-technology.ps1 -Name "Redis" -Years 4
```

**Option B: Direct SQL**
```powershell
npx wrangler d1 execute cv_assistant_db --remote --command "
INSERT INTO technology (
  name, experience, experience_years, level, category_id,
  summary, action, effect, outcome, related_project
) VALUES (
  'Redis',
  '4 years production experience',
  4,
  'Advanced',
  3,
  'In-memory caching and pub/sub messaging',
  'Implemented distributed caching layer for API responses',
  'Reduced API latency from 200ms to 15ms, 93% improvement',
  'Enabled 10x traffic scaling without infrastructure changes',
  'E-Commerce Platform'
);"
```

### Step 3: Re-index Vectors

```powershell
.\reindex.ps1 -Environment production
```

### Step 4: Verify

```powershell
# Check the technology was added
npx wrangler d1 execute cv_assistant_db --remote --command "SELECT id, name FROM technology ORDER BY id DESC LIMIT 5"

# Check vector was created
npx wrangler vectorize info cv-skills-index
```

---

## 📊 Category Reference

| ID | Category | Examples |
|----|----------|----------|
| 1 | Architecture & Patterns | SOA, Microservices, Event-Driven |
| 2 | Cloud Platforms | AWS, GCP, Azure |
| 3 | Databases & Storage | PostgreSQL, Redis, DynamoDB |
| 4 | Languages | TypeScript, Python, Go |
| 5 | Frameworks | Angular, .NET Core, Node.js |
| 6 | DevOps & Infrastructure | Docker, Kubernetes, Terraform |
| 7 | Security | OAuth, HMAC, Zero-Trust |
| 8 | AI/ML | Workers AI, Embeddings |
| 9 | Practices | CI/CD, Testing, Monitoring |

---

## 🔧 Scripts Reference

### `reindex.ps1`

Re-generates all vector embeddings from D1 technology data.

```powershell
# Production (default TotalRecords=100)
.\reindex.ps1 -Environment production

# Development
.\reindex.ps1 -Environment development

# With custom record count
.\reindex.ps1 -Environment production -TotalRecords 150
```

### `add-technology.ps1`

Interactive helper to add new technologies.

```powershell
.\add-technology.ps1 -Name "GraphQL" -Years 2 -Category 5
```

### `verify-sync.ps1`

Quick diagnostic to check D1 and Vectorize are in sync.

```powershell
.\verify-sync.ps1
```

---

## 🛠️ Troubleshooting

### Vector count doesn't match D1 count

```powershell
# Check counts
npx wrangler d1 execute cv_assistant_db --remote --command "SELECT COUNT(*) FROM technology"
npx wrangler vectorize info cv-skills-index

# Re-index with higher limit
.\reindex.ps1 -Environment production -TotalRecords 150
```

### "Indexing already in progress" error

Wait 2 minutes for lock expiry, or clear manually:
```powershell
npx wrangler kv key delete "index:lock:technology" --binding KV
```

### Technology not appearing in search results

1. Verify it has rich `summary`, `action`, `outcome` fields
2. Re-index after adding/modifying
3. Wait 10-15 seconds for Vectorize consistency

---

## 📈 Current Statistics

| Metric | Value |
|--------|-------|
| Total Technologies | 93 |
| Vector Dimensions | 768 |
| Embedding Model | `@cf/baai/bge-base-en-v1.5` |
| Index Name | `cv-skills-index` |
| Database | `cv_assistant_db` |

---

## 🗄️ Database Schema

```sql
CREATE TABLE technology (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  experience TEXT,
  experience_years INTEGER,
  level TEXT,
  category_id INTEGER,
  summary TEXT,           -- What you know
  action TEXT,            -- What you did  
  effect TEXT,            -- Technical impact
  outcome TEXT,           -- Business result
  related_project TEXT,   -- Project context
  employer TEXT           -- Company context
);
```

---

## 📝 Migration History

| Version | Date | Description |
|---------|------|-------------|
| 015 | Nov 2025 | Added AWS/GCP/Cloudflare technologies |
| 014 | Nov 2025 | Added outcome-driven fields |
| ... | ... | Earlier migrations in D1CV repo |

---

## 🔗 Related Resources

- Worker code: `src/services/indexingService.ts`
- Vector store: `src/repositories/vectorStore.ts`
- npm scripts: `package.json` → `index:remote`
- Sync process docs: `docs/VECTORIZE_SYNC_PROCESS.md`

---

## 🧹 Orphan Cleanup & Disaster Recovery

### Understanding Orphans

Orphan vectors occur when D1 records are deleted **without** using the Admin Portal sync:

| Scenario | D1 | Vectorize | Result |
|----------|-----|-----------|--------|
| Delete via Admin Portal → Sync | ✅ Deleted | ✅ Deleted | Clean |
| Manual D1 delete | ✅ Deleted | ❌ Orphan remains | Orphan |

Orphans are **harmless** (chatbot gracefully skips them) but **wasteful** (consume Vectorize storage).

### Option 1: Leave Orphans (Lazy Approach)

If you have few orphans, they're harmless:

- Vectorize queries return orphan IDs
- D1 lookup finds nothing  
- Code gracefully skips → no bad data shown

### Option 2: Full Re-index (Partial Cleanup)

Re-indexing **overwrites** existing vectors but **doesn't delete** orphans:

```powershell
# API call - processes in batches of 50
$body = '{"type":"technology"}'
Invoke-RestMethod -Uri "https://cv-assistant-worker-production.{YOUR_WORKERS_SUBDOMAIN}/index" -Method POST -Body $body -ContentType "application/json"

# For 93+ records, run with offset to get all:
$body = '{"type":"technology","offset":50}'
Invoke-RestMethod -Uri "https://cv-assistant-worker-production.{YOUR_WORKERS_SUBDOMAIN}/index" -Method POST -Body $body -ContentType "application/json"
```

### Option 3: Delete & Recreate Vectorize Index (Nuclear Option)

For complete cleanup (e.g., many orphans, corrupted index):

#### Step 1: Delete the Index

```bash
# Via Cloudflare Dashboard:
# Workers & Pages → cv-assistant-worker-production → Settings → Bindings → Vectorize
# Click cv-skills-index → Delete

# Or via Wrangler CLI:
npx wrangler vectorize delete cv-skills-index
```

#### Step 2: Recreate the Index

```bash
npx wrangler vectorize create cv-skills-index --dimensions 768 --metric cosine
```

#### Step 3: Re-bind to Worker

Update `wrangler.toml` if needed, then redeploy:

```bash
npx wrangler deploy --env production
```

#### Step 4: Full Re-index

```powershell
# Index first batch (0-49)
$body = '{"type":"technology"}'
Invoke-RestMethod -Uri "https://cv-assistant-worker-production.{YOUR_WORKERS_SUBDOMAIN}/index" -Method POST -Body $body -ContentType "application/json"

# Index remaining (50+)
$body = '{"type":"technology","offset":50}'
Invoke-RestMethod -Uri "https://cv-assistant-worker-production.{YOUR_WORKERS_SUBDOMAIN}/index" -Method POST -Body $body -ContentType "application/json"

# Repeat with offset 100, 150, etc. if you have more records
```

#### Step 5: Verify

```powershell
# Check vector count
npx wrangler vectorize info cv-skills-index

# Check D1 count
npx wrangler d1 execute cv_assistant_db --remote --command "SELECT COUNT(*) FROM technology"

# Counts should match!
```

### When to Use Each Option

| Situation | Recommended Action |
|-----------|-------------------|
| Few test records deleted manually | Leave orphans (Option 1) |
| Many manual deletes | Re-index (Option 2) |
| Corrupted index / major issues | Delete & recreate (Option 3) |
| Regular operations via Admin Portal | Nothing needed - sync handles it |

---

## 🎯 Best Practices

1. **Always use Admin Portal** for add/update/delete - it handles sync automatically
2. **Avoid manual D1 deletes** - creates orphans
3. **Re-index after bulk imports** - if adding via SQL directly
4. **Monitor counts** - `npx wrangler vectorize info cv-skills-index` should match D1 count
