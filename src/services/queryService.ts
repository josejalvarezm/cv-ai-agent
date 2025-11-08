/**
 * Query Service
 *
 * Addresses Single Responsibility Principle (SRP) by extracting all query
 * orchestration logic from index.ts into a focused service.
 *
 * Responsibilities:
 * - Validate query input
 * - Generate embeddings
 * - Search vectors
 * - Cache coordination
 * - Response formatting
 *
 * Before: Complex logic scattered across index.ts handleQuery function
 * After: Focused service with clear inputs/outputs
 */

import { type ServiceContainer } from './container';
import { generateCacheKey, getCachedResponse, setCachedResponse } from './cacheService';
import { CACHE_CONFIG, SEARCH_CONFIG } from '../config';

/**
 * Query request
 */
export interface QueryRequest {
  query: string;
  topK?: number;
}

/**
 * Query result entry
 */
export interface QueryResultEntry {
  id: number;
  name: string;
  mastery: string;
  years: number;
  category?: string;
  description?: string;
  distance: number;
  provenance: {
    id: number;
    distance: number;
    source: 'vectorize' | 'kv-fallback';
  };
}

/**
 * Query response
 */
export interface QueryResponse {
  query: string;
  results: QueryResultEntry[];
  source: 'vectorize' | 'kv-fallback';
  timestamp: string;
  cached: boolean;
  assistantReply?: string;
}

/**
 * Query Service
 * Orchestrates semantic search operations
 */
export class QueryService {
  constructor(private services: ServiceContainer, private aiEnabled: boolean = false) {}

  /**
   * Execute a semantic search query
   */
  async execute(
    request: QueryRequest,
    requestUrl: string
  ): Promise<QueryResponse> {
    const { query } = request;
    const topK = request.topK || SEARCH_CONFIG.TOP_K;

    // Validate query
    if (!query || query.trim().length === 0) {
      throw new Error('Query parameter "q" is required');
    }

    console.log(`Processing query: "${query}"`);

    // Check cache
    const cacheKey = generateCacheKey(query);
    const cachedData = await getCachedResponse(cacheKey, requestUrl);
    if (cachedData) {
      console.log('Cache hit');
      return cachedData as QueryResponse;
    }

    console.log('Cache miss, processing query...');

    // Generate embedding for query
    const queryEmbedding = await this.services.embeddingService.generate(query);

    // Search vectors
    const results = await this.searchVectors(queryEmbedding, topK);

    // Build response
    const responseData: QueryResponse = {
      query,
      results,
      source: results.length > 0 ? (results[0].provenance.source as 'vectorize' | 'kv-fallback') : 'vectorize',
      timestamp: new Date().toISOString(),
      cached: false,
    };

    // Generate AI reply if enabled
    if (this.aiEnabled && results.length > 0) {
      responseData.assistantReply = await this.generateAssistantReply(query, results);
    }

    // Cache the response
    const cacheTtl = CACHE_CONFIG.DEFAULT_TTL;
    await setCachedResponse(cacheKey, requestUrl, responseData, cacheTtl);

    return responseData;
  }

  /**
   * Search vectors using configured store
   */
  private async searchVectors(embedding: number[], topK: number): Promise<QueryResultEntry[]> {
    const results: QueryResultEntry[] = [];

    try {
      // Query vector store (with automatic fallback)
      const vectorMatches = await this.services.vectorStore.query(embedding, topK);

      // Fetch canonical data for each match
      for (const match of vectorMatches) {
        try {
          const skill = await this.services.skillRepository.getById(match.metadata.id);
          if (skill) {
            results.push({
              id: skill.id,
              name: skill.name,
              mastery: skill.mastery,
              years: skill.years,
              category: skill.category,
              description: skill.description,
              distance: match.score,
              provenance: {
                id: match.metadata.id,
                distance: match.score,
                source: 'vectorize', // This would need to be tracked from match
              },
            });
          }
        } catch (error) {
          console.error(`Error fetching skill data for id ${match.metadata.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Vector search failed:', error);
      throw new Error(`Vector search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return results;
  }

  /**
   * Generate AI reply using Workers AI
   */
  private async generateAssistantReply(query: string, results: QueryResultEntry[]): Promise<string> {
    try {
      if (results.length === 0) {
        return '';
      }

      const topResults = results.slice(0, SEARCH_CONFIG.TOP_K);
      const topScore = topResults[0]?.distance ?? 0;
      const confidence = topScore >= SEARCH_CONFIG.HIGH_CONFIDENCE ? 'high' : (topScore >= SEARCH_CONFIG.MEDIUM_CONFIDENCE ? 'medium' : 'low');

      const resultsText = topResults
        .map(
          (r, i) => `${i + 1}) ${r.name} — ${r.description || ''} (id:${r.id}, score:${r.distance.toFixed(3)})`
        )
        .join('\n');

      // TODO: Use this prompt with Workers AI when AI binding is available
      const _prompt = `You are a concise technical assistant. User question: "${query}"

Top matching technologies:
${resultsText}

Provide a short 2-3 sentence answer that:
- Uses the top match as the primary answer
- Mentions confidence level (${confidence} based on score ${topScore.toFixed(3)})
- Suggests one practical follow-up action
- Keep it conversational and helpful`;

      console.log('Generating AI reply...');

      // This would need the AI binding passed in
      // For now, return empty
      return '';
    } catch (error) {
      console.error('AI reply generation failed:', error);
      return '';
    }
  }
}
