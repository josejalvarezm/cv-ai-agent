/**
 * Generate SQL INSERT statements from enriched JSON with outcomes
 * Run with: node scripts/generate-seed-sql.js > migrations/002_seed_data_tech_only.sql
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, '../schema/technologies-content-with-outcomes.json');
const enrichedData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

console.log('-- Seed data generated from technologies-content-with-outcomes.json\n');

// Insert categories and collect IDs
const categoryMap = new Map();
let categoryId = 1;

console.log('-- Insert categories');
for (const categoryObj of enrichedData.technologyCategories) {
  const categoryName = categoryObj.name.replace(/'/g, "''"); // Escape single quotes
  console.log(`INSERT INTO technology_category (id, name) VALUES (${categoryId}, '${categoryName}');`);
  categoryMap.set(categoryObj.name, categoryId);
  categoryId++;
}

console.log('\n-- Insert technologies');
let techId = 1;

for (const categoryObj of enrichedData.technologyCategories) {
  const catId = categoryMap.get(categoryObj.name);

  console.log(`\n-- ${categoryObj.name}`);

  for (const tech of categoryObj.technologies) {
    const escape = (val) => val ? `'${String(val).replace(/'/g, "''")}'` : 'NULL';

    const values = [
      techId,
      escape(tech.id),
      escape(tech.name),
      escape(tech.experience),
      tech.experienceYears,
      tech.proficiencyPercent,
      escape(tech.level),
      escape(tech.summary),
      escape(tech.category),
      tech.recency ? escape(tech.recency) : 'NULL',
      catId,
      escape(tech.action),
      escape(tech.effect),
      escape(tech.outcome),
      escape(tech.related_project)
    ];

    const insertStatement = `INSERT INTO technology (id, stable_id, name, experience, experience_years, proficiency_percent, level, summary, category, recency, category_id, action, effect, outcome, related_project) VALUES (${values.join(', ')});`;
    console.log(insertStatement);

    techId++;
  }
}

console.log('\n-- Note: Vector embeddings will be generated separately via Worker');
