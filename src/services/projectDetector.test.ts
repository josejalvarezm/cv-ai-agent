/**
 * Project Detector Service Tests
 * 
 * Tests for the ProjectDetectorService that detects project-specific queries.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectDetectorService } from './projectDetector';

describe('ProjectDetectorService', () => {
    let detector: ProjectDetectorService;

    beforeEach(() => {
        detector = new ProjectDetectorService();
    });

    describe('Non-Project Queries', () => {
        it('should return isProjectSpecific=false for general queries', () => {
            const result = detector.detect('What are Jose\'s TypeScript skills?');
            expect(result.isProjectSpecific).toBe(false);
            expect(result.projectName).toBeUndefined();
        });

        it('should preserve the original query for general queries', () => {
            const query = 'What experience does Jose have with AWS?';
            const result = detector.detect(query);
            expect(result.cleanQuery).toBe(query);
        });

        it('should handle empty strings', () => {
            const result = detector.detect('');
            expect(result.isProjectSpecific).toBe(false);
            expect(result.cleanQuery).toBe('');
        });
    });

    describe('CCHQ Project Detection', () => {
        it('should detect "at CCHQ" pattern', () => {
            const result = detector.detect('What did Jose work on at CCHQ?');
            expect(result.isProjectSpecific).toBe(true);
            expect(result.projectName).toBe('CCHQ');
        });

        it('should detect "in CCHQ" pattern', () => {
            const result = detector.detect('What technologies did Jose use in CCHQ?');
            expect(result.isProjectSpecific).toBe(true);
            expect(result.projectName).toBe('CCHQ');
        });

        it('should detect standalone CCHQ mention', () => {
            const result = detector.detect('CCHQ project experience');
            expect(result.isProjectSpecific).toBe(true);
            expect(result.projectName).toBe('CCHQ');
        });

        it('should detect Conservative Party variation', () => {
            const result = detector.detect('What did Jose do at Conservative Party HQ?');
            expect(result.isProjectSpecific).toBe(true);
            expect(result.projectName).toBe('CCHQ');
        });

        it('should be case insensitive', () => {
            const result = detector.detect('Skills at cchq');
            expect(result.isProjectSpecific).toBe(true);
            expect(result.projectName).toBe('CCHQ');
        });
    });

    describe('Wairbut Project Detection', () => {
        it('should detect "at Wairbut" pattern', () => {
            const result = detector.detect('What did Jose work on at Wairbut?');
            expect(result.isProjectSpecific).toBe(true);
            expect(result.projectName).toBe('Wairbut');
        });

        it('should detect standalone Wairbut mention', () => {
            const result = detector.detect('Wairbut project details');
            expect(result.isProjectSpecific).toBe(true);
            expect(result.projectName).toBe('Wairbut');
        });
    });

    describe('Query Cleaning', () => {
        it('should remove project mention from query', () => {
            const result = detector.detect('What skills did Jose use at CCHQ?');
            expect(result.cleanQuery).not.toContain('CCHQ');
            expect(result.cleanQuery).toContain('skills');
        });

        it('should return original query if cleaning would empty it', () => {
            const result = detector.detect('CCHQ');
            expect(result.cleanQuery.length).toBeGreaterThan(0);
        });

        it('should trim whitespace after cleaning', () => {
            const result = detector.detect('Skills at CCHQ project');
            expect(result.cleanQuery).not.toMatch(/^\s/);
            expect(result.cleanQuery).not.toMatch(/\s$/);
        });
    });

    describe('Custom Project Support', () => {
        it('should allow adding custom projects', () => {
            detector.addProject(/\btest-company\b/i, 'TestCompany');
            const result = detector.detect('Work at test-company');
            expect(result.isProjectSpecific).toBe(true);
            expect(result.projectName).toBe('TestCompany');
        });

        it('should detect custom projects after standard projects', () => {
            detector.addProject(/\bacme\b/i, 'Acme Corp');

            // Standard project should still work
            const cchqResult = detector.detect('Work at CCHQ');
            expect(cchqResult.projectName).toBe('CCHQ');

            // Custom project should also work
            const acmeResult = detector.detect('Work at Acme');
            expect(acmeResult.projectName).toBe('Acme Corp');
        });
    });

    describe('Edge Cases', () => {
        it('should handle multiple project mentions (return first match)', () => {
            const result = detector.detect('Compare CCHQ and Wairbut experience');
            expect(result.isProjectSpecific).toBe(true);
            // Should match the first pattern found
            expect(result.projectName).toBeDefined();
        });

        it('should not false positive on similar words', () => {
            const result = detector.detect('What is Jose\'s approach to HQ level decisions?');
            // This should not match CCHQ
            expect(result.projectName).not.toBe('CCHQ');
        });

        it('should handle special characters in query', () => {
            const result = detector.detect('What C++ skills at CCHQ?');
            expect(result.isProjectSpecific).toBe(true);
            expect(result.cleanQuery).toContain('C++');
        });
    });
});
