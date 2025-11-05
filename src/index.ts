/**
 * CV Assistant Worker
 *
 * A semantic search engine for CV skills using Cloudflare's edge stack:
 * - D1: Canonical SQL database for skills data
 * - Vectorize: Semantic vector index
 * - Workers AI: Embedding generation
 * - KV: Fallback vector storage
 * - Cache API: Query result caching
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
import { handleQuotaStatus, handleAdminQuota, handleQuotaReset, handleQuotaSync } from './handlers/quotaHandler';
import { handleSession } from './handlers/sessionHandler';
import { handleIndex } from './handlers/indexHandler';
import { handleIndexProgress, handleIndexResume, handleIndexStop, handleIds, handleDebugVector } from './handlers/indexManagementHandler';
import { handleCORSPreflight, addCORSHeaders, verifyAuth, handleWorkerError, handle404 } from './middleware';
import { checkRateLimit } from './middleware/rateLimiter';
import { initializeSQSLogger } from './aws/sqs-logger';

// Environment bindings interface
interface Env {
  DB: D1Database;
  VECTORIZE: Vectorize;
  KV: KVNamespace;
  AI: Ai;
  CACHE_TTL?: string;
  VECTORIZE_FALLBACK?: string;
  AI_REPLY_ENABLED?: string;
  TURNSTILE_SECRET_KEY?: string; // Turnstile secret for server-side validation
  JWT_SECRET?: string;            // Secret for signing session JWTs
  AWS_SQS_URL?: string;           // SQS queue URL for analytics
  AWS_REGION?: string;            // AWS region for SQS
  AWS_ACCESS_KEY_ID?: string;     // AWS access key for SigV4 signing
  AWS_SECRET_ACCESS_KEY?: string; // AWS secret key for SigV4 signing
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

// Fetch canonical skill-like record by id. Tries `skills` first, then `technology`.
async function fetchCanonicalById(id: number, env: Env): Promise<Skill | null> {
  try {
    const s = await env.DB.prepare('SELECT * FROM skills WHERE id = ?').bind(id).first<Skill>();
    if (s) return s;
  } catch {
    // ignore
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
    // ignore
  }

  return null;
}

// Utility functions moved to utils.ts

// Handlers moved to handlers/ directory

// Handlers moved to handlers/ directory

/**
 * /query endpoint: Semantic search over skills
 * 
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
      // Try Vectorize first
      console.log('Querying Vectorize...');
      const vectorResults = await env.VECTORIZE.query(queryEmbedding, {
        topK: SEARCH_CONFIG.TOP_K,
        returnMetadata: true,
      });
      
      // Fetch canonical data from D1 for each result
      const skillPromises = vectorResults.matches.map(async (match) => {
        // Vectorize returns a generic metadata object; treat as any and map required fields
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
  results = (skillResults.filter(r => r !== null) as unknown) as QueryResult[];
      
    } catch (vectorizeError) {
      console.error('Vectorize error, falling back to KV:', vectorizeError);
      
      // Fallback to KV if Vectorize is unavailable
      if (env.VECTORIZE_FALLBACK === 'true') {
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
  results = (skillResults.filter(r => r !== null) as unknown) as QueryResult[];
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

        // Using Mistral 7B HuggingFace model
        const response = await env.AI.run(AI_CONFIG.FALLBACK_MODEL as any, {
          messages: [
            { 
              role: 'system', 
              content: `You are a recruiter-facing assistant that answers questions about José's professional profile.

Always follow these rules:

1. **Classification**
   - When asked about professional level, always classify explicitly as Junior, Mid-level, Senior, or Principal/Lead.
   - Use this mapping:
     - 0–3 years = Junior
     - 3–7 years = Mid-level
     - 7–15 years = Senior
     - 15+ years = Principal/Lead
   - If skills vary, return the highest consistent level but note if some newer skills are at lower depth.

2. **Outcome-driven synthesis**
   - Structure every skill answer as:
     Skill → Context (years, level) → Action → Effect → Outcome → Project (optional).
   - Prioritize measurable outcomes (percentages, cycle times, uptime, throughput).
   - Avoid vague phrases like "delivered business value" or "drove success."

3. **Anti tool-centric**
   - Never present SQL Server, AppDynamics, or any single tool as the sole definition of the candidate.
   - Always contextualize tool-specific skills inside broader architectural or engineering outcomes.
   - Aggregate across categories (database, architecture, cloud, DevOps) when multiple skills are relevant.

4. **Style**
   - Keep answers concise, clear, and recruiter-friendly.
   - Always answer the implicit recruiter question: "So what?"
   - Do not repeat summaries verbatim; reframe into outcome-driven narratives.

### Example transformation:

Input skill:
- Name: Full-Stack Service Decomposition
- ExperienceYears: 5
- Level: Advanced
- Action: Broke down monolithic applications into modular services
- Effect: Enabled teams to deploy independently and faster
- Outcome: Cut release cycles from weeks to days
- Related_project: CCHQ national campaign platform

Output answer:
"With 5+ years of advanced experience in Full‑Stack Service Decomposition at CCHQ, José broke down monolithic applications into modular services. This enabled teams to deploy independently, cutting release cycles from weeks to days and ensuring campaign responsiveness during national elections."`
            },
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
    
    // Store in Cache API (non-blocking)
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
 * Health check endpoint
 */
