import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import { Schema, z } from "zod";
import { supabase } from "../../libs/supabase";
import { TransactionFrequencyEnum } from "../../enums/transaction";
import { PostgrestSingleResponse } from "@supabase/supabase-js";
import { Database } from "../../types/database/database.types";

type Tables = Database['public']['Tables']
type Transaction = Tables['transactions']['Row']
type TransactionInsert = Tables['transactions']['Insert']

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
      frequency: z.enum(Object.values(TransactionFrequencyEnum) as [string, ...string[]]),
      quantity: z.number().int().positive(),
    })
    .optional(),
  paymentStatusId: z.string().optional(),
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
    } const payload: TransactionInsert = {
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
      payment_status_id: data.paymentStatusId
    }
    let response: PostgrestSingleResponse<Transaction[]> | undefined = undefined;
    if (data.recurrent) {
      // Create a recurrent transaction
      const recurrentId = uuidv4();

      const payloadList: TransactionInsert[] = [];
      for (let i = 0; i <= data.recurrent.quantity; i++) {
        const date = new Date(data.date);
        switch (data.recurrent.frequency) {
          case TransactionFrequencyEnum.DAILY:
            date.setDate(date.getDate() + i);
            break;
          case TransactionFrequencyEnum.WEEKLY:
            date.setDate(date.getDate() + i * 7);
            break;
          case TransactionFrequencyEnum.MONTHLY:
            date.setMonth(date.getMonth() + i);
            break;
          case TransactionFrequencyEnum.YEARLY:
            date.setFullYear(date.getFullYear() + i);
            break;
        }

        payloadList.push({
          ...payload,
          id: i === 0 ? id : uuidv4(),
          date: date,
          recurrent_transaction_id: recurrentId
        })
      }
      response = await supabase.from("transactions").insert(payloadList).select("*")
    }
    else {
      response = await supabase.from("transactions").insert(payload).select("*")
    }

    if (response.error) {
      console.log(response);

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
        data: response.data
      }),
    };
  }
  catch (error) {
    console.log({ error });

    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Error creating transaction",
        error
      })
    }
  }
};
