import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

import { supabase } from '../../libs/supabase';
import { Database } from '../../types/database/database.type';

type Tables = Database['public']['Tables'];

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
  try {
    const { id } = event.pathParameters || {};
    const userId = event.requestContext.authorizer.jwt.claims.sub;

    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: {
            code: 'INVALID_INPUT',
            message: 'ID não fornecido',
            details: 'O ID do usuário é obrigatório',
          },
        }),
      };
    }

    if (!userId || typeof userId !== 'string' || userId !== id) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          error: {
            code: 'FORBIDDEN',
            message: 'Acesso negado',
            details: 'Você só pode acessar seus próprios dados',
          },
        }),
      };
    }

    const { data, error } = await supabase
      .from('users')
      .select(
        `
                id,
                email,
                name,
                loginMethod,
                balance,
                createdAt,
                updatedAt
            `
      )
      .eq('id', id)
      .single();

    if (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Usuário não encontrado',
            details: error.message,
          },
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Dados do usuário obtidos com sucesso',
        data,
      }),
    };
  } catch (error: any) {
    console.log({ error });

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro ao obter dados do usuário',
          details: error.message,
        },
      }),
    };
  }
};
