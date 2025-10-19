#!/usr/bin/env node
/**
 * Remove employer names from text fields in technologies-content-with-outcomes.json
 * Keeps employer names ONLY in the dedicated "employer" field
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const jsonPath = join(__dirname, '../schema/technologies-content-with-outcomes.json');

// Employer patterns to remove from text fields
const employerPatterns = [
  / at CCHQ/g,
  / and Wairbut/g,
  / at Wairbut/g,
  / for Independent Production/g,
  / at Independent Production/g,
  / for Prototype Development/g,
  / at Prototype Development/g
];

console.log('Reading JSON file...');
const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));

let updatedCount = 0;
const fieldsToClean = ['summary', 'action', 'effect', 'outcome', 'embedding_text'];

// Process each category
for (const category of data.technologyCategories) {
  for (const tech of category.technologies) {
    // Process each text field
    for (const field of fieldsToClean) {
      if (tech[field]) {
        const originalValue = tech[field];
        
        // Remove all employer patterns
        let cleanedValue = tech[field];
        for (const pattern of employerPatterns) {
          cleanedValue = cleanedValue.replace(pattern, '');
        }
        
        // Track changes
        if (cleanedValue !== originalValue) {
          tech[field] = cleanedValue;
          updatedCount++;
        }
      }
    }
  }
}

// Write back to file with proper formatting
console.log('Writing cleaned JSON...');
writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8');

console.log('\n✅ EMPLOYER REMOVAL COMPLETE');
console.log(`\nFile: ${jsonPath}`);
console.log(`Total field values updated: ${updatedCount}`);
console.log('\nEmployer names removed from:');
fieldsToClean.forEach(field => console.log(`  - ${field}`));
console.log('\nEmployer names are now ONLY in the \'employer\' field');
