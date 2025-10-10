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

    // Determine date range for generating virtual transactions
    const now = new Date();
    let rangeStart: Date;
    let rangeEnd: Date;

    if (dateFilter) {
      // If date filter exists, generate for entire month
      const date = new Date(dateFilter);
      const year = date.getFullYear();
      const month = date.getMonth();

      // First day of the month
      rangeStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

      // Last day of the month
      rangeEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
    } else {
      // Default: generate for next 90 days
      rangeStart = now;
      rangeEnd = new Date(now);
      rangeEnd.setDate(rangeEnd.getDate() + 90);
    }

    // Respect recurring transaction start_date and end_date
    const startDate = new Date(recurringTransaction.start_date);
    if (startDate > rangeEnd) {
      return []; // Recurring hasn't started yet in this range
    }

    if (recurringTransaction.end_date) {
      const endDate = new Date(recurringTransaction.end_date);
      if (endDate < rangeStart) {
        return []; // Recurring has already ended
      }
      rangeEnd = endDate < rangeEnd ? endDate : rangeEnd;
    }

    // Adjust rangeStart to not be before start_date
    rangeStart = startDate > rangeStart ? startDate : rangeStart;

    try {
      // Generate occurrences using RRULE
      const occurrences = generateOccurrences(
        recurringTransaction.recurrence_rule,
        startDate,
        { start: rangeStart, end: rangeEnd }
      );

      // Create virtual transaction for each occurrence
      for (const occurrenceDate of occurrences) {
        const dateStr = occurrenceDate.toISOString().split('T')[0];

        // Skip if real transaction already exists for this date
        if (existingTransactionDates.has(dateStr)) {
          continue;
        }

        // Create virtual transaction
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
          // Copy optional fields from reference transaction if available
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

      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1 * multiplier;
      if (bVal == null) return -1 * multiplier;

      // Compare values
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
      // 1. Build query for real transactions with filters
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId);

      // Apply filters to the query
      if (filters.type) {
        query = query.eq('type', filters.type);
      }

      if (filters.date) {
        // Extract year and month from date to filter entire month
        const date = new Date(filters.date);
        const year = date.getFullYear();
        const month = date.getMonth(); // 0-11

        // First day of the month
        const firstDay = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

        // First day of next month (used as upper bound)
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

      // 2. Fetch recurring transactions for the user
      const { data: recurringTransactions, error: recurringError } =
        await supabase
          .from('recurring_transactions')
          .select('*')
          .eq('user_id', userId);

      if (recurringError) {
        console.error('Error fetching recurring transactions:', recurringError);
      }

      // 3. Create a set of dates that have real transactions for each recurring_transaction_id
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
            // Store first transaction as reference for optional fields
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

      // 4. Generate virtual transactions from recurring transactions
      const virtualTransactions: ExtendedTransaction[] = [];

      for (const recurring of recurringTransactions || []) {
        // Apply filters to recurring transactions before generating
        if (filters.type && recurring.type !== filters.type) {
          continue;
        }

        const existingDates =
          existingDatesMap.get(recurring.id) || new Set<string>();
        const referenceTransaction = referenceTransactionMap.get(recurring.id);

        // Filter by category/tag/status if they exist in reference transaction
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

      // 5. Merge real and virtual transactions
      const allTransactions: ExtendedTransaction[] = [
        ...(realTransactions || []).map(t => ({
          ...t,
          is_virtual: false,
        })),
        ...virtualTransactions,
      ];

      // 6. Sort all transactions
      const sorted = this.sortTransactions(
        allTransactions,
        filters.sortBy,
        filters.sortOrder
      );

      // 7. Apply pagination manually
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginated = sorted.slice(startIndex, endIndex);

      // 8. Return with pagination metadata
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
