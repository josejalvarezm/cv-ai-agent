import { describe, it, expect, vi } from 'vitest';
import { getQuotaStatus, canUseAI, NEURON_COSTS } from './ai-quota';

// Mock KVNamespace
const createMockKV = (quotaValue: string | null = null, countValue: string | null = null) => {
  return {
    get: vi.fn((key: string) => {
      if (key.includes(':count')) return Promise.resolve(countValue);
      return Promise.resolve(quotaValue);
    }),
    put: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
  } as unknown as KVNamespace;
};

describe('getQuotaStatus', () => {
  it('should return zero usage for new day with no data', async () => {
    const mockKV = createMockKV(null, null);
    const status = await getQuotaStatus(mockKV);

    expect(status.neuronsUsed).toBe(0);
    expect(status.neuronsLimit).toBe(9500);
    expect(status.neuronsRemaining).toBe(9500);
    expect(status.isExceeded).toBe(false);
    expect(status.inferenceCount).toBe(0);
  });

  it('should return current usage when data exists', async () => {
    const mockKV = createMockKV('5000', '100');
    const status = await getQuotaStatus(mockKV);

    expect(status.neuronsUsed).toBe(5000);
    expect(status.neuronsRemaining).toBe(4500);
    expect(status.isExceeded).toBe(false);
    expect(status.inferenceCount).toBe(100);
  });

  it('should mark as exceeded when limit reached', async () => {
    const mockKV = createMockKV('9500', '200');
    const status = await getQuotaStatus(mockKV);

    expect(status.neuronsUsed).toBe(9500);
    expect(status.neuronsRemaining).toBe(0);
    expect(status.isExceeded).toBe(true);
  });

  it('should mark as exceeded when over limit', async () => {
    const mockKV = createMockKV('10000', '250');
    const status = await getQuotaStatus(mockKV);

    expect(status.isExceeded).toBe(true);
    expect(status.neuronsRemaining).toBe(0);
  });

  it('should provide reset time for next day at midnight UTC', async () => {
    const mockKV = createMockKV('1000', '20');
    const status = await getQuotaStatus(mockKV);

    const resetDate = new Date(status.resetAt);
    expect(resetDate.getUTCHours()).toBe(0);
    expect(resetDate.getUTCMinutes()).toBe(0);
    expect(resetDate.getUTCSeconds()).toBe(0);
  });

  it('should include today\'s date in YYYY-MM-DD format', async () => {
    const mockKV = createMockKV(null, null);
    const status = await getQuotaStatus(mockKV);

    expect(status.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('canUseAI', () => {
  it('should allow AI use when under quota', async () => {
    const mockKV = createMockKV('1000', '20');
    const result = await canUseAI(mockKV);

    expect(result.allowed).toBe(true);
    expect(result.status.neuronsUsed).toBe(1000);
  });

  it('should block AI use when quota exceeded', async () => {
    const mockKV = createMockKV('9500', '200');
    const result = await canUseAI(mockKV);

    expect(result.allowed).toBe(false);
    expect(result.status.isExceeded).toBe(true);
  });

  it('should block AI use when over quota', async () => {
    const mockKV = createMockKV('15000', '300');
    const result = await canUseAI(mockKV);

    expect(result.allowed).toBe(false);
    expect(result.status.isExceeded).toBe(true);
  });
});

describe('NEURON_COSTS', () => {
  it('should have defined costs for primary models', () => {
    expect(NEURON_COSTS['llama-3.1-70b-instruct']).toBe(5);
    expect(NEURON_COSTS['mistral-7b-instruct']).toBe(75);
    expect(NEURON_COSTS['bge-base-en-v1.5']).toBe(0.6);
  });

  it('should have reasonable costs (positive numbers)', () => {
    Object.values(NEURON_COSTS).forEach(cost => {
      expect(cost).toBeGreaterThan(0);
    });
  });

  it('should have primary model cost lower than fallback', () => {
    // llama-3.1-70b (primary) should be cheaper than mistral-7b (fallback)
    expect(NEURON_COSTS['llama-3.1-70b-instruct']).toBeLessThan(NEURON_COSTS['mistral-7b-instruct']);
  });

  it('should have embedding cost much lower than LLM costs', () => {
    // Embeddings should be much cheaper than LLM inferences
    expect(NEURON_COSTS['bge-base-en-v1.5']).toBeLessThan(NEURON_COSTS['llama-3.1-70b-instruct']);
  });
});
