import { APIGatewayProxyResult } from 'aws-lambda';

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface StatsMetadata {
  [key: string]: number | string | boolean;
}

export class ResponseBuilder {
  /**
   * Build a success response (200 OK)
   */
  static ok<T>(
    data: T,
    metadata?: {
      pagination?: PaginationMetadata;
      stats?: StatsMetadata;
    }
  ): APIGatewayProxyResult {
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data,
        ...(metadata?.pagination && { pagination: metadata.pagination }),
        ...(metadata?.stats && { stats: metadata.stats }),
      }),
    };
  }

  /**
   * Build a created response (201 Created)
   */
  static created<T>(data: T, message?: string): APIGatewayProxyResult {
    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        message: message || 'Resource created successfully',
        data,
      }),
    };
  }

  /**
   * Build a no content response (204 No Content)
   */
  static noContent(): APIGatewayProxyResult {
    return {
      statusCode: 204,
      body: '',
    };
  }

  /**
   * Build a bad request response (400 Bad Request)
   */
  static badRequest(
    message: string,
    errors?: Record<string, unknown>
  ): APIGatewayProxyResult {
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message,
          ...(errors && { details: errors }),
        },
      }),
    };
  }

  /**
   * Build an unauthorized response (401 Unauthorized)
   */
  static unauthorized(message?: string): APIGatewayProxyResult {
    return {
      statusCode: 401,
      body: JSON.stringify({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: message || 'Authentication required',
        },
      }),
    };
  }

  /**
   * Build a forbidden response (403 Forbidden)
   */
  static forbidden(message?: string): APIGatewayProxyResult {
    return {
      statusCode: 403,
      body: JSON.stringify({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: message || 'Access denied',
        },
      }),
    };
  }

  /**
   * Build a not found response (404 Not Found)
   */
  static notFound(resource?: string): APIGatewayProxyResult {
    return {
      statusCode: 404,
      body: JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: resource ? `${resource} not found` : 'Resource not found',
        },
      }),
    };
  }

  /**
   * Build a conflict response (409 Conflict)
   */
  static conflict(message: string, code?: string): APIGatewayProxyResult {
    return {
      statusCode: 409,
      body: JSON.stringify({
        success: false,
        error: {
          code: code || 'CONFLICT',
          message,
        },
      }),
    };
  }

  /**
   * Build an internal server error response (500 Internal Server Error)
   */
  static internalError(
    message?: string,
    requestId?: string
  ): APIGatewayProxyResult {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: message || 'An unexpected error occurred',
          ...(requestId && { requestId }),
        },
      }),
    };
  }

  /**
   * Build a custom response
   */
  static custom(
    statusCode: number,
    body: Record<string, unknown>
  ): APIGatewayProxyResult {
    return {
      statusCode,
      body: JSON.stringify(body),
    };
  }
}
