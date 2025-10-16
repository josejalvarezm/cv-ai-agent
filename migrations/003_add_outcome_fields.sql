-- Migration: Add outcome-driven fields to technology table
-- This migration adds action, effect, outcome, and related_project fields
-- to support the outcome-driven CV assistant template

-- Add new columns to technology table
ALTER TABLE technology ADD COLUMN action TEXT;
ALTER TABLE technology ADD COLUMN effect TEXT;
ALTER TABLE technology ADD COLUMN outcome TEXT;
ALTER TABLE technology ADD COLUMN related_project TEXT;

-- Note: SQLite doesn't support adding comments to columns after creation
-- These fields are intended for:
-- - action: What was done with this skill (e.g., "Broke down monolithic applications")
-- - effect: Operational/technical effect (e.g., "Enabled teams to deploy independently")
-- - outcome: Business outcome or measurable result (e.g., "Cut release cycles from weeks to days")
-- - related_project: Optional project/context anchor (e.g., "CCHQ national campaign platform")
