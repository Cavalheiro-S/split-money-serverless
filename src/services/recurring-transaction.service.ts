import { supabase } from '../libs/supabase';
import { Database } from '../types/database/database.type';

type Tables = Database['public']['Tables'];
type RecurringTransaction = Tables['recurring_transactions']['Row'];

interface GetRecurringTransactionsFilters {
  startDate?: string; // ISO date string - filter recurring transactions from this date onwards
}

export class RecurringTransactionService {
  /**
   * Gets all recurring transactions for a user
   * Optionally filters by start date to show only active recurring transactions
   * @param userId User ID for authorization
   * @param filters Optional filters (startDate)
   * @returns Result with recurring transactions or error
   */
  static async getRecurringTransactions(
    userId: string,
    filters?: GetRecurringTransactionsFilters
  ): Promise<{
    success: boolean;
    data?: RecurringTransaction[];
    error?: unknown;
  }> {
    try {
      let query = supabase
        .from('recurring_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (filters?.startDate) {
        const filterDate = new Date(filters.startDate);

        query = query.or(
          `end_date.is.null,end_date.gte.${filterDate.toISOString()}`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching recurring transactions:', error);
        return {
          success: false,
          error,
        };
      }

      return {
        success: true,
        data: data || [],
      };
    } catch (error) {
      console.error('Unexpected error in getRecurringTransactions:', error);
      return {
        success: false,
        error,
      };
    }
  }
  /**
   * Updates a recurring transaction by ID
   * Only updates the recurring transaction, existing real transactions remain unchanged
   * @param id Recurring transaction ID
   * @param userId User ID for authorization
   * @param updateData Data to update
   * @returns Result with updated data or error
   */
  static async updateRecurringTransaction(
    id: string,
    userId: string,
    updateData: Partial<{
      description: string;
      type: 'income' | 'outcome';
      amount: number;
      recurrence_rule: string;
      start_date: Date;
      end_date: Date | null;
      note: string;
    }>
  ): Promise<{
    success: boolean;
    data?: RecurringTransaction;
    error?: unknown;
  }> {
    try {
      // Verify ownership
      const { data: existingRecurring, error: fetchError } = await supabase
        .from('recurring_transactions')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (fetchError || !existingRecurring) {
        return {
          success: false,
          error: new Error('Recurring transaction not found or unauthorized'),
        };
      }

      // Prepare update payload
      const payload: any = {
        ...updateData,
        updated_at: new Date(),
      };

      // Update recurring transaction
      const { data: updatedRecurring, error: updateError } = await supabase
        .from('recurring_transactions')
        .update(payload)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating recurring transaction:', updateError);
        return {
          success: false,
          error: updateError,
        };
      }

      return {
        success: true,
        data: updatedRecurring as RecurringTransaction,
      };
    } catch (error) {
      console.error('Unexpected error in updateRecurringTransaction:', error);
      return {
        success: false,
        error,
      };
    }
  }

  /**
   * Deletes a recurring transaction by ID
   * Keeps all existing real transactions intact (removes the reference to recurring_transaction)
   * @param id Recurring transaction ID
   * @param userId User ID for authorization
   * @returns Result with data or error
   */
  static async deleteRecurringTransaction(
    id: string,
    userId: string
  ): Promise<{
    success: boolean;
    data?: RecurringTransaction;
    error?: unknown;
  }> {
    try {
      const { data: existingRecurring, error: fetchError } = await supabase
        .from('recurring_transactions')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (fetchError || !existingRecurring) {
        return {
          success: false,
          error: new Error('Recurring transaction not found or unauthorized'),
        };
      }

      // 2. Remover a referência de recurrent_transaction_id nas transações existentes
      // Isso mantém as transações intactas mas remove o vínculo com a recurring_transaction
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ recurrent_transaction_id: null })
        .eq('recurrent_transaction_id', id)
        .eq('user_id', userId);

      if (updateError) {
        console.error(
          'Error removing recurring transaction reference:',
          updateError
        );
        return {
          success: false,
          error: updateError,
        };
      }

      const { error: deleteError } = await supabase
        .from('recurring_transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Error deleting recurring transaction:', deleteError);
        return {
          success: false,
          error: deleteError,
        };
      }

      return {
        success: true,
        data: existingRecurring,
      };
    } catch (error) {
      console.error('Unexpected error in deleteRecurringTransaction:', error);
      return {
        success: false,
        error,
      };
    }
  }
}
