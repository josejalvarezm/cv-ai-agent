-- Drop existing tables if they exist
DROP TABLE IF EXISTS vectors;
DROP TABLE IF EXISTS technology;
DROP TABLE IF EXISTS technology_category;

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
