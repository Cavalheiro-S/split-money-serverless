import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { date, z } from "zod";
import { supabase } from "../../libs/supabase";
import { v4 as uuidv4 } from "uuid";

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
    const sub = event.requestContext.authorizer.jwt.claims.sub as string;
    const { success, data, error } = schema.safeParse(body);
    const id = uuidv4();
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
      .insert({
        id,
        description: data.description,
        date: data.date,
        amount: data.amount,
        type: data.type,
        category: data.category,
        userId: sub,
        updatedAt: new Date(),
      })
      .select();
    
    if(response.error) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Error creating transaction",
          error: response.error
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Create new Transaction",
        event: response
      }),
    };
  }
  catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Error creating transaction",
        error
      })
    }
  }
};
