/**
 * CV Assistant Worker
 *
 * A semantic search engine for CV skills using Cloudflare's edge stack:
 * - D1: Canonical SQL database for skills data
 * - Vectorize: Semantic vector index
 * - Workers AI: Embedding generation
 * - KV: Fallback vector storage
 * - Cache API: Query result caching
 *
 * This is a demonstration project showing how to build an AI-powered CV assistant
 * at the edge with zero-cost infrastructure.
 */

import { handleD1VectorQuery } from './query-d1-vectors';
import { generateEmbedding, cosineSimilarity } from './services/embeddingService';
import { generateCacheKey, getCachedResponse, setCachedResponse } from './services/cacheService';
import {
  CACHE_CONFIG,
  AI_CONFIG,
  SEARCH_CONFIG,
  ENDPOINTS,
} from './config';
import { handleHealth } from './handlers/healthHandler';
import { handleSession } from './handlers/sessionHandler';
import { handleIndex } from './handlers/indexHandler';
import { handleCORSPreflight, addCORSHeaders, handleWorkerError, handle404 } from './middleware';
import { checkRateLimit } from './middleware/rateLimiter';

// Environment bindings interface
interface Env {
  DB: D1Database;
  VECTORIZE?: Vectorize;
  KV?: KVNamespace;
  AI: Ai;
  CACHE_TTL?: string;
  VECTORIZE_FALLBACK?: string;
  AI_REPLY_ENABLED?: string;
  TURNSTILE_SECRET_KEY?: string; // Turnstile secret for server-side validation
  JWT_SECRET?: string;            // Secret for signing session JWTs
}

// Skill record from D1
interface Skill {
  id: number;
  name: string;
  mastery: string;
  years: number;
  category?: string;
  description?: string;
  last_used?: string;
  action?: string;              // What was done with this skill
  effect?: string;              // Operational/technical effect
  outcome?: string;             // Business outcome or measurable result
  related_project?: string;     // Optional project/context anchor
}

// Vector metadata
interface VectorMetadata {
  id: number;
  version: number;
  name: string;
  mastery: string;
  years: number;
  category?: string;
}

// Query result
interface QueryResult {
  skill: Skill;
  distance: number;
  provenance: {
    id: number;
    distance: number;
    source: 'vectorize' | 'kv-fallback';
  };
}

/**
 * Fetch canonical skill-like record by id
 * Tries `skills` table first, then falls back to `technology` table
 */
