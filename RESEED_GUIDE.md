# AI Data Re-seeding Guide

## Overview

The `reseed-ai-data.ps1` script provides a bulletproof way to update your CV Assistant's AI data without worrying about foreign key constraints, duplicate categories, or incomplete operations.

## ⚠️ Important: Schema Changes

**Before using this guide**, if you're adding a **new field** to the technology table (like `employer`, `tags`, etc.), you **must** follow the schema migration process first. See:

📖 **[SCHEMA_MIGRATION_GUIDE.md](./SCHEMA_MIGRATION_GUIDE.md)** - Complete guide for adding new database columns

If you skip schema migration and try to reseed with a new field, you'll get:
```
X [ERROR] table technology has no column named your_field: SQLITE_ERROR
```

## Quick Start

### Update AI data (recommended)

```bash
npm run reseed
```

This single command:
- ✅ Detects if `technologies-content-with-outcomes.json` has changed
- ✅ Automatically regenerates SQL if needed
- ✅ Clears old data respecting foreign key constraints
- ✅ Seeds new data with all outcome fields
- ✅ Re-indexes vectors for semantic search
- ✅ Verifies the operation succeeded
- ✅ Runs health check on the worker

## Command Reference

### Standard Commands

| Command | Purpose |
|---------|---------|
| `npm run reseed` | Standard re-seed (recommended for most updates) |
| `npm run reseed:force` | Force regenerate SQL and re-seed even if files haven't changed |
| `npm run reseed:local` | Re-seed local development database |
| `npm run reseed:dryrun` | Test what would happen without making changes |

### Direct Script Usage

```bash
# Standard remote re-seeding
pwsh -File scripts/reseed-ai-data.ps1

# Force regeneration of SQL from JSON
pwsh -File scripts/reseed-ai-data.ps1 -Force

# Test locally
pwsh -File scripts/reseed-ai-data.ps1 -Environment local

# See what would happen without making changes
pwsh -File scripts/reseed-ai-data.ps1 -DryRun

# Force regenerate without re-indexing vectors
pwsh -File scripts/reseed-ai-data.ps1 -Force -SkipIndex

# Combine options
pwsh -File scripts/reseed-ai-data.ps1 -Environment local -DryRun
```

## How It Works

The script follows this bulletproof process:

### 1. **Check Source Data** 
   - Verifies `technologies-content-with-outcomes.json` exists
   - Compares JSON modification date with generated SQL

### 2. **Regenerate SQL (if needed)**
   - If JSON is newer than SQL, runs `generate-seed-sql.js`
   - Includes all outcome fields: `action`, `effect`, `outcome`, `related_project`
   - Can be forced with `-Force` flag

### 3. **Get Baseline**
   - Queries current database state
   - Shows current record counts (useful for debugging)

### 4. **Clear Old Data (Correctly)**
   - Deletes in correct order respecting FK constraints:
     1. `vectors` (has FK to `technology`)
     2. `technology` (has FK to `technology_category`)
     3. `technology_category` (no FKs, safe to clear last)

### 5. **Seed New Data**
   - Executes all INSERT statements from SQL file
   - Inserts categories first, then technologies

### 6. **Verify**
   - Checks record counts (should be 64 technologies, 9 categories)
   - Spot-checks that outcome fields are populated

### 7. **Re-Index Vectors**
   - Runs `npm run index:remote` to generate embeddings
   - Creates vector versions for semantic search
   - Shows progress and final verification

### 8. **Health Check**
   - Confirms worker is healthy
   - Validates database connection
   - Shows updated skill count

## Updating Your AI Data Workflow

### When You Update `technologies-content-with-outcomes.json`

1. Edit the JSON file with new skills, outcomes, etc.
2. Run one command:
   ```bash
   npm run reseed
   ```
3. That's it! The script handles everything else.

### When You're Unsure What Will Happen

Always test with dry-run first:
```bash
npm run reseed:dryrun
```

This shows you exactly what will happen without making changes.

### When Something Goes Wrong

If the re-seeding fails:

1. **Check the error message** - the script provides detailed logging
2. **Run dry-run to debug** - `npm run reseed:dryrun`
3. **Manual recovery** - the script is idempotent, safe to retry
4. **Check D1 status** - `wrangler d1 info cv_assistant_db --remote`

## Troubleshooting

### "SQL file is being generated but not used"
The script auto-detects file changes. To force regeneration:
```bash
npm run reseed:force
```

### "Foreign key constraint failed"
The script clears data in the correct order. If this still happens:
1. Check if vectors table exists
2. Ensure technology table has correct schema
3. Run: `npm run reseed:force`

### "Vectors aren't re-indexed"
The script runs re-indexing automatically. To manually re-index:
```bash
npm run index:remote
```

### "Health check shows 0 skills"
Wait a few seconds and check again:
```bash
npm run health
```
Indexing is async and may take a moment.

### "Local database re-seeding"
Use:
```bash
npm run reseed:local
```

## Environment Variables

The script uses these npm scripts to interact with D1:
- Automatically uses `--remote` or `--local` based on Environment parameter
- No additional environment variables needed

## Script Structure

The script includes:

- **Logging Functions** - Color-coded output (Success, Warning, Error, Info)
- **File Validation** - Checks JSON and SQL exist and are valid
- **Idempotent Operations** - Safe to run multiple times
- **FK Constraint Handling** - Deletes in correct order
- **Dry-Run Support** - See what would happen first
- **Verification** - Confirms operation succeeded
- **Error Handling** - Graceful failure messages

## Notes

- **Idempotent**: Safe to run multiple times. Errors won't corrupt data.
- **Smart**: Auto-detects if SQL needs regeneration from JSON
- **Verbose**: Detailed logging helps troubleshoot issues
- **Testable**: Dry-run mode for confidence before committing
- **Indexed**: Auto-runs vector indexing for semantic search
- **Verified**: Health checks confirm everything works

## Next Steps

1. Update your AI data in `schema/technologies-content-with-outcomes.json`
2. Run `npm run reseed`
3. Verify with `npm run health`
4. Deploy with `npm run deploy` (if needed)

That's it! No more worrying about foreign key constraints, duplicate categories, or failed partial updates.
