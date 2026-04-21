import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { supabase } from '../../libs/supabase';
import { Database } from '../../types/database/database.type';

type Tables = Database['public']['Tables'];
type ContributionInsert = Tables['goal_contributions']['Insert'];

const schema = z.object({
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  note: z.string().optional(),
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

    const { data: goal, error: goalError } = await (supabase as any)
      .from('goals')
      .select('id')
      .eq('id', id)
      .eq('user_id', sub)
      .single();

    if (goalError || !goal) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Goal not found' }) };
    }

    const payload: ContributionInsert = {
      id: uuidv4(),
      goal_id: id,
      user_id: sub,
      amount: data.amount,
      date: data.date,
      note: data.note ?? null,
    };

    const { data: contribution, error: insertError } = await (supabase as any)
      .from('goal_contributions')
      .insert(payload)
      .select()
      .single();

    if (insertError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Error creating contribution', error: insertError.message }),
      };
    }

    return {
      statusCode: 201,
      body: JSON.stringify({ message: 'Contribution created successfully', data: contribution }),
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
