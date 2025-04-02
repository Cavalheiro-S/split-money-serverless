import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { supabase } from "../../libs/supabase";

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  try {
    const { id } = event.pathParameters || {};
    if(!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid id",
        }),
      };
    }

    const response = await supabase
      .from("payment_status")
      .delete()
      .eq("id", id)

    if (response.error) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Error delete payment status",
          error: response.error
        }),
      };
    }

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: "Deleted payment status",
      }),
    };
  }
  catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Error delete payment status",
        error
      })
    }
  }
};
