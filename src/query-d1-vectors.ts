/**
 * D1 Vector Query Handler
 * Performs semantic search using vectors stored in D1 database
 * 
 * This is the core query endpoint that:
 * 1. Generates embedding for user query
 * 2. Compares against stored skill vectors using cosine similarity
 * 3. Fetches matching skills from database
 * 4. Optionally generates AI response using LLM
 */

import { generateEmbedding, cosineSimilarity } from './services/embeddingService';
import { generateCacheKey, getCachedResponse, setCachedResponse } from './services/cacheService';
import { AI_CONFIG, SEARCH_CONFIG, CACHE_CONFIG } from './config';

interface Env {
  DB: D1Database;
  AI: Ai;
  CACHE_TTL?: string;
  AI_REPLY_ENABLED?: string;
}

interface Technology {
  id: number;
  name: string;
  experience?: string;
  experience_years?: number;
  proficiency_percent?: number;
  level?: string;
  summary?: string;
  category?: string;
  recency?: string;
  action?: string;
  effect?: string;
  outcome?: string;
  related_project?: string;
  employer?: string;
}

/**
 * Handle D1 vector-based semantic search queries
 * 
 * @param request - Incoming request with query parameter
 * @param env - Worker environment bindings
 * @returns JSON response with search results and optional AI reply
 */
