import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { supabase } from "../../libs/supabase";
import { Database } from "../../types/database/database.types";

type Tables = Database['public']['Tables']
type Investment = Tables['investments']['Row']
type InvestmentInsert = Tables['investments']['Insert']

const schema = z.object({
  ticker: z.string(),
  quantity: z.number().positive(),
  purchasePrice: z.number().positive(),
  purchaseDate: z.coerce.date(),
  currency: z.enum(["BRL", "USD"])
})

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { success, data, error } = schema.safeParse(body);
    const sub = event.requestContext.authorizer.jwt.claims.sub as string;

    if (error || !success) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Dados inválidos",
          error
        }),
      };
    }

    const id = uuidv4();
    const payload: InvestmentInsert = {
      id,
      userId: sub,
      ticker: data.ticker,
      quantity: data.quantity,
      purchasePrice: data.purchasePrice,
      purchaseDate: data.purchaseDate,
      currency: data.currency,
      updatedAt: new Date()
    }

    const response = await supabase
      .from("investments")
      .insert(payload)
      .select()
      .single();

    if (response.error) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Erro ao criar investimento",
          error: response.error
        }),
      };
    }

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: "Investimento criado com sucesso",
        data: response.data
      }),
    };
  } catch (error) {
    console.log({ error });
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Erro interno ao criar investimento",
        error
      })
    }
  }
};
