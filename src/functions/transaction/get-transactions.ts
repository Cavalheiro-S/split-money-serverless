import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { z } from 'zod';
import { TransactionService } from '../../services/transaction.service';
import { Database } from '../../types/database/database.type';
import { createErrorLogger } from '../../utils/error-logger';

type Tables = Database['public']['Tables'];
type Transaction = Tables['transactions']['Row'];

const schema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
  type: z.enum(['income', 'outcome']).optional(),
  date: z.string().optional(),
  status: z.string().optional(),
  categoryId: z.string().optional(),
  tagId: z.string().optional(),
  sortBy: z
    .enum([
      'description',
      'date',
      'amount',
      'type',
      'category',
      'tag',
      'payment_status',
    ])
    .optional()
    .default('date'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
  const errorLogger = createErrorLogger({
    requestId: event.requestContext.requestId,
    userId: event.requestContext.authorizer.jwt.claims.sub as string,
    functionName: 'get-transactions',
  });

  try {
    const filters = schema.parse(event.queryStringParameters || {});
    const sub = event.requestContext.authorizer.jwt.claims.sub as string;
    const service = new TransactionService();
    const { data, pagination } = await service.get({ ...filters, userId: sub });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Get Transactions',
        data,
        pagination,
      }),
    };
  } catch (error) {
    errorLogger.functionError('get-transactions', error, {
      queryParams: event.queryStringParameters,
    });

    // Return appropriate error response
    if (error instanceof z.ZodError) {
      errorLogger.validationError(
        'query parameters',
        event.queryStringParameters,
        'schema validation',
        error
      );

      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid query parameters',
          error: 'Validation error',
          details: error.issues,
        }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: event.requestContext.requestId,
      }),
    };
  }
};
