/**
 * Typed Error Handling
 *
 * Phase 3: Polish & Polish
 *
 * Provides typed error hierarchy for better error handling, tracking, and recovery.
 * Replaces generic Error throws with semantic application errors.
 *
 * Benefits:
 * - Type-safe error handling
 * - Better error tracking and logging
 * - Semantic status codes (400 vs 500 vs 503)
 * - Client-friendly error responses
 */

/**
 * Base Application Error
 * All application errors inherit from this
 */
export class ApplicationError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApplicationError';
    Object.setPrototypeOf(this, ApplicationError.prototype);
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      statusCode: this.statusCode,
      ...(this.details && { details: this.details }),
    };
  }
}

/**
 * Validation Error (400 Bad Request)
 * User provided invalid input
 */
export class ValidationError extends ApplicationError {
  constructor(message: string, details?: Record<string, any>) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Authentication Error (401 Unauthorized)
 * User not authenticated or session expired
 */
export class AuthenticationError extends ApplicationError {
  constructor(message: string = 'Unauthorized', details?: Record<string, any>) {
    super(401, 'AUTHENTICATION_ERROR', message, details);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Authorization Error (403 Forbidden)
 * User not authorized to perform action
 */
export class AuthorizationError extends ApplicationError {
  constructor(message: string = 'Forbidden', details?: Record<string, any>) {
    super(403, 'AUTHORIZATION_ERROR', message, details);
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * Not Found Error (404 Not Found)
 * Resource does not exist
 */
export class NotFoundError extends ApplicationError {
  constructor(resource: string, id?: string | number) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super(404, 'NOT_FOUND', message);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Conflict Error (409 Conflict)
 * Resource state conflict (e.g., duplicate, already locked)
 */
export class ConflictError extends ApplicationError {
  constructor(message: string, details?: Record<string, any>) {
    super(409, 'CONFLICT', message, details);
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * Rate Limit Error (429 Too Many Requests)
 * Too many requests from client
 */
export class RateLimitError extends ApplicationError {
  constructor(retryAfter: number = 60, details?: Record<string, any>) {
    super(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Too many requests. Please try again later.',
      { retryAfter, ...details }
    );
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Service Error (500 Internal Server Error)
 * Unexpected server error
 */
export class ServiceError extends ApplicationError {
  constructor(message: string = 'Internal server error', details?: Record<string, any>) {
    super(500, 'SERVICE_ERROR', message, details);
    this.name = 'ServiceError';
    Object.setPrototypeOf(this, ServiceError.prototype);
  }
}

/**
 * External Service Error (503 Service Unavailable)
 * External dependency unavailable
 */
export class ExternalServiceError extends ApplicationError {
  constructor(service: string, message?: string, details?: Record<string, any>) {
    const msg = message || `${service} is temporarily unavailable`;
    super(503, 'EXTERNAL_SERVICE_ERROR', msg, { service, ...details });
    this.name = 'ExternalServiceError';
    Object.setPrototypeOf(this, ExternalServiceError.prototype);
  }
}

/**
 * Database Error (500 Internal Server Error)
 * Database operation failed
 */
export class DatabaseError extends ApplicationError {
  constructor(operation: string, message?: string, details?: Record<string, any>) {
    const msg = message || `Database ${operation} failed`;
    super(500, 'DATABASE_ERROR', msg, { operation, ...details });
    this.name = 'DatabaseError';
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * Timeout Error (504 Gateway Timeout)
 * Operation timed out
 */
export class TimeoutError extends ApplicationError {
  constructor(operation: string, timeout: number) {
    super(504, 'TIMEOUT', `${operation} timed out after ${timeout}ms`);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Check if error is an ApplicationError
 */
export function isApplicationError(error: unknown): error is ApplicationError {
  return error instanceof ApplicationError;
}

/**
 * Get HTTP status code from error
 */
export function getStatusCode(error: unknown): number {
  if (isApplicationError(error)) {
    return error.statusCode;
  }
  return 500;
}

/**
 * Convert error to response
 */
export function errorToResponse(error: unknown): Response {
  let statusCode = 500;
  let body: any = { error: 'Internal server error' };

  if (isApplicationError(error)) {
    statusCode = error.statusCode;
    body = error.toJSON();
  } else if (error instanceof Error) {
    body = { error: 'Internal server error', message: error.message };
  }

  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
  });
}