// Handlers moved to handlers/ directory

/**
 * Main Worker entry point
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    // Initialize SQS analytics logger on first request
    initializeSQSLogger({
      AWS_SQS_URL: env.AWS_SQS_URL || '',
      AWS_REGION: env.AWS_REGION || '',
      AWS_ACCESS_KEY_ID: env.AWS_ACCESS_KEY_ID || '',
      AWS_SECRET_ACCESS_KEY: env.AWS_SECRET_ACCESS_KEY || '',
    });

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
        // Rate limiting check (prevents quota exhaustion)
        const rateLimitResult = await checkRateLimit(request, env.KV);
        if (!rateLimitResult.allowed) {
          return addCORSHeaders(new Response(JSON.stringify({
            error: rateLimitResult.message,
            retryAfter: rateLimitResult.retryAfter,
          }), {
            status: 429, // Too Many Requests
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
            },
          }));
        }

        // Verify authentication (JWT or Turnstile)
        const authResult = await verifyAuth(request, env);
        if (!authResult.authorized) {
          return authResult.response!;
        }

        // Use D1 vectors for all queries
        return addCORSHeaders(await handleD1VectorQuery(request, env, _ctx));
      }

      // Admin: get current AI quota status from KV
      if (path === ENDPOINTS.ADMIN_QUOTA && request.method === 'GET') {
        return await handleAdminQuota(request, env);
      }

      // Legacy endpoint - redirects to /query
      if (path === ENDPOINTS.QUERY_D1 && (request.method === 'GET' || request.method === 'POST')) {
        return addCORSHeaders(await handleD1VectorQuery(request, env, _ctx));
      }

      // Old Vectorize-based query (deprecated, keeping for reference)
      if (path === ENDPOINTS.QUERY_VECTORIZE && (request.method === 'GET' || request.method === 'POST')) {
        return addCORSHeaders(await handleQuery(request, env));
      }

      if (path === ENDPOINTS.DEBUG_VECTOR && request.method === 'GET') {
        return await handleDebugVector(env);
      }
      
      if (path === ENDPOINTS.QUOTA && request.method === 'GET') {
        return await handleQuotaStatus(env);
      }
      
      if (path === ENDPOINTS.QUOTA_RESET && request.method === 'POST') {
        return await handleQuotaReset(env);
      }
      
      if (path === ENDPOINTS.QUOTA_SYNC && request.method === 'POST') {
        return await handleQuotaSync(request, env);
      }
      
      if (path === ENDPOINTS.HEALTH || path === ENDPOINTS.ROOT) {
        return addCORSHeaders(await handleHealth(env));
      }

      if (path === ENDPOINTS.IDS && request.method === 'GET') {
        return await handleIds(env);
      }

      if (path === ENDPOINTS.INDEX_PROGRESS && request.method === 'GET') {
        return await handleIndexProgress(request, env);
      }

      if (path === ENDPOINTS.INDEX_RESUME && request.method === 'POST') {
        return await handleIndexResume(request, env);
      }

      if (path === ENDPOINTS.INDEX_STOP && request.method === 'POST') {
        return await handleIndexStop(request, env);
      }
      
      // 404 for unknown routes
      return handle404();
      
    } catch (error: any) {
      return handleWorkerError(error);
    }
  },
};