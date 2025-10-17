# Quick Re-seed Reference

## The Easy Way (Recommended)

When you update `technologies-content-with-outcomes.json`:

```bash
npm run reseed
```

That's it! One command handles everything:
- ✅ Auto-detects if JSON changed
- ✅ Regenerates SQL if needed
- ✅ Clears old data safely
- ✅ Seeds new data with outcomes
- ✅ Re-indexes vectors
- ✅ Verifies success

## Common Commands

```bash
# Standard re-seed (production)
npm run reseed

# Force re-seed even if files haven't changed
npm run reseed:force

# Test locally
npm run reseed:local

# See what would happen without making changes
npm run reseed:dryrun

# Manual direct script
pwsh -File scripts/reseed-ai-data.ps1
```

## Workflow

1. **Edit JSON** → Update `schema/technologies-content-with-outcomes.json`
2. **Run reseed** → `npm run reseed`
3. **Check status** → `npm run health`
4. **Done!** Semantic search is live with your new data

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "SQL not updating" | Run `npm run reseed:force` to force regeneration |
| "Foreign key error" | Already handled by script! Run `npm run reseed` again |
| "Vectors not indexed" | Wait 10 seconds and check `npm run health` |
| "Database corrupted" | Safe to retry! Script is idempotent |

## What the Script Does

1. Checks if `technologies-content-with-outcomes.json` exists
2. Regenerates SQL if JSON is newer (or if forced)
3. Clears vectors, technologies, then categories (in correct order)
4. Seeds 9 categories + 64 technologies with outcomes
5. Re-indexes all 64 vectors for semantic search
6. Runs health check to confirm everything works

## Pro Tips

- Always run `npm run reseed:dryrun` first if unsure
- The script is **idempotent** - safe to run multiple times
- Delete old migrations files you don't need anymore
- Outcomes data fields: `action`, `effect`, `outcome`, `related_project`

## Questions?

Read the full guide: `RESEED_GUIDE.md`
