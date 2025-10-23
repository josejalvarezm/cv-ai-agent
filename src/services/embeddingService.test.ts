/**
 * Tests for embedding service
 * Validates cosine similarity calculations
 */

import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from './embeddingService';

describe('embeddingService', () => {
  describe('cosineSimilarity', () => {
    it('returns 1.0 for identical vectors', () => {
      const vector = new Float32Array([1, 2, 3, 4]);
      const result = cosineSimilarity(vector, vector);
      expect(result).toBeCloseTo(1.0, 5);
    });

    it('returns 0.0 for orthogonal vectors', () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([0, 1, 0]);
      const result = cosineSimilarity(a, b);
      expect(result).toBeCloseTo(0.0, 5);
    });

    it('returns -1.0 for opposite vectors', () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array([-1, -2, -3]);
      const result = cosineSimilarity(a, b);
      expect(result).toBeCloseTo(-1.0, 5);
    });

    it('calculates correct similarity for known vectors', () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array([4, 5, 6]);
      const result = cosineSimilarity(a, b);
      
      // Manual calculation: (1*4 + 2*5 + 3*6) / (sqrt(14) * sqrt(77))
      // = 32 / 32.8329 = 0.9746
      expect(result).toBeCloseTo(0.9746, 3);
    });

    it('handles zero vectors gracefully', () => {
      const a = new Float32Array([0, 0, 0]);
      const b = new Float32Array([1, 2, 3]);
      const result = cosineSimilarity(a, b);
      // Zero magnitude vector results in 0 (not NaN due to || 1 fallback)
      expect(result).toBe(0);
    });
  });
});
