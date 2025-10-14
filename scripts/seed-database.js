/**
 * Seed Cloudflare D1 database with technology data and embeddings
 *
 * Prerequisites:
 * - Cloudflare D1 database created
 * - wrangler CLI installed and configured
 * - OpenAI API key or Cloudflare Workers AI configured
 *
 * Usage:
 *   node seed-database.js
 *
 * Or integrate into a Cloudflare Worker for serverless execution
 */

import fs from 'fs';
import path from 'path';

// Configuration
const DB_NAME = 'recruiter-chatbot-db'; // Your D1 database name
const ENRICHED_DATA_PATH = '../schema/technologies-content-enriched.json';

/**
 * Generate embedding using your preferred service
 * Replace this with your actual embedding API call
 */
async function generateEmbedding(text) {
  // Option 1: OpenAI Embeddings API
  // const response = await fetch('https://api.openai.com/v1/embeddings', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
  //     'Content-Type': 'application/json'
  //   },
  //   body: JSON.stringify({
  //     model: 'text-embedding-3-small',
  //     input: text
  //   })
  // });
  // const data = await response.json();
  // return data.data[0].embedding;

  // Option 2: Cloudflare Workers AI
  // const response = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
  //   text: text
  // });
  // return response.data[0];

  // Placeholder for demonstration
  console.log(`Generating embedding for: "${text.substring(0, 50)}..."`);

  // Return mock embedding (replace with actual API call)
  return new Array(384).fill(0).map(() => Math.random());
}

/**
 * Convert float array to binary blob for SQLite storage
 */
function floatArrayToBlob(floatArray) {
  const buffer = new Float32Array(floatArray);
  return Buffer.from(buffer.buffer);
}

/**
 * Execute D1 query via wrangler CLI
 */
async function executeD1Query(sql, params = []) {
  // In production, use D1 REST API or execute within a Worker
  // For local development, use wrangler d1 execute

  // Pseudocode for D1 execution:
  // const result = await env.DB.prepare(sql).bind(...params).run();
  // return result;

  console.log('Executing SQL:', sql.substring(0, 100) + '...');
  console.log('Params:', params.length > 0 ? params : 'none');

  // Mock response
  return { success: true, meta: { last_row_id: Math.floor(Math.random() * 1000) } };
}

/**
 * Main seeding function
 */
