import {
  ConfirmSignUpCommand,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';

import { cognitoClient } from '../../libs/cognito';

import type { APIGatewayProxyEventV2 } from 'aws-lambda';

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const body = JSON.parse(event.body || '{}');

    const command = new ConfirmSignUpCommand({
      ClientId: process.env.COGNITO_CLIENT_ID,
      Username: body.email,
      ConfirmationCode: body.code,
    });

    const { Session } = await cognitoClient.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'E-mail confirmed',
        Session,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error confirm e-mail',
        error,
      }),
    };
  }
};
