/**
 * Indexing endpoint handler
 * POST /index - Index skills/technology into D1 vectors table
 * 
 * This handler generates embeddings for all skills in the database
 * and stores them in the vectors table for semantic search.
 * 
 * This is a simplified version. For production use:
 * - Add batch processing for large datasets
 * - Add progress tracking via KV
 * - Add locking to prevent concurrent indexing
 */

import { generateEmbedding } from '../services/embeddingService';

interface Env {
  DB: D1Database;
  AI: Ai;
}

interface Technology {
  id: number;
  name: string;
  experience?: string;
  summary?: string;
  category?: string;
}

/**
 * POST /index - Index all technology skills into vectors table
 * 
 * Workflow:
 * 1. Fetch all technology records from D1
 * 2. Generate embeddings for each using Workers AI
 * 3. Store embeddings in vectors table
 * 
 * @param request - Incoming request
 * @param env - Worker environment bindings
 * @returns JSON response with indexing results
 * 
 * @example
 * curl -X POST https://your-worker.workers.dev/index
 * // Returns:
 * // {
 * //   "success": true,
 * //   "processed": 15,
 * //   "message": "Indexed 15 skills successfully"
 * // }
 */
export async function handleIndex(request: Request, env: Env): Promise<Response> {
  try {
    console.log('Starting indexing process...');

    // Fetch all technology records
    const { results: technologies } = await env.DB.prepare(
      'SELECT id, name, experience, summary, category FROM technology ORDER BY id'
    ).all<Technology>();

    if (!technologies || technologies.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        processed: 0,
        message: 'No skills to index',
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${technologies.length} technologies to index`);

    // Clear existing vectors for fresh index
    await env.DB.prepare('DELETE FROM vectors WHERE item_type = ?')
      .bind('technology')
      .run();

    let processedCount = 0;

    // Process each technology
    for (const tech of technologies) {
      try {
        // Create text representation for embedding
        const text = `${tech.name} ${tech.experience || ''} ${tech.summary || ''}`.trim();
        
        // Generate embedding
        const embedding = await generateEmbedding(text, env.AI);
        
        // Convert to binary blob for storage
        const embeddingBlob = new Float32Array(embedding).buffer;
        
        // Create metadata
        const metadata = {
          id: tech.id,
          name: tech.name,
          category: tech.category || '',
        };
        
        // Insert into vectors table
        await env.DB.prepare(
          'INSERT INTO vectors (item_type, item_id, embedding, metadata) VALUES (?, ?, ?, ?)'
        )
          .bind('technology', tech.id, embeddingBlob, JSON.stringify(metadata))
          .run();
        
        processedCount++;
        console.log(`Indexed: ${tech.name} (${processedCount}/${technologies.length})`);
      } catch (error) {
        console.error(`Failed to index ${tech.name}:`, error);
        // Continue with next item
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      total: technologies.length,
      message: `Indexed ${processedCount} of ${technologies.length} skills successfully`,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
    
  } catch (error: any) {
    console.error('Indexing error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Indexing failed',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