async function seedDatabase() {
  console.log('Starting database seed...\n');

  // Load enriched data
  const dataPath = path.join(import.meta.dirname || __dirname, ENRICHED_DATA_PATH);
  const enrichedData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  const categoryMap = new Map(); // Track category name -> DB ID

  // Step 1: Insert categories
  console.log('Step 1: Inserting categories...');
  for (const categoryObj of enrichedData.technologyCategories) {
    const categoryName = categoryObj.name;

    const result = await executeD1Query(
      'INSERT INTO technology_category (name) VALUES (?) RETURNING id',
      [categoryName]
    );

    const categoryId = result.meta.last_row_id;
    categoryMap.set(categoryName, categoryId);
    console.log(`  ✓ Inserted category: ${categoryName} (ID: ${categoryId})`);
  }

  console.log(`\nStep 2: Inserting technologies and generating embeddings...\n`);

  // Step 2 & 3: Insert technologies and generate embeddings
  for (const categoryObj of enrichedData.technologyCategories) {
    const categoryName = categoryObj.name;
    const categoryId = categoryMap.get(categoryName);

    console.log(`Processing category: ${categoryName}`);

    for (const tech of categoryObj.technologies) {
      // Insert technology
      const techResult = await executeD1Query(
        `INSERT INTO technology (
          stable_id, name, experience, experience_years, proficiency_percent,
          level, summary, category, recency, category_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [
          tech.id,
          tech.name,
          tech.experience,
          tech.experienceYears,
          tech.proficiencyPercent,
          tech.level,
          tech.summary,
          tech.category,
          tech.recency || null,
          categoryId
        ]
      );

      const techId = techResult.meta.last_row_id;
      console.log(`  ✓ Inserted: ${tech.name} (ID: ${techId})`);

      // Generate embedding from embedding_text
      const embeddingText = `${tech.name} — ${tech.experienceYears} years, ${tech.level}. ${tech.summary}`;
      const embedding = await generateEmbedding(embeddingText);

      // Convert embedding to binary blob
      const embeddingBlob = floatArrayToBlob(embedding);

      // Prepare metadata JSON
      const metadata = {
        name: tech.name,
        years: tech.experienceYears,
        level: tech.level,
        summary: tech.summary,
        category: tech.category,
        recency: tech.recency || null
      };

      // Insert vector
      await executeD1Query(
        `INSERT INTO vectors (item_type, item_id, embedding, metadata) VALUES (?, ?, ?, ?)`,
        [
          'technology',
          techId,
          embeddingBlob,
          JSON.stringify(metadata)
        ]
      );

      console.log(`    → Embedding generated and stored`);
    }

    console.log('');
  }

  console.log('✅ Database seeding complete!\n');

  // Summary
  const totalCategories = enrichedData.technologyCategories.length;
  const totalTechnologies = enrichedData.technologyCategories.reduce(
    (sum, cat) => sum + cat.technologies.length,
    0
  );

  console.log('Summary:');
  console.log(`  Categories: ${totalCategories}`);
  console.log(`  Technologies: ${totalTechnologies}`);
  console.log(`  Vectors: ${totalTechnologies}`);
}

/**
 * Production-ready Cloudflare Worker integration example
 */
export async function seedDatabaseInWorker(env) {
  /*
  // This function can be called from a Cloudflare Worker
  // env.DB is your D1 database binding
  // env.AI is your Workers AI binding

  const enrichedData = await fetch('https://your-domain.com/technologies-content-enriched.json')
    .then(r => r.json());

  const db = env.DB;

  // Begin transaction for better performance
  const statements = [];

  // Insert categories
  for (const categoryObj of enrichedData.technologyCategories) {
    statements.push(
      db.prepare('INSERT INTO technology_category (name) VALUES (?)').bind(categoryObj.name)
    );
  }

  await db.batch(statements);

  // Fetch category IDs
  const categories = await db.prepare('SELECT id, name FROM technology_category').all();
  const categoryMap = new Map(categories.results.map(c => [c.name, c.id]));

  // Insert technologies with embeddings
  for (const categoryObj of enrichedData.technologyCategories) {
    const categoryId = categoryMap.get(categoryObj.name);

    for (const tech of categoryObj.technologies) {
      // Insert technology
      const techResult = await db.prepare(
        `INSERT INTO technology (
          stable_id, name, experience, experience_years, proficiency_percent,
          level, summary, category, recency, category_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
      ).bind(
        tech.id, tech.name, tech.experience, tech.experienceYears,
        tech.proficiencyPercent, tech.level, tech.summary,
        tech.category, tech.recency || null, categoryId
      ).first();

      const techId = techResult.id;

      // Generate embedding
      const embeddingText = `${tech.name} — ${tech.experienceYears} years, ${tech.level}. ${tech.summary}`;
      const { data } = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: [embeddingText]
      });
      const embedding = data[0];

      // Store vector
      const embeddingBlob = new Float32Array(embedding).buffer;
      const metadata = {
        name: tech.name,
        years: tech.experienceYears,
        level: tech.level,
        summary: tech.summary,
        category: tech.category,
        recency: tech.recency || null
      };

      await db.prepare(
        'INSERT INTO vectors (item_type, item_id, embedding, metadata) VALUES (?, ?, ?, ?)'
      ).bind('technology', techId, embeddingBlob, JSON.stringify(metadata)).run();
    }
  }

  return { success: true };
  */
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase().catch(console.error);
}