export async function handleD1VectorQuery(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    let rawQuery: string;
    
    // Handle both GET and POST requests
    if (request.method === 'GET') {
      rawQuery = url.searchParams.get('q') || '';
    } else {
      // POST request - parse JSON body
      const body = await request.json() as { question?: string; q?: string };
      rawQuery = body.question || body.q || '';
    }

    if (!rawQuery || rawQuery.trim().length === 0) {
      return Response.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    const query = rawQuery.trim();
    console.log(`D1 Vector Query: "${query}"`);

    // Check cache first
    const cacheKey = generateCacheKey(query);
    const cachedData = await getCachedResponse(cacheKey, request.url);
    
    if (cachedData) {
      console.log('Cache hit');
      return Response.json(cachedData);
    }

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query, env.AI);
    const queryVector = new Float32Array(queryEmbedding);

    // Fetch all vectors from D1
    const { results: vectors } = await env.DB.prepare(`
      SELECT v.id, v.item_id, v.embedding, v.metadata, 
             t.name, t.experience, t.experience_years,
             t.proficiency_percent, t.level, t.summary, t.category, t.recency,
             t.action, t.effect, t.outcome, t.related_project, t.employer
      FROM vectors v
      JOIN technology t ON v.item_id = t.id
      WHERE v.item_type = 'technology'
    `).all();

    if (!vectors || vectors.length === 0) {
      return Response.json({
        query,
        assistantReply: "I couldn't find any relevant skills for that query. Could you try rephrasing?",
      });
    }

    console.log(`Found ${vectors.length} vectors to compare`);

    // Calculate similarities
    const similarities: Array<{
      id: number;
      item_id: number;
      similarity: number;
      technology: Technology;
    }> = [];

    for (const vector of vectors) {
      try {
        // D1 returns BLOBs as Arrays of bytes
        let embedding: Float32Array;
        const embeddingData = vector.embedding as any;

        if (Array.isArray(embeddingData)) {
          const uint8 = new Uint8Array(embeddingData);
          embedding = new Float32Array(uint8.buffer);
        } else if (embeddingData instanceof ArrayBuffer) {
          embedding = new Float32Array(embeddingData);
        } else if (ArrayBuffer.isView(embeddingData)) {
          embedding = new Float32Array(embeddingData.buffer, embeddingData.byteOffset, embeddingData.byteLength / 4);
        } else {
          console.error(`Vector ${vector.id}: Unexpected type`);
          continue;
        }

        if (embedding.length !== queryVector.length) {
          console.error(`Vector ${vector.id}: Dimension mismatch`);
          continue;
        }

        const similarity = cosineSimilarity(queryVector, embedding);

        if (isNaN(similarity)) {
          continue;
        }

        similarities.push({
          id: vector.id as number,
          item_id: vector.item_id as number,
          similarity,
          technology: {
            id: vector.item_id as number,
            name: vector.name as string,
            experience: vector.experience as string,
            experience_years: vector.experience_years as number,
            proficiency_percent: vector.proficiency_percent as number,
            level: vector.level as string,
            summary: vector.summary as string,
            category: vector.category as string,
            recency: vector.recency as string,
            action: vector.action as string,
            effect: vector.effect as string,
            outcome: vector.outcome as string,
            related_project: vector.related_project as string,
            employer: vector.employer as string,
          },
        });
      } catch (error: any) {
        console.error(`Error processing vector ${vector.id}:`, error.message);
        continue;
      }
    }

    // Sort by similarity and take top results
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topResults = similarities.slice(0, SEARCH_CONFIG.TOP_K_EXTENDED);

    console.log(`Top result: ${topResults[0]?.technology.name} (${topResults[0]?.similarity.toFixed(4)})`);

    // Prepare response
    const responseData: any = {
      query,
      assistantReply: '',
    };

    // Generate AI reply if enabled
    if (env.AI_REPLY_ENABLED === 'true' && topResults.length > 0) {
      try {
        const top5 = topResults.slice(0, SEARCH_CONFIG.TOP_K);
        const topScore = top5[0]?.similarity ?? 0;
        const confidence = topScore >= SEARCH_CONFIG.HIGH_CONFIDENCE ? 'high' : 
                          topScore >= SEARCH_CONFIG.MEDIUM_CONFIDENCE ? 'medium' : 'low';

        const resultsText = top5.map((r, i) => {
          const tech = r.technology;
          let text = `${i+1}. ${tech.name} — ${tech.experience_years} years, ${tech.level}`;
          if (tech.action) text += `\n   Action: ${tech.action}`;
          if (tech.effect) text += `\n   Effect: ${tech.effect}`;
          if (tech.outcome) text += `\n   Outcome: ${tech.outcome}`;
          if (tech.related_project) text += `\n   Project: ${tech.related_project}`;
          text += `\n   Similarity: ${r.similarity.toFixed(3)}`;
          return text;
        }).join('\n\n');

        const prompt = `You are a helpful technical assistant answering questions about a candidate's CV.

USER QUESTION: "${query}"

TOP MATCHING SKILLS (confidence: ${confidence}, score: ${topScore.toFixed(3)}):
${resultsText}

Provide a concise 2-3 sentence answer that:
1. Uses the top matching skills to answer the question
2. Highlights measurable outcomes when available
3. Mentions years of experience and proficiency level
4. Keeps it professional and factual

Answer directly and concisely.`;

        const aiResponse = await env.AI.run(AI_CONFIG.CHAT_MODEL as any, {
          messages: [
            { 
              role: 'system', 
              content: 'You are a helpful assistant that provides concise, factual answers about a candidate\'s technical skills and experience. Focus on concrete outcomes and measurable results.'
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: AI_CONFIG.MAX_TOKENS,
        }) as any;

        // Extract AI response
        let aiReply = '';
        if (typeof aiResponse === 'string') {
          aiReply = aiResponse;
        } else if (aiResponse?.response) {
          aiReply = aiResponse.response;
        } else if (Array.isArray(aiResponse?.choices) && aiResponse.choices[0]?.message?.content) {
          aiReply = aiResponse.choices[0].message.content;
        }

        responseData.assistantReply = aiReply.trim();
      } catch (aiError: any) {
        console.error('AI reply generation failed:', aiError);
        responseData.assistantReply = '';
      }
    }

    // Cache the response
    const cacheTtl = parseInt(env.CACHE_TTL || CACHE_CONFIG.DEFAULT_TTL.toString(), 10);
    await setCachedResponse(cacheKey, request.url, responseData, cacheTtl);

    return Response.json(responseData);

  } catch (error: any) {
    console.error('D1 Vector query error:', error);
    return Response.json({
      error: error.message || 'Query failed',
    }, { status: 500 });
  }
}
