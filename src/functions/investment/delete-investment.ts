import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { supabase } from "../../libs/supabase";

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  try {
    const { id } = event.pathParameters || {};
    const sub = event.requestContext.authorizer.jwt.claims.sub as string;

    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "ID do investimento não fornecido",
        }),
      };
    }

    const response = await supabase
      .from("investments")
      .delete()
      .eq("id", id)
      .eq("userId", sub);

    if (response.error) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Erro ao deletar investimento",
          error: response.error
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Investimento deletado com sucesso"
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Erro interno ao deletar investimento",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      })
    }
  }
};
