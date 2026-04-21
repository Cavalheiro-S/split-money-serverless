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

    const { data: goal, error: goalError } = await (supabase as any)
      .from('goals')
      .select('id')
      .eq('id', id)
      .eq('user_id', sub)
      .single();

    if (goalError || !goal) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Goal not found' }) };
    }

    const { data, error } = await (supabase as any)
      .from('goal_contributions')
      .select('*')
      .eq('goal_id', id)
      .eq('user_id', sub)
      .order('date', { ascending: true });

    if (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Error fetching contributions', error: error.message }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Contributions fetched successfully', data: data ?? [] }),
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
