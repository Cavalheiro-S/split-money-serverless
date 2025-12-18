import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { z } from 'zod';

import { RecurringTransactionService } from '../../services/recurring-transaction.service';
import { createErrorLogger } from '../../utils/error-logger';

const schema = z.object({
  description: z.string().optional(),
  type: z.enum(['income', 'outcome']).optional(),
  amount: z.number().optional(),
  recurrenceRule: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().nullable().optional(),
  note: z.string().optional(),
});

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
  const errorLogger = createErrorLogger({
    requestId: event.requestContext.requestId,
    userId: event.requestContext.authorizer.jwt.claims.sub as string,
    functionName: 'update-recurring-transaction',
  });

  try {
    const { id } = event.pathParameters || {};

    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid recurring transaction id',
        }),
      };
    }

    const body = JSON.parse(event.body || '{}');
    const { success, data, error } = schema.safeParse(body);

    if (error || !success) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid data',
          error: error?.errors,
        }),
      };
    }

    const userId = event.requestContext.authorizer.jwt.claims.sub as string;

    // Prepare update data
    const updateData: any = {};
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.recurrenceRule !== undefined)
      updateData.recurrence_rule = data.recurrenceRule;
    if (data.startDate !== undefined) updateData.start_date = data.startDate;
    if (data.endDate !== undefined) updateData.end_date = data.endDate;
    if (data.note !== undefined) updateData.note = data.note;

    const result = await RecurringTransactionService.updateRecurringTransaction(
      id,
      userId,
      updateData
    );

    if (!result.success) {
      const errorMessage =
        result.error instanceof Error
          ? result.error.message
          : 'Error updating recurring transaction';

      errorLogger.functionError('update-recurring-transaction', result.error, {
        recurringId: id,
      });

      if (
        result.error instanceof Error &&
        result.error.message.includes('not found')
      ) {
        return {
          statusCode: 404,
          body: JSON.stringify({
            message: errorMessage,
          }),
        };
      }

      return {
        statusCode: 500,
        body: JSON.stringify({
          message: errorMessage,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Recurring transaction updated successfully',
        info: 'Only the recurring transaction was updated. Existing real transactions remain unchanged.',
        data: result.data,
      }),
    };
  } catch (error) {
    errorLogger.functionError('update-recurring-transaction', error, {
      pathParams: event.pathParameters,
      body: event.body,
    });

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
