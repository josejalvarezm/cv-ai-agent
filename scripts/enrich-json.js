#!/usr/bin/env node
/**
 * Enriches technologies-content-enriched.json with outcome fields
 * from 002_seed_data_outcome_driven.sql
 * 
 * Adds: action, effect, outcome, related_project to each technology
 */

const fs = require('fs');
const path = require('path');

const JSON_FILE = path.join(__dirname, '../schema/technologies-content-enriched.json');
const SQL_FILE = path.join(__dirname, '../migrations/002_seed_data_outcome_driven.sql');
const OUTPUT_FILE = path.join(__dirname, '../schema/technologies-content-with-outcomes.json');

// Parse SQL INSERT statements to extract outcome data
function parseSqlData(sqlContent) {
  const outcomes = {};
  
  // Match INSERT statements
  const insertRegex = /INSERT INTO technology \([^)]+\)\s+VALUES \(([^)]+(?:\([^)]*\)[^)]*)*)\);/gs;
  
  let match;
  while ((match = insertRegex.exec(sqlContent)) !== null) {
    const values = match[1];
    
    // Parse values - this is simplified, real parsing would need to handle escaped quotes
    const parts = [];
    let current = '';
    let inString = false;
    let depth = 0;
    
    for (let i = 0; i < values.length; i++) {
      const char = values[i];
      const prevChar = i > 0 ? values[i-1] : '';
      
      if (char === "'" && prevChar !== '\\') {
        inString = !inString;
        current += char;
      } else if (char === ',' && !inString && depth === 0) {
        parts.push(current.trim());
        current = '';
      } else {
        if (char === '(' && !inString) depth++;
        if (char === ')' && !inString) depth--;
        current += char;
      }
    }
    if (current.trim()) parts.push(current.trim());
    
    // Extract fields (id is at index 0, stable_id at index 1)
    if (parts.length >= 15) {
      const id = parts[0].trim();
      const stable_id = parts[1].replace(/'/g, '').trim();
      const action = parts[11] === 'NULL' ? null : parts[11].replace(/^'|'$/g, '').trim();
      const effect = parts[12] === 'NULL' ? null : parts[12].replace(/^'|'$/g, '').trim();
      const outcome = parts[13] === 'NULL' ? null : parts[13].replace(/^'|'$/g, '').trim();
      const related_project = parts[14] === 'NULL' ? null : parts[14].replace(/^'|'$/g, '').trim();
      
      outcomes[stable_id] = { action, effect, outcome, related_project };
    }
  }
  
  return outcomes;
}

function enrichJson() {
  console.log('🔄 Starting JSON enrichment...\n');
  
  // Read files
  console.log('📖 Reading files...');
  const jsonContent = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
  const sqlContent = fs.readFileSync(SQL_FILE, 'utf8');
  
  // Parse SQL data
  console.log('🔍 Parsing SQL outcome data...');
  const outcomes = parseSqlData(sqlContent);
  console.log(`   Found ${Object.keys(outcomes).length} records with outcome data\n`);
  
  // Enrich JSON
  console.log('✨ Enriching technologies...');
  let enriched = 0;
  let skipped = 0;
  
  jsonContent.technologyCategories.forEach(category => {
    category.technologies.forEach(tech => {
      const outcomeData = outcomes[tech.id];
      
      if (outcomeData) {
        tech.action = outcomeData.action;
        tech.effect = outcomeData.effect;
        tech.outcome = outcomeData.outcome;
        tech.related_project = outcomeData.related_project;
        enriched++;
        console.log(`   ✅ ${tech.name}`);
      } else {
        tech.action = null;
        tech.effect = null;
        tech.outcome = null;
        tech.related_project = null;
        skipped++;
      }
    });
  });
  
  console.log(`\n📊 Summary:`);
  console.log(`   Enriched: ${enriched} technologies`);
  console.log(`   Skipped: ${skipped} technologies (no outcome data)\n`);
  
  // Write output
  console.log(`💾 Writing to ${path.basename(OUTPUT_FILE)}...`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(jsonContent, null, 2));
  
  console.log(`✅ Done!\n`);
  console.log(`📝 Next steps:`);
  console.log(`   1. Review: ${OUTPUT_FILE}`);
  console.log(`   2. If satisfied, replace: ${JSON_FILE}`);
  console.log(`   3. Run: npm run deploy:full\n`);
}

// Run
try {
  enrichJson();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
