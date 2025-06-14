import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { z } from "zod";
import { supabase } from "../../libs/supabase";
import { Database } from "../../types/database/database.types";  

type Tables = Database['public']['Tables']
type Transaction = Tables['transactions']['Row']
type TransactionUpdate = Tables['transactions']['Update']

const schema = z.object({
  description: z.string().optional(),
  date: z.coerce.date().optional(),
  amount: z.number().optional(),
  type: z.enum(["income", "outcome"]).optional(),
  categoryId: z.string().optional(),
  tagId: z.string().optional(),
  note: z.string().optional(),
  paymentStatusId: z.string().optional(),
});

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  try {
    const { id } = event.pathParameters || {};
    const body = JSON.parse(event.body || "{}");
    const { success, data, error } = schema.safeParse(body);

    if (error || !success) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid data",
          error
        }),
      };
    }    const payload: TransactionUpdate = {
      description: data.description,
      date: data.date,
      amount: data.amount,
      type: data.type,
      category_id: data.categoryId,
      tag_id: data.tagId,
      note: data.note,
      payment_status_id: data.paymentStatusId,
      updated_at: new Date(),
    };

    const { data: updatedTransaction, error: updateError } = await supabase
      .from("transactions")
      .update(payload)
      .eq("id", id)
      .select()
      .single() as { 
        data: Transaction | null;
        error: any;
      };

    if (updateError) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Error updating transaction",
          error: updateError
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Update transaction",
        data: updatedTransaction
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
