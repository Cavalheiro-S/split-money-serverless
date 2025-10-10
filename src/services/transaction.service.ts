import { supabase } from '../libs/supabase';
import { Database } from '../types/database/database.type';
import { ExtendedTransaction } from '../types/database/transaction.type';
import { generateOccurrences } from '../utils/rrule-converter';

type Filters = {
  page?: number;
  limit?: number;
  type?: 'income' | 'outcome';
  date?: string; // ISO date string
  status?: string; // e.g., "paid", "pending"
  categoryId?: string;
  tagId?: string;
  sortBy?:
    | 'description'
    | 'date'
    | 'amount'
    | 'type'
    | 'category'
    | 'tag'
    | 'payment_status';
  sortOrder?: 'asc' | 'desc';
  userId: string;
};

type Tables = Database['public']['Tables'];
type Transaction = Tables['transactions']['Row'];
type RecurringTransaction = Tables['recurring_transactions']['Row'];

interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export class TransactionService {
  /**
   * Generates virtual transactions from a recurring transaction based on RRULE
   * @param recurringTransaction The recurring transaction definition
   * @param dateFilter Optional date to generate for entire month, or generates for next 90 days
   * @param existingTransactionDates Dates that already have real transactions (to exclude)
   * @returns Array of virtual transactions
   */
  private static generateVirtualTransactions(
    recurringTransaction: RecurringTransaction,
    dateFilter?: string,
    existingTransactionDates: Set<string> = new Set(),
    referenceTransaction?: Transaction
  ): ExtendedTransaction[] {
    const virtualTransactions: ExtendedTransaction[] = [];

    const now = new Date();
    let rangeStart: Date;
    let rangeEnd: Date;

    if (dateFilter) {
      const date = new Date(dateFilter);
      const year = date.getFullYear();
      const month = date.getMonth();

      rangeStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

      rangeEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
    } else {
      // Default: generate for next 90 days
      rangeStart = now;
      rangeEnd = new Date(now);
      rangeEnd.setDate(rangeEnd.getDate() + 90);
    }

    const startDate = new Date(recurringTransaction.start_date);
    if (startDate > rangeEnd) {
      return [];
    }

    if (recurringTransaction.end_date) {
      const endDate = new Date(recurringTransaction.end_date);
      if (endDate < rangeStart) {
        return [];
      }
      rangeEnd = endDate < rangeEnd ? endDate : rangeEnd;
    }

    rangeStart = startDate > rangeStart ? startDate : rangeStart;

    try {
      const occurrences = generateOccurrences(
        recurringTransaction.recurrence_rule,
        startDate,
        { start: rangeStart, end: rangeEnd }
      );

      for (const occurrenceDate of occurrences) {
        const dateStr = occurrenceDate.toISOString().split('T')[0];

        if (existingTransactionDates.has(dateStr)) {
          continue;
        }

        const virtualTransaction: ExtendedTransaction = {
          id: `virtual-${recurringTransaction.id}-${occurrenceDate.getTime()}`,
          description: recurringTransaction.description,
          date: occurrenceDate,
          amount: recurringTransaction.amount,
          note: recurringTransaction.note,
          type: recurringTransaction.type,
          created_at: recurringTransaction.created_at,
          updated_at: recurringTransaction.updated_at,
          user_id: recurringTransaction.user_id,
          recurrent_transaction_id: recurringTransaction.id,
          is_virtual: true,
          is_recurring_generated: true,
          tag_id: referenceTransaction?.tag_id,
          category_id: referenceTransaction?.category_id,
          payment_status_id: referenceTransaction?.payment_status_id,
        };

        virtualTransactions.push(virtualTransaction);
      }
    } catch (error) {
      console.error(
        'Error generating virtual transactions:',
        error,
        'for recurring:',
        recurringTransaction.id
      );
    }

    return virtualTransactions;
  }

  /**
   * Sorts transactions array by specified field and order
   */
  private static sortTransactions(
    transactions: ExtendedTransaction[],
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'desc'
  ): ExtendedTransaction[] {
    if (!sortBy) {
      sortBy = 'date';
    }

    return [...transactions].sort((a, b) => {
      const aVal = a[sortBy as keyof ExtendedTransaction];
      const bVal = b[sortBy as keyof ExtendedTransaction];
      const multiplier = sortOrder === 'asc' ? 1 : -1;

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1 * multiplier;
      if (bVal == null) return -1 * multiplier;

      if (aVal < bVal) return -1 * multiplier;
      if (aVal > bVal) return 1 * multiplier;
      return 0;
    });
  }

  /**
   * Gets transactions with pagination, merging real and virtual transactions
   */
  static async getTransactions(
    filters: Filters,
    userId: string
  ): Promise<{
    data: ExtendedTransaction[];
    pagination: PaginationMetadata;
    error?: unknown;
  }> {
    try {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId);

      if (filters.type) {
        query = query.eq('type', filters.type);
      }

      if (filters.date) {
        const date = new Date(filters.date);
        const year = date.getFullYear();
        const month = date.getMonth();

        const firstDay = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

        const lastDay = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));

        query = query.gte('date', firstDay.toISOString());
        query = query.lt('date', lastDay.toISOString());
      }

      if (filters.status) {
        query = query.eq('payment_status_id', filters.status);
      }

      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }

      if (filters.tagId) {
        query = query.eq('tag_id', filters.tagId);
      }

      const { data: realTransactions, error: realError } = await query;

      if (realError) {
        console.error('Error fetching real transactions:', realError);
        return {
          data: [],
          pagination: {
            page: filters.page || 1,
            limit: filters.limit || 10,
            total: 0,
            totalPages: 0,
            hasMore: false,
          },
          error: realError,
        };
      }

      const { data: recurringTransactions, error: recurringError } =
        await supabase
          .from('recurring_transactions')
          .select('*')
          .eq('user_id', userId);

      if (recurringError) {
        console.error('Error fetching recurring transactions:', recurringError);
      }

      const existingDatesMap = new Map<string, Set<string>>();
      const referenceTransactionMap = new Map<string, Transaction>();

      for (const transaction of realTransactions || []) {
        if (transaction.recurrent_transaction_id) {
          const dateStr = new Date(transaction.date)
            .toISOString()
            .split('T')[0];

          if (!existingDatesMap.has(transaction.recurrent_transaction_id)) {
            existingDatesMap.set(
              transaction.recurrent_transaction_id,
              new Set()
            );
            referenceTransactionMap.set(
              transaction.recurrent_transaction_id,
              transaction
            );
          }

          const dateSet = existingDatesMap.get(
            transaction.recurrent_transaction_id
          );
          if (dateSet) {
            dateSet.add(dateStr);
          }
        }
      }

      const virtualTransactions: ExtendedTransaction[] = [];

      for (const recurring of recurringTransactions || []) {
        if (filters.type && recurring.type !== filters.type) {
          continue;
        }

        const existingDates =
          existingDatesMap.get(recurring.id) || new Set<string>();
        const referenceTransaction = referenceTransactionMap.get(recurring.id);

        if (
          filters.categoryId &&
          referenceTransaction?.category_id !== filters.categoryId
        ) {
          continue;
        }

        if (filters.tagId && referenceTransaction?.tag_id !== filters.tagId) {
          continue;
        }

        if (
          filters.status &&
          referenceTransaction?.payment_status_id !== filters.status
        ) {
          continue;
        }

        const generated = this.generateVirtualTransactions(
          recurring,
          filters.date,
          existingDates,
          referenceTransaction
        );

        virtualTransactions.push(...generated);
      }

      const allTransactions: ExtendedTransaction[] = [
        ...(realTransactions || []).map(t => ({
          ...t,
          is_virtual: false,
        })),
        ...virtualTransactions,
      ];

      const sorted = this.sortTransactions(
        allTransactions,
        filters.sortBy,
        filters.sortOrder
      );

      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginated = sorted.slice(startIndex, endIndex);

      return {
        data: paginated,
        pagination: {
          page,
          limit,
          total: sorted.length,
          totalPages: Math.ceil(sorted.length / limit),
          hasMore: endIndex < sorted.length,
        },
      };
    } catch (error) {
      console.error('Unexpected error in getTransactions:', error);
      return {
        data: [],
        pagination: {
          page: filters.page || 1,
          limit: filters.limit || 10,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
        error,
      };
    }
  }
}
