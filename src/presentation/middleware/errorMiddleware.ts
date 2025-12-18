import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { ErrorLogger } from '../../utils/error-logger';
import { ResponseBuilder } from '../utils/ResponseBuilder';

const errorLogger = new ErrorLogger();

/**
 * Custom application errors
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource?: string) {
    super(
      404,
      'NOT_FOUND',
      resource ? `${resource} not found` : 'Resource not found'
    );
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, 'FORBIDDEN', message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code?: string) {
    super(409, code || 'CONFLICT', message);
    this.name = 'ConflictError';
  }
}

export type AsyncHandler = (
  event: APIGatewayProxyEvent
) => Promise<APIGatewayProxyResult>;

/**
 * Middleware to handle errors and convert them to appropriate HTTP responses
 * Uses ErrorLogger for structured logging
 *
 * @param handler - The handler function to wrap
 * @returns Wrapped handler with error handling
 *
 * @example
 * export const handler = withErrorHandling(async (event) => {
 *   // If this throws, errorMiddleware will catch and format the response
 *   throw new NotFoundError('Category');
 * });
 */
export function withErrorHandling(handler: AsyncHandler): AsyncHandler {
  return async (
    event: APIGatewayProxyEvent
  ): Promise<APIGatewayProxyResult> => {
    const requestId = event.requestContext?.requestId;
    const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown';

    try {
      return await handler(event);
    } catch (error) {
      // Handle known AppError types
      if (error instanceof AppError) {
        errorLogger.functionError(functionName, error, {
          requestId,
          statusCode: error.statusCode,
          code: error.code,
        });

        return ResponseBuilder.custom(error.statusCode, {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            ...(error.details && { details: error.details }),
            ...(requestId && { requestId }),
          },
        });
      }

      // Handle Zod validation errors
      if (error && typeof error === 'object' && 'issues' in error) {
        const zodError = error as {
          issues: Array<{ path: string[]; message: string }>;
        };
        const validationErrors = zodError.issues.reduce(
          (acc, issue) => {
            const field = issue.path.join('.');
            acc[field] = issue.message;
            return acc;
          },
          {} as Record<string, string>
        );

        errorLogger.validationError(
          'request_body',
          event.body,
          'zod_schema',
          error
        );

        return ResponseBuilder.badRequest(
          'Validation failed',
          validationErrors
        );
      }

      // Handle Supabase errors
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        'message' in error
      ) {
        const dbError = error as { code: string; message: string };

        errorLogger.databaseError('UNKNOWN_OPERATION', 'unknown', error);

        // Map common Supabase error codes
        if (dbError.code === 'PGRST116') {
          return ResponseBuilder.notFound();
        }

        if (dbError.code === '23505') {
          // Unique violation
          return ResponseBuilder.conflict(
            'Resource already exists',
            'DUPLICATE'
          );
        }

        if (dbError.code === '23503') {
          // Foreign key violation
          return ResponseBuilder.conflict(
            'Operation would violate data integrity',
            'FOREIGN_KEY_VIOLATION'
          );
        }
      }

      // Handle unknown errors
      errorLogger.functionError(functionName, error, { requestId });

      // Don't expose internal error details in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      const errorMessage =
        isDevelopment && error instanceof Error ? error.message : undefined;

      return ResponseBuilder.internalError(errorMessage, requestId);
    }
  };
}

/**
 * Combine multiple middleware functions
 *
 * @param middlewares - Array of middleware functions
 * @returns Combined middleware function
 *
 * @example
 * export const handler = compose([
 *   withAuth,
 *   withErrorHandling
 * ])(async (event: AuthenticatedEvent) => {
 *   // Handler logic
 * });
 */
export function compose(
  middlewares: Array<(handler: AsyncHandler) => AsyncHandler>
): (handler: AsyncHandler) => AsyncHandler {
  return (handler: AsyncHandler) => {
    return middlewares.reduceRight(
      (acc, middleware) => middleware(acc),
      handler
    );
  };
}
