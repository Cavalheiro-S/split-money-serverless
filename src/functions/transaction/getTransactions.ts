import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { z } from "zod";
import { supabase } from "../../libs/supabase";

const schema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(1),
  type: z.enum(["income", "outcome"]).optional(),
})

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  try {
    const { page, limit, type } = schema.parse(event.queryStringParameters);
    // Definir índices de paginação
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit - 1;

    const { data, error, count } = await supabase
      .from("transactions")
      .select("*", { count: "exact" })
      .range(startIndex, endIndex)
      .eq("userId", event.requestContext.authorizer.jwt.claims.sub as string)
      .in("type", type ? [type] : ["income", "outcome"]);
      

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
        data,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil((count || 0) / limit),
        },
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
