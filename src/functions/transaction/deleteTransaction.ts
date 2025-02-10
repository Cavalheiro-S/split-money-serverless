import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
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
    
    const sub = event.requestContext.authorizer.jwt.claims.sub as string;

    const response = await supabase
      .from("transactions")
      .delete()
      .eq("id", id)

    if (response.error) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Error delete transaction",
          error: response.error
        }),
      };
    }

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: "Deleted transaction",
      }),
    };
  }
  catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Error delete transaction",
        error
      })
    }
  }
};
