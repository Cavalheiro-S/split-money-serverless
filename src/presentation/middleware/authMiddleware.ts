import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { ResponseBuilder } from '../utils/ResponseBuilder';

export interface AuthenticatedEvent extends APIGatewayProxyEvent {
  userId: string;
}

export type AuthenticatedHandler = (
  event: AuthenticatedEvent
) => Promise<APIGatewayProxyResult>;

export type AsyncHandler = (
  event: APIGatewayProxyEvent
) => Promise<APIGatewayProxyResult>;

/**
 * Middleware to extract and validate user ID from JWT claims
 * Wraps a handler function and injects authenticated userId into the event
 *
 * @param handler - The handler function to wrap
 * @returns Wrapped handler with authentication
 *
 * @example
 * export const handler = withAuth(async (event: AuthenticatedEvent) => {
 *   const userId = event.userId; // Available and validated
 *   // ... handler logic
 * });
 */
export function withAuth(handler: AuthenticatedHandler): AsyncHandler {
  return async (
    event: APIGatewayProxyEvent
  ): Promise<APIGatewayProxyResult> => {
    try {
      // Extract userId from JWT claims (Cognito authorizer)
      const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;

      // Validate userId
      if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
        return ResponseBuilder.unauthorized(
          'Invalid or missing authentication token'
        );
      }

      // Inject userId into event
      const authenticatedEvent: AuthenticatedEvent = {
        ...event,
        userId,
      };

      // Call the handler with authenticated event
      return await handler(authenticatedEvent);
    } catch (error) {
      // Log error (in production, use proper logging)
      console.error('Authentication middleware error:', error);

      // Return unauthorized response
      return ResponseBuilder.unauthorized('Authentication failed');
    }
  };
}

/**
 * Extract userId from event (for use in handlers that don't use withAuth yet)
 * @deprecated Use withAuth middleware instead
 */
export function extractUserId(event: APIGatewayProxyEvent): string | null {
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;

  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    return null;
  }

  return userId;
}
