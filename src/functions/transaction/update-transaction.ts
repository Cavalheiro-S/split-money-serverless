import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { z } from 'zod';
import { supabase } from '../../libs/supabase';
import { Database } from '../../types/database/database.type';

type Tables = Database['public']['Tables'];
type TransactionRow = Tables['transactions']['Row'];
type TransactionUpdate = Tables['transactions']['Update'];
type RecurringTransactionUpdate = Tables['recurring_transactions']['Update'];

const schema = z.object({
  description: z.string().optional(),
  date: z.coerce.date().optional(),
  amount: z.number().optional(),
  type: z.enum(['income', 'outcome']).optional(),
  categoryId: z.string().optional(),
  tagId: z.string().optional(),
  note: z.string().optional(),
  paymentStatusId: z.string().optional(),
});

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
  try {
    const { id } = event.pathParameters || {};
    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid transaction id',
        }),
      };
    }

    const body = JSON.parse(event.body || '{}');
    const { success, data, error } = schema.safeParse(body);

    if (error || !success) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid data',
          error,
        }),
      };
    }

    const sub = event.requestContext.authorizer.jwt.claims.sub as string;

    // ✅ Verificar se a transação existe e pertence ao usuário, incluindo recurrent_transaction_id
    const { data: existingTransaction, error: checkError } = (await supabase
      .from('transactions')
      .select('id, recurrent_transaction_id')
      .eq('id', id)
      .eq('user_id', sub)
      .single()) as {
      data: { id: string; recurrent_transaction_id: string | null } | null;
      error: any;
    };

    if (checkError || !existingTransaction) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: 'Transaction not found or access denied',
        }),
      };
    }

    const payload: TransactionUpdate = {
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

    const { data: updatedTransaction, error: updateError } = (await (
      supabase as any
    )
      .from('transactions')
      .update(payload)
      .eq('id', id)
      .eq('user_id', sub) // ✅ Verificação de propriedade
      .select()
      .single()) as {
      data: TransactionRow | null;
      error: any;
    };

    if (updateError) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error updating transaction',
          error: updateError,
        }),
      };
    }

    // ✅ Se a transação tem recurrent_transaction_id, atualizar também a transação recorrente
    if (existingTransaction && existingTransaction.recurrent_transaction_id) {
      const recurringPayload: any = {};

      if (data.description !== undefined)
        recurringPayload.description = data.description;
      if (data.amount !== undefined) recurringPayload.amount = data.amount;
      if (data.type !== undefined) recurringPayload.type = data.type;
      if (data.note !== undefined) recurringPayload.note = data.note;

      recurringPayload.updated_at = new Date();

      const { error: recurringUpdateError } = await (supabase as any)
        .from('recurring_transactions')
        .update(recurringPayload)
        .eq('id', existingTransaction.recurrent_transaction_id)
        .eq('user_id', sub); // ✅ Verificação de propriedade

      if (recurringUpdateError) {
        console.error(
          'Error updating recurring transaction:',
          recurringUpdateError
        );
        // Não retornamos erro aqui para não quebrar a atualização da transação principal
        // mas logamos o erro para debug
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Transaction updated successfully',
        data: updatedTransaction,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
