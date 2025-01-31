import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { supabase } from "../../libs/supabase";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const { data, error } = await supabase.from("transactions").select("*");

  if(error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Error fetching transactions",
        error
      }),
    };
  }
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Get Transaction",
      data
    }),
  };
};
