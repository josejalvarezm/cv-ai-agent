# 🚀 Getting Started with AI Data Re-seeding

## Installation Complete ✅

You now have a complete, bulletproof AI data management system set up!

## First Time Setup (What We Just Did)

✅ Created `scripts/reseed-ai-data.ps1` - Main re-seeding script  
✅ Updated `scripts/generate-seed-sql.js` - Now uses outcomes JSON  
✅ Updated `package.json` - Added npm shortcuts  
✅ Created documentation - Quick refs and guides  

## Your First Re-seed (Try It Now!)

```bash
npm run reseed
```

This will:
1. ✅ Check your JSON data file
2. ✅ Clear old database records safely
3. ✅ Seed 64 technologies with outcomes
4. ✅ Re-index vectors for search
5. ✅ Verify everything works

Expected time: ~30-45 seconds

## Common Scenarios

### Scenario 1: You Updated Skills in JSON

```bash
# 1. Edit schema/technologies-content-with-outcomes.json
# 2. Run
npm run reseed
# Done! Semantic search is updated
```

### Scenario 2: You're Testing Locally

```bash
npm run reseed:local
```

### Scenario 3: You Want to Preview Changes

```bash
npm run reseed:dryrun
# Shows exactly what would happen
# Then run npm run reseed when ready
```

### Scenario 4: Something Failed and You Want to Retry

```bash
npm run reseed:force
# Forces complete regeneration and re-seed
```

### Scenario 5: You Just Need Vector Updates

```bash
npm run index:remote
# Only re-generates embeddings, skips seeding
```

## What to Expect

### Successful Run Output

```
▶ Checking source data files...
✅ Found: schema/technologies-content-with-outcomes.json
✅ SQL file is up-to-date, skipping regeneration

▶ Checking current database state...
   Current records - Categories: 9, Technologies: 64, Vectors: 64

▶ Clearing old data (maintaining referential integrity)...
✅ All old data cleared

▶ Seeding new data from SQL...
✅ Seeded 274 rows

▶ Verifying seeded data...
✅ Data verified: 64 technologies, 9 categories ✓

▶ Re-indexing vectors...
✅ Indexed 64 vectors

▶ Running health check...
✅ Worker is healthy

RE-SEEDING COMPLETE! 🎉
```

### Verify It Worked

```bash
npm run health
```

You should see:
```json
{
  "status": "healthy",
  "total_skills": 64,
  "last_index": {
    "version": 15,
    "indexed_at": "2025-10-17 16:52:51"
  }
}
```

## File Organization

```
scripts/
  ├── reseed-ai-data.ps1          ← Main script (use via npm run)
  ├── generate-seed-sql.js        ← Updated to use outcomes JSON
  ├── deploy-cv-assistant.ps1     ← Full deployment
  └── index-vectors.js            ← Vector indexing

schema/
  ├── technologies-content-with-outcomes.json  ← Your data source
  └── schema.sql                  ← Database schema

migrations/
  └── 002_seed_data_tech_only.sql ← Generated from your JSON

Documentation/
  ├── RESEED_SOLUTION_SUMMARY.md  ← Overview
  ├── RESEED_GUIDE.md             ← Complete reference
  └── RESEED_QUICK_REF.md         ← Quick commands
```

## Key Features

🎯 **One Command**
```bash
npm run reseed
```

🔄 **Idempotent**
Safe to run multiple times. Errors won't corrupt data.

🧠 **Smart**
Auto-detects if your JSON changed. Only regenerates SQL when needed.

🔐 **Safe**
Handles foreign key constraints correctly. Deletes in proper order.

📊 **Verified**
Checks record counts and confirms vectors are indexed.

📝 **Logged**
Detailed output helps you understand what's happening.

🧪 **Testable**
Dry-run mode to preview before committing.

## Data Validation

The script confirms:

✅ JSON file exists  
✅ SQL file is generated correctly  
✅ 9 technology categories exist  
✅ 64 technologies are seeded  
✅ Outcome fields are populated  
✅ 64 vectors are indexed  
✅ Worker is healthy  
✅ Database is connected  

## Emergency Operations

### If database is corrupted

```bash
npm run reseed:force
```

### If you need to manually check

```bash
# Check record counts
wrangler d1 execute cv_assistant_db --remote --command="SELECT COUNT(*) FROM technology;"

# Check outcome data
wrangler d1 execute cv_assistant_db --remote --command="SELECT name, outcome FROM technology LIMIT 3;"

# Check vectors
wrangler d1 execute cv_assistant_db --remote --command="SELECT COUNT(*) FROM vectors;"
```

### Manually clear and reseed (not needed, but here for reference)

```bash
# Clear
wrangler d1 execute cv_assistant_db --remote --command="DELETE FROM vectors; DELETE FROM technology; DELETE FROM technology_category;"

# Seed
wrangler d1 execute cv_assistant_db --remote --file=migrations/002_seed_data_tech_only.sql

# Index
npm run index:remote
```

**But honestly, just use `npm run reseed:force` instead!**

## Workflow Summary

1. **Update your data** 
   ```
   Edit: schema/technologies-content-with-outcomes.json
   ```

2. **Re-seed the database**
   ```
   npm run reseed
   ```

3. **Check it worked**
   ```
   npm run health
   ```

4. **Deploy if needed**
   ```
   npm run deploy
   ```

That's it!

## Next Steps

- Read `RESEED_GUIDE.md` for the complete reference
- Read `RESEED_QUICK_REF.md` for command cheat sheet
- Run `npm run reseed:dryrun` to see it in action
- Edit your JSON and run `npm run reseed` when ready

## Support

If anything seems unclear:

1. Run `npm run reseed:dryrun` to see what would happen
2. Check the output carefully - it's very detailed
3. Look at `RESEED_GUIDE.md` for troubleshooting
4. The script is safe to retry multiple times!

## Success!

You now have a production-ready system that makes updating AI data as simple as:

```bash
npm run reseed
```

No more worrying about foreign key constraints, manual cleanup, or incomplete operations.

**Just run the command, and it handles everything!** 🎉
