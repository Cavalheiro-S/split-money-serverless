import {
  AdminDeleteUserCommand,
  CodeDeliveryFailureException,
  InvalidPasswordException,
} from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { z } from 'zod';
import { cognitoClient } from '../../libs/cognito';
import { supabase } from '../../libs/supabase';

const schema = z.object({
  email: z.string().email(),
  id: z.string(),
  name: z.string().min(2),
});

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const { success, data, error } = schema.safeParse(
      JSON.parse(event.body || '{}')
    );
    if (!success) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid request body',
          error: error.issues,
        }),
      };
    }

    const response = await supabase.from('users').insert({
      id: data.id,
      email: data.email,
      name: data.name,
      login_method: 'cognito',
      updated_at: new Date(),
    });

    if (response.error) {
      await cognitoClient.send(
        new AdminDeleteUserCommand({
          UserPoolId: process.env.COGNITO_USERPOOL_ID,
          Username: data.email,
        })
      );

      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Error creating user',
          error: response.error,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Created new User',
        userId: data.id,
      }),
    };
  } catch (error) {
    if (error instanceof InvalidPasswordException) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid Password',
          error,
        }),
      };
    }

    if (error instanceof CodeDeliveryFailureException) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Code Delivery Failure',
          error,
        }),
      };
    }
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error creating user',
        error,
      }),
    };
  }
};
