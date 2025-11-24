#!/usr/bin/env node
/**
 * CV Skills Audit & SQL Generator
 * 
 * Automates the process of:
 * 1. Parsing deep.seek.cv.md to extract all technologies
 * 2. Querying D1 database for existing skills
 * 3. Identifying missing skills
 * 4. Generating SQL seed file with proper stable_id format
 * 5. Optionally executing the seed file
 * 
 * Usage:
 *   node scripts/audit-and-generate-seed.js [options]
 * 
 * Options:
 *   --execute    Execute the generated SQL immediately
 *   --output     Specify output file (default: scripts/seed-missing-skills.sql)
 *   --cv-path    Path to CV markdown file (default: ../deep.seek.cv.md)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  cvPath: process.argv.includes('--cv-path') 
    ? process.argv[process.argv.indexOf('--cv-path') + 1]
    : path.join(__dirname, '../../deep.seek.cv.md'),
  outputFile: process.argv.includes('--output')
    ? process.argv[process.argv.indexOf('--output') + 1]
    : path.join(__dirname, 'seed-missing-skills.sql'),
  executeImmediately: process.argv.includes('--execute'),
  dbName: 'cv_assistant_db'
};

// Technology patterns to extract from CV
const TECH_PATTERNS = {
  // Cloud platforms
  aws: /AWS Lambda|DynamoDB|SQS FIFO|EventBridge|SES|DynamoDB Streams|S3|CloudFront|API Gateway/gi,
  gcp: /GCP|Cloud Functions|Firestore|Firebase Hosting|BigQuery|Cloud Run|Pub\/Sub/gi,
  azure: /Azure Functions|Azure DevOps|Blob Storage|CDN|Cognitive Services|CosmosDB|Cosmos DB/gi,
  cloudflare: /Cloudflare Workers|Cloudflare Pages|Cloudflare KV|Cloudflare D1|Vectorize|Workers AI/gi,
  
  // Languages
  languages: /TypeScript|JavaScript|Node\.js|Go|C#|Python|Java|Ruby|PHP/gi,
  
  // Frameworks
  frameworks: /React|Angular|AngularJS|Vue\.js|Next\.js|Express|\.NET Core|\.NET 5|\.NET 9|ASP\.NET MVC|ASP\.NET Core|Entity Framework/gi,
  
  // Databases
  databases: /SQL Server|PostgreSQL|MySQL|MongoDB|Redis|Elasticsearch|DynamoDB|Firestore|CosmosDB|Cosmos DB/gi,
  
  // DevOps & Infrastructure
  devops: /Docker|Kubernetes|Terraform|GitHub Actions|GitLab CI|Jenkins|CircleCI|Ansible|Chef|Puppet/gi,
  
  // Architecture patterns
  architecture: /Microservices|Event-Driven|Serverless|REST API|GraphQL|WebSockets|Message Queue|CQRS|Event Sourcing|HMAC|Multi-Cloud/gi,
  
  // Practices
  practices: /CI\/CD|TDD|Agile|Scrum|Pair Programming|Code Review|Infrastructure as Code|Semantic Versioning/gi
};

/**
 * Extract technologies from CV markdown
 */
