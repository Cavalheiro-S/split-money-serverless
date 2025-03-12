import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import { Schema, z } from "zod";
import { supabase } from "../../libs/supabase";
import { TransactionFrequencyEnum } from "../../enums/transaction";
import { PostgrestSingleResponse } from "@supabase/supabase-js";

const schema = z.object({
  description: z.string(),
  date: z.coerce.date(),
  amount: z.number(),
  type: z.enum(["income", "outcome"]),
  category: z.string(),
  recorrent: z
    .object({
      frequency: z.enum(Object.values(TransactionFrequencyEnum) as [string, ...string[]]),
      quantity: z.number().int().positive(),
    })
    .optional(),
})

type Transaction = z.infer<typeof schema> & {
  id: string;
  userId: string;
  updatedAt: Date;
  parentId?: string;
};

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
    const payload: Transaction = {
      id,
      description: data.description,
      amount: data.amount,
      type: data.type,
      category: data.category,
      userId: sub,
      updatedAt: new Date(),
      date: data.date
    }
    let response : PostgrestSingleResponse<any[]> | undefined = undefined;
    if (data.recorrent) {
      const payloadList: Transaction[] = [];
      for (let i = 0; i <= data.recorrent.quantity; i++) {
        const IS_PARENT_TRANSACTION = i === 0;
        const date = new Date(data.date);
        switch (data.recorrent.frequency) {
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
          id: IS_PARENT_TRANSACTION ? id : uuidv4(),
          date: date,
          parentId: IS_PARENT_TRANSACTION ? undefined : id
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
