# CV Assistant - Automation Quick Reference

## One-Command Deployment

### Full Automated Deployment (Recommended)
```powershell
npm run deploy:full
```

This runs the PowerShell automation script that:
1. ✅ Builds TypeScript
2. ✅ Deploys to Cloudflare Workers
3. ✅ Checks/applies schema migrations
4. ✅ Seeds database (if needed)
5. ✅ Indexes vectors (generates embeddings)
6. ✅ Runs health check
7. ✅ Tests semantic search

**Options:**
```powershell
# Skip build (if already built)
.\scripts\deploy-cv-assistant.ps1 -SkipBuild

# Skip indexing (if vectors already exist)
.\scripts\deploy-cv-assistant.ps1 -SkipIndex

# Force re-seed and re-index
.\scripts\deploy-cv-assistant.ps1 -Force

# Deploy to local for testing
.\scripts\deploy-cv-assistant.ps1 -Environment local
```

---

## Individual Commands

### Build & Deploy
```powershell
# Build TypeScript
npm run build

# Quick deploy (build + deploy only)
npm run deploy:quick

# Deploy without build
npm run deploy
```

### Database Operations
```powershell
# Apply outcome fields migration
npm run db:migrate:outcome

# Seed database with outcome-driven data
npm run db:seed:outcome

# Clear all data (dangerous!)
npm run db:clear
```

### Vector Indexing
```powershell
# Index all 64 records automatically
npm run index:remote

# Or use PowerShell directly for more control
.\scripts\deploy-cv-assistant.ps1 -SkipBuild -SkipSeed
```

### Health & Testing
```powershell
# Check worker health
npm run health

# Manual query test (requires Turnstile token in production)
curl "https://cv-assistant-worker.{YOUR_WORKERS_SUBDOMAIN}/query?q=microservices"
```

---

## Typical Workflows

### First Time Setup
```powershell
# Complete setup from scratch
npm run deploy:full
```

### Adding New Skills
```powershell
# 1. Edit migrations/002_seed_data_outcome_driven.sql
# 2. Run full deployment
npm run deploy:full -Force
```

### Code Changes Only
```powershell
# Quick redeploy without data changes
npm run deploy:quick

# Or with automation (skips seed/index)
.\scripts\deploy-cv-assistant.ps1 -SkipSeed -SkipIndex
```

### Database Reset
```powershell
# Clear and re-seed everything
npm run db:clear
npm run db:seed:outcome
npm run index:remote
```

### Troubleshooting
```powershell
# Check health
npm run health

# Re-index if vectors are missing
wrangler d1 execute cv_assistant_db --remote --command="DELETE FROM vectors;"
npm run index:remote

# Force full redeployment
.\scripts\deploy-cv-assistant.ps1 -Force
```

---

## Environment Variables

The automation scripts support these environment variables:

### index-vectors.js
```bash
WORKER_URL=https://your-worker.dev  # Default: cv-assistant-worker.{YOUR_WORKERS_SUBDOMAIN}
BATCH_SIZE=10                        # Records per batch (default: 10)
TOTAL_RECORDS=64                     # Total records to index (default: 64)
DELAY_MS=200                         # Delay between batches (default: 200ms)
```

**Example:**
```powershell
$env:BATCH_SIZE=5
npm run index:remote
```

---

## CI/CD Integration

### GitHub Actions (Future Enhancement)
Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy CV Assistant
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      - run: npm run index:remote
```

---

## Manual Commands Reference

### Wrangler D1 Commands
```powershell
# Check schema
wrangler d1 execute cv_assistant_db --remote --command="PRAGMA table_info(technology);"

# Count records
wrangler d1 execute cv_assistant_db --remote --command="SELECT COUNT(*) FROM technology;"

# Count vectors
wrangler d1 execute cv_assistant_db --remote --command="SELECT COUNT(*) FROM vectors;"

# Check index metadata
wrangler d1 execute cv_assistant_db --remote --command="SELECT * FROM index_metadata ORDER BY version DESC LIMIT 5;"

# Sample data
wrangler d1 execute cv_assistant_db --remote --command="SELECT id, name, action, outcome FROM technology WHERE outcome IS NOT NULL LIMIT 3;"
```

### Curl Commands
```powershell
# Health check
curl https://cv-assistant-worker.{YOUR_WORKERS_SUBDOMAIN}/health

# Query with Turnstile token
curl "https://cv-assistant-worker.{YOUR_WORKERS_SUBDOMAIN}/query?q=microservices" `
  -H "X-Turnstile-Token: YOUR_TOKEN"

# Trigger indexing manually
$body = @{ type = "technology"; batchSize = 10; offset = 0 } | ConvertTo-Json
curl -X POST "https://cv-assistant-worker.{YOUR_WORKERS_SUBDOMAIN}/index" `
  -H "Content-Type: application/json" -d $body
```

---

## Troubleshooting Guide

### Issue: "Indexing already in progress"
**Solution:**
```powershell
wrangler d1 execute cv_assistant_db --remote --command="DELETE FROM index_metadata;"
npm run index:remote
```

### Issue: Vectors count is wrong (not 64)
**Solution:**
```powershell
wrangler d1 execute cv_assistant_db --remote --command="DELETE FROM vectors;"
npm run index:remote
```

### Issue: Schema migration fails
**Solution:**
```powershell
# Check if columns already exist
wrangler d1 execute cv_assistant_db --remote --command="PRAGMA table_info(technology);"

# If columns exist, skip migration
# If not, run manually
wrangler d1 execute cv_assistant_db --remote --file=migrations/003_add_outcome_fields.sql
```

### Issue: Build fails
**Solution:**
```powershell
# Clean and rebuild
Remove-Item -Recurse -Force dist/
npm run build
```

### Issue: Query returns empty results
**Solutions:**
1. Check vectors exist: `wrangler d1 execute cv_assistant_db --remote --command="SELECT COUNT(*) FROM vectors;"`
2. Re-index: `npm run index:remote`
3. Check data exists: `wrangler d1 execute cv_assistant_db --remote --command="SELECT COUNT(*) FROM technology;"`

---

## Best Practices

1. **Always test locally first**
   ```powershell
   .\scripts\deploy-cv-assistant.ps1 -Environment local
   ```

2. **Use Force flag sparingly** - only when you need to reset data
   ```powershell
   .\scripts\deploy-cv-assistant.ps1 -Force
   ```

3. **Monitor the health endpoint** after deployments
   ```powershell
   npm run health
   ```

4. **Keep Turnstile enabled** in production for security

5. **Version control your seed data** - always update `002_seed_data_outcome_driven.sql`

---

## Quick Command Cheat Sheet

| Task | Command |
|------|---------|
| **Full Deploy** | `npm run deploy:full` |
| **Quick Deploy** | `npm run deploy:quick` |
| **Just Build** | `npm run build` |
| **Clear Data** | `npm run db:clear` |
| **Seed Data** | `npm run db:seed:outcome` |
| **Index Vectors** | `npm run index:remote` |
| **Health Check** | `npm run health` |
| **Force Reset** | `.\scripts\deploy-cv-assistant.ps1 -Force` |

---

**Last Updated**: October 16, 2025
