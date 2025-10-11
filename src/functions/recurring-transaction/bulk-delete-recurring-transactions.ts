import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { RecurringTransactionService } from '../../services/recurring-transaction.service';
import { createErrorLogger } from '../../utils/error-logger';

interface BulkDeleteRequest {
  ids: string[];
}

interface BulkDeleteResult {
  success: string[];
  failed: Array<{
    id: string;
    reason: string;
  }>;
}

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
  const errorLogger = createErrorLogger({
    requestId: event.requestContext.requestId,
    userId: event.requestContext.authorizer.jwt.claims.sub as string,
    functionName: 'bulk-delete-recurring-transactions',
  });

  try {
    const userId = event.requestContext.authorizer.jwt.claims.sub as string;

    // Parse request body
    let requestBody: BulkDeleteRequest;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid JSON in request body',
        }),
      };
    }

    const { ids } = requestBody;

    // Validations
    if (!ids || !Array.isArray(ids)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Request body must contain an array of IDs',
        }),
      };
    }

    if (ids.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'IDs array cannot be empty',
        }),
      };
    }

    if (ids.length > 50) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Maximum 50 IDs allowed per request',
        }),
      };
    }

    // Validate all IDs are strings
    if (!ids.every(id => typeof id === 'string')) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'All IDs must be strings',
        }),
      };
    }

    const result: BulkDeleteResult = {
      success: [],
      failed: [],
    };

    // Process each ID individually
    for (const id of ids) {
      try {
        const deleteResult =
          await RecurringTransactionService.deleteRecurringTransaction(
            id,
            userId
          );

        if (!deleteResult.success) {
          const errorMessage =
            deleteResult.error instanceof Error
              ? deleteResult.error.message
              : 'Error deleting recurring transaction';

          result.failed.push({
            id,
            reason: errorMessage,
          });

          errorLogger.functionError(
            'bulk-delete-recurring-transaction-item',
            deleteResult.error,
            {
              recurringId: id,
            }
          );
        } else {
          result.success.push(id);
        }
      } catch (error) {
        result.failed.push({
          id,
          reason:
            error instanceof Error
              ? error.message
              : 'Unexpected error during deletion',
        });

        errorLogger.functionError(
          'bulk-delete-recurring-transaction-item',
          error,
          {
            recurringId: id,
          }
        );
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Bulk delete operation completed',
        info: 'Existing real transactions remain intact. Virtual transactions will no longer be generated.',
        summary: {
          total: ids.length,
          succeeded: result.success.length,
          failed: result.failed.length,
        },
        results: result,
      }),
    };
  } catch (error) {
    errorLogger.functionError('bulk-delete-recurring-transactions', error, {
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
