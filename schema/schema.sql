-- Technology categories
DROP TABLE IF EXISTS technology_category;
CREATE TABLE technology_category (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  icon TEXT
);

-- Technologies within categories
DROP TABLE IF EXISTS technology;
CREATE TABLE technology (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            stable_id TEXT NOT NULL UNIQUE,   -- e.g. "soa-001"
                            name TEXT NOT NULL,
                            experience TEXT,                  -- "8+ years"
                            experience_years INTEGER,
                            proficiency_percent INTEGER,
                            level TEXT,                       -- "Advanced", "Proficient", etc.
                            summary TEXT,                     -- recruiter-friendly one-liner
                            category TEXT,                    -- carry down the human-readable category
                            recency TEXT,                     -- e.g. "2017–2025"
                            category_id INTEGER,              -- optional FK to technology_category
                            FOREIGN KEY (category_id) REFERENCES technology_category(id)
);

-- Single table for vector storage (one table is sufficient for Vectorize + fallback)
-- embedding can be NULL at seed time; production workflows should store real vectors (BLOB/JSON)
DROP TABLE IF EXISTS vectors;
CREATE TABLE vectors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_type TEXT NOT NULL, -- e.g., 'skill' or 'technology'
  item_id INTEGER NOT NULL, -- references skills.id or technology.id
  version INTEGER DEFAULT 1,
  embedding BLOB, -- store binary or JSON blob of floats
  metadata TEXT, -- JSON string with lightweight metadata for search results
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);