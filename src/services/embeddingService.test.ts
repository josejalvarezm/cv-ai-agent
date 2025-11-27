import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from './embeddingService';

describe('cosineSimilarity', () => {
  it('should return 1.0 for identical vectors', () => {
    const vec1 = [1, 2, 3, 4];
    const vec2 = [1, 2, 3, 4];
    const similarity = cosineSimilarity(vec1, vec2);
    expect(similarity).toBeCloseTo(1.0, 5);
  });

  it('should return 0.0 for orthogonal vectors', () => {
    const vec1 = [1, 0, 0, 0];
    const vec2 = [0, 1, 0, 0];
    const similarity = cosineSimilarity(vec1, vec2);
    expect(similarity).toBeCloseTo(0.0, 5);
  });

  it('should return -1.0 for opposite vectors', () => {
    const vec1 = [1, 2, 3];
    const vec2 = [-1, -2, -3];
    const similarity = cosineSimilarity(vec1, vec2);
    expect(similarity).toBeCloseTo(-1.0, 5);
  });

  it('should handle Float32Array inputs', () => {
    const vec1 = new Float32Array([1, 2, 3]);
    const vec2 = new Float32Array([1, 2, 3]);
    const similarity = cosineSimilarity(vec1, vec2);
    expect(similarity).toBeCloseTo(1.0, 5);
  });

  it('should handle mixed array and Float32Array inputs', () => {
    const vec1 = [1, 2, 3];
    const vec2 = new Float32Array([1, 2, 3]);
    const similarity = cosineSimilarity(vec1, vec2);
    expect(similarity).toBeCloseTo(1.0, 5);
  });

  it('should calculate correct similarity for partially similar vectors', () => {
    const vec1 = [1, 0, 1, 0];
    const vec2 = [1, 1, 0, 0];
    // Dot product: 1*1 + 0*1 + 1*0 + 0*0 = 1
    // Magnitude vec1: sqrt(1+0+1+0) = sqrt(2)
    // Magnitude vec2: sqrt(1+1+0+0) = sqrt(2)
    // Cosine: 1 / (sqrt(2) * sqrt(2)) = 1/2 = 0.5
    const similarity = cosineSimilarity(vec1, vec2);
    expect(similarity).toBeCloseTo(0.5, 5);
  });

  it('should handle zero vectors gracefully', () => {
    const vec1 = [0, 0, 0];
    const vec2 = [1, 2, 3];
    const similarity = cosineSimilarity(vec1, vec2);
    // Zero vectors produce NaN or 0 depending on implementation
    expect(similarity === 0 || isNaN(similarity)).toBe(true);
  });

  it('should handle large vectors (768 dimensions like embeddings)', () => {
    const vec1 = Array(768).fill(0.1);
    const vec2 = Array(768).fill(0.1);
    const similarity = cosineSimilarity(vec1, vec2);
    expect(similarity).toBeCloseTo(1.0, 5);
  });

  it('should return value between -1 and 1', () => {
    const vec1 = [1, 2, 3, 4, 5];
    const vec2 = [5, 4, 3, 2, 1];
    const similarity = cosineSimilarity(vec1, vec2);
    expect(similarity).toBeGreaterThanOrEqual(-1);
    expect(similarity).toBeLessThanOrEqual(1);
  });

  it('should be commutative (order doesn\'t matter)', () => {
    const vec1 = [1, 2, 3];
    const vec2 = [4, 5, 6];
    const sim1 = cosineSimilarity(vec1, vec2);
    const sim2 = cosineSimilarity(vec2, vec1);
    expect(sim1).toBeCloseTo(sim2, 10);
  });
});
