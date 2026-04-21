import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { supabase } from '../../libs/supabase';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
  try {
    const { id } = event.pathParameters || {};
    if (!id) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Missing goal id' }) };
    }

    const sub = event.requestContext.authorizer.jwt.claims.sub as string;

    const { data: existing, error: checkError } = await (supabase as any)
      .from('goals')
      .select('id')
      .eq('id', id)
      .eq('user_id', sub)
      .single();

    if (checkError || !existing) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Goal not found' }) };
    }

    const { error } = await (supabase as any)
      .from('goals')
      .delete()
      .eq('id', id)
      .eq('user_id', sub);

    if (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Error deleting goal', error: error.message }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Goal deleted successfully' }),
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
