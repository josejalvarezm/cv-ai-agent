# "No Vectors Found in Database" - Diagnostic & Fix Guide

## Problem Summary

**Error**: "No vectors found in database"
**Root Cause**: Vector indexing step was skipped or incomplete during re-seeding
**Solution**: Run vector indexing separately

## What Happened

1. ✅ Database was re-seeded with 64 technologies
2. ❌ Vector indexing was NOT performed (or failed silently)
3. ❌ Vectors table remained empty (0 records)
4. ❌ Semantic search failed because there were no embeddings

## Quick Fix

If you get "No vectors found in database":

```bash
npm run index:remote
```

This will:
- Generate embeddings for all 64 technologies
- Store vectors in the database
- Create index versions (18-24 in this case)
- Re-enable semantic search

## Detailed Diagnosis

### Check Technology Count
```bash
wrangler d1 execute cv_assistant_db --remote \
  --command="SELECT COUNT(*) FROM technology;"
```
Expected: **64 records** ✓

### Check Vector Count
```bash
wrangler d1 execute cv_assistant_db --remote \
  --command="SELECT COUNT(*) FROM vectors;"
```

If **0**, run: `npm run index:remote`  
If **64**, vectors are ready ✓

### Check Worker Health
```bash
npm run health
```

Look for:
- `"total_skills": 64` ✓
- `"database": "connected"` ✓
- `"last_index": { "version": 24, ...}` ✓

## Why This Happens

### Possible Causes

1. **Incomplete re-seed** - Indexing step was skipped
2. **Network timeout** - Indexing failed but error wasn't shown
3. **Manual seed** - Only database was populated, indexing not run
4. **Cache issue** - Worker version mismatch

### Prevention

Always ensure the complete workflow:

```bash
npm run reseed
# This includes:
# 1. Clear caches
# 2. Re-seed data
# 3. Re-index vectors  ← This step
# 4. Health check
```

If you manually seed, also run:
```bash
npm run index:remote
```

## Complete Workflow

### Option 1: Full Re-seed (Recommended)
```bash
npm run reseed
# Clears caches, seeds data, indexes vectors, verifies
```

### Option 2: Just Index Vectors
```bash
npm run index:remote
# Only generates and stores vectors
```

### Option 3: Step by Step
```bash
# 1. Clear and seed data
wrangler d1 execute cv_assistant_db --remote \
  --command="DELETE FROM vectors; DELETE FROM technology;"
wrangler d1 execute cv_assistant_db --remote \
  --file=migrations/002_seed_data_tech_only.sql

# 2. Index vectors
npm run index:remote

# 3. Verify
npm run health
```

## Verification After Fix

After running `npm run index:remote`:

```bash
# Check 1: Vector count
wrangler d1 execute cv_assistant_db --remote \
  --command="SELECT COUNT(*) FROM vectors;"
# Should show: 64

# Check 2: Health status
npm run health
# Should show:
# - "status": "healthy"
# - "total_skills": 64
# - "last_index": { "version": 24 }

# Check 3: Sample query
curl "https://cv-assistant-worker.{YOUR_WORKERS_SUBDOMAIN}/query?q=microservices"
# Should return results, not "No vectors found"
```

## Timing

- Vector indexing: ~20-30 seconds
- Cache propagation: 5 seconds
- Total: ~30-35 seconds

## Common Mistakes

❌ **Only running the re-seed command once** - May have incomplete state
✅ **Always verify with** `npm run health`

❌ **Manually clearing database without re-indexing**
✅ **Always run** `npm run index:remote` after manual changes

❌ **Ignoring errors during re-seed**
✅ **Check output carefully** and re-run if needed

## Summary

| Check | Command | Expected |
|-------|---------|----------|
| Technologies | `SELECT COUNT(*) FROM technology` | 64 |
| Vectors | `SELECT COUNT(*) FROM vectors` | 64 |
| Worker | `npm run health` | healthy |
| Indexing | Last index version | 24+ |

If vectors = 0: Run `npm run index:remote`

## Related Commands

```bash
npm run reseed              # Full re-seed with everything
npm run reseed:force        # Force full regeneration
npm run index:remote        # Just index vectors
npm run health              # Check status
npm run reseed:dryrun       # Preview without changes
```

## Prevention Going Forward

1. After any data update, always run full re-seed:
   ```bash
   npm run reseed
   ```

2. Verify with:
   ```bash
   npm run health
   ```

3. If you manually edit the database, always follow up with:
   ```bash
   npm run index:remote
   ```

---

**Status**: Fixed ✅

Your system now has:
- 64 technologies
- 64 vectors
- Semantic search working
- All caches cleared
