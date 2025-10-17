# 🎯 AI Data Re-seeding Solution - Complete Setup

## What You Have

A bulletproof, production-ready re-seeding system that handles all the complexity for you.

## The Problem (Solved ✅)

- ❌ Foreign key constraint errors when re-seeding
- ❌ Category lookup failures
- ❌ Incomplete data causing missing vectors
- ❌ Manual cleanup required between re-seeds
- ❌ Unclear which SQL file to use

## The Solution

One simple command that does everything correctly:

```bash
npm run reseed
```

## What This Does

✅ Detects if your JSON data has changed  
✅ Automatically regenerates SQL if needed  
✅ Clears old data in the **correct order** (respecting FK constraints)  
✅ Seeds 9 categories + 64 technologies with outcomes  
✅ Re-indexes all vectors for semantic search  
✅ Verifies success with health checks  
✅ Shows detailed logging of every step  

## Available Commands

| Command | Purpose | When to Use |
|---------|---------|------------|
| `npm run reseed` | Standard re-seed | Daily use - most common |
| `npm run reseed:force` | Force regenerate | When unsure about changes |
| `npm run reseed:local` | Seed locally | Development/testing |
| `npm run reseed:dryrun` | Preview changes | Before committing |
| `npm run health` | Check worker status | Verify it's working |
| `npm run index:remote` | Just re-index vectors | If only vectors need updating |

## Workflow

### When You Update AI Data

1. Edit `schema/technologies-content-with-outcomes.json`
2. Run `npm run reseed`
3. Wait for completion (~30 seconds)
4. Check `npm run health` - should show 64 skills

### When You Want to See What Would Happen

1. Run `npm run reseed:dryrun`
2. Review the output
3. If happy, run `npm run reseed`

### Emergency Re-seed

If something went wrong:

```bash
npm run reseed:force
```

The script is **idempotent** - safe to run multiple times.

## Script Details

**File**: `scripts/reseed-ai-data.ps1`

**Features**:
- Smart file change detection (JSON vs SQL)
- Correct delete order (vectors → technology → categories)
- Automatic SQL generation if needed
- Dry-run support for safety
- Detailed step-by-step logging
- Record count verification
- Spot-check of outcomes data
- Vector indexing
- Health check confirmation

**Parameters**:
- `-Environment` (local/remote) - Default: remote
- `-Force` - Force SQL regeneration
- `-SkipIndex` - Skip vector re-indexing
- `-DryRun` - Preview without changes

## Updated Package.json

New scripts added:
```json
{
  "reseed": "pwsh -File scripts/reseed-ai-data.ps1",
  "reseed:force": "pwsh -File scripts/reseed-ai-data.ps1 -Force",
  "reseed:local": "pwsh -File scripts/reseed-ai-data.ps1 -Environment local",
  "reseed:dryrun": "pwsh -File scripts/reseed-ai-data.ps1 -DryRun"
}
```

## Key Improvements

### Before
- Had to manually clear tables in specific order
- SQL generation sometimes skipped
- No verification that data was correct
- Unclear which files to update
- Risk of FK constraint failures

### After
- ✅ One command does everything
- ✅ Smart file detection
- ✅ Automatic verification
- ✅ Safe FK handling
- ✅ Detailed logging

## Updated Generator

**File**: `scripts/generate-seed-sql.js`

Now:
- ✅ Reads from `technologies-content-with-outcomes.json`
- ✅ Includes all outcome fields (action, effect, outcome, related_project)
- ✅ Single-line INSERTs (no line breaks)
- ✅ Correctly handles special characters (apostrophes)

## Database Operations

The script safely handles these DB operations:

1. **Clear Phase** (respects FK constraints):
   ```
   DELETE FROM vectors;        # No FK dependencies
   DELETE FROM technology;     # References categories
   DELETE FROM technology_category;  # Safe last
   ```

2. **Seed Phase**:
   ```
   INSERT INTO technology_category (9 rows)
   INSERT INTO technology (64 rows)
   ```

3. **Index Phase**:
   ```
   Generate embeddings
   Create vector records (64 rows)
   Update index version
   ```

## Success Criteria

You'll know it worked when:

✅ Command completes without errors  
✅ Shows "RE-SEEDING COMPLETE! 🎉"  
✅ `npm run health` shows 64 skills  
✅ No foreign key errors  
✅ Latest index version is set  

## Troubleshooting

### Issue: "SQL file is old"
**Solution**: Run `npm run reseed:force`

### Issue: "Foreign key constraint failed"
**Solution**: Already handled! Run `npm run reseed` again

### Issue: "Vectors show 0 records"
**Solution**: Wait 10 seconds, run `npm run health` again

### Issue: "Worker shows unhealthy"
**Solution**: Check wrangler logs, then `npm run reseed`

### Issue: Not sure what will happen
**Solution**: Always run `npm run reseed:dryrun` first!

## Documentation

For more details, see:
- `RESEED_GUIDE.md` - Complete reference guide
- `RESEED_QUICK_REF.md` - Quick command reference

## Summary

You now have a production-ready system for managing AI data that:

- **Is simple**: One command to rule them all
- **Is safe**: Handles FK constraints correctly
- **Is smart**: Detects changes automatically
- **Is testable**: Dry-run mode available
- **Is reliable**: Idempotent and verifies success
- **Is logged**: Detailed output for debugging

### Ready to Use

```bash
npm run reseed
```

That's all you need. Everything else is handled.
