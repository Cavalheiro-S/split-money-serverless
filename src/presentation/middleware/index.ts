/**
 * Middleware exports
 * Centralized export for all middleware functions and utilities
 */

// Auth middleware
export {
  withAuth,
  extractUserId,
  AuthenticatedEvent,
  AuthenticatedHandler,
  AsyncHandler,
} from './authMiddleware';

// Error middleware
export {
  withErrorHandling,
  compose,
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from './errorMiddleware';

// Response builder
export {
  ResponseBuilder,
  PaginationMetadata,
  StatsMetadata,
} from '../utils/ResponseBuilder';

/**
 * Common middleware composition patterns
 */
import { AuthenticatedHandler, withAuth, AsyncHandler } from './authMiddleware';
import { withErrorHandling } from './errorMiddleware';

/**
 * Standard authenticated handler with error handling
 * Most common pattern for protected endpoints
 *
 * @example
 * export const handler = withStandardMiddleware(async (event: AuthenticatedEvent) => {
 *   const userId = event.userId;
 *   // Handler logic
 *   return ResponseBuilder.ok({ message: 'Success' });
 * });
 */
export function withStandardMiddleware(
  handler: AuthenticatedHandler
): AsyncHandler {
  return withErrorHandling(withAuth(handler));
}

/**
 * Public handler with only error handling
 * For endpoints that don't require authentication
 *
 * @example
 * export const handler = withPublicMiddleware(async (event) => {
 *   // Public handler logic
 *   return ResponseBuilder.ok({ message: 'Public endpoint' });
 * });
 */
export function withPublicMiddleware(handler: AsyncHandler): AsyncHandler {
  return withErrorHandling(handler);
}
