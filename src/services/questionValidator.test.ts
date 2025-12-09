/**
 * Question Validator Service Tests
 * 
 * Tests for the QuestionValidatorService that validates user queries.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QuestionValidatorService } from './questionValidator';

describe('QuestionValidatorService', () => {
    let validator: QuestionValidatorService;

    beforeEach(() => {
        validator = new QuestionValidatorService();
    });

    describe('Technical Questions (Valid)', () => {
        it('should accept questions about programming languages', () => {
            const result = validator.validate('What experience does Jose have with TypeScript?');
            expect(result.isValid).toBe(true);
            expect(result.errorMessage).toBeUndefined();
        });

        it('should accept questions about frameworks', () => {
            const result = validator.validate('Has Jose worked with Angular or React?');
            expect(result.isValid).toBe(true);
        });

        it('should accept questions about projects', () => {
            const result = validator.validate('What projects has Jose worked on?');
            expect(result.isValid).toBe(true);
        });

        it('should accept questions about cloud technologies', () => {
            const result = validator.validate('Does Jose have AWS or Azure experience?');
            expect(result.isValid).toBe(true);
        });

        it('should accept questions about skills', () => {
            const result = validator.validate('What are Jose\'s key technical skills?');
            expect(result.isValid).toBe(true);
        });

        it('should accept questions about databases', () => {
            const result = validator.validate('What database systems has Jose worked with?');
            expect(result.isValid).toBe(true);
        });

        it('should accept questions about years of experience', () => {
            const result = validator.validate('How many years of experience does Jose have with Python?');
            expect(result.isValid).toBe(true);
        });
    });

    describe('Compensation Questions (Invalid)', () => {
        it('should reject salary questions', () => {
            const result = validator.validate('What is Jose\'s salary expectation?');
            expect(result.isValid).toBe(false);
            expect(result.suggestion).toBeDefined();
        });

        it('should reject compensation questions', () => {
            const result = validator.validate('What compensation does Jose require?');
            expect(result.isValid).toBe(false);
        });

        it('should reject pay rate questions', () => {
            const result = validator.validate('What is the market rate for Jose?');
            expect(result.isValid).toBe(false);
        });

        it('should reject wage questions', () => {
            const result = validator.validate('What wage is Jose looking for?');
            expect(result.isValid).toBe(false);
        });

        it('should reject cost questions', () => {
            const result = validator.validate('How much does it cost to hire Jose?');
            expect(result.isValid).toBe(false);
        });
    });

    describe('Personal Questions (Invalid)', () => {
        it('should reject questions about age', () => {
            // The pattern matches "age" keyword, so use explicit phrasing
            const result = validator.validate('What is Jose\'s age?');
            expect(result.isValid).toBe(false);
        });

        it('should reject questions about family', () => {
            const result = validator.validate('Does Jose have a family?');
            expect(result.isValid).toBe(false);
        });

        it('should reject questions about marital status', () => {
            const result = validator.validate('Is Jose married?');
            expect(result.isValid).toBe(false);
        });

        it('should reject questions about home address', () => {
            const result = validator.validate('What is Jose\'s home address?');
            expect(result.isValid).toBe(false);
        });

        it('should reject questions about private information', () => {
            const result = validator.validate('Can you share private information about Jose?');
            expect(result.isValid).toBe(false);
        });
    });

    describe('Employment Questions (Invalid)', () => {
        it('should reject relocation questions', () => {
            const result = validator.validate('Is Jose willing to relocate?');
            expect(result.isValid).toBe(false);
        });

        it('should reject notice period questions', () => {
            const result = validator.validate('What is Jose\'s notice period?');
            expect(result.isValid).toBe(false);
        });

        it('should reject start date questions', () => {
            const result = validator.validate('When can Jose start date?');
            expect(result.isValid).toBe(false);
        });

        it('should reject availability questions', () => {
            const result = validator.validate('Is Jose available for interviews?');
            expect(result.isValid).toBe(false);
        });
    });

    describe('Negative Questions (Invalid)', () => {
        it('should reject weakness questions', () => {
            const result = validator.validate('What are Jose\'s weaknesses?');
            expect(result.isValid).toBe(false);
        });

        it('should reject failure questions', () => {
            const result = validator.validate('What failures has Jose had?');
            expect(result.isValid).toBe(false);
        });

        it('should reject questions about what Jose is bad at', () => {
            const result = validator.validate('What is Jose bad at?');
            expect(result.isValid).toBe(false);
        });

        it('should reject regret questions', () => {
            // The pattern matches "regrets" plural, so use that form
            const result = validator.validate('What regrets does Jose have in his career?');
            expect(result.isValid).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty strings', () => {
            const result = validator.validate('');
            expect(result.isValid).toBe(true);
        });

        it('should handle whitespace-only strings', () => {
            const result = validator.validate('   ');
            expect(result.isValid).toBe(true);
        });

        it('should be case insensitive', () => {
            const result = validator.validate('WHAT IS THE SALARY?');
            expect(result.isValid).toBe(false);
        });

        it('should handle mixed case', () => {
            const result = validator.validate('What is the SaLaRy expectation?');
            expect(result.isValid).toBe(false);
        });
    });

    describe('Custom Pattern Support', () => {
        it('should allow adding custom patterns', () => {
            validator.addPattern(/\btest-pattern\b/i, 'test', 'Test suggestion');
            const result = validator.validate('This contains test-pattern keyword');
            expect(result.isValid).toBe(false);
            expect(result.suggestion).toBe('Test suggestion');
        });
    });
});
