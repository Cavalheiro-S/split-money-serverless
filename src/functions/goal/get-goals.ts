import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { supabase } from '../../libs/supabase';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
  try {
    const sub = event.requestContext.authorizer.jwt.claims.sub as string;

    const { data: goals, error } = await (supabase as any)
      .from('goals')
      .select(`
        id,
        title,
        description,
        target_amount,
        deadline,
        created_at,
        goal_contributions(amount)
      `)
      .eq('user_id', sub)
      .order('deadline', { ascending: true });

    if (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Error fetching goals', error: error.message }),
      };
    }

    const data = (goals ?? []).map((g: any) => {
      const contributions: { amount: number }[] = g.goal_contributions ?? [];
      const currentAmount = contributions.reduce((sum, c) => sum + Number(c.amount), 0);
      return {
        id: g.id,
        title: g.title,
        description: g.description,
        targetAmount: Number(g.target_amount),
        deadline: g.deadline,
        createdAt: g.created_at,
        currentAmount,
        contributionCount: contributions.length,
      };
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Goals fetched successfully', data }),
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