async function fetchCanonicalById(id: number, env: Env): Promise<Skill | null> {
  try {
    const s = await env.DB.prepare('SELECT * FROM skills WHERE id = ?').bind(id).first<Skill>();
    if (s) return s;
  } catch {
    // Ignore errors, try next table
  }

  try {
    const t = await env.DB.prepare('SELECT id, name, experience as description, experience_years as years FROM technology WHERE id = ?').bind(id).first<any>();
    if (t) {
      const mapped: Skill = {
        id: t.id,
        name: t.name,
        mastery: typeof t.experience === 'string' ? t.experience : '',
        years: t.years || 0,
        category: undefined,
        description: t.description || t.experience || undefined,
        action: t.action,
        effect: t.effect,
        outcome: t.outcome,
        related_project: t.related_project,
      };
      return mapped;
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * /query endpoint: Semantic search over skills
 * 
 * Workflow:
 * 1. Checks cache for existing results
 * 2. Generates embedding for query
 * 3. Searches Vectorize (or falls back to KV)
 * 4. Fetches canonical data from D1
 * 5. Returns top 3 results with provenance
 * 6. Caches results
 */
async function handleQuery(request: Request, env: Env): Promise<Response> {
  try {
    // Parse query from request
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || await request.text();
    
    if (!query || query.trim().length === 0) {
      return new Response(JSON.stringify({
        error: 'Query parameter "q" is required',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`Processing query: "${query}"`);
    
    // Check cache first
    const cacheKey = generateCacheKey(query);
    const cachedData = await getCachedResponse(cacheKey, request.url);
    
    if (cachedData) {
      console.log('Cache hit');
      return new Response(JSON.stringify(cachedData), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    console.log('Cache miss, processing query...');
    
    // Generate embedding for query
    const ai = env.AI;
    const queryEmbedding = await generateEmbedding(query, ai);
    
    let results: QueryResult[] = [];
    let source: 'vectorize' | 'kv-fallback' = 'vectorize';
    
    try {
      // Try Vectorize first (if available)
      if (!env.VECTORIZE) {
        throw new Error('Vectorize not configured');
      }
      console.log('Querying Vectorize...');
      const vectorResults = await env.VECTORIZE.query(queryEmbedding, {
        topK: SEARCH_CONFIG.TOP_K,
        returnMetadata: true,
      });
      
      // Fetch canonical data from D1 for each result
      const skillPromises = vectorResults.matches.map(async (match) => {
        const metadataAny = match.metadata as any;
        const metadata: VectorMetadata = {
          id: metadataAny?.id,
          version: metadataAny?.version,
          name: metadataAny?.name,
          mastery: metadataAny?.mastery,
          years: metadataAny?.years,
          category: metadataAny?.category || '',
        };
        const skill = await fetchCanonicalById(metadata.id, env);
        
        if (skill) {
          return {
            skill,
            distance: match.score || 0,
            provenance: {
              id: metadata.id,
              distance: match.score || 0,
              source: 'vectorize' as const,
            },
          };
        }
        return null;
      });
      
      const skillResults = await Promise.all(skillPromises);
      results = skillResults.filter(r => r !== null) as QueryResult[];
      
    } catch (vectorizeError) {
      console.error('Vectorize error, falling back to KV:', vectorizeError);
      
      // Fallback to KV if Vectorize is unavailable
      if (env.VECTORIZE_FALLBACK === 'true' && env.KV) {
        source = 'kv-fallback';
        
        // List all vectors from KV (in production, you'd maintain an index)
        const { results: allTechnologies } = await env.DB.prepare(
          'SELECT id FROM technology ORDER BY id'
        ).all<{ id: number }>();
        
        const similarities: Array<{ id: number; similarity: number }> = [];
        
        // Calculate cosine similarity for each stored vector
        for (const technology of allTechnologies.slice(0, 20)) { // Limit for performance
          const vectorKey = `vector:technology-${technology.id}`;
          const vectorData = await env.KV.get(vectorKey, 'json') as {
            values: number[];
            metadata: VectorMetadata;
          } | null;
          
          if (vectorData) {
            const similarity = cosineSimilarity(queryEmbedding, vectorData.values);
            similarities.push({ id: technology.id, similarity });
          }
        }
        
        // Sort by similarity and take top 3
        similarities.sort((a, b) => b.similarity - a.similarity);
        const topMatches = similarities.slice(0, SEARCH_CONFIG.TOP_K);
        
        // Fetch skills from D1
        const skillPromises = topMatches.map(async (match) => {
          const skill = await fetchCanonicalById(match.id, env);
          
          if (skill) {
            return {
              skill,
              distance: match.similarity,
              provenance: {
                id: match.id,
                distance: match.similarity,
                source: 'kv-fallback' as const,
              },
            };
          }
          return null;
        });
        
        const skillResults = await Promise.all(skillPromises);
        results = skillResults.filter(r => r !== null) as QueryResult[];
      } else {
        throw vectorizeError;
      }
    }
    
    // Prepare response
    const responseData: any = {
      query,
      results: results.map(r => ({
        id: r.skill.id,
        name: r.skill.name,
        mastery: r.skill.mastery,
        years: r.skill.years,
        category: r.skill.category,
        description: r.skill.description,
        distance: r.distance,
        provenance: r.provenance,
      })),
      source,
      timestamp: new Date().toISOString(),
      cached: false,
    };
    
    // Generate assistant reply using Workers AI (if enabled)
    if (env.AI_REPLY_ENABLED === 'true' && responseData.results.length > 0) {
      try {
        const topResults = responseData.results.slice(0, SEARCH_CONFIG.TOP_K);
        const topScore = topResults[0]?.distance ?? 0;
        const confidence = topScore >= SEARCH_CONFIG.HIGH_CONFIDENCE ? 'high' : (topScore >= SEARCH_CONFIG.MEDIUM_CONFIDENCE ? 'medium' : 'low');
        
        const resultsText = topResults.map((r: any, i: number) => 
          `${i+1}) ${r.name} — ${r.description || ''} (id:${r.id}, score:${r.distance.toFixed(3)})`
        ).join('\n');
        
        const prompt = `You are a concise technical assistant. User question: "${query}"

Top matching technologies:
${resultsText}

Provide a short 2-3 sentence answer that:
- Uses the top match as the primary answer
- Mentions confidence level (${confidence} based on score ${topScore.toFixed(3)})
- Suggests one practical follow-up action
- Keep it conversational and helpful`;

        const response = await env.AI.run(AI_CONFIG.FALLBACK_MODEL as any, {
          messages: [
            { role: 'system', content: 'You are a helpful technical assistant that answers questions about a candidate\'s CV.' },
            { role: 'user', content: prompt }
          ]
        }) as { response?: string };
        
        responseData.assistantReply = response?.response || '';
      } catch (aiError) {
        console.error('AI reply generation failed:', aiError);
        responseData.assistantReply = '';
      }
    }
    
    // Cache the response
    const cacheTtl = parseInt(env.CACHE_TTL || CACHE_CONFIG.DEFAULT_TTL.toString(), 10);
    await setCachedResponse(cacheKey, request.url, responseData, cacheTtl);
    
    return new Response(JSON.stringify(responseData), {
      headers: { 'Content-Type': 'application/json' },
    });
    
  } catch (error: any) {
    console.error('Query error:', error);
    
    return new Response(JSON.stringify({
      error: error.message || 'Query failed',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Main Worker entry point
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORSPreflight();
    }
    
    try {
      // Route handling
      if (path === ENDPOINTS.SESSION && request.method === 'POST') {
        return addCORSHeaders(await handleSession(request, env));
      }
      
      if (path === ENDPOINTS.INDEX && request.method === 'POST') {
        return addCORSHeaders(await handleIndex(request, env));
      }
      
      if (path === ENDPOINTS.QUERY && (request.method === 'GET' || request.method === 'POST')) {
        // Rate limiting check (if KV is available)
        if (env.KV) {
          const rateLimitResult = await checkRateLimit(request, env.KV);
          if (!rateLimitResult.allowed) {
            return addCORSHeaders(new Response(JSON.stringify({
              error: rateLimitResult.message,
              retryAfter: rateLimitResult.retryAfter,
            }), {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
              },
            }));
          }
        }

        // Use D1 vectors for all queries
        return addCORSHeaders(await handleD1VectorQuery(request, env));
      }

      // Legacy Vectorize-based query (kept for reference)
      if (path === ENDPOINTS.QUERY_VECTORIZE && (request.method === 'GET' || request.method === 'POST')) {
        return addCORSHeaders(await handleQuery(request, env));
      }
      
      if (path === ENDPOINTS.HEALTH || path === ENDPOINTS.ROOT) {
        return addCORSHeaders(await handleHealth(env));
      }
      
      // 404 for unknown routes
      return handle404();
      
    } catch (error: any) {
      return handleWorkerError(error);
    }
  },
};
