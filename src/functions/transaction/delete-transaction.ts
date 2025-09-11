import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { supabase } from "../../libs/supabase";
import { Database } from "../../types/database/database.type";

type Tables = Database["public"]["Tables"];

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
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

    const { data: existingTransaction, error: checkError } = await supabase
      .from("transactions")
      .select("id, recurrent_transaction_id")
      .eq("id", id)
      .eq("user_id", sub)
      .single() as { data: { id: string; recurrent_transaction_id: string | null } | null; error: any };

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
      .eq("user_id", sub);

    if (response.error) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: "Error deleting transaction",
          error: response.error,
        }),
      };
    }

    // Verificar se devemos deletar a recurring_transaction após deletar a transação
    if (existingTransaction.recurrent_transaction_id) {
      const { data: otherTransactions, error: checkRecurringError } = await supabase
        .from("transactions")
        .select("id")
        .eq("recurrent_transaction_id", existingTransaction.recurrent_transaction_id)
        .eq("user_id", sub);

      if (!checkRecurringError && (!otherTransactions || otherTransactions.length === 0)) {
        await supabase
          .from("recurring_transactions")
          .delete()
          .eq("id", existingTransaction.recurrent_transaction_id)
          .eq("user_id", sub);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Transaction deleted successfully",
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
