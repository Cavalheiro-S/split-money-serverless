import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { supabase } from '../../libs/supabase';
import { Database } from '../../types/database/database.type';

type Tables = Database['public']['Tables'];
type GoalInsert = Tables['goals']['Insert'];

const schema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  targetAmount: z.number().positive(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'deadline must be YYYY-MM-DD'),
});

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { success, data, error } = schema.safeParse(body);

    if (!success) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid data', error }),
      };
    }

    const sub = event.requestContext.authorizer.jwt.claims.sub as string;

    const payload: GoalInsert = {
      id: uuidv4(),
      user_id: sub,
      title: data.title,
      description: data.description ?? null,
      target_amount: data.targetAmount,
      deadline: data.deadline,
    };

    const { data: goal, error: insertError } = await (supabase as any)
      .from('goals')
      .insert(payload)
      .select()
      .single();

    if (insertError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Error creating goal', error: insertError.message }),
      };
    }

    return {
      statusCode: 201,
      body: JSON.stringify({ message: 'Goal created successfully', data: goal }),
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
