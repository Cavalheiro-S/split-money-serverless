import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { supabase } from "../../libs/supabase";
import { Database } from "../../types/database/database.types";

type Tables = Database['public']['Tables']
type Investment = Tables['investments']['Row']

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

    const { data, error } = await supabase
      .from("investments")
      .select("*")
      .eq("id", id)
      .eq("userId", sub)
      .single() as {
        data: Investment | null;
        error: any;
      };

    if (error) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: "Investimento não encontrado",
          error: error.message,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Investimento encontrado",
        data
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Erro interno ao buscar investimento",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
    };
  }
};
