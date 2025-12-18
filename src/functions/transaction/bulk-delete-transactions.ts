import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

import { supabase } from '../../libs/supabase';
import { Database } from '../../types/database/database.type';

type Tables = Database['public']['Tables'];

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
  try {
    const sub = event.requestContext.authorizer.jwt.claims.sub as string;

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

    // Track recurring_transaction_ids that might need cleanup
    const recurringTransactionsToCheck = new Set<string>();

    // Process each ID individually
    for (const id of ids) {
      try {
        // Check if transaction exists and belongs to user
        const { data: existingTransaction, error: checkError } = (await supabase
          .from('transactions')
          .select('id, recurrent_transaction_id')
          .eq('id', id)
          .eq('user_id', sub)
          .single()) as {
          data: { id: string; recurrent_transaction_id: string | null } | null;
          error: any;
        };

        if (checkError || !existingTransaction) {
          result.failed.push({
            id,
            reason: 'Transaction not found or access denied',
          });
          continue;
        }

        // Store recurring_transaction_id for later cleanup
        if (existingTransaction.recurrent_transaction_id) {
          recurringTransactionsToCheck.add(
            existingTransaction.recurrent_transaction_id
          );
        }

        // Delete the transaction
        const { error: deleteError } = await supabase
          .from('transactions')
          .delete()
          .eq('id', id)
          .eq('user_id', sub);

        if (deleteError) {
          result.failed.push({
            id,
            reason: 'Error deleting transaction',
          });
          continue;
        }

        result.success.push(id);
      } catch (error) {
        result.failed.push({
          id,
          reason:
            error instanceof Error
              ? error.message
              : 'Unexpected error during deletion',
        });
      }
    }

    // Cleanup orphaned recurring_transactions
    for (const recurringId of recurringTransactionsToCheck) {
      try {
        const { data: remainingTransactions } = await supabase
          .from('transactions')
          .select('id')
          .eq('recurrent_transaction_id', recurringId)
          .eq('user_id', sub);

        if (!remainingTransactions || remainingTransactions.length === 0) {
          await supabase
            .from('recurring_transactions')
            .delete()
            .eq('id', recurringId)
            .eq('user_id', sub);
        }
      } catch (error) {
        // Log but don't fail the request if cleanup fails
        console.error(
          `Failed to cleanup recurring_transaction ${recurringId}:`,
          error
        );
      }
    }

    // Return response
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Bulk delete operation completed',
        summary: {
          total: ids.length,
          succeeded: result.success.length,
          failed: result.failed.length,
        },
        results: result,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
