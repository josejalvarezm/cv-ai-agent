# Schema Migration Guide

## Overview

This guide explains how to safely add new fields to the database schema without breaking the seeding process.

## ⚠️ Critical Rule

**NEVER add a new field to the JSON data before migrating the database schema!**

The database schema must exist BEFORE you try to insert data with the new field.

## The Correct Order

When adding a new field like `employer`, `tags`, etc., follow these steps **in order**:

### Step 1: Update the Base Schema

Edit `migrations/001_initial_schema.sql` to document the new field:

```sql
CREATE TABLE technology (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stable_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  -- ... existing fields ...
  employer TEXT,            -- NEW FIELD: Add comment explaining purpose
  FOREIGN KEY (category_id) REFERENCES technology_category(id)
);
```

### Step 2: Create a Migration File

Create a new migration file: `migrations/00X_add_fieldname.sql`

```sql
-- Add employer column to technology table
ALTER TABLE technology ADD COLUMN employer TEXT;
```

**Naming convention**: Use sequential numbers (003, 004, etc.) and descriptive names.

### Step 3: Apply Migration to Remote Database

```bash
npx wrangler d1 execute cv_assistant_db --remote --file=migrations/003_add_employer.sql
```

**Wait for success message** before proceeding!

### Step 4: Update the Seed Generator

Edit `scripts/generate-seed-sql.js`:

```javascript
// Add the new field to the values array
const values = [
  techId,
  escape(tech.id),
  escape(tech.name),
  // ... existing fields ...
  escape(tech.employer)  // NEW FIELD
];

// Add the new field to the INSERT column list
const insertStatement = `INSERT INTO technology (
  id, stable_id, name, ..., employer
) VALUES (${values.join(', ')});`;
```

### Step 5: Update the JSON Data

Now it's safe to add the field to `schema/technologies-content-with-outcomes.json`:

```json
{
  "id": "csharp-1",
  "name": "C#",
  "experience": "19 years",
  "employer": "CCHQ national campaign platform, Wairbut"
}
```

### Step 6: Reseed the Database

```bash
npm run reseed
```

This will:
- Regenerate the SQL with the new field
- Clear old data
- Insert new data with the employer field populated

## What Happens If You Skip Steps?

### ❌ If you skip the migration (Step 3):

```
X [ERROR] table technology has no column named employer: SQLITE_ERROR
```

**Why**: The database doesn't know about the new column yet, so it can't accept data for it.

**Fix**: Go back and do steps 2-3, then run `npm run reseed` again.

### ❌ If you skip updating the generator (Step 4):

The new field will be `NULL` for all records even though your JSON has values.

**Fix**: Update the generator and run `npm run reseed:force`.

### ❌ If you update JSON first (skip steps 1-4):

Same as skipping migration - you'll get the "no column named X" error.

**Fix**: Follow steps 1-4, then run `npm run reseed`.

## Migration Examples

### Example 1: Adding a Single Text Column

```sql
-- migrations/004_add_certification.sql
ALTER TABLE technology ADD COLUMN certification TEXT;
```

Apply:

```bash
npx wrangler d1 execute cv_assistant_db --remote --file=migrations/004_add_certification.sql
```

### Example 2: Adding Multiple Columns

```sql
-- migrations/005_add_metadata_fields.sql
ALTER TABLE technology ADD COLUMN last_used_date TEXT;
ALTER TABLE technology ADD COLUMN proficiency_level INTEGER;
ALTER TABLE technology ADD COLUMN is_primary BOOLEAN DEFAULT 0;
```

### Example 3: Adding a Column with Default Value

```sql
-- migrations/006_add_visibility.sql
ALTER TABLE technology ADD COLUMN is_visible BOOLEAN DEFAULT 1;
```

## Verification Checklist

After applying a migration and reseeding, verify:

- [ ] Migration applied successfully (check wrangler output)
- [ ] `npm run reseed` completed without errors
- [ ] Query the database to confirm the column exists:

```bash
npx wrangler d1 execute cv_assistant_db --remote --command="SELECT name, your_new_field FROM technology LIMIT 5"
```

- [ ] New field contains expected values (not all NULL)
- [ ] `npm run health` shows correct record count

## Local vs Remote

### Local Development

If testing locally first:

```bash
# Apply to local DB
npx wrangler d1 execute cv_assistant_db --local --file=migrations/003_add_employer.sql

# Reseed local
npm run reseed:local
```

### Production (Remote)

Always use `--remote` flag for production database:

```bash
npx wrangler d1 execute cv_assistant_db --remote --file=migrations/003_add_employer.sql
npm run reseed
```

## Quick Reference

| Task | Command |
|------|---------|
| Create migration file | `migrations/00X_add_field.sql` |
| Apply to remote DB | `npx wrangler d1 execute cv_assistant_db --remote --file=migrations/00X_add_field.sql` |
| Apply to local DB | `npx wrangler d1 execute cv_assistant_db --local --file=migrations/00X_add_field.sql` |
| Update generator | Edit `scripts/generate-seed-sql.js` |
| Reseed remote | `npm run reseed` |
| Reseed local | `npm run reseed:local` |
| Verify column exists | `npx wrangler d1 execute cv_assistant_db --remote --command="PRAGMA table_info(technology)"` |

## Common Mistakes to Avoid

1. ❌ **Adding field to JSON first** → Always migrate DB first
2. ❌ **Forgetting to update generator** → Field will be NULL
3. ❌ **Not waiting for migration to complete** → Check for success message
4. ❌ **Using `--local` when you meant `--remote`** → Wrong database updated
5. ❌ **Not documenting in base schema** → Future confusion

## Summary

**The Golden Rule**: Schema first, data second.

1. Update base schema (documentation)
2. Create migration file
3. Apply migration to database
4. Update seed generator
5. Update JSON data
6. Reseed

Follow this order **every time** you add a new field, and you'll never see "no column named X" errors again.
