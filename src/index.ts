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
import { signJWT, verifyJWT, generateSessionId, type JWTPayload } from './jwt';
import { getQuotaStatus, resetQuota, syncQuotaFromDashboard } from './ai-quota';
import { isWithinBusinessHours } from './input-validation';
import {
  CACHE_CONFIG,
  AI_CONFIG,
  SEARCH_CONFIG,
  INDEX_CONFIG,
  AUTH_CONFIG,
  ENDPOINTS,
  CORS_CONFIG,
  TURNSTILE_VERIFY_URL,
  DB_TABLES,
  ITEM_TYPES,
} from './config';

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

// Lock helper: acquire a KV lock for indexing to prevent concurrent runs
async function acquireIndexLock(itemType: string, env: Env, ttlSeconds = 60): Promise<boolean> {
  const lockKey = `index:lock:${itemType}`;
  const existing = await env.KV.get(lockKey);
  if (existing) return false; // lock already held
  await env.KV.put(lockKey, new Date().toISOString(), { expirationTtl: ttlSeconds });
  return true;
}

// Lock helper: release a KV lock for indexing
async function releaseIndexLock(itemType: string, env: Env): Promise<void> {
  const lockKey = `index:lock:${itemType}`;
  await env.KV.delete(lockKey);
}

// Fetch canonical skill-like record by id. Tries `skills` first, then `technology`.
async function fetchCanonicalById(id: number, env: Env): Promise<Skill | null> {
  try {
    const s = await env.DB.prepare('SELECT * FROM skills WHERE id = ?').bind(id).first<Skill>();
    if (s) return s;
  } catch (_) {
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
  } catch (_) {
    // ignore
  }

  return null;
}

/**
 * Validate Turnstile token with Cloudflare's siteverify API
 * @param token - Turnstile token from client
 * @param secretKey - Turnstile secret key
 * @param clientIp - Optional client IP address
 * @returns true if token is valid, false otherwise
 */
