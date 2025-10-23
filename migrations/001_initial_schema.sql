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
-- This stores individual skills/technologies with experience details
CREATE TABLE technology (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stable_id TEXT NOT NULL UNIQUE,          -- Stable identifier for updates
  name TEXT NOT NULL,                       -- Technology name (e.g., "Python", "React")
  experience TEXT,                          -- Description of experience
  experience_years INTEGER,                 -- Years of experience
  proficiency_percent INTEGER,              -- Proficiency percentage (0-100)
  level TEXT,                               -- Skill level (Beginner, Intermediate, Advanced, Expert)
  summary TEXT,                             -- Summary of experience
  category TEXT,                            -- Category name (for display)
  recency TEXT,                             -- Recency indicator (e.g., "2024-Present")
  category_id INTEGER,                      -- Foreign key to category
  action TEXT,                              -- What was done with this skill
  effect TEXT,                              -- Operational/technical effect
  outcome TEXT,                             -- Business outcome or measurable result
  related_project TEXT,                     -- Optional project/context anchor
  employer TEXT,                            -- Employer/organization
  FOREIGN KEY (category_id) REFERENCES technology_category(id)
);

-- Create vectors table
-- Stores embeddings for semantic search
CREATE TABLE vectors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_type TEXT NOT NULL,                  -- Type of item (e.g., 'technology')
  item_id INTEGER NOT NULL,                 -- Foreign key to technology table
  embedding BLOB NOT NULL,                  -- Vector embedding (binary)
  metadata JSON,                            -- Additional metadata
  FOREIGN KEY (item_id) REFERENCES technology(id)
);

-- Create indexes for better query performance
CREATE INDEX idx_technology_stable_id ON technology(stable_id);
CREATE INDEX idx_technology_category_id ON technology(category_id);
CREATE INDEX idx_vectors_item_type_id ON vectors(item_type, item_id);
