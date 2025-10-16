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
              t.proficiency_percent, t.level, t.summary, t.category, t.recency,
              t.action, t.effect, t.outcome, t.related_project
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
            action: vector.action,
            effect: vector.effect,
            outcome: vector.outcome,
            related_project: vector.related_project,
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
        action: r.technology.action,
        effect: r.technology.effect,
        outcome: r.technology.outcome,
        related_project: r.technology.related_project,
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

        const resultsText = top5.map((r, i) => {
          const tech = r.technology;
          // Build a structured text representation highlighting outcome-driven fields
          let text = `${i+1}. ${tech.name} — ${tech.years} years, ${tech.level}${tech.recency ? ` (${tech.recency})` : ''}
   Category: ${tech.category}`;
          
          if (tech.action) text += `\n   Action: ${tech.action}`;
          if (tech.effect) text += `\n   Effect: ${tech.effect}`;
          if (tech.outcome) text += `\n   Outcome: ${tech.outcome}`;
          if (tech.related_project) text += `\n   Project: ${tech.related_project}`;
          if (tech.summary) text += `\n   Summary: ${tech.summary}`;
          
          text += `\n   Similarity: ${r.similarity.toFixed(3)}`;
          return text;
        }).join('\n\n');

        const prompt = `You are an expert CV assistant answering recruiter questions about a senior engineer candidate.

USER QUESTION: "${query}"

TOP MATCHING SKILLS (confidence: ${confidence}, score: ${topScore.toFixed(3)}):
${resultsText}

CONTEXT FOR ASSESSMENT:
- Categories represented: ${Array.from(categories).join(', ')}
- Expert-level skills: ${expertSkills.length} (${expertSkills.map(s => s.technology.name).join(', ')})
- Senior experience (10+ years): ${seniorSkills.length} (${seniorSkills.map(s => s.technology.name).join(', ')})
- Recent/current skills: ${hasRecent ? 'Yes' : 'No'}

YOUR TASK:
Generate an outcome-driven answer using this template:
**Skill → Context (years, level) → Action → Effect → Outcome → Project (optional)**

CRITICAL GUIDELINES:
1. ALWAYS follow the template: Start with the skill name and context (years, level), then describe the Action, Effect, Outcome, and optionally the Project
2. Use the "action", "effect", "outcome", and "related_project" fields when available - these are already structured for recruiter impact
3. If action/effect/outcome fields are empty, extract them from the summary field
4. Be CONCISE, CLEAR, and PROFESSIONAL - avoid recruiter fluff like "exceptional engineer" or "proven track record"
5. Prioritize measurable results and cause-and-effect links (e.g., "Cut release cycles from weeks to days")
6. When multiple skills are relevant, weave them into a coherent narrative
7. Always answer the implicit "So what?" question - why does this matter to business outcomes?
8. For breadth queries: Highlight skills across categories (Frontend, Backend, Database, Architecture)
9. For depth queries: Emphasize Expert/Advanced levels and 10+ years experience
10. Scores 0.65+ with Expert/10+ years = HIGH CONFIDENCE senior/principal positioning

EXAMPLE OUTPUT FORMAT:
"With 5+ years of advanced experience in Full‑Stack Service Decomposition at CCHQ, I broke down monolithic applications into modular services. This enabled teams to deploy independently, cutting release cycles from weeks to days and ensuring campaign responsiveness during national elections."

Provide a professional, outcome-driven answer (3-5 sentences maximum):`;

        const aiResponse = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
          messages: [
            { 
              role: 'system', 
              content: 'You are an expert CV assistant. Generate outcome-driven answers that follow the template: Skill → Context → Action → Effect → Outcome → Project. Be concise, avoid fluff, focus on measurable business impact. Never invent data not present in the provided skills.' 
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: 300
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
