/**
 * Cache Service
 * Handles caching operations using Cloudflare's Cache API
 * 
 * This service provides efficient caching of query results to reduce
 * AI inference costs and improve response times for repeated queries.
 */

import { CACHE_CONFIG } from '../config';

/**
 * Generate a cache key from query string
 * 
 * Uses a simple hash function for consistent key generation.
 * Same query will always produce the same cache key.
 * 
 * @param query - Query string to hash
 * @returns Cache key string
 * 
 * @example
 * const key = generateCacheKey("python experience");
 * // Returns: "query:123456789"
 */
export function generateCacheKey(query: string): string {
  // Simple hash for cache key
  let hash = 0;
  for (let i = 0; i < query.length; i++) {
    const char = query.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `${CACHE_CONFIG.QUERY_PREFIX}${Math.abs(hash)}`;
}

/**
 * Get cached response for a query
 * 
 * Checks Cloudflare's Cache API for a previously cached response.
 * Returns null if not found or expired.
 * 
 * @param cacheKey - Cache key to lookup
 * @param requestUrl - Original request URL (used to construct cache URL)
 * @returns Cached response data or null if not found
 * 
 * @example
 * const cached = await getCachedResponse(cacheKey, request.url);
 * if (cached) {
 *   return Response.json(cached);
 * }
 */
export async function getCachedResponse(cacheKey: string, requestUrl: string): Promise<any | null> {
  const cache = caches.default;
  const cacheUrl = new URL(requestUrl);
  cacheUrl.pathname = `/cache/${cacheKey}`;
  
  const cachedResponse = await cache.match(cacheUrl.toString());
  if (cachedResponse) {
    const cachedData = await cachedResponse.json() as any;
    return {
      ...cachedData,
      cached: true,
    };
  }
  
  return null;
}

/**
 * Store response in cache
 * 
 * Saves a query response in Cloudflare's Cache API with specified TTL.
 * Automatically adds Cache-Control headers for edge caching.
 * 
 * @param cacheKey - Cache key to store under
 * @param requestUrl - Original request URL (used to construct cache URL)
 * @param data - Data to cache (will be JSON stringified)
 * @param ttl - Time to live in seconds (optional, uses default from config)
 * 
 * @example
 * await setCachedResponse(cacheKey, request.url, responseData, 3600);
 * // Cached for 1 hour
 */
export async function setCachedResponse(
  cacheKey: string,
  requestUrl: string,
  data: any,
  ttl?: number
): Promise<void> {
  const cache = caches.default;
  const cacheUrl = new URL(requestUrl);
  cacheUrl.pathname = `/cache/${cacheKey}`;
  
  const cacheTtl = ttl || CACHE_CONFIG.DEFAULT_TTL;
  const responseToCache = new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `max-age=${cacheTtl}`,
    },
  });
  
  await cache.put(cacheUrl.toString(), responseToCache.clone());
}

/**
 * Invalidate cache entry
 * 
 * Removes a specific entry from the cache. Useful when data changes
 * and cached results need to be refreshed.
 * 
 * @param cacheKey - Cache key to invalidate
 * @param requestUrl - Original request URL (used to construct cache URL)
 * @returns true if entry was deleted, false if it didn't exist
 * 
 * @example
 * const deleted = await invalidateCache(cacheKey, request.url);
 * if (deleted) {
 *   console.log('Cache invalidated');
 * }
 */
export async function invalidateCache(cacheKey: string, requestUrl: string): Promise<boolean> {
  const cache = caches.default;
  const cacheUrl = new URL(requestUrl);
  cacheUrl.pathname = `/cache/${cacheKey}`;
  
  return await cache.delete(cacheUrl.toString());
}
