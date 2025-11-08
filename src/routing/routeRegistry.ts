/**
 * Route Registry Pattern
 *
 * Addresses Open/Closed Principle (OCP) by providing extensible routing
 * without modifying the main entry point.
 *
 * Before: Hard-coded if-else chains in index.ts
 * After: Declarative route registration, closed for modification
 *
 * Benefits:
 * - Add new routes without modifying index.ts
 * - Type-safe route definitions
 * - Centralized routing configuration
 * - Easy to test: routes are data, not logic
 */

// Environment types available for type hints in handler signatures
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { type QueryEnv, type IndexEnv, type SessionEnv, type HealthEnv, type QuotaEnv, type AnalyticsHandlerEnv } from '../types/env';

/**
 * Route handler function signature
 */
export type RouteHandler = (
  request: Request,
  env: any,
  ctx: ExecutionContext
) => Promise<Response>;

/**
 * Route definition
 */
export interface Route {
  path: string;
  method: 'GET' | 'POST' | 'OPTIONS' | 'PUT' | 'DELETE';
  handler: RouteHandler;
  requiresAuth?: boolean;
}

/**
 * Route Registry
 * Manages route definitions and dispatching
 */
export class RouteRegistry {
  private routes: Route[] = [];

  /**
   * Register a route
   */
  register(path: string, method: string, handler: RouteHandler, requiresAuth = true): void {
    this.routes.push({
      path,
      method: method as 'GET' | 'POST' | 'OPTIONS' | 'PUT' | 'DELETE',
      handler,
      requiresAuth,
    });
  }

  /**
   * Find a route by method and path
   */
  findRoute(method: string, path: string): Route | undefined {
    return this.routes.find((r) => r.method === method && r.path === path);
  }

  /**
   * Dispatch request to matching route
   */
  async dispatch(
    request: Request,
    _env: any,
    _ctx: ExecutionContext,
    _onNotFound: () => Promise<Response>
  ): Promise<Route | undefined> {
    const url = new URL(request.url);
    const route = this.findRoute(request.method, url.pathname);
    if (!route) {
      return undefined;
    }
    return route;
  }

  /**
   * Get all registered routes
   */
  getRoutes(): Route[] {
    return [...this.routes];
  }

  /**
   * Get routes by pattern (for debugging)
   */
  getRoutesByPattern(pattern: string): Route[] {
    const regex = new RegExp(pattern);
    return this.routes.filter((r) => regex.test(r.path));
  }
}

/**
 * Factory function to create and configure route registry
 * This is where all routes are declared
 */
export function createRouteRegistry(handlers: {
  handleSession: RouteHandler;
  handleIndex: RouteHandler;
  handleQuery: RouteHandler;
  handleAdminQuota: RouteHandler;
  handleQuotaStatus: RouteHandler;
  handleQuotaReset: RouteHandler;
  handleQuotaSync: RouteHandler;
  handleHealth: RouteHandler;
  handleDebugVector: RouteHandler;
  handleIds: RouteHandler;
  handleIndexProgress: RouteHandler;
  handleIndexResume: RouteHandler;
  handleIndexStop: RouteHandler;
}): RouteRegistry {
  const registry = new RouteRegistry();

  // Query endpoints
  registry.register('/query', 'GET', handlers.handleQuery, true);
  registry.register('/query', 'POST', handlers.handleQuery, true);

  // Indexing endpoints
  registry.register('/index', 'POST', handlers.handleIndex, true);
  registry.register('/index/progress', 'GET', handlers.handleIndexProgress, true);
  registry.register('/index/resume', 'POST', handlers.handleIndexResume, true);
  registry.register('/index/stop', 'POST', handlers.handleIndexStop, true);

  // Session endpoints
  registry.register('/session', 'POST', handlers.handleSession, false);

  // Health endpoints
  registry.register('/health', 'GET', handlers.handleHealth, false);
  registry.register('/', 'GET', handlers.handleHealth, false);

  // Quota endpoints
  registry.register('/quota', 'GET', handlers.handleQuotaStatus, false);
  registry.register('/quota/reset', 'POST', handlers.handleQuotaReset, false);
  registry.register('/quota/sync', 'POST', handlers.handleQuotaSync, false);
  registry.register('/admin/quota', 'GET', handlers.handleAdminQuota, false);

  // Debug endpoints
  registry.register('/debug/vector', 'GET', handlers.handleDebugVector, true);
  registry.register('/ids', 'GET', handlers.handleIds, true);

  return registry;
}
