-- Drop existing tables if they exist
DROP TABLE IF EXISTS vectors;
DROP TABLE IF EXISTS technology;
DROP TABLE IF EXISTS technology_category;

-- ⚠️ IMPORTANT: When adding new columns to the technology table:
-- 1. Add the column definition below (for documentation)
-- 2. Create a new migration file (e.g., 004_add_your_field.sql)
-- 3. Apply the migration: npx wrangler d1 execute cv_assistant_db --remote --file=migrations/00X_add_field.sql
-- 4. Update scripts/generate-seed-sql.js to include the new field
-- 5. Update schema/technologies-content-with-outcomes.json with values
-- 6. Run: npm run reseed
-- See: SCHEMA_MIGRATION_GUIDE.md for complete instructions

-- Create technology_category table
CREATE TABLE technology_category (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

-- Create technology table
CREATE TABLE technology (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stable_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  experience TEXT,
  experience_years INTEGER,
  proficiency_percent INTEGER,
  level TEXT,
  summary TEXT,
  category TEXT,
  recency TEXT,
  category_id INTEGER,
  action TEXT,              -- What was done with this skill
  effect TEXT,              -- Operational/technical effect
  outcome TEXT,             -- Business outcome or measurable result
  related_project TEXT,     -- Optional project/context anchor
  employer TEXT,            -- Employer/organization (Independent Production, Wairbut, CCHQ national campaign platform)
  FOREIGN KEY (category_id) REFERENCES technology_category(id)
);

-- Create vectors table
CREATE TABLE vectors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_type TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  embedding BLOB NOT NULL,
  metadata JSON,
  FOREIGN KEY (item_id) REFERENCES technology(id)
);

-- Create indexes for better query performance
CREATE INDEX idx_technology_stable_id ON technology(stable_id);
CREATE INDEX idx_technology_category_id ON technology(category_id);
CREATE INDEX idx_vectors_item_type_id ON vectors(item_type, item_id);
