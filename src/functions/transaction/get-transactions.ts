import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { z } from "zod";
import { supabase } from "../../libs/supabase";
import { Database } from "../../types/database/database.types";

type Tables = Database['public']['Tables']
type Transaction = Tables['transactions']['Row']

const schema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
  type: z.enum(["income", "outcome"]).optional(),
  date: z.string().optional(),
  status: z.string().optional(),
  sortBy: z.enum(["description", "date", "amount", "type", "category", "payment_status"]).optional().default("date"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  try {
    const { page, limit, type, date, status, sortBy, sortOrder } = schema.parse(event.queryStringParameters);

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit - 1;

    const startDate = date ? startOfMonth(new Date(date)) : undefined;
    const endDate = date ? endOfMonth(new Date(date)) : undefined;

    const sub = event.requestContext.authorizer.jwt.claims.sub as string;
    let query = supabase
      .from("transactions")
      .select(`
        *,
        payment_status (*)
      `, { count: "exact" })
      .range(startIndex, endIndex)
      .eq("userId", sub)
      .order(sortBy === "payment_status" ? "payment_status(status)" : sortBy, { ascending: sortOrder === "asc" });
    if (type) {
      query = query.eq("type", type);
    }

    if (status) {
      query = query.eq("payment_status.status", status);
    }

    if (startDate && endDate) {
      query = query
        .gte("date", format(startDate, "yyyy-MM-dd HH:mm:ss"))
        .lte("date", format(endDate, "yyyy-MM-dd HH:mm:ss"));
    }

    const { data, error, count } = await query as {
      data: (Transaction & { payment_status: Tables['payment_status']['Row'] | null })[] | null;
      error: any;
      count: number;
    };

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
      statusCode: 500,
      body: JSON.stringify({
        message: "Unexpected error",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
