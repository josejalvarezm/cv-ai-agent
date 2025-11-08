/**
 * Cache Service
 * Handles caching operations using Cloudflare's Cache API
 */

import { CACHE_CONFIG } from '../config';

/**
 * Generate a cache key from query string
 * Uses simple hash for consistent key generation
 * @param query - Query string to hash
 * @returns Cache key string
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
 * @param cacheKey - Cache key to lookup
 * @param requestUrl - Original request URL
 * @returns Cached response or null if not found
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
 * @param cacheKey - Cache key to store under
 * @param requestUrl - Original request URL
 * @param data - Data to cache
 * @param ttl - Time to live in seconds (optional, uses default from config)
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
 * @param cacheKey - Cache key to invalidate
 * @param requestUrl - Original request URL
 */
export async function invalidateCache(cacheKey: string, requestUrl: string): Promise<boolean> {
  const cache = caches.default;
  const cacheUrl = new URL(requestUrl);
  cacheUrl.pathname = `/cache/${cacheKey}`;
  
  return await cache.delete(cacheUrl.toString());
}

/**
 * CacheService class wrapper
 * Provides object-oriented interface for dependency injection
 */
export class CacheService {
  constructor(private _kv?: KVNamespace) {
    // KV namespace optional for distributed caching
    // This service primarily uses Cache API
  }

  generateKey(query: string): string {
    return generateCacheKey(query);
  }

  async get(cacheKey: string, requestUrl: string): Promise<any | null> {
    return getCachedResponse(cacheKey, requestUrl);
  }

  async set(cacheKey: string, requestUrl: string, data: any, ttl?: number): Promise<void> {
    return setCachedResponse(cacheKey, requestUrl, data, ttl);
  }

  async invalidate(cacheKey: string, requestUrl: string): Promise<boolean> {
    return invalidateCache(cacheKey, requestUrl);
  }
}

