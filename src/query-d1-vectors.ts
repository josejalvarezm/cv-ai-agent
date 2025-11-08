/**
 * D1 Vector Query Handler
 * Orchestrates semantic search workflow using D1-stored vectors
 * 
 * This handler coordinates:
 * 1. Query embedding generation
 * 2. Vector search (delegated to vectorSearchService)
 * 3. AI response generation (delegated to aiResponseService)
 * 4. Response caching
 */

import { generateEmbedding } from './services/embeddingService';
import { generateCacheKey, getCachedResponse, setCachedResponse } from './services/cacheService';
import { searchVectorsInD1 } from './services/vectorSearchService';
import { generateAIResponse } from './services/aiResponseService';
import { SEARCH_CONFIG, CACHE_CONFIG } from './config';
import type { QueryEnv } from './types';

/**
 * Handle D1 vector-based semantic search queries
 * 
 * @param request - Incoming request with query parameter
 * @param env - Worker environment bindings
 * @returns JSON response with search results and optional AI reply
 */
export async function handleD1VectorQuery(request: Request, env: QueryEnv): Promise<Response> {
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

    // Search vectors using dedicated service
    const searchResults = await searchVectorsInD1(
      queryVector, 
      env.DB, 
      SEARCH_CONFIG.TOP_K_EXTENDED
    );

    console.log(`Top result: ${searchResults[0]?.technology.name} (${searchResults[0]?.similarity.toFixed(4)})`);

    // Prepare response
    const responseData: any = {
      query,
      assistantReply: '',
    };

    // Generate AI reply if enabled
    if (env.AI_REPLY_ENABLED === 'true' && searchResults.length > 0) {
      responseData.assistantReply = await generateAIResponse(query, searchResults, env.AI);
    } else if (searchResults.length === 0) {
      responseData.assistantReply = "I couldn't find any relevant skills for that query. Could you try rephrasing?";
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
