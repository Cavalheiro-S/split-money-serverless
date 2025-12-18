import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

import { supabase } from '../../libs/supabase';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
  try {
    const { id } = event.pathParameters || {};
    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid id',
        }),
      };
    }

    const userId = event.requestContext.authorizer.jwt.claims.sub;
    if (!userId || typeof userId !== 'string' || userId.length === 0) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          message: 'Unauthorized',
        }),
      };
    }

    // First check if the payment status exists and belongs to the user
    const { data: existingPaymentStatus, error: fetchError } = await supabase
      .from('payment_status')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existingPaymentStatus) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: 'Payment status not found or unauthorized',
          error: fetchError,
        }),
      };
    }

    // Check if there are any transactions using this payment status
    const {
      data: transactionsUsingPaymentStatus,
      error: transactionCheckError,
    } = await supabase
      .from('transactions')
      .select('id')
      .eq('payment_status_id', id)
      .eq('user_id', userId)
      .limit(1);

    if (transactionCheckError) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error checking payment status dependencies',
          error: transactionCheckError,
        }),
      };
    }

    if (
      transactionsUsingPaymentStatus &&
      transactionsUsingPaymentStatus.length > 0
    ) {
      return {
        statusCode: 409,
        body: JSON.stringify({
          message: 'Cannot delete payment status with dependent transactions',
          code: 'PAYMENT_STATUS_HAS_DEPENDENT_TRANSACTIONS',
        }),
      };
    }

    const response = await supabase
      .from('payment_status')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (response.error) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Error delete payment status',
          error: response.error,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Payment status deleted successfully',
        id,
      }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Error delete payment status',
        error,
      }),
    };
  }
};
