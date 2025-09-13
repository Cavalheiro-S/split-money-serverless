import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { supabase } from '../../libs/supabase';
import { Database } from '../../types/database/database.type';

type Tables = Database['public']['Tables'];
type Transaction = Tables['transactions']['Row'];

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

    const sub = event.requestContext.authorizer.jwt.claims.sub as string;

    const { data, error } = (await supabase
      .from('transactions')
      .select(
        `
        *,
        payment_status (*),
        categories (*),
        tags (*)
      `
      )
      .eq('id', id)
      .eq('user_id', sub) // ✅ Verificação de propriedade
      .single()) as {
      data:
        | (Transaction & {
            payment_status: Tables['payment_status']['Row'] | null;
            category: Tables['categories']['Row'] | null;
            tag: Tables['tags']['Row'] | null;
          })
        | null;
      error: any;
    };

    if (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error fetching transaction',
          error: error.message,
        }),
      };
    }

    if (!data) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: 'Transaction not found',
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Get Transaction By Id',
        data,
      }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error',
        error: error?.message,
      }),
    };
  }
};
