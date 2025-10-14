/**
 * Cloudflare Worker to generate embeddings for all technologies
 *
 * This worker:
 * 1. Fetches all technologies from D1
 * 2. Generates embeddings using Workers AI
 * 3. Stores embeddings in the vectors table
 *
 * Usage: Deploy and call via POST request with authentication
 */

export default {
  async fetch(request, env) {
    // Only allow POST requests
    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    // Simple authentication (replace with your secret)
    const authHeader = request.headers.get('Authorization');
    if (!env.EMBEDDING_SECRET || authHeader !== `Bearer ${env.EMBEDDING_SECRET}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      console.log('Starting embedding generation...');

      // Fetch all technologies from database
      const { results: technologies } = await env.DB.prepare(
        `SELECT id, name, experience_years, level, summary, category, recency
         FROM technology
         ORDER BY id`
      ).all();

      if (!technologies || technologies.length === 0) {
        return Response.json({ error: 'No technologies found' }, { status: 404 });
      }

      console.log(`Found ${technologies.length} technologies`);

      const processedCount = { success: 0, failed: 0, skipped: 0 };
      const errors = [];

      // Process each technology
      for (const tech of technologies) {
        try {
          // Check if embedding already exists
          const { results: existingVectors } = await env.DB.prepare(
            'SELECT id FROM vectors WHERE item_type = ? AND item_id = ?'
          ).bind('technology', tech.id).all();

          if (existingVectors && existingVectors.length > 0) {
            console.log(`Skipping ${tech.name} - embedding already exists`);
            processedCount.skipped++;
            continue;
          }

          // Build embedding text with enhanced seniority indicators
          // Format emphasizes experience level for better semantic matching
          let seniorityPrefix = '';
          if (tech.experience_years >= 15 && tech.level === 'Expert') {
            seniorityPrefix = 'Senior/Principal-level expertise: ';
          } else if (tech.experience_years >= 10 && tech.level === 'Expert') {
            seniorityPrefix = 'Expert-level proficiency: ';
          } else if (tech.experience_years >= 5 && tech.level === 'Advanced') {
            seniorityPrefix = 'Advanced proficiency: ';
          }

          const embeddingText = `${seniorityPrefix}${tech.name} — ${tech.experience_years} years ${tech.level}. ${tech.summary}`;

          console.log(`Generating embedding for: ${tech.name}`);

          // Generate embedding using Cloudflare Workers AI
          // Using BGE-base model which produces 768-dimensional embeddings
          const embeddings = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
            text: [embeddingText]
          });

          if (!embeddings || !embeddings.data || !embeddings.data[0]) {
            throw new Error('Failed to generate embedding');
          }

          const embeddingVector = embeddings.data[0];

          // Convert embedding array to Float32Array buffer for storage
          const float32Array = new Float32Array(embeddingVector);
          const buffer = float32Array.buffer;

          // Prepare metadata JSON
          const metadata = {
            name: tech.name,
            years: tech.experience_years,
            level: tech.level,
            summary: tech.summary,
            category: tech.category,
            recency: tech.recency
          };

          // Insert vector into database
          await env.DB.prepare(
            `INSERT INTO vectors (item_type, item_id, embedding, metadata)
             VALUES (?, ?, ?, ?)`
          ).bind(
            'technology',
            tech.id,
            buffer,
            JSON.stringify(metadata)
          ).run();

          console.log(`✓ Successfully processed: ${tech.name}`);
          processedCount.success++;

        } catch (error) {
          console.error(`✗ Error processing ${tech.name}:`, error.message);
          errors.push({ technology: tech.name, error: error.message });
          processedCount.failed++;
        }
      }

      // Return summary
      return Response.json({
        success: true,
        summary: {
          total: technologies.length,
          processed: processedCount.success,
          skipped: processedCount.skipped,
          failed: processedCount.failed
        },
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      console.error('Fatal error:', error);
      return Response.json({
        success: false,
        error: error.message,
        stack: error.stack
      }, { status: 500 });
    }
  }
};
