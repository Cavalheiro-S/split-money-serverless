import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { z } from 'zod';
import { RecurringTransactionService } from '../../services/recurring-transaction.service';
import { createErrorLogger } from '../../utils/error-logger';

const schema = z.object({
  startDate: z.string().optional(),
});

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
  const errorLogger = createErrorLogger({
    requestId: event.requestContext.requestId,
    userId: event.requestContext.authorizer.jwt.claims.sub as string,
    functionName: 'get-recurring-transactions',
  });

  try {
    const filters = schema.parse(event.queryStringParameters || {});
    const userId = event.requestContext.authorizer.jwt.claims.sub as string;

    const result = await RecurringTransactionService.getRecurringTransactions(
      userId,
      filters
    );

    if (!result.success) {
      errorLogger.functionError('get-recurring-transactions', result.error, {
        queryParams: event.queryStringParameters,
      });

      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error fetching recurring transactions',
          error:
            result.error instanceof Error
              ? result.error.message
              : 'Database error',
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Recurring transactions retrieved successfully',
        data: result.data,
        count: result.data?.length || 0,
      }),
    };
  } catch (error) {
    errorLogger.functionError('get-recurring-transactions', error, {
      queryParams: event.queryStringParameters,
    });

    if (error instanceof z.ZodError) {
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
