/**
 * Query D1 vectors directly using cosine similarity
 * This bypasses Vectorize and uses the embeddings stored in your vectors table
 */

interface Env {
  DB: D1Database;
  AI: Ai;
  AI_REPLY_ENABLED?: string;
}

// Convert binary blob to Float32Array
function blobToFloat32Array(blob: ArrayBuffer): Float32Array {
  return new Float32Array(blob);
}

// Cosine similarity calculation
function cosineSimilarity(vecA: Float32Array | number[], vecB: Float32Array | number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Generate embedding using Workers AI
async function generateEmbedding(text: string, ai: Ai): Promise<number[]> {
  const response = await ai.run('@cf/baai/bge-base-en-v1.5', {
    text: [text],
  }) as { data: number[][] };
  return response.data[0];
}

export async function handleD1VectorQuery(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || await request.text();

    if (!query || query.trim().length === 0) {
      return Response.json({ error: 'Query parameter "q" is required' }, { status: 400 });
    }

    console.log(`D1 Vector Query: "${query}"`);

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query, env.AI);
    const queryVector = new Float32Array(queryEmbedding);

    // Fetch ALL vectors from D1 (for small datasets, this is fine)
    // For large datasets, you'd want to implement approximate nearest neighbor search
    const { results: vectors } = await env.DB.prepare(
      `SELECT v.id, v.item_id, v.embedding, v.metadata, t.name, t.experience, t.experience_years,
              t.proficiency_percent, t.level, t.summary, t.category, t.recency
       FROM vectors v
       JOIN technology t ON v.item_id = t.id
       WHERE v.item_type = 'technology'`
    ).all();

    if (!vectors || vectors.length === 0) {
      return Response.json({ error: 'No vectors found in database' }, { status: 404 });
    }

    console.log(`Found ${vectors.length} vectors to compare`);

    // Calculate similarities
    const similarities: Array<{
      id: number;
      item_id: number;
      similarity: number;
      technology: any;
      metadata: any;
    }> = [];

    for (const vector of vectors) {
      // D1 returns BLOB as ArrayBuffer in Workers runtime
      let embedding: Float32Array;

      try {
        const embeddingData = vector.embedding as any;

        // D1 returns BLOBs as Arrays of bytes (Uint8Array-like)
        if (Array.isArray(embeddingData)) {
          // Convert byte array to Float32Array
          const uint8 = new Uint8Array(embeddingData);
          embedding = new Float32Array(uint8.buffer);
        } else if (embeddingData instanceof ArrayBuffer) {
          embedding = new Float32Array(embeddingData);
        } else if (ArrayBuffer.isView(embeddingData)) {
          embedding = new Float32Array(embeddingData.buffer, embeddingData.byteOffset, embeddingData.byteLength / 4);
        } else {
          console.error(`Vector ${vector.id}: Unexpected type -`, embeddingData?.constructor?.name || typeof embeddingData);
          continue;
        }

        if (embedding.length !== queryVector.length) {
          console.error(`Vector ${vector.id}: Dimension mismatch - embedding=${embedding.length}, query=${queryVector.length}`);
          continue;
        }

        let similarity = cosineSimilarity(queryVector, embedding);

        if (isNaN(similarity)) {
          console.error(`Vector ${vector.id}: Similarity is NaN`);
          continue;
        }

        // Apply experience-based boost for generic queries
        // This ensures senior skills rank higher when queries are vague
        const years = vector.experience_years as number || 0;
        const level = vector.level as string || '';

        // Boost factor based on seniority (up to +15% for 20+ years Expert)
        let boostFactor = 1.0;
        if (years >= 15 && level === 'Expert') {
          boostFactor = 1.15; // +15% for senior/principal level
        } else if (years >= 10 && level === 'Expert') {
          boostFactor = 1.10; // +10% for expert level
        } else if (years >= 8 && level === 'Advanced') {
          boostFactor = 1.05; // +5% for advanced with significant experience
        }

        // Apply boost
        similarity = Math.min(1.0, similarity * boostFactor);

        const metadata = typeof vector.metadata === 'string'
          ? JSON.parse(vector.metadata)
          : vector.metadata;

        similarities.push({
          id: vector.id as number,
          item_id: vector.item_id as number,
          similarity,
          technology: {
            id: vector.item_id,
            name: vector.name,
            experience: vector.experience,
            years: vector.experience_years,
            proficiency: vector.proficiency_percent,
            level: vector.level,
            summary: vector.summary,
            category: vector.category,
            recency: vector.recency,
          },
          metadata,
        });
      } catch (error: any) {
        console.error(`Error processing vector ${vector.id}:`, error.message);
        continue;
      }
    }

    // Sort by similarity (highest first) and take top 5
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topResults = similarities.slice(0, 5);

    console.log(`Top result: ${topResults[0]?.technology.name} (${topResults[0]?.similarity.toFixed(4)})`);

    // Prepare response
    const responseData: any = {
      query,
      results: topResults.map(r => ({
        id: r.technology.id,
        name: r.technology.name,
        years: r.technology.years,
        level: r.technology.level,
        proficiency: r.technology.proficiency,
        summary: r.technology.summary,
        category: r.technology.category,
        recency: r.technology.recency,
        similarity: r.similarity,
        provenance: {
          source: 'd1-vectors',
          vector_id: r.id,
        },
      })),
      source: 'd1-vectors',
      total_compared: vectors.length,
      timestamp: new Date().toISOString(),
    };

    // Generate AI reply if enabled
    if (env.AI_REPLY_ENABLED === 'true' && topResults.length > 0) {
      try {
        const top5 = topResults.slice(0, 5);
        const topScore = top5[0]?.similarity ?? 0;

        // Confidence interpretation: scores above 0.65 are strong matches for broad queries
        const confidence = topScore >= 0.80 ? 'very high' :
                          topScore >= 0.65 ? 'high' :
                          topScore >= 0.50 ? 'moderate' : 'low';

        // Group results by category for breadth analysis
        const categories = new Set(top5.map(r => r.technology.category));
        const hasRecent = top5.some(r => r.technology.recency);
        const expertSkills = top5.filter(r => r.technology.level === 'Expert');
        const seniorSkills = top5.filter(r => r.technology.years >= 10);

        const resultsText = top5.map((r, i) =>
          `${i+1}. ${r.technology.name} — ${r.technology.years} years, ${r.technology.level}${r.technology.recency ? ` (${r.technology.recency})` : ''}
   Category: ${r.technology.category}
   ${r.technology.summary}
   Similarity: ${r.similarity.toFixed(3)}`
        ).join('\n\n');

        const prompt = `You are a professional technical recruiter assessing a senior software engineer candidate.

User question: "${query}"

Top matching skills (confidence: ${confidence}, score: ${topScore.toFixed(3)}):
${resultsText}

Context for assessment:
- Categories represented: ${Array.from(categories).join(', ')}
- Expert-level skills: ${expertSkills.length} (${expertSkills.map(s => s.technology.name).join(', ')})
- Senior experience (10+ years): ${seniorSkills.length} (${seniorSkills.map(s => s.technology.name).join(', ')})
- Recent/current skills: ${hasRecent ? 'Yes' : 'No'}

IMPORTANT GUIDELINES:
1. For breadth/overview queries: Highlight at least one skill from each major category (Frontend, Backend, Database, Architecture)
2. Emphasize "recency" when present, especially if query mentions "current" or "recent"
3. Highlight Expert/Advanced levels and 10+ years when query mentions "depth" or "senior"
4. Use the summary field as narrative anchor - these are outcome-driven descriptions
5. Scores above 0.65 are STRONG matches for broad queries - do not undersell confidence
6. Synthesize into a concise, outcome-driven paragraph balancing depth AND breadth
7. Never rate as "moderate" or "further assessment needed" when scores are 0.65+ with Expert/10+ years experience

Provide a professional 3-4 sentence assessment that positions this as a SENIOR/PRINCIPAL level candidate.`;

        const aiResponse = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
          messages: [
            { role: 'system', content: 'You are a senior technical recruiter. Provide confident, outcome-focused assessments that highlight candidate strengths. Never undersell senior expertise.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 200
        }) as { response?: string };

        responseData.assistantReply = aiResponse?.response || '';
      } catch (aiError) {
        console.error('AI reply generation failed:', aiError);
        responseData.assistantReply = '';
      }
    }

    return Response.json(responseData);

  } catch (error: any) {
    console.error('D1 Vector query error:', error);
    return Response.json({
      error: error.message || 'Query failed',
      stack: error.stack,
    }, { status: 500 });
  }
}
