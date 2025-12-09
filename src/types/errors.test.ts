/**
 * Typed Error Handling Tests
 * 
 * Tests for the error type hierarchy and utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
    ApplicationError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    ServiceError,
    ExternalServiceError,
    DatabaseError,
    TimeoutError,
    isApplicationError,
    getStatusCode,
    errorToResponse,
} from './errors';

describe('Error Types', () => {
    describe('ApplicationError', () => {
        it('should create an error with all properties', () => {
            const error = new ApplicationError(500, 'TEST_ERROR', 'Test message', { key: 'value' });
            expect(error.statusCode).toBe(500);
            expect(error.code).toBe('TEST_ERROR');
            expect(error.message).toBe('Test message');
            expect(error.details).toEqual({ key: 'value' });
        });

        it('should serialize to JSON correctly', () => {
            const error = new ApplicationError(400, 'BAD_REQUEST', 'Invalid input', { field: 'name' });
            const json = error.toJSON();
            expect(json).toEqual({
                error: 'BAD_REQUEST',
                message: 'Invalid input',
                statusCode: 400,
                details: { field: 'name' },
            });
        });

        it('should omit details from JSON when not provided', () => {
            const error = new ApplicationError(500, 'ERROR', 'Something failed');
            const json = error.toJSON();
            expect(json.details).toBeUndefined();
        });

        it('should be an instance of Error', () => {
            const error = new ApplicationError(500, 'ERROR', 'Test');
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(ApplicationError);
        });
    });

    describe('ValidationError', () => {
        it('should have status code 400', () => {
            const error = new ValidationError('Invalid input');
            expect(error.statusCode).toBe(400);
            expect(error.code).toBe('VALIDATION_ERROR');
        });

        it('should be an instance of ApplicationError', () => {
            const error = new ValidationError('Invalid');
            expect(error).toBeInstanceOf(ApplicationError);
            expect(error).toBeInstanceOf(ValidationError);
        });
    });

    describe('AuthenticationError', () => {
        it('should have status code 401', () => {
            const error = new AuthenticationError();
            expect(error.statusCode).toBe(401);
            expect(error.code).toBe('AUTHENTICATION_ERROR');
        });

        it('should have default message', () => {
            const error = new AuthenticationError();
            expect(error.message).toBe('Unauthorized');
        });

        it('should accept custom message', () => {
            const error = new AuthenticationError('Session expired');
            expect(error.message).toBe('Session expired');
        });
    });

    describe('AuthorizationError', () => {
        it('should have status code 403', () => {
            const error = new AuthorizationError();
            expect(error.statusCode).toBe(403);
            expect(error.code).toBe('AUTHORIZATION_ERROR');
        });
    });

    describe('NotFoundError', () => {
        it('should have status code 404', () => {
            const error = new NotFoundError('User');
            expect(error.statusCode).toBe(404);
            expect(error.code).toBe('NOT_FOUND');
        });

        it('should format message with resource name', () => {
            const error = new NotFoundError('User');
            expect(error.message).toBe('User not found');
        });

        it('should format message with resource and id', () => {
            const error = new NotFoundError('User', 123);
            expect(error.message).toBe('User with id 123 not found');
        });

        it('should work with string ids', () => {
            const error = new NotFoundError('Skill', 'typescript');
            expect(error.message).toBe('Skill with id typescript not found');
        });
    });

    describe('ConflictError', () => {
        it('should have status code 409', () => {
            const error = new ConflictError('Resource already exists');
            expect(error.statusCode).toBe(409);
            expect(error.code).toBe('CONFLICT');
        });
    });

    describe('RateLimitError', () => {
        it('should have status code 429', () => {
            const error = new RateLimitError();
            expect(error.statusCode).toBe(429);
            expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
        });

        it('should include retryAfter in details', () => {
            const error = new RateLimitError(120);
            expect(error.details?.retryAfter).toBe(120);
        });

        it('should default to 60 seconds retry', () => {
            const error = new RateLimitError();
            expect(error.details?.retryAfter).toBe(60);
        });
    });

    describe('ServiceError', () => {
        it('should have status code 500', () => {
            const error = new ServiceError();
            expect(error.statusCode).toBe(500);
            expect(error.code).toBe('SERVICE_ERROR');
        });

        it('should have default message', () => {
            const error = new ServiceError();
            expect(error.message).toBe('Internal server error');
        });
    });

    describe('ExternalServiceError', () => {
        it('should have status code 503', () => {
            const error = new ExternalServiceError('AWS');
            expect(error.statusCode).toBe(503);
            expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
        });

        it('should include service name in message', () => {
            const error = new ExternalServiceError('DynamoDB');
            expect(error.message).toContain('DynamoDB');
        });

        it('should include service in details', () => {
            const error = new ExternalServiceError('S3', 'Bucket not found');
            expect(error.details?.service).toBe('S3');
        });
    });

    describe('DatabaseError', () => {
        it('should have status code 500', () => {
            const error = new DatabaseError('query');
            expect(error.statusCode).toBe(500);
            expect(error.code).toBe('DATABASE_ERROR');
        });

        it('should include operation in message', () => {
            const error = new DatabaseError('insert');
            expect(error.message).toContain('insert');
        });
    });

    describe('TimeoutError', () => {
        it('should have status code 504', () => {
            const error = new TimeoutError('Vector search', 5000);
            expect(error.statusCode).toBe(504);
            expect(error.code).toBe('TIMEOUT');
        });

        it('should include operation and timeout in message', () => {
            const error = new TimeoutError('AI inference', 30000);
            expect(error.message).toContain('AI inference');
            expect(error.message).toContain('30000ms');
        });
    });
});

describe('Error Utility Functions', () => {
    describe('isApplicationError', () => {
        it('should return true for ApplicationError', () => {
            const error = new ApplicationError(500, 'ERROR', 'Test');
            expect(isApplicationError(error)).toBe(true);
        });

        it('should return true for subclasses', () => {
            expect(isApplicationError(new ValidationError('Invalid'))).toBe(true);
            expect(isApplicationError(new AuthenticationError())).toBe(true);
            expect(isApplicationError(new NotFoundError('Resource'))).toBe(true);
        });

        it('should return false for regular Error', () => {
            const error = new Error('Regular error');
            expect(isApplicationError(error)).toBe(false);
        });

        it('should return false for non-errors', () => {
            expect(isApplicationError('string')).toBe(false);
            expect(isApplicationError(null)).toBe(false);
            expect(isApplicationError(undefined)).toBe(false);
            expect(isApplicationError({})).toBe(false);
        });
    });

    describe('getStatusCode', () => {
        it('should return status code for ApplicationError', () => {
            expect(getStatusCode(new ValidationError('Invalid'))).toBe(400);
            expect(getStatusCode(new AuthenticationError())).toBe(401);
            expect(getStatusCode(new NotFoundError('Resource'))).toBe(404);
            expect(getStatusCode(new RateLimitError())).toBe(429);
            expect(getStatusCode(new ServiceError())).toBe(500);
        });

        it('should return 500 for regular Error', () => {
            expect(getStatusCode(new Error('Regular'))).toBe(500);
        });

        it('should return 500 for non-errors', () => {
            expect(getStatusCode('string')).toBe(500);
            expect(getStatusCode(null)).toBe(500);
        });
    });

    describe('errorToResponse', () => {
        it('should create Response from ApplicationError', () => {
            const error = new ValidationError('Invalid input', { field: 'name' });
            const response = errorToResponse(error);
            expect(response.status).toBe(400);
        });

        it('should create Response from regular Error', () => {
            const error = new Error('Something failed');
            const response = errorToResponse(error);
            expect(response.status).toBe(500);
        });

        it('should create Response from unknown error', () => {
            const response = errorToResponse('string error');
            expect(response.status).toBe(500);
        });

        it('should include error details in response body for ApplicationError', async () => {
            const error = new NotFoundError('User', 123);
            const response = errorToResponse(error);
            const body = await response.json() as { error: string; message: string };
            expect(body.error).toBe('NOT_FOUND');
            expect(body.message).toContain('User');
        });
    });
});
