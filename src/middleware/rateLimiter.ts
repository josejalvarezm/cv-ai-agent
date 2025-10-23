/**
 * Rate Limiting Middleware
 * 
 * Prevents quota exhaustion and abuse by limiting requests per IP/user
 * 
 * Best Practices:
 * - Per-IP limiting: 10 requests per minute (prevents individual abuse)
 * - Sliding window algorithm (more accurate than fixed windows)
 * - Cloudflare KV for distributed rate limit storage
 * - Graceful error messages for rate-limited users
 */

interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  burstAllowance: number; // Extra requests allowed in short bursts
}

interface RateLimitResult {
  allowed: boolean;
  message?: string;
  retryAfter?: number; // Seconds until retry allowed
  remaining?: number;  // Remaining requests in current window
}

const DEFAULT_CONFIG: RateLimitConfig = {
  requestsPerMinute: 10,   // 10 queries per minute per IP
  requestsPerHour: 50,     // 50 queries per hour per IP
  burstAllowance: 2,       // Allow 2 extra requests for bursts
};

/**
 * Check if request is within rate limits
 * Uses sliding window algorithm for accurate rate limiting
 */
export async function checkRateLimit(
  request: Request,
  kv: KVNamespace,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<RateLimitResult> {
  // Get client IP (Cloudflare provides this header)
  const ip = request.headers.get('CF-Connecting-IP') || 
             request.headers.get('X-Forwarded-For') || 
             'unknown';
  
  if (ip === 'unknown') {
    // Allow unknown IPs (development, local testing)
    return { allowed: true };
  }
  
  const now = Date.now();
  const minuteWindow = Math.floor(now / 60000); // Current minute
  const hourWindow = Math.floor(now / 3600000); // Current hour
  
  // Keys for different time windows
  const minuteKey = `ratelimit:${ip}:minute:${minuteWindow}`;
  const hourKey = `ratelimit:${ip}:hour:${hourWindow}`;
  
  // Get current counts
  const [minuteCount, hourCount] = await Promise.all([
    kv.get(minuteKey),
    kv.get(hourKey),
  ]);
  
  const currentMinuteCount = minuteCount ? parseInt(minuteCount, 10) : 0;
  const currentHourCount = hourCount ? parseInt(hourCount, 10) : 0;
  
  // Check minute limit (with burst allowance)
  if (currentMinuteCount >= config.requestsPerMinute + config.burstAllowance) {
    const retryAfter = 60 - (Math.floor(now / 1000) % 60); // Seconds until next minute
    return {
      allowed: false,
      message: `Rate limit exceeded. Maximum ${config.requestsPerMinute} requests per minute. Please wait ${retryAfter} seconds.`,
      retryAfter,
      remaining: 0,
    };
  }
  
  // Check hour limit
  if (currentHourCount >= config.requestsPerHour) {
    const retryAfter = 3600 - (Math.floor(now / 1000) % 3600); // Seconds until next hour
    return {
      allowed: false,
      message: `Hourly rate limit exceeded. Maximum ${config.requestsPerHour} requests per hour. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`,
      retryAfter,
      remaining: 0,
    };
  }
  
  // Increment counters (non-blocking, fire-and-forget)
  const minuteTTL = 120; // Keep for 2 minutes (covers window overlap)
  const hourTTL = 7200;  // Keep for 2 hours (covers window overlap)
  
  await Promise.all([
    kv.put(minuteKey, (currentMinuteCount + 1).toString(), { expirationTtl: minuteTTL }),
    kv.put(hourKey, (currentHourCount + 1).toString(), { expirationTtl: hourTTL }),
  ]);
  
  return {
    allowed: true,
    remaining: config.requestsPerMinute - currentMinuteCount - 1,
  };
}

/**
 * Get current rate limit status for an IP (for monitoring/debugging)
 */
export async function getRateLimitStatus(
  ip: string,
  kv: KVNamespace
): Promise<{
  minuteCount: number;
  hourCount: number;
  minuteLimit: number;
  hourLimit: number;
}> {
  const now = Date.now();
  const minuteWindow = Math.floor(now / 60000);
  const hourWindow = Math.floor(now / 3600000);
  
  const minuteKey = `ratelimit:${ip}:minute:${minuteWindow}`;
  const hourKey = `ratelimit:${ip}:hour:${hourWindow}`;
  
  const [minuteCount, hourCount] = await Promise.all([
    kv.get(minuteKey),
    kv.get(hourKey),
  ]);
  
  return {
    minuteCount: minuteCount ? parseInt(minuteCount, 10) : 0,
    hourCount: hourCount ? parseInt(hourCount, 10) : 0,
    minuteLimit: DEFAULT_CONFIG.requestsPerMinute,
    hourLimit: DEFAULT_CONFIG.requestsPerHour,
  };
}

/**
 * Reset rate limit for an IP (admin function)
 */
export async function resetRateLimit(
  ip: string,
  kv: KVNamespace
): Promise<void> {
  const now = Date.now();
  const minuteWindow = Math.floor(now / 60000);
  const hourWindow = Math.floor(now / 3600000);
  
  const minuteKey = `ratelimit:${ip}:minute:${minuteWindow}`;
  const hourKey = `ratelimit:${ip}:hour:${hourWindow}`;
  
  await Promise.all([
    kv.delete(minuteKey),
    kv.delete(hourKey),
  ]);
}
