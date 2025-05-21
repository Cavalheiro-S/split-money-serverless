import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { z } from "zod";
import { supabase } from "../../libs/supabase";
import { Database } from "../../types/database/database.types";

type Tables = Database['public']['Tables']
type Investment = Tables['investments']['Row']
type InvestmentUpdate = Tables['investments']['Update']

const schema = z.object({
  ticker: z.string().optional(),
  quantity: z.number().positive().optional(),
  purchase_price: z.number().positive().optional(),
  purchase_date: z.coerce.date().optional(),
  currency: z.enum(["BRL", "USD"]).optional()
});

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  try {
    const { id } = event.pathParameters || {};
    const sub = event.requestContext.authorizer.jwt.claims.sub as string;
    const body = JSON.parse(event.body || "{}");
    const { success, data, error } = schema.safeParse(body);

    if (error || !success) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Dados inválidos",
          error
        }),
      };
    }

    const payload: InvestmentUpdate = {
      ...data,
      updatedAt: new Date()
    };

    const { data: updatedInvestment, error: updateError } = await supabase
      .from("investments")
      .update(payload)
      .eq("id", id)
      .eq("userId", sub)
      .select()
      .single() as {
        data: Investment | null;
        error: any;
      };

    if (updateError) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Erro ao atualizar investimento",
          error: updateError
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Investimento atualizado com sucesso",
        data: updatedInvestment
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Erro interno ao atualizar investimento",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      })
    }
  }
};
