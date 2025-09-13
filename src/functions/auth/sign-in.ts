import {
  InitiateAuthCommand,
  NotAuthorizedException,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { cognitoClient } from '../../libs/cognito';
import { z } from 'zod';
import { AuthExceptions } from '../../enums/exceptions/auth';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const { data, success, error } = schema.safeParse(
      JSON.parse(event.body || '{}')
    );

    if (!success) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid input',
          error,
        }),
      };
    }

    const command = new InitiateAuthCommand({
      ClientId: process.env.COGNITO_CLIENT_ID,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: data.email,
        PASSWORD: data.password,
      },
    });

    const { AuthenticationResult } = await cognitoClient.send(command);

    if (!AuthenticationResult) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          message: 'Invalid credentials',
        }),
      };
    }
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Success',
        accessToken: AuthenticationResult.AccessToken,
        refreshToken: AuthenticationResult.RefreshToken,
      }),
    };
  } catch (error: any) {
    console.log({ error });

    if (error instanceof NotAuthorizedException) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: {
            code: AuthExceptions.InvalidInput,
            message: 'Invalid input',
          },
        }),
      };
    }
    if (error instanceof UserNotFoundException) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: {
            code: AuthExceptions.InvalidInput,
            message: 'Invalid input',
          },
        }),
      };
    }
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error login',
        error: {
          code: AuthExceptions.Default,
          message: 'Internal server error',
        },
      }),
    };
  }
};
