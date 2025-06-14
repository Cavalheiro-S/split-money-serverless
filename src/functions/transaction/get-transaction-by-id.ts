import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { supabase } from "../../libs/supabase";
import { Database } from "../../types/database/database.types";

type Tables = Database['public']['Tables']
type Transaction = Tables['transactions']['Row']

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {  try {
    const { id } = event.pathParameters || {};
    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid id",
        }),
      };
    }
    
    const { data, error } =
      await supabase
        .from("transactions")
        .select(`
        *,
        payment_status (*),
        categories (*),
        tags (*)
      `)
        .eq("id", id)
        .single() as {
          data: (Transaction & {
            payment_status: Tables['payment_status']['Row'] | null;
            category: Tables['categories']['Row'] | null;
            tag: Tables['tags']['Row'] | null;
          }) | null;
          error: any;
        };

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
  }
  catch (error: any) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Error fetching transaction",
        error: error?.message,
      }),
    };
  }
};
