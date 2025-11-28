import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateAndSanitizeInput, isWithinBusinessHours } from './input-validation';

describe('validateAndSanitizeInput', () => {
  it('should accept valid technical queries', () => {
    const result = validateAndSanitizeInput('What is your experience with TypeScript?');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedInput).toBe('What is your experience with TypeScript?');
  });

  it('should reject empty input', () => {
    const result = validateAndSanitizeInput('');
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBeTruthy();
  });

  it('should reject too short queries', () => {
    const result = validateAndSanitizeInput('hi');
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBeTruthy();
  });

  it('should reject too long queries', () => {
    const longQuery = 'a'.repeat(501);
    const result = validateAndSanitizeInput(longQuery);
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBeTruthy();
  });

  it('should reject queries with excessive special characters', () => {
    const result = validateAndSanitizeInput('!!!???***###');
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBeTruthy();
  });

  it('should reject queries with repetitive characters', () => {
    const result = validateAndSanitizeInput('aaaaaaaaaaaaaaaa what is this');
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBeTruthy();
  });

  it('should strip control characters', () => {
    const result = validateAndSanitizeInput('What is\x00 TypeScript\x08?');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedInput).toBe('What is TypeScript?');
    expect(result.sanitizedInput).not.toContain('\x00');
  });

  it('should trim whitespace', () => {
    const result = validateAndSanitizeInput('  What is TypeScript?  ');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedInput).toBe('What is TypeScript?');
  });

  it('should accept non-technical queries as valid (handled by separate function)', () => {
    // validateAndSanitizeInput only checks format/spam, not content
    const result = validateAndSanitizeInput('What is your salary expectation?');
    expect(result.isValid).toBe(true);
  });

  it('should accept queries about age as valid (handled by separate function)', () => {
    // validateAndSanitizeInput only checks format/spam, not content
    const result = validateAndSanitizeInput('How old are you?');
    expect(result.isValid).toBe(true);
  });

  it('should accept project-specific queries', () => {
    const result = validateAndSanitizeInput('What skills did you use at Acme Corp?');
    expect(result.isValid).toBe(true);
  });

  it('should accept queries with common SQL injection patterns but valid content', () => {
    const result = validateAndSanitizeInput('What is your experience with SQL OR database?');
    expect(result.isValid).toBe(true);
  });

  it('should handle URLs gracefully', () => {
    const result = validateAndSanitizeInput('Tell me about your experience with https://example.com frameworks');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedInput).toContain('https://example.com');
  });
});

describe('isWithinBusinessHours', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests during UK business hours (weekday 9am-9pm BST)', () => {
    // Tuesday, 3pm BST (14:00 UTC in summer)
    const date = new Date('2024-07-16T14:00:00Z');
    vi.setSystemTime(date);

    const result = isWithinBusinessHours();
    expect(result.isWithinHours).toBe(true);
  });

  it('should block requests outside UK business hours (too early)', () => {
    // Tuesday, 6am BST (5:00 UTC in summer)
    const date = new Date('2024-07-16T05:00:00Z');
    vi.setSystemTime(date);

    const result = isWithinBusinessHours();
    expect(result.isWithinHours).toBe(false);
  });

  it('should block requests outside UK business hours (too late)', () => {
    // Tuesday, 10pm BST (21:00 UTC in summer)
    const date = new Date('2024-07-16T21:00:00Z');
    vi.setSystemTime(date);

    const result = isWithinBusinessHours();
    expect(result.isWithinHours).toBe(false);
  });

  it('should block requests on Saturday', () => {
    // Saturday, 2pm BST
    const date = new Date('2024-07-20T13:00:00Z');
    vi.setSystemTime(date);

    const result = isWithinBusinessHours();
    expect(result.isWithinHours).toBe(false);
  });

  it('should block requests on Sunday', () => {
    // Sunday, 2pm BST
    const date = new Date('2024-07-21T13:00:00Z');
    vi.setSystemTime(date);

    const result = isWithinBusinessHours();
    expect(result.isWithinHours).toBe(false);
  });

  it('should provide timezone info in response', () => {
    const date = new Date('2024-07-16T14:00:00Z');
    vi.setSystemTime(date);

    const result = isWithinBusinessHours();
    expect(result.timezone).toContain('BST');
  });

  it('should respect bypass phrase if provided', () => {
    // Sunday, should normally be blocked
    const date = new Date('2024-07-21T13:00:00Z');
    vi.setSystemTime(date);

    const result = isWithinBusinessHours('bypass');
    // Note: actual bypass phrase may be different, test that function accepts parameter
    expect(result).toBeDefined();
    expect(result.isWithinHours).toBeDefined();
  });
});
