import type { APIGatewayProxyEventV2, APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { supabase } from "../../libs/supabase";

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  try {
    const { data, error } = await supabase
      .from("transactions")
      .select()
      .eq("userId", event.requestContext.authorizer.jwt.claims.sub as string);


    if (error) {
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
  }

  catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Error fetching transactions",
        error
      }),
    };
  }

};
