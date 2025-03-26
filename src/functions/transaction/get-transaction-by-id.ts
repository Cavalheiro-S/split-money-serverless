import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { supabase } from "../../libs/supabase";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const id = event.pathParameters?.id;
  if (!id) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Transaction ID is required",
      }),
    };
  }
  const { data, error } = await supabase
    .from("transactions")
    .select(`
      *,
      payment_status (
        id,
        status
      )
    `)
    .eq("id", id)
    .single();

  if (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Error fetching transaction",
        error: error.message,
      }), 
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Get Transaction By Id",
      data: data
    }),
  };
};
