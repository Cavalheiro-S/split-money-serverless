import {
  ForgotPasswordCommand,
  UserNotFoundException,
  LimitExceededException,
} from '@aws-sdk/client-cognito-identity-provider';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { cognitoClient } from '../../libs/cognito';
import { z } from 'zod';
import { AuthExceptions } from '../../enums/exceptions/auth';

const schema = z.object({
  email: z.string().email('Email inválido').toLowerCase(),
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
          error: {
            code: AuthExceptions.InvalidInput,
            message: 'Dados inválidos',
            details: error,
          },
        }),
      };
    }

    const command = new ForgotPasswordCommand({
      ClientId: process.env.COGNITO_CLIENT_ID,
      Username: data.email,
    });

    const { CodeDeliveryDetails } = await cognitoClient.send(command);

    if (!CodeDeliveryDetails) {
      throw new Error('Falha ao enviar código de recuperação');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Código de recuperação enviado com sucesso',
        deliveryDetails: {
          destination: CodeDeliveryDetails.Destination,
          deliveryMedium: CodeDeliveryDetails.DeliveryMedium,
          attributeName: CodeDeliveryDetails.AttributeName,
        },
      }),
    };
  } catch (error: any) {
    console.log({ error });

    if (error instanceof UserNotFoundException) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: {
            code: AuthExceptions.UserNotFound,
            message: 'Usuário não encontrado',
            details: error.message,
          },
        }),
      };
    }

    if (error instanceof LimitExceededException) {
      return {
        statusCode: 429,
        body: JSON.stringify({
          error: {
            code: AuthExceptions.LimitExceeded,
            message: 'Muitas tentativas. Tente novamente mais tarde',
            details: error.message,
          },
        }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: {
          code: AuthExceptions.Default,
          message: 'Erro ao enviar código de recuperação',
          details: error.message,
        },
      }),
    };
  }
};
