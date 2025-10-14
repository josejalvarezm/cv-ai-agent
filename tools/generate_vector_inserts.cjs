const fs = require('fs');
const path = require('path');

const inputPath = path.resolve(__dirname, '../schema/technologies-content.json');
const outPath = path.resolve(__dirname, '../schema/generated_vectors_inserts.sql');

function sanitize(s) {
  if (s === null || s === undefined) return 'NULL';
  return "'" + String(s).replace(/'/g, "''") + "'";
}

function main() {
  const raw = fs.readFileSync(inputPath, 'utf8');
  const doc = JSON.parse(raw);

  const categories = doc.technologyCategories || [];
  const lines = [];

  lines.push('-- Generated inserts for technology_category and technology');
  for (const cat of categories) {
    lines.push(`INSERT INTO technology_category (name, icon) VALUES (${sanitize(cat.name)}, ${sanitize(cat.icon)});`);
    for (const tech of (cat.technologies || [])) {
      lines.push(`INSERT INTO technology (category_id, name, experience, experience_years, proficiency_percent, level) VALUES ((SELECT id FROM technology_category WHERE name=${sanitize(cat.name)}), ${sanitize(tech.name)}, ${sanitize(tech.experience)}, ${tech.experienceYears || 'NULL'}, ${tech.proficiencyPercent || 'NULL'}, ${sanitize(tech.level)});`);
    }
  }

  lines.push('\n-- Placeholder vector entries for all technologies (embeddings NULL)');
  lines.push("INSERT INTO vectors (item_type, item_id, version, embedding, metadata)");
  lines.push("SELECT 'technology', t.id, 1, NULL, json_object('name', t.name, 'category_id', t.category_id) FROM technology t;");

  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log('Wrote', outPath);
}

main();