async function validateTurnstileToken(
  token: string,
  secretKey: string,
  clientIp?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (clientIp) {
      formData.append('remoteip', clientIp);
    }

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json() as { success: boolean; 'error-codes'?: string[] };
    
    if (!result.success) {
      console.warn('Turnstile validation failed:', result['error-codes']);
      return { success: false, error: result['error-codes']?.join(', ') || 'Validation failed' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Turnstile validation error:', error);
    return { success: false, error: error.message };
  }
}

// Cache key generator (simple hash)
function generateCacheKey(query: string): string {
  // Simple hash for cache key
  let hash = 0;
  for (let i = 0; i < query.length; i++) {
    const char = query.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `query:${Math.abs(hash)}`;
}

// Generate embedding using Workers AI
async function generateEmbedding(text: string, ai: Ai): Promise<number[]> {
  const response = await ai.run(AI_CONFIG.EMBEDDING_MODEL, {
    text: [text],
  }) as { data: number[][] };
  return response.data[0]; // Returns array of AI_CONFIG.EMBEDDING_DIMENSIONS dimensions
}

// Cosine similarity for fallback vector search
function cosineSimilarity(vecA: number[], vecB: number[]): number {
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

// Helper to create skill text for embedding
function createSkillText(skill: Skill): string {
  return `${skill.name} with ${skill.mastery} mastery level and ${skill.years} years of experience${skill.category ? ` in ${skill.category}` : ''}`;
}

/**
 * /index endpoint: Index all skills into Vectorize
 * 
 * 1. Reads all skills from D1
 * 2. Generates embeddings using Workers AI
 * 3. Upserts vectors into Vectorize with metadata
 * 4. Stores fallback copy in KV
 * 5. Records indexing metadata
 */
async function handleIndex(request: Request, env: Env): Promise<Response> {
  const lockAcquired = { value: false, itemType: 'skills' as string };
  
  try {
    console.log('Starting indexing process...');

    // parse optional body for batched indexing
    let params: { type?: string; batchSize?: number; offset?: number } = {};
    try {
      if (request.headers.get('content-type')?.includes('application/json')) {
        params = await request.json();
      }
    } catch {
      params = {};
    }

    const itemType = params.type === 'technology' ? 'technology' : 'skills';
    lockAcquired.itemType = itemType;

    // acquire lock to prevent concurrent indexing
    const acquired = await acquireIndexLock(itemType, env, 120);
    if (!acquired) {
      return new Response(JSON.stringify({ error: 'Indexing already in progress', itemType }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }
    lockAcquired.value = true;

    const ai = env.AI;

    // ensure index_metadata table exists (no-op if already present)
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS index_metadata (
        version INTEGER PRIMARY KEY,
        indexed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        total_skills INTEGER,
        status TEXT
      )`
    ).run();

    // determine version
    const lastVersion = await env.DB.prepare('SELECT MAX(version) as last_version FROM index_metadata').first();
    const version = (lastVersion?.last_version as number || 0) + 1;

    // create indexing record
    await env.DB.prepare('INSERT INTO index_metadata (version, total_skills, status) VALUES (?, ?, ?)').bind(version, 0, 'in_progress').run();

    // batching params
    const batchSize = params.batchSize && params.batchSize > 0 ? params.batchSize : (params.type === 'technology' ? INDEX_CONFIG.TECHNOLOGY_BATCH_SIZE : INDEX_CONFIG.DEFAULT_BATCH_SIZE);
    let offset = params.offset && params.offset >= 0 ? params.offset : 0;

    // fetch batch from D1 using LIMIT/OFFSET
    const selectSql = itemType === 'technology'
      ? 'SELECT id, category_id, name, experience, experience_years FROM technology ORDER BY id LIMIT ? OFFSET ?'
      : 'SELECT id, name, mastery, years, category, description, last_used FROM skills ORDER BY id LIMIT ? OFFSET ?';

    const { results: rows } = await env.DB.prepare(selectSql).bind(batchSize, offset).all<any>();
    const items = rows as any[] || [];

    if (!items.length) {
      // nothing to do
      await env.DB.prepare('UPDATE index_metadata SET status = ? WHERE version = ?').bind('completed', version).run();
      return new Response(JSON.stringify({ success: true, message: 'No items to index', version, processed: 0 }), { headers: { 'Content-Type': 'application/json' } });
    }

    const vectors: any[] = [];
    const kvPromises: Promise<any>[] = [];
    const d1Promises: Promise<any>[] = [];

    for (const item of items) {
      const text = itemType === 'technology'
        ? `${item.name} (${item.experience || ''})`
        : createSkillText(item as Skill);

      const embedding = await generateEmbedding(text, ai);
      const idKey = `${itemType}-${item.id}`;
      const metadata = {
        id: item.id,
        version,
        name: item.name,
        category: itemType === 'technology' ? item.category_id : (item as Skill).category || '',
      };

      vectors.push({ id: idKey, values: embedding, metadata });

      kvPromises.push(env.KV.put(`vector:${idKey}`, JSON.stringify({ values: embedding, metadata }), { expirationTtl: INDEX_CONFIG.VECTOR_KV_TTL }));
      
      // Store embedding in D1 vectors table (id is auto-increment, don't specify it)
      const embeddingBlob = new Float32Array(embedding).buffer;
      d1Promises.push(
        env.DB.prepare(
          'INSERT INTO vectors (item_type, item_id, embedding, metadata) VALUES (?, ?, ?, ?)'
        ).bind(itemType, item.id, embeddingBlob, JSON.stringify(metadata)).run()
      );
    }

    // upsert into Vectorize, KV, and D1
    await env.VECTORIZE.upsert(vectors as any);
    await Promise.all([...kvPromises, ...d1Promises]);

    // update metadata: increment total_skills by processed count and mark as in_progress
    await env.DB.prepare('UPDATE index_metadata SET total_skills = COALESCE(total_skills,0) + ?, status = ? WHERE version = ?').bind(items.length, 'in_progress', version).run();

    // write checkpoint to KV for resumability
    try {
      const totalRow = await env.DB.prepare(itemType === 'technology' ? 'SELECT COUNT(*) as total FROM technology' : 'SELECT COUNT(*) as total FROM skills').first<any>();
      const total = totalRow?.total || 0;
      const nextOffset = offset + items.length;
      const checkpointKey = `index:checkpoint:${itemType}`;
      const checkpoint = {
        version,
        nextOffset,
        processed: nextOffset,
        total,
        status: nextOffset >= total ? 'completed' : 'in_progress',
        lastBatchAt: new Date().toISOString(),
        lastProcessedCount: items.length,
        errors: [] as any[],
      };
      await env.KV.put(checkpointKey, JSON.stringify(checkpoint));
    } catch (e) {
      console.error('Failed to write checkpoint to KV', e);
    }

    // release lock
    if (lockAcquired.value) {
      await releaseIndexLock(lockAcquired.itemType, env);
    }

    return new Response(JSON.stringify({ success: true, version, processed: items.length, offset }), { headers: { 'Content-Type': 'application/json' } });
    
  } catch (error: any) {
    console.error('Indexing error:', error);
    
    // release lock on error
    if (lockAcquired.value) {
      await releaseIndexLock(lockAcquired.itemType, env);
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Indexing failed',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * /session endpoint: Exchange Turnstile token for session JWT
 * 
 * 1. Validates Turnstile token (single-use, 5-minute TTL)
 * 2. Issues a signed JWT with 15-minute expiry
 * 3. Returns JWT to client for subsequent requests
 */
async function handleSession(request: Request, env: Env): Promise<Response> {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Turnstile-Token',
  };

  try {
    // Get Turnstile token from header
    const turnstileToken = request.headers.get('X-Turnstile-Token');
    
    if (!turnstileToken) {
      return new Response(JSON.stringify({
        error: 'Forbidden',
        message: 'Turnstile token required',
      }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // Validate Turnstile token
    if (!env.TURNSTILE_SECRET_KEY) {
      return new Response(JSON.stringify({
        error: 'Server configuration error',
        message: 'Turnstile not configured',
      }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const clientIp = request.headers.get('CF-Connecting-IP') || undefined;
    const validation = await validateTurnstileToken(turnstileToken, env.TURNSTILE_SECRET_KEY, clientIp);
    
    if (!validation.success) {
      return new Response(JSON.stringify({
        error: 'Forbidden',
        message: 'Turnstile verification failed. Please refresh and try again.',
        details: validation.error,
      }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // Issue JWT
    if (!env.JWT_SECRET) {
      return new Response(JSON.stringify({
        error: 'Server configuration error',
        message: 'JWT not configured',
      }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const sessionId = generateSessionId();
    const payload: JWTPayload = {
      sub: 'cv-chat-session',
      iat: now,
      exp: now + AUTH_CONFIG.JWT_EXPIRY,
      sessionId,
    };

    const jwt = await signJWT(payload, env.JWT_SECRET);

    console.log(`Session created: ${sessionId}, expires in 15 minutes`);

    return new Response(JSON.stringify({
      success: true,
      token: jwt,
      expiresIn: AUTH_CONFIG.JWT_EXPIRY,
      expiresAt: new Date((now + AUTH_CONFIG.JWT_EXPIRY) * 1000).toISOString(),
    }), {
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('Session creation error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: 'Failed to create session',
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

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
    const cache = caches.default;
    const cacheUrl = new URL(request.url);
    cacheUrl.pathname = `/cache/${cacheKey}`;
    
    const cachedResponse = await cache.match(cacheUrl.toString());
    if (cachedResponse) {
      console.log('Cache hit');
      const cachedData = await cachedResponse.json() as any;
      return new Response(JSON.stringify({
        ...(cachedData || {}),
        cached: true,
      }), {
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
    const responseToCache = new Response(JSON.stringify(responseData), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${cacheTtl}`,
      },
    });
    
    // Store in Cache API (non-blocking)
    await cache.put(cacheUrl.toString(), responseToCache.clone());
    
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
async function handleHealth(env: Env): Promise<Response> {
  try {
    // Check D1 connection
    const dbCheck = await env.DB.prepare('SELECT 1').first();
    
    // Get skill count
    let skillCount: { count: number } | null = null;
    try {
      skillCount = await env.DB.prepare('SELECT COUNT(*) as count FROM skills').first<{ count: number }>();
    } catch (e) {
      // skills table may not exist in this DB; fall back to technology count
      try {
        skillCount = await env.DB.prepare('SELECT COUNT(*) as count FROM technology').first<{ count: number }>();
      } catch {
        skillCount = { count: 0 };
      }
    }
    
    // Get last index version
    const lastIndex = await env.DB.prepare(
      'SELECT version, indexed_at, total_skills, status FROM index_metadata ORDER BY version DESC LIMIT 1'
    ).first();
    
    // Get AI quota status
    const quotaStatus = await getQuotaStatus(env.KV);
    
    // Get business hours status
    const businessHours = isWithinBusinessHours();
    
    return new Response(JSON.stringify({
      status: 'healthy',
      database: dbCheck ? 'connected' : 'error',
      total_skills: skillCount?.count || 0,
      last_index: lastIndex || null,
      ai_quota: quotaStatus,
      business_hours: {
        isWithinHours: businessHours.isWithinHours,
        timezone: businessHours.timezone,
        hours: '08:00-20:00 Mon-Fri UK (GMT/BST)',
      },
      timestamp: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      status: 'unhealthy',
      error: error.message,
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
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS headers for development
    const corsHeaders = {
      'Access-Control-Allow-Origin': CORS_CONFIG.ALLOWED_ORIGINS,
      'Access-Control-Allow-Methods': CORS_CONFIG.ALLOWED_METHODS,
      'Access-Control-Allow-Headers': CORS_CONFIG.ALLOWED_HEADERS,
    };
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      // Route handling
      if (path === ENDPOINTS.SESSION && request.method === 'POST') {
        const response = await handleSession(request, env);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return response;
      }
      
      if (path === ENDPOINTS.INDEX && request.method === 'POST') {
        const response = await handleIndex(request, env);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return response;
      }
      
      if (path === ENDPOINTS.QUERY && (request.method === 'GET' || request.method === 'POST')) {
        // Check for JWT in Authorization header first, then fall back to Turnstile token
        const authHeader = request.headers.get('Authorization');
        const hasJWT = authHeader && authHeader.startsWith('Bearer ');
        
        if (hasJWT && env.JWT_SECRET) {
          // Verify JWT
          const token = authHeader!.substring(7); // Remove 'Bearer ' prefix
          const payload = await verifyJWT(token, env.JWT_SECRET);
          
          if (!payload) {
            return new Response(JSON.stringify({
              error: 'Unauthorized',
              message: 'Invalid or expired session token. Please refresh the page.',
            }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          console.log(`Query authorized with JWT session: ${payload.sessionId}`);
        } else {
          // Fall back to Turnstile token validation (backward compatibility)
          const turnstileToken = request.headers.get('X-Turnstile-Token');
          
          if (env.TURNSTILE_SECRET_KEY) {
            if (!turnstileToken) {
              return new Response(JSON.stringify({
                error: 'Forbidden',
                message: 'Turnstile verification required. Please complete the human verification.',
              }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }

            // Validate token
            const clientIp = request.headers.get('CF-Connecting-IP') || undefined;
            const validation = await validateTurnstileToken(turnstileToken, env.TURNSTILE_SECRET_KEY, clientIp);
            
            if (!validation.success) {
              return new Response(JSON.stringify({
                error: 'Forbidden',
                message: 'Turnstile verification failed. Please refresh and try again.',
                details: validation.error,
              }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
            
            console.log('Query authorized with Turnstile token');
          }
        }

        // Use D1 vectors for all queries (replaces old Vectorize implementation)
        const response = await handleD1VectorQuery(request, env);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return response;
      }

      // Admin: get current AI quota status from KV
      if (path === ENDPOINTS.ADMIN_QUOTA && request.method === 'GET') {
        // Simple auth: if JWT_SECRET is set require a Bearer token matching it (admin use only)
        const authHeader = request.headers.get('Authorization');
        if (env.JWT_SECRET) {
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          const token = authHeader.substring(7);
          if (token !== env.JWT_SECRET) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        }

        const quota = await getQuotaStatus(env.KV);
        const resp = new Response(JSON.stringify({ success: true, quota }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        return resp;
      }

      // Legacy endpoint - redirects to /query
      if (path === ENDPOINTS.QUERY_D1 && (request.method === 'GET' || request.method === 'POST')) {
        const response = await handleD1VectorQuery(request, env);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return response;
      }

      // Old Vectorize-based query (deprecated, keeping for reference)
      if (path === ENDPOINTS.QUERY_VECTORIZE && (request.method === 'GET' || request.method === 'POST')) {
        const response = await handleQuery(request, env);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return response;
      }

      if (path === ENDPOINTS.DEBUG_VECTOR && request.method === 'GET') {
        // Debug endpoint to inspect raw vector data
        const { results } = await env.DB.prepare('SELECT id, item_id, LENGTH(embedding) as size, typeof(embedding) as type FROM vectors LIMIT 1').all();
        const vec = results[0] as any;
        const { results: vecData } = await env.DB.prepare('SELECT * FROM vectors LIMIT 1').all();
        const fullVec = vecData[0] as any;

        const embeddingInfo: any = {
          id: vec.id,
          item_id: vec.item_id,
          size: vec.size,
          sqlType: vec.type,
          jsType: typeof fullVec.embedding,
          isArrayBuffer: fullVec.embedding instanceof ArrayBuffer,
          isUint8Array: fullVec.embedding instanceof Uint8Array,
          constructorName: fullVec.embedding?.constructor?.name,
        };

        if (ArrayBuffer.isView(fullVec.embedding)) {
          embeddingInfo.byteLength = (fullVec.embedding as any).byteLength;
          embeddingInfo.byteOffset = (fullVec.embedding as any).byteOffset;
        }

        return Response.json(embeddingInfo);
      }
      
      if (path === ENDPOINTS.QUOTA && request.method === 'GET') {
        // AI quota status endpoint
        const quotaStatus = await getQuotaStatus(env.KV);
        return new Response(JSON.stringify(quotaStatus), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (path === ENDPOINTS.QUOTA_RESET && request.method === 'POST') {
        // Admin endpoint to manually reset quota (requires authentication in production)
        // TODO: Add proper authentication/authorization
        await resetQuota(env.KV);
        const newStatus = await getQuotaStatus(env.KV);
        return new Response(JSON.stringify({
          success: true,
          message: 'Quota reset successfully',
          status: newStatus,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (path === ENDPOINTS.QUOTA_SYNC && request.method === 'POST') {
        // Admin endpoint to manually sync quota from dashboard
        // Usage: POST /quota/sync with body: { "neurons": 137.42 }
        // TODO: Add proper authentication/authorization
        try {
          const body = await request.json() as any;
          const neurons = parseFloat(body.neurons);
          
          if (isNaN(neurons) || neurons < 0) {
            return new Response(JSON.stringify({
              error: 'Invalid neurons value. Must be a positive number.',
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          await syncQuotaFromDashboard(env.KV, neurons);
          const newStatus = await getQuotaStatus(env.KV);
          
          return new Response(JSON.stringify({
            success: true,
            message: `Quota synced successfully. Updated to ${neurons} neurons.`,
            status: newStatus,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (e) {
          return new Response(JSON.stringify({
            error: 'Failed to parse request body. Expected: { "neurons": <number> }',
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      
      if (path === ENDPOINTS.HEALTH || path === ENDPOINTS.ROOT) {
        const response = await handleHealth(env);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return response;
      }

      if (path === ENDPOINTS.IDS && request.method === 'GET') {
        // return technology ids for remote orchestration
        const rows = await env.DB.prepare('SELECT id FROM technology ORDER BY id').all();
        const ids = (rows.results || []).map((r: any) => r.id);
        return new Response(JSON.stringify({ ids }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (path === ENDPOINTS.INDEX_PROGRESS && request.method === 'GET') {
        const itemType = url.searchParams.get('type') || 'technology';
        const checkpointKey = `index:checkpoint:${itemType}`;
        const data = await env.KV.get(checkpointKey);
        if (!data) return new Response(JSON.stringify({ found: false }), { headers: { 'Content-Type': 'application/json' } });
        return new Response(data, { headers: { 'Content-Type': 'application/json' } });
      }

      if (path === ENDPOINTS.INDEX_RESUME && request.method === 'POST') {
        // resume indexing using checkpoint in KV; returns immediate response and continues via worker-invoked POST
    const bodyAny = await request.json().catch(() => ({})) as any;
    const itemType = bodyAny.type || 'technology';
    const checkpointKey = `index:checkpoint:${itemType}`;
    const checkpointRaw = await env.KV.get(checkpointKey);
    const checkpoint = checkpointRaw ? JSON.parse(checkpointRaw) : { nextOffset: 0 };
    const batchSize = bodyAny.batchSize || 20;

        // trigger one batch by calling handleIndex directly
        const req = new Request(`${url.origin}${ENDPOINTS.INDEX}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: itemType, batchSize, offset: checkpoint.nextOffset || 0 }),
        });
        const res = await handleIndex(req, env);
        return new Response(JSON.stringify({ triggered: true, status: res.status }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (path === ENDPOINTS.INDEX_STOP && request.method === 'POST') {
    const bodyAny = await request.json().catch(() => ({})) as any;
    const itemType = bodyAny.type || 'technology';
        const checkpointKey = `index:checkpoint:${itemType}`;
        const checkpointRaw = await env.KV.get(checkpointKey);
        const checkpoint = checkpointRaw ? JSON.parse(checkpointRaw) : { nextOffset: 0 };
        checkpoint.status = 'stopped';
        await env.KV.put(checkpointKey, JSON.stringify(checkpoint));
        return new Response(JSON.stringify({ stopped: true }), { headers: { 'Content-Type': 'application/json' } });
      }
      
      // 404 for unknown routes
      return new Response(JSON.stringify({
        error: 'Not found',
        available_endpoints: [
          'GET / - Health check',
          'GET /health - Health check',
          'POST /index - Index all skills into Vectorize',
          'GET /query?q=<query> - Semantic search',
          'POST /query - Semantic search (body as query)',
        ],
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      
    } catch (error: any) {
      console.error('Worker error:', error);
      
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};