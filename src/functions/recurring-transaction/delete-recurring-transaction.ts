import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { RecurringTransactionService } from '../../services/recurring-transaction.service';
import { createErrorLogger } from '../../utils/error-logger';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
  const errorLogger = createErrorLogger({
    requestId: event.requestContext.requestId,
    userId: event.requestContext.authorizer.jwt.claims.sub as string,
    functionName: 'delete-recurring-transaction',
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

    const userId = event.requestContext.authorizer.jwt.claims.sub as string;

    const result = await RecurringTransactionService.deleteRecurringTransaction(
      id,
      userId
    );

    if (!result.success) {
      const errorMessage =
        result.error instanceof Error
          ? result.error.message
          : 'Error deleting recurring transaction';

      errorLogger.functionError('delete-recurring-transaction', result.error, {
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
        message: 'Recurring transaction deleted successfully',
        info: 'Existing real transactions remain intact. Virtual transactions will no longer be generated.',
        data: result.data,
      }),
    };
  } catch (error) {
    errorLogger.functionError('delete-recurring-transaction', error, {
      pathParams: event.pathParameters,
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
