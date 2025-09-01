import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { supabase } from "../../libs/supabase";
import { Database } from "../../types/database/database.type";

type Tables = Database['public']['Tables']

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  try {
    const { id } = event.pathParameters || {};
    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid transaction id",
        }),
      };
    }

    const sub = event.requestContext.authorizer.jwt.claims.sub as string;
    
    // ✅ Verificar se a transação existe e pertence ao usuário
    const { data: existingTransaction, error: checkError } = await supabase
      .from("transactions")
      .select("id")
      .eq("id", id)
      .eq("user_id", sub)
      .single();

    if (checkError || !existingTransaction) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: "Transaction not found or access denied",
        }),
      };
    }

    const response = await supabase
      .from("transactions")
      .delete()
      .eq("id", id)
      .eq("user_id", sub); // ✅ Verificação de propriedade

    if (response.error) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: "Error deleting transaction",
          error: response.error
        }),
      };
    }

    return {
      statusCode: 200, // ✅ Código correto para DELETE bem-sucedido
      body: JSON.stringify({
        message: "Transaction deleted successfully",
      }),
    };
  }
  catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error"
      })
    }
  }
};
