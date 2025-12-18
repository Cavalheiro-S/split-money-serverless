import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { getMonth, getYear } from 'date-fns';
import { z } from 'zod';

import { RecurringTransactionService } from '../../services/recurring-transaction.service';
import { createErrorLogger } from '../../utils/error-logger';

const schema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
  const errorLogger = createErrorLogger({
    requestId: event.requestContext.requestId,
    userId: event.requestContext.authorizer.jwt.claims.sub as string,
    functionName: 'trigger-create-recurring-transactions',
  });

  try {
    const queryParams = schema.parse(event.queryStringParameters || {});

    const now = new Date();
    const month = queryParams.month || getMonth(now) + 1;
    const year = queryParams.year || getYear(now);

    const result =
      await RecurringTransactionService.createScheduledTransactions(
        month,
        year
      );

    if (!result.success) {
      errorLogger.functionError(
        'trigger-create-recurring-transactions',
        result.error,
        {
          month,
          year,
        }
      );

      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error creating recurring transactions',
          error:
            result.error instanceof Error
              ? result.error.message
              : 'Unknown error',
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Recurring transactions created successfully',
        stats: result.stats,
        processedMonth: result.processedMonth,
      }),
    };
  } catch (error) {
    errorLogger.functionError('trigger-create-recurring-transactions', error, {
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
