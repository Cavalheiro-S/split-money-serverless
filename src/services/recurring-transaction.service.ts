import { supabase } from '../libs/supabase';
import { Database } from '../types/database/database.type';
import { generateOccurrences } from '../utils/rrule-converter';
import { v4 as uuidv4 } from 'uuid';
import { startOfMonth, endOfMonth, getMonth, getYear } from 'date-fns';

type Tables = Database['public']['Tables'];
type RecurringTransaction = Tables['recurring_transactions']['Row'];
type TransactionInsert = Tables['transactions']['Insert'];

interface GetRecurringTransactionsFilters {
  startDate?: string;
}

export class RecurringTransactionService {
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
        return { success: false, error };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error };
    }
  }

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

      const payload = {
        ...updateData,
        updated_at: new Date(),
      };

      const { data: updatedRecurring, error: updateError } = await supabase
        .from('recurring_transactions')
        .update(payload)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (updateError) {
        return { success: false, error: updateError };
      }

      return { success: true, data: updatedRecurring as RecurringTransaction };
    } catch (error) {
      return { success: false, error };
    }
  }

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

      const { error: updateError } = await supabase
        .from('transactions')
        .update({ recurrent_transaction_id: null })
        .eq('recurrent_transaction_id', id)
        .eq('user_id', userId);

      if (updateError) {
        return { success: false, error: updateError };
      }

      const { error: deleteError } = await supabase
        .from('recurring_transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (deleteError) {
        return { success: false, error: deleteError };
      }

      return { success: true, data: existingRecurring };
    } catch (error) {
      return { success: false, error };
    }
  }

  static async createScheduledTransactions(
    targetMonth?: number,
    targetYear?: number
  ): Promise<{
    success: boolean;
    stats?: {
      totalRecurringTransactions: number;
      totalOccurrencesGenerated: number;
      totalTransactionsCreated: number;
      errors: Array<{ recurringId: string; error: string }>;
    };
    processedMonth?: string;
    error?: unknown;
  }> {
    try {
      const now = new Date();
      const month = targetMonth !== undefined ? targetMonth - 1 : getMonth(now);
      const year = targetYear !== undefined ? targetYear : getYear(now);

      const targetDate = new Date(year, month);
      const rangeStart = startOfMonth(targetDate);
      const rangeEnd = endOfMonth(targetDate);

      const { data: recurringTransactions, error: recurringError } =
        await supabase.from('recurring_transactions').select('*');

      if (recurringError) {
        return { success: false, error: recurringError };
      }

      if (!recurringTransactions || recurringTransactions.length === 0) {
        return {
          success: true,
          stats: {
            totalRecurringTransactions: 0,
            totalOccurrencesGenerated: 0,
            totalTransactionsCreated: 0,
            errors: [],
          },
          processedMonth: `${year}-${String(month + 1).padStart(2, '0')}`,
        };
      }

      const stats = {
        totalRecurringTransactions: recurringTransactions.length,
        totalOccurrencesGenerated: 0,
        totalTransactionsCreated: 0,
        errors: [] as Array<{ recurringId: string; error: string }>,
      };

      for (const recurring of recurringTransactions) {
        try {
          const startDate = new Date(recurring.start_date);

          if (startDate > rangeEnd) continue;

          if (recurring.end_date) {
            const endDate = new Date(recurring.end_date);
            if (endDate < rangeStart) continue;
          }

          const { data: existingTransactions, error: existingError } =
            await supabase
              .from('transactions')
              .select('date')
              .eq('recurrent_transaction_id', recurring.id);

          if (existingError) {
            stats.errors.push({
              recurringId: recurring.id,
              error:
                existingError.message || 'Error fetching existing transactions',
            });
            continue;
          }

          const existingDates = new Set(
            (existingTransactions || []).map(
              t => new Date(t.date).toISOString().split('T')[0]
            )
          );

          const occurrences = generateOccurrences(
            recurring.recurrence_rule,
            startDate,
            { start: rangeStart, end: rangeEnd }
          );

          stats.totalOccurrencesGenerated += occurrences.length;

          const { data: referenceTransactions } = await supabase
            .from('transactions')
            .select('category_id, tag_id, payment_status_id')
            .eq('recurrent_transaction_id', recurring.id)
            .limit(1)
            .maybeSingle();

          const transactionsToCreate: TransactionInsert[] = [];

          for (const occurrenceDate of occurrences) {
            const dateStr = occurrenceDate.toISOString().split('T')[0];

            if (existingDates.has(dateStr)) continue;

            transactionsToCreate.push({
              id: uuidv4(),
              description: recurring.description,
              date: occurrenceDate,
              amount: recurring.amount,
              note: recurring.note,
              type: recurring.type,
              user_id: recurring.user_id,
              recurrent_transaction_id: recurring.id,
              category_id: referenceTransactions?.category_id || null,
              tag_id: referenceTransactions?.tag_id || null,
              payment_status_id:
                referenceTransactions?.payment_status_id || null,
              updated_at: new Date(),
            });
          }

          if (transactionsToCreate.length > 0) {
            const { error: insertError } = await supabase
              .from('transactions')
              .insert(transactionsToCreate);

            if (insertError) {
              stats.errors.push({
                recurringId: recurring.id,
                error: insertError.message || 'Error creating transactions',
              });
            } else {
              stats.totalTransactionsCreated += transactionsToCreate.length;
            }
          }
        } catch (error) {
          stats.errors.push({
            recurringId: recurring.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        success: true,
        stats,
        processedMonth: `${year}-${String(month + 1).padStart(2, '0')}`,
      };
    } catch (error) {
      return { success: false, error };
    }
  }
}
