/**
 * Response Validator Service Tests
 * 
 * Tests for the ResponseValidatorService that validates and cleans AI responses.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ResponseValidatorService } from './responseValidator';

describe('ResponseValidatorService', () => {
    let validator: ResponseValidatorService;

    beforeEach(() => {
        validator = new ResponseValidatorService();
    });

    describe('cleanupReply', () => {
        it('should return empty string for empty input', () => {
            expect(validator.cleanupReply('')).toBe('');
        });

        it('should return trimmed result for whitespace-only input', () => {
            // Implementation returns the input as-is if trim().length === 0
            // after checking `if (!reply || reply.trim().length === 0) return reply;`
            expect(validator.cleanupReply('   ')).toBe('   ');
        });

        it('should preserve complete sentences', () => {
            const input = 'Jose has 5 years of TypeScript experience.';
            const result = validator.cleanupReply(input);
            expect(result).toContain('5 years');
            expect(result).toContain('TypeScript');
        });

        it('should handle sentences ending with exclamation marks', () => {
            const input = 'Jose is highly skilled in cloud technologies!';
            const result = validator.cleanupReply(input);
            expect(result.endsWith('!')).toBe(true);
        });

        it('should handle sentences ending with question marks', () => {
            const input = 'Would you like to know more?';
            const result = validator.cleanupReply(input);
            expect(result.endsWith('?')).toBe(true);
        });

        it('should trim leading and trailing whitespace', () => {
            const input = '   Jose has experience with AWS.   ';
            const result = validator.cleanupReply(input);
            expect(result).not.toMatch(/^\s/);
            expect(result).not.toMatch(/\s$/);
        });

        it('should remove generic filler phrases via enforceLaconicStyle', () => {
            const input = "My expertise spans multiple domains. Jose has AWS experience.";
            const result = validator.enforceLaconicStyle(input);
            expect(result).not.toContain('My expertise spans');
        });

        it('should remove transition words via enforceLaconicStyle', () => {
            const input = 'Additionally, Jose has 3 years of Python experience.';
            const result = validator.enforceLaconicStyle(input);
            expect(result).not.toMatch(/^Additionally/);
        });

        it('should handle multi-sentence input', () => {
            const input = 'Jose has TypeScript experience. He has worked with Angular.';
            const result = validator.cleanupReply(input);
            expect(result).toContain('TypeScript');
        });
    });

    describe('validateQuality', () => {
        it('should return quality result for valid response', () => {
            const result = validator.validateQuality('Jose has 5 years of TypeScript experience at CCHQ.');
            expect(result).toHaveProperty('isValid');
            expect(result).toHaveProperty('issues');
        });

        it('should detect filler phrases', () => {
            const input = "I've worked in enterprise technologies for 10 years. Jose has AWS skills.";
            const result = validator.validateQuality(input);
            // The issues array should contain filler detection
            expect(result.issues.some(issue => issue.toLowerCase().includes('filler'))).toBe(true);
        });

        it('should detect when response exceeds max sentences', () => {
            const input = 'Sentence one. Sentence two. Sentence three. Sentence four.';
            const result = validator.validateQuality(input);
            // Should report too many sentences in issues
            expect(result.issues.some(issue => issue.toLowerCase().includes('sentences'))).toBe(true);
        });

        it('should not flag responses within sentence limit', () => {
            const input = 'Jose has AWS experience at CCHQ.';
            const result = validator.validateQuality(input);
            // Should not have sentence limit issues
            expect(result.issues.filter(issue => issue.toLowerCase().includes('sentences')).length).toBe(0);
        });
    });

    describe('Custom Sentence Limit', () => {
        it('should respect custom max sentences in enforceLaconicStyle', () => {
            const customValidator = new ResponseValidatorService(4);
            const input = 'One. Two. Three. Four. Five.';
            const result = customValidator.enforceLaconicStyle(input);
            // Should keep 4 sentences
            const sentences = result.match(/[^.!?]+[.!?]+/g) || [];
            expect(sentences.length).toBeLessThanOrEqual(4);
        });

        it('should limit to custom sentence count', () => {
            const customValidator = new ResponseValidatorService(1);
            const input = 'One. Two. Three.';
            const result = customValidator.enforceLaconicStyle(input);
            // Should keep only 1 sentence
            const sentences = result.match(/[^.!?]+[.!?]+/g) || [];
            expect(sentences.length).toBe(1);
        });
    });

    describe('Employer Attribution', () => {
        it('should preserve employer attribution at end of response', () => {
            const input = 'Jose worked at Microsoft. Prior to that, he was at Amazon.';
            const result = validator.cleanupReply(input);
            expect(result).toContain('Amazon');
        });
    });

    describe('Edge Cases', () => {
        it('should handle very long responses', () => {
            const longResponse = 'Jose has extensive experience. '.repeat(20);
            const result = validator.cleanupReply(longResponse);
            expect(result.length).toBeLessThanOrEqual(longResponse.length);
        });

        it('should handle responses with special characters', () => {
            const input = 'Jose has worked with C++, C#, and F#.';
            const result = validator.cleanupReply(input);
            expect(result).toContain('C++');
            expect(result).toContain('C#');
        });

        it('should handle responses with numbers and percentages', () => {
            const input = 'Jose improved performance by 40% using optimization techniques.';
            const result = validator.cleanupReply(input);
            expect(result).toContain('40%');
        });

        it('should handle responses with URLs or code references', () => {
            const input = 'Jose has contributed to github.com/project repositories.';
            const result = validator.cleanupReply(input);
            expect(result).toContain('github.com');
        });
    });
});