function extractTechnologiesFromCV(cvPath) {
  console.log('📖 Reading CV file:', cvPath);
  
  if (!fs.existsSync(cvPath)) {
    console.error('❌ CV file not found:', cvPath);
    process.exit(1);
  }
  
  const cvContent = fs.readFileSync(cvPath, 'utf-8');
  const technologies = new Set();
  
  // Extract using patterns
  Object.entries(TECH_PATTERNS).forEach(([category, pattern]) => {
    const matches = cvContent.match(pattern) || [];
    matches.forEach(tech => {
      // Normalize technology name
      const normalized = tech
        .replace(/\s+/g, ' ')
        .replace(/\*\*/g, '')  // Remove markdown bold
        .replace(/\*/g, '')    // Remove markdown italic
        .trim();
      if (normalized && normalized.length > 1) {
        technologies.add(normalized);
      }
    });
  });
  
  // Extract from Technical Expertise section specifically
  const techExpertiseMatch = cvContent.match(/## Technical Expertise([\s\S]*?)(?=##|$)/);
  if (techExpertiseMatch) {
    const techSection = techExpertiseMatch[1];
    
    // Extract items from lists
    const listItems = techSection.match(/(?:^|\n)[•\-\*]\s*\*\*([^*:]+)\*\*/gm) || [];
    listItems.forEach(item => {
      const tech = item.replace(/(?:^|\n)[•\-\*]\s*\*\*([^*:]+)\*\*/, '$1').trim();
      if (tech) technologies.add(tech);
    });
    
    // Extract from comma-separated lists
    const commaSeparated = techSection.match(/:\s*([^\n]+)/g) || [];
    commaSeparated.forEach(line => {
      const techs = line.replace(/^:\s*/, '').split(/,|;|\||(?:and\s)/);
      techs.forEach(t => {
        const tech = t.trim()
          .replace(/\(.*?\)/g, '')  // Remove parentheses
          .replace(/\*\*/g, '')      // Remove markdown bold
          .replace(/\*/g, '')        // Remove markdown italic
          .trim();
        if (tech && tech.length > 2) technologies.add(tech);
      });
    });
  }
  
  console.log(`✅ Found ${technologies.size} unique technologies in CV\n`);
  return Array.from(technologies).sort();
}

/**
 * Query D1 database for existing technologies
 */
function getExistingTechnologies() {
  console.log('🔍 Querying D1 database for existing skills...');
  
  try {
    // Use PowerShell to capture only stdout (table), ignore stderr (warnings)
    const command = process.platform === 'win32'
      ? `powershell -NoProfile -Command "$output = npx wrangler d1 execute ${CONFIG.dbName} --remote --yes --command \\"SELECT id, stable_id, name FROM technology ORDER BY name\\" 2>$null; Write-Output $output"`
      : `npx wrangler d1 execute ${CONFIG.dbName} --remote --yes --command "SELECT id, stable_id, name FROM technology ORDER BY name" 2>/dev/null`;
    
    const result = execSync(command, { 
      encoding: 'utf-8', 
      cwd: path.join(__dirname, '..'),
      maxBuffer: 10 * 1024 * 1024  // 10MB buffer for large results
    });
    
    const existing = new Map();
    const stableIds = new Set();
    
    // Parse D1 table output
    const lines = result.split('\n');
    
    for (const line of lines) {
      // Match table rows with box drawing characters: │ id │ stable_id │ name │
      // Unicode box drawing: U+2502 (│), U+2500 (─), U+250C (┌), etc.
      const match = line.match(/[│┤├]\s*(\d+)\s*[│┤├]\s*([^│┤├]+)\s*[│┤├]\s*([^│┤├]+)\s*[│┤├]/);
      
      if (match) {
        const [, id, stable_id, name] = match;
        const cleanName = name.trim();
        const cleanStableId = stable_id.trim();
        const cleanId = id.trim();
        
        // Skip header row and separator rows
        if (cleanName && 
            cleanStableId && 
            !cleanName.includes('─') &&
            !cleanName.includes('┌') &&
            !cleanName.includes('└') &&
            cleanName !== 'name' &&
            !isNaN(parseInt(cleanId))) {
          
          existing.set(cleanName.toLowerCase(), {
            id: parseInt(cleanId),
            stable_id: cleanStableId,
            name: cleanName
          });
          stableIds.add(cleanStableId);
        }
      }
    }
    
    console.log(`✅ Found ${existing.size} existing skills in D1`);
    console.log(`✅ Found ${stableIds.size} existing stable_ids\n`);
    
    return { existing, stableIds };
  } catch (error) {
    console.error('❌ Error querying D1:', error.message);
    console.error('Make sure you are authenticated with Wrangler: npx wrangler login');
    process.exit(1);
  }
}

/**
 * Generate stable_id from technology name
 */
function generateStableId(name, existingStableIds) {
  // Convert to lowercase kebab-case
  let base = name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')  // Remove special chars except hyphens
    .replace(/\s+/g, '-')       // Spaces to hyphens
    .replace(/\.+/g, '-')       // Dots to hyphens
    .replace(/-+/g, '-')        // Multiple hyphens to single
    .replace(/^-|-$/g, '');     // Remove leading/trailing hyphens
  
  // Find next available sequence number
  let sequence = 1;
  let stableId = `${base}-${sequence}`;
  
  while (existingStableIds.has(stableId)) {
    sequence++;
    stableId = `${base}-${sequence}`;
  }
  
  return stableId;
}

/**
 * Categorize technology
 */
function categorizeTechnology(name) {
  const nameLower = name.toLowerCase();
  
  // Cloud platforms
  if (/aws|lambda|dynamodb|sqs|eventbridge|ses|s3|cloudfront/.test(nameLower)) {
    return 'Cloud & DevOps';
  }
  if (/gcp|cloud functions|firestore|firebase|bigquery/.test(nameLower)) {
    return 'Cloud & DevOps';
  }
  if (/azure|cognitive services|cosmosdb/.test(nameLower)) {
    return 'Cloud & DevOps';
  }
  if (/cloudflare|workers|pages|vectorize/.test(nameLower)) {
    return 'Cloud & DevOps';
  }
  
  // Languages
  if (/typescript|javascript|node|python|java|ruby|php|go|c#/.test(nameLower)) {
    return 'Languages & Frameworks';
  }
  
  // Frameworks
  if (/react|angular|vue|next|express|\.net|asp\.net|entity framework/.test(nameLower)) {
    return 'Languages & Frameworks';
  }
  
  // Databases
  if (/sql server|postgresql|mysql|mongodb|redis|elasticsearch|database/.test(nameLower)) {
    return 'Databases & Storage';
  }
  
  // DevOps
  if (/docker|kubernetes|terraform|github actions|jenkins|ci\/cd/.test(nameLower)) {
    return 'Cloud & DevOps';
  }
  
  // Architecture
  if (/microservices|serverless|event-driven|rest|graphql|websocket|hmac/.test(nameLower)) {
    return 'Architecture & Patterns';
  }
  
  return 'Other';
}

/**
 * Infer experience details from CV context
 */
function inferExperienceDetails(techName, cvContent) {
  const nameLower = techName.toLowerCase();
  
  // Escape regex special characters in technology name
  const escapedTechName = techName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Try to find context around the technology mention
  const regex = new RegExp(`([^.]*${escapedTechName}[^.]*\\.?)`, 'i');
  const match = cvContent.match(regex);
  const context = match ? match[1] : '';
  
  // Default values
  const details = {
    experienceYears: null,
    level: 'Intermediate',
    action: null,
    effect: null,
    outcome: null,
    employer: null,
    recency: null
  };
  
  // Infer years
  const yearsMatch = context.match(/(\d+)\+?\s*years?/i);
  if (yearsMatch) {
    details.experienceYears = parseInt(yearsMatch[1]);
  }
  
  // Infer level based on context
  if (/expert|extensive|advanced|deep|architected|designed|led/i.test(context)) {
    details.level = 'Advanced';
  } else if (/proficient|experienced|delivered|implemented/i.test(context)) {
    details.level = 'Intermediate';
  }
  
  // Infer employer from sections
  if (/Portfolio|Open Source Production Systems/i.test(cvContent.substring(cvContent.toLowerCase().indexOf(nameLower) - 500, cvContent.toLowerCase().indexOf(nameLower) + 500))) {
    details.employer = 'Portfolio';
  } else if (/Conservative Party|National Campaign/i.test(cvContent.substring(cvContent.toLowerCase().indexOf(nameLower) - 500, cvContent.toLowerCase().indexOf(nameLower) + 500))) {
    details.employer = 'Conservative Party';
  }
  
  // Infer recency
  if (/2023|2024|2025|Current/i.test(context)) {
    details.recency = 'Current (2023-2025)';
  } else if (/2020|2021|2022/i.test(context)) {
    details.recency = 'Recent (2020-2023)';
  }
  
  return details;
}

/**
 * Generate SQL INSERT statements for missing technologies
 */
function generateSQLInserts(missingTechs, cvContent, existingStableIds) {
  console.log('\n📝 Generating SQL INSERT statements...\n');
  
  const sqlStatements = [];
  const header = `-- Auto-generated seed file for missing CV skills
-- Generated: ${new Date().toISOString()}
-- Missing technologies: ${missingTechs.length}
--
-- Execute with:
-- npx wrangler d1 execute cv_assistant_db --remote --yes --file=${path.basename(CONFIG.outputFile)}

`;
  
  sqlStatements.push(header);
  
  missingTechs.forEach((tech, index) => {
    const stableId = generateStableId(tech, existingStableIds);
    existingStableIds.add(stableId); // Prevent duplicates within this batch
    
    const category = categorizeTechnology(tech);
    const details = inferExperienceDetails(tech, cvContent);
    
    const escapeSql = (str) => str ? `'${str.replace(/'/g, "''")}'` : 'NULL';
    
    const insert = `-- ${index + 1}. ${tech}
INSERT INTO technology (
    stable_id,
    name,
    category,
    experience,
    experience_years,
    proficiency_percent,
    level,
    action,
    effect,
    outcome,
    employer,
    recency
) VALUES (
    ${escapeSql(stableId)},
    ${escapeSql(tech)},
    ${escapeSql(category)},
    NULL, -- TODO: Add specific experience from CV
    ${details.experienceYears || 'NULL'},
    NULL, -- TODO: Add proficiency percentage
    ${escapeSql(details.level)},
    NULL, -- TODO: Add CAR action
    NULL, -- TODO: Add CAR effect
    NULL, -- TODO: Add CAR outcome
    ${escapeSql(details.employer)},
    ${escapeSql(details.recency)}
);

`;
    
    sqlStatements.push(insert);
  });
  
  return sqlStatements.join('');
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 CV Skills Audit & SQL Generator\n');
  console.log('='.repeat(60));
  console.log('');
  
  // Step 1: Extract technologies from CV
  const cvTechnologies = extractTechnologiesFromCV(CONFIG.cvPath);
  
  // Step 2: Get existing technologies from D1
  const { existing, stableIds } = getExistingTechnologies();
  
  // Step 3: Compare and identify missing
  console.log('🔄 Comparing CV with D1 database...\n');
  
  const missing = [];
  const found = [];
  
  cvTechnologies.forEach(tech => {
    const normalized = tech.toLowerCase();
    if (existing.has(normalized)) {
      found.push(tech);
    } else {
      // Check for partial matches
      let isPartialMatch = false;
      for (const [existingName] of existing) {
        if (existingName.includes(normalized) || normalized.includes(existingName)) {
          found.push(tech);
          isPartialMatch = true;
          break;
        }
      }
      if (!isPartialMatch) {
        missing.push(tech);
      }
    }
  });
  
  console.log('📊 Audit Results:');
  console.log('─'.repeat(60));
  console.log(`   Total technologies in CV: ${cvTechnologies.length}`);
  console.log(`   Already in D1: ${found.length}`);
  console.log(`   Missing from D1: ${missing.length}`);
  console.log('');
  
  if (missing.length === 0) {
    console.log('✅ All CV technologies are already in D1 database!');
    console.log('   No seed file needed.');
    return;
  }
  
  // Step 4: Display missing technologies
  console.log('❌ Missing Technologies:');
  console.log('─'.repeat(60));
  missing.forEach((tech, index) => {
    console.log(`   ${index + 1}. ${tech}`);
  });
  console.log('');
  
  // Step 5: Generate SQL
  const cvContent = fs.readFileSync(CONFIG.cvPath, 'utf-8');
  const sql = generateSQLInserts(missing, cvContent, new Set(stableIds));
  
  // Step 6: Write to file
  fs.writeFileSync(CONFIG.outputFile, sql, 'utf-8');
  console.log('✅ SQL seed file generated:', CONFIG.outputFile);
  console.log('');
  
  // Step 7: Execute if requested
  if (CONFIG.executeImmediately) {
    console.log('⚡ Executing seed file...\n');
    try {
      const result = execSync(
        `npx wrangler d1 execute ${CONFIG.dbName} --remote --yes --file=${CONFIG.outputFile}`,
        { encoding: 'utf-8', cwd: path.join(__dirname, '..') }
      );
      console.log(result);
      console.log('✅ Seed file executed successfully!');
    } catch (error) {
      console.error('❌ Error executing seed file:', error.message);
      process.exit(1);
    }
  } else {
    console.log('📋 Next Steps:');
    console.log('─'.repeat(60));
    console.log('1. Review the generated SQL file:');
    console.log(`   ${CONFIG.outputFile}`);
    console.log('');
    console.log('2. Update TODO comments with CV-accurate details:');
    console.log('   - Add specific experience summaries');
    console.log('   - Fill in CAR framework (action, effect, outcome)');
    console.log('   - Add proficiency percentages');
    console.log('');
    console.log('3. Execute the seed file:');
    console.log(`   npx wrangler d1 execute ${CONFIG.dbName} --remote --yes --file=${CONFIG.outputFile}`);
    console.log('');
    console.log('4. Trigger Vectorize indexing:');
    console.log('   Invoke-RestMethod -Uri "https://cv-assistant-worker-production.{YOUR_WORKERS_SUBDOMAIN}/index" -Method POST');
    console.log('');
    console.log('Or run with --execute flag to execute immediately:');
    console.log(`   node scripts/audit-and-generate-seed.js --execute`);
  }
  
  console.log('');
  console.log('='.repeat(60));
  console.log('✨ Done!');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
