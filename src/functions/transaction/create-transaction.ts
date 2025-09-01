import { PostgrestSingleResponse } from "@supabase/supabase-js";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { TransactionFrequencyEnum } from "../../enums/transaction";
import { supabase } from "../../libs/supabase";
import { Database } from "../../types/database/database.type";
import { convertToRRule } from "../../utils/rrule-converter";

type Tables = Database["public"]["Tables"];
type Transaction = Tables["transactions"]["Row"];
type TransactionInsert = Tables["transactions"]["Insert"];

const schema = z.object({
  description: z.string(),
  date: z.coerce.date(),
  amount: z.number(),
  type: z.enum(["income", "outcome"]),
  categoryId: z.string().optional(),
  tagId: z.string().optional(),
  note: z.string().optional(),
  recurrent: z
    .object({
      frequency: z.nativeEnum(TransactionFrequencyEnum),
      quantity: z.number().int().positive(),
    })
    .optional(),
  paymentStatusId: z.string().optional(),
});

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
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
          error,
        }),
      };
    }
    const payload: TransactionInsert = {
      id,
      description: data.description,
      amount: data.amount,
      type: data.type,
      category_id: data.categoryId,
      tag_id: data.tagId,
      note: data.note,
      user_id: sub,
      updated_at: new Date(),
      date: data.date,
      payment_status_id: data.paymentStatusId,
    };
    let response: PostgrestSingleResponse<Transaction[]> | undefined =
      undefined;
    if (data.recurrent) {
      const { frequency, quantity } = data.recurrent;
      const { paymentStatusId, tagId, categoryId, date, recurrent, ...recurringDate } = data;
      const rrule = convertToRRule(frequency, quantity);
      const responseRecurring = await (supabase as any)
        .from("recurring_transactions")
        .insert({
          ...recurringDate,
          recurrence_rule: rrule,
          user_id: sub,
          start_date: data.date,
        })
        .select("id")

      if (responseRecurring.error && !responseRecurring.data) {
        console.error(responseRecurring.error);
        return {
          statusCode: 400,
          body: JSON.stringify({
            message: "Error creating recurring transaction",
            error: responseRecurring.error,
          }),
        };
      }

      response = await (supabase as any).from("transactions").insert({
        ...payload,
        recurrent_transaction_id: responseRecurring.data[0].id,
      }).select("*");

    } else {
      response = await (supabase as any)
        .from("transactions")
        .insert(payload)
        .select("*");
    }

    if (response?.error) {
      console.error("Error creating transaction:", response.error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: "Error creating transaction",
          error: response.error.message || "Unknown database error",
        }),
      };
    }

    return {
      statusCode: 201, // ✅ Código correto para criação bem-sucedida
      body: JSON.stringify({
        message: "Transaction created successfully",
        data: response?.data,
      }),
    };
  } catch (error) {
    console.error("Unexpected error creating transaction:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
