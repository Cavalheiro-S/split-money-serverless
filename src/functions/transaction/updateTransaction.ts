import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { z } from "zod";
import { supabase } from "../../libs/supabase";

const schema = z.object({
  description: z.string(),
  date: z.coerce.date(),
  amount: z.number(),
  type: z.enum(["income", "expense"]),
  category: z.string(),
})

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  try {

    const body = JSON.parse(event.body || "{}");
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
    const { success, data, error } = schema.safeParse(body);

    if (error || !success) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid data",
          error
        }),
      };
    }

    const response = await supabase
      .from("transactions")
      .update({
        description: data.description,
        date: data.date,
        amount: data.amount,
        type: data.type,
        category: data.category,
        userId: sub,
        updatedAt: new Date(),
      })
      .eq("id", id)

    if (response.error) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Error updating transaction",
          error: response.error
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Update transaction",
        data: response.data
      }),
    };
  }
  catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Error updating transaction",
        error
      })
    }
  }
};
