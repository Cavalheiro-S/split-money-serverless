import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { supabase } from '../../libs/supabase';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
  try {
    const { id, contribId } = event.pathParameters || {};
    if (!id || !contribId) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Missing goal id or contribution id' }) };
    }

    const sub = event.requestContext.authorizer.jwt.claims.sub as string;

    const { data: contribution, error: checkError } = await (supabase as any)
      .from('goal_contributions')
      .select('id')
      .eq('id', contribId)
      .eq('goal_id', id)
      .eq('user_id', sub)
      .single();

    if (checkError || !contribution) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Contribution not found' }) };
    }

    const { error } = await (supabase as any)
      .from('goal_contributions')
      .delete()
      .eq('id', contribId)
      .eq('user_id', sub);

    if (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Error deleting contribution', error: error.message }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Contribution deleted successfully' }),
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
