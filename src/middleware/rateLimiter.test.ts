import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, getRateLimitStatus, resetRateLimit } from './rateLimiter';

// Mock KV namespace
function createMockKV(): KVNamespace {
  const store = new Map<string, { value: string; expiration: number }>();
  
  return {
    get: vi.fn(async (key: string) => {
      const item = store.get(key);
      if (!item) return null;
      if (item.expiration && Date.now() > item.expiration) {
        store.delete(key);
        return null;
      }
      return item.value;
    }),
    
    put: vi.fn(async (key: string, value: string, options?: { expirationTtl?: number }) => {
      const expiration = options?.expirationTtl 
        ? Date.now() + (options.expirationTtl * 1000)
        : 0;
      store.set(key, { value, expiration });
    }),
    
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  } as any;
}

// Mock request with CF-Connecting-IP header
function createMockRequest(ip: string = '192.168.1.1'): Request {
  return {
    headers: new Map([['CF-Connecting-IP', ip]]) as any,
  } as Request;
}

describe('Rate Limiter', () => {
  let mockKV: KVNamespace;
  
  beforeEach(() => {
    mockKV = createMockKV();
    vi.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow first request', async () => {
      const request = createMockRequest('1.2.3.4');
      const result = await checkRateLimit(request, mockKV);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // 10 - 1
    });

    it('should allow requests under limit', async () => {
      const request = createMockRequest('1.2.3.4');
      
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        const result = await checkRateLimit(request, mockKV);
        expect(result.allowed).toBe(true);
      }
    });

    it('should block requests over minute limit', async () => {
      const request = createMockRequest('1.2.3.4');
      
      // Make 12 requests (10 + 2 burst)
      for (let i = 0; i < 12; i++) {
        await checkRateLimit(request, mockKV);
      }
      
      // 13th request should be blocked
      const result = await checkRateLimit(request, mockKV);
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('Rate limit exceeded');
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should track different IPs separately', async () => {
      const request1 = createMockRequest('1.2.3.4');
      const request2 = createMockRequest('5.6.7.8');
      
      // Exhaust limit for IP1
      for (let i = 0; i < 12; i++) {
        await checkRateLimit(request1, mockKV);
      }
      
      // IP1 should be blocked
      const result1 = await checkRateLimit(request1, mockKV);
      expect(result1.allowed).toBe(false);
      
      // IP2 should still be allowed
      const result2 = await checkRateLimit(request2, mockKV);
      expect(result2.allowed).toBe(true);
    });

    it('should allow unknown IPs', async () => {
      const request = {
        headers: new Map() as any,
      } as Request;
      
      const result = await checkRateLimit(request, mockKV);
      expect(result.allowed).toBe(true);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return current counts', async () => {
      const ip = '1.2.3.4';
      const request = createMockRequest(ip);
      
      // Mock Date.now to prevent minute boundary crossing during test
      const fixedTime = 1700000000000; // Fixed timestamp mid-minute
      vi.spyOn(Date, 'now').mockReturnValue(fixedTime);
      
      // Make 3 requests
      await checkRateLimit(request, mockKV);
      await checkRateLimit(request, mockKV);
      await checkRateLimit(request, mockKV);
      
      const status = await getRateLimitStatus(ip, mockKV);
      expect(status.minuteCount).toBe(3);
      expect(status.minuteLimit).toBe(10);
      expect(status.hourLimit).toBe(50);
      
      // Restore Date.now
      vi.restoreAllMocks();
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit for IP', async () => {
      const ip = '1.2.3.4';
      const request = createMockRequest(ip);
      
      // Mock Date.now to prevent minute boundary crossing during test
      const fixedTime = 1700000000000; // Fixed timestamp mid-minute
      vi.spyOn(Date, 'now').mockReturnValue(fixedTime);
      
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(request, mockKV);
      }
      
      // Verify count
      let status = await getRateLimitStatus(ip, mockKV);
      expect(status.minuteCount).toBe(5);
      
      // Reset
      await resetRateLimit(ip, mockKV);
      
      // Verify reset
      status = await getRateLimitStatus(ip, mockKV);
      expect(status.minuteCount).toBe(0);
      
      // Restore Date.now
      vi.restoreAllMocks();
    });
  });
});
