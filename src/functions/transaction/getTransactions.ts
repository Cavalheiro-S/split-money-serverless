import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { z } from "zod";
import { supabase } from "../../libs/supabase";
import { startOfMonth, endOfMonth, format, parse } from "date-fns";

const schema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10), // Limite mais razoável por padrão
  type: z.enum(["income", "outcome"]).optional(),
  date: z.string().optional(),
});

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  try {
    const { page, limit, type, date } = schema.parse(event.queryStringParameters);

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit - 1;

    // Converter a string para Date, se fornecida
    const startDate = date ? startOfMonth(new Date(date)) : undefined;
    const endDate = date ? endOfMonth(new Date(date)) : undefined;
    
    let query = supabase
      .from("transactions")
      .select("*", { count: "exact" })
      .range(startIndex, endIndex)
      .eq("userId", event.requestContext.authorizer.jwt.claims.sub as string)
      .order("date", { ascending: false });

    if (type) {
      query = query.eq("type", type);
    }

    if (startDate && endDate) {
      query = query
        .gte("date", format(startDate, "yyyy-MM-dd HH:mm:ss"))
        .lte("date", format(endDate, "yyyy-MM-dd HH:mm:ss"));
    }

    const { data, error, count } = await query;

    if (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Error fetching transactions",
          error: error.message,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Get Transactions",
        data,
        pagination: {
          total: count || 0,
          page,
          limit,
          totalPages: Math.ceil((count || 0) / limit),
        },
      }),
    };
  } catch (error) {
    return {
      statusCode: 500, // Melhor indicar erro do servidor
      body: JSON.stringify({
        message: "Unexpected error",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
