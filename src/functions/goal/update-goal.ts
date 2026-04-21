import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { z } from 'zod';
import { supabase } from '../../libs/supabase';
import { Database } from '../../types/database/database.type';

type Tables = Database['public']['Tables'];
type GoalUpdate = Tables['goals']['Update'];

const schema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  targetAmount: z.number().positive().optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
  try {
    const { id } = event.pathParameters || {};
    if (!id) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Missing goal id' }) };
    }

    const body = JSON.parse(event.body || '{}');
    const { success, data, error } = schema.safeParse(body);

    if (!success) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Invalid data', error }) };
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

    const payload: GoalUpdate = {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.targetAmount !== undefined && { target_amount: data.targetAmount }),
      ...(data.deadline !== undefined && { deadline: data.deadline }),
      updated_at: new Date(),
    };

    const { data: updated, error: updateError } = await (supabase as any)
      .from('goals')
      .update(payload)
      .eq('id', id)
      .eq('user_id', sub)
      .select()
      .single();

    if (updateError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Error updating goal', error: updateError.message }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Goal updated successfully', data: updated }),
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
