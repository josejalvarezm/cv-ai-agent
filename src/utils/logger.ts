/**
 * Structured Logging System
 *
 * Phase 3: Polish & Polish
 *
 * Provides structured, category-aware logging with severity levels.
 * Supports both local logging and analytics integration.
 *
 * Features:
 * - Category-based organization (API, Service, Repository, Cache, Vector, Database)
 * - Severity levels (debug, info, warn, error)
 * - Context tracking (request ID, correlation ID)
 * - Performance metrics (duration, operations count)
 * - Analytics integration ready
 */

type LogSeverity = 'debug' | 'info' | 'warn' | 'error';

type LogCategory =
  | 'API'
  | 'Service'
  | 'Repository'
  | 'Cache'
  | 'Vector'
  | 'Database'
  | 'Auth'
  | 'Performance'
  | 'Error';

interface LogContext {
  requestId?: string;
  correlationId?: string;
  userId?: string;
  handler?: string;
}

interface LogMetadata {
  category: LogCategory;
  severity: LogSeverity;
  timestamp: string;
  context?: LogContext;
  duration?: number; // milliseconds
  operationCount?: number;
  metadata?: Record<string, any>;
}

interface LogEntry extends LogMetadata {
  message: string;
}

/**
 * Structured Logger
 */
export class Logger {
  private static instance: Logger;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private format(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const severity = entry.severity.toUpperCase().padEnd(5);
    const category = `[${entry.category}]`.padEnd(12);
    const context = entry.context?.requestId ? ` (${entry.context.requestId})` : '';
    return `${timestamp} ${severity} ${category} ${entry.message}${context}`;
  }

  private async sendToAnalytics(_entry: LogEntry): Promise<void> {
    // Integration point for analytics
    // In production, send to analytics service
    // Example: await fetch('/__analytics/log', { method: 'POST', body: JSON.stringify(_entry) })
  }

  private log(
    message: string,
    severity: LogSeverity,
    category: LogCategory,
    options: {
      context?: LogContext;
      duration?: number;
      operationCount?: number;
      metadata?: Record<string, any>;
    } = {}
  ): void {
    const entry: LogEntry = {
      message,
      severity,
      category,
      timestamp: new Date().toISOString(),
      context: options.context,
      duration: options.duration,
      operationCount: options.operationCount,
      metadata: options.metadata,
    };

    const formatted = this.format(entry);

    // Console output
    switch (severity) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }

    // Send to analytics
    this.sendToAnalytics(entry).catch((err) => {
      console.error('Failed to send log to analytics:', err);
    });
  }

  // API Logging
  api(message: string, context?: LogContext): void {
    this.log(message, 'info', 'API', { context });
  }

  apiError(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    this.log(message, 'error', 'API', { context, metadata });
  }

  apiRequest(method: string, path: string, context?: LogContext): void {
    this.log(`${method} ${path}`, 'debug', 'API', { context });
  }

  apiResponse(method: string, path: string, statusCode: number, duration: number, context?: LogContext): void {
    this.log(`${method} ${path} ${statusCode}`, 'info', 'API', { context, duration });
  }

  // Service Logging
  service(message: string, context?: LogContext): void {
    this.log(message, 'info', 'Service', { context });
  }

  serviceError(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    this.log(message, 'error', 'Service', { context, metadata });
  }

  serviceOperation(operation: string, duration: number, operationCount: number = 1, context?: LogContext): void {
    this.log(`${operation} completed`, 'debug', 'Service', { context, duration, operationCount });
  }

  // Repository Logging
  repository(message: string, context?: LogContext): void {
    this.log(message, 'debug', 'Repository', { context });
  }

  repositoryError(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    this.log(message, 'error', 'Repository', { context, metadata });
  }

  // Cache Logging
  cacheHit(key: string, context?: LogContext): void {
    this.log(`Cache hit: ${key}`, 'debug', 'Cache', { context });
  }

  cacheMiss(key: string, context?: LogContext): void {
    this.log(`Cache miss: ${key}`, 'debug', 'Cache', { context });
  }

  cacheError(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    this.log(message, 'warn', 'Cache', { context, metadata });
  }

  // Vector Store Logging
  vector(message: string, context?: LogContext): void {
    this.log(message, 'debug', 'Vector', { context });
  }

  vectorError(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    this.log(message, 'error', 'Vector', { context, metadata });
  }

  vectorOperation(operation: string, count: number, duration: number, context?: LogContext): void {
    this.log(`${operation} ${count} vectors in ${duration}ms`, 'info', 'Vector', {
      context,
      duration,
      operationCount: count,
    });
  }

  // Database Logging
  database(message: string, context?: LogContext): void {
    this.log(message, 'debug', 'Database', { context });
  }

  databaseError(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    this.log(message, 'error', 'Database', { context, metadata });
  }

  databaseQuery(query: string, duration: number, context?: LogContext): void {
    this.log(`Query executed in ${duration}ms`, 'debug', 'Database', { context, duration, metadata: { query } });
  }

  // Authentication Logging
  auth(message: string, context?: LogContext): void {
    this.log(message, 'info', 'Auth', { context });
  }

  authError(message: string, context?: LogContext): void {
    this.log(message, 'warn', 'Auth', { context });
  }

  // Performance Logging
  performance(operation: string, duration: number, context?: LogContext): void {
    const severity = duration > 1000 ? 'warn' : 'info';
    this.log(`${operation} took ${duration}ms`, severity, 'Performance', { context, duration });
  }

  // Error Logging
  error(message: string, error: unknown, context?: LogContext): void {
    const details = error instanceof Error ? error.message : String(error);
    this.log(`${message}: ${details}`, 'error', 'Error', { context, metadata: { error: details } });
  }
}

/**
 * Get logger instance (singleton)
 */
export function getLogger(): Logger {
  return Logger.getInstance();
}

/**
 * Create context object for request tracking
 */
export function createContext(
  requestId: string,
  options?: { correlationId?: string; userId?: string; handler?: string }
): LogContext {
  return {
    requestId,
    correlationId: options?.correlationId,
    userId: options?.userId,
    handler: options?.handler,
  };
}

/**
 * Performance timer utility
 */
export class Timer {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  duration(): number {
    return Date.now() - this.startTime;
  }

  log(operation: string, context?: LogContext): void {
    getLogger().performance(operation, this.duration(), context);
  }

  logOperation(operation: string, count?: number, context?: LogContext): void {
    getLogger().serviceOperation(operation, this.duration(), count, context);
  }
}
