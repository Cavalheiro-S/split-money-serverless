import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { supabase } from '../../libs/supabase';
import { Database } from '../../types/database/database.type';

type Tables = Database['public']['Tables'];
type PaymentStatus = Tables['payment_status']['Row'];
type PaymentStatusInsert = Tables['payment_status']['Insert'];

const schema = z.object({
  description: z.string().min(3).max(50),
});

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { success, data, error } = schema.safeParse(body);
    if (error || !success) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid data',
          error,
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
    const id = uuidv4();
    const payload: PaymentStatusInsert = {
      id,
      description: data.description,
      updated_at: new Date(),
      user_id: userId,
    };

    const { data: paymentStatus, error: createError } = (await supabase
      .from('payment_status')
      .insert(payload)
      .select()
      .single()) as {
      data: PaymentStatus | null;
      error: any;
    };

    if (createError) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Error creating payment status',
          error: createError,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Create new payment status',
        data: paymentStatus,
      }),
    };
  } catch (error) {
    console.log({ error });

    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Error creating payment status',
        error,
      }),
    };
  }
};
