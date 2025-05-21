import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { z } from "zod";
import { supabase } from "../../libs/supabase";
import { Database } from "../../types/database/database.types";

type Tables = Database['public']['Tables']
type Investment = Tables['investments']['Row']

const schema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
  currency: z.enum(["BRL", "USD"]).optional(),
});

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  try {
    const { data: params, success } = schema.safeParse(event.queryStringParameters);
    if (!success) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Parâmetros inválidos",
          error: params,
        }),
      };
    }
    const { page, limit, currency } = params;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit - 1;

    const sub = event.requestContext.authorizer.jwt.claims.sub as string;
    let query = supabase
      .from("investments")
      .select("*", { count: "exact" })
      .range(startIndex, endIndex)
      .eq("userId", sub)
      .order("purchaseDate", { ascending: false });

    if (currency) {
      query = query.eq("currency", currency);
    }

    const { data, error, count } = await query as {
      data: Investment[] | null;
      error: any;
      count: number;
    };

    if (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Erro ao buscar investimentos",
          error: error.message,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Investimentos encontrados",
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
      statusCode: 500,
      body: JSON.stringify({
        message: "Erro interno ao buscar investimentos",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
    };
  }
};
