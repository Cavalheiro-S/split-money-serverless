import {
  endOfMonth,
  format,
  startOfMonth,
  addMonths,
  addYears,
  addWeeks,
  addDays,
} from "date-fns";
import { supabase } from "../libs/supabase";
import { Database } from "../types/database/database.type";
import { RRule } from "rrule";
import { createErrorLogger } from "../utils/error-logger";

type Filters = {
  page?: number;
  limit?: number;
  type?: "income" | "outcome";
  date?: string; // ISO date string
  status?: string; // e.g., "paid", "pending"
  categoryId?: string;
  tagId?: string;
  sortBy?:
    | "description"
    | "date"
    | "amount"
    | "type"
    | "category"
    | "tag"
    | "payment_status";
  sortOrder?: "asc" | "desc";
  userId: string;
};

type Tables = Database["public"]["Tables"];
type Transaction = Tables["transactions"]["Row"];
type RecurringTransaction = Tables["recurring_transactions"]["Row"];

export class TransactionService {
  private async generateFutureTransactions(
    recurringTransaction: RecurringTransaction,
    filters?: Filters
  ): Promise<Transaction[]> {
    const errorLogger = createErrorLogger({
      userId: recurringTransaction.user_id,
      functionName: 'generateFutureTransactions',
    });

    const now = new Date();

    try {
      // Parse the recurrence rule
      const rule = RRule.fromString(recurringTransaction.recurrence_rule);

      const startDate = filters?.date ? new Date(filters.date) : now;
      let endDate;

      const count = rule.options.count ?? 1;
      switch (rule.options.freq) {
        case RRule.YEARLY:
          endDate = addYears(startDate, count);
          break;
        case RRule.MONTHLY:
          endDate = addMonths(startDate, count);
          break;
        case RRule.WEEKLY:
          endDate = addWeeks(startDate, count);
          break;
        case RRule.DAILY:
          endDate = addDays(startDate, count);
          break;
        default:
          endDate = addMonths(startDate, 12);
      }

      // Determine the end boundary for date generation
      let dateLimit: Date;

      if (filters?.date) {
        // If we have a date filter, use end of that month
        dateLimit = endDate!;
      } else if (recurringTransaction.end_date || rule.options.until) {
        // Otherwise use the earliest of end_date or until date if they exist
        if (recurringTransaction.end_date && rule.options.until) {
          dateLimit = new Date(
            Math.min(
              recurringTransaction.end_date.getTime(),
              rule.options.until.getTime()
            )
          );
        } else {
          dateLimit = new Date(
            (recurringTransaction.end_date || rule.options.until)!.getTime()
          );
        }
      } else {
        // If no specific end date, generate for next 12 months
        dateLimit = addMonths(now, 12);
      }

      // Get dates based on the rule
      let dates: Date[];
      if (rule.options.count) {
        // If count is specified, get all dates and filter by our date range
        dates = rule
          .all()
          .filter((date) => date >= startDate && date <= dateLimit);
      } else {
        // Otherwise get dates between our date range
        dates = rule.between(
          recurringTransaction.last_generated_at || startDate,
          dateLimit,
          true // inclusive
        );
      }

      // Generate transactions for each date
      const futureTransactions: Transaction[] = dates.map((date) => ({
        id: crypto.randomUUID(),
        description: recurringTransaction.description,
        type: recurringTransaction.type,
        amount: recurringTransaction.amount,
        date: date,
        note: recurringTransaction.note,
        user_id: recurringTransaction.user_id,
        recurrent_transaction_id: recurringTransaction.id,
        created_at: now,
        updated_at: now,
      }));

      // Update the last_generated_at date if we have generated any transactions
      if (futureTransactions.length > 0) {
        try {
          const { error: updateError } = await supabase
            .from("recurring_transactions")
            .update({ last_generated_at: now })
            .eq("id", recurringTransaction.id);

          if (updateError) {
            errorLogger.databaseError('UPDATE', 'recurring_transactions', updateError, {
              recurringTransactionId: recurringTransaction.id,
              operation: 'update last_generated_at',
            });
          }
        } catch (updateError) {
          errorLogger.functionError('updateLastGeneratedAt', updateError, {
            recurringTransactionId: recurringTransaction.id,
          });
        }
      }

      return futureTransactions;
    } catch (error) {
      errorLogger.functionError('generateFutureTransactions', error, {
        recurringTransaction: {
          id: recurringTransaction.id,
          description: recurringTransaction.description,
          recurrence_rule: recurringTransaction.recurrence_rule,
        },
        filters,
      });
      throw error;
    }
  }

  async get(filters: Filters) {
    const errorLogger = createErrorLogger({
      userId: filters.userId,
      functionName: 'TransactionService.get',
    });
    
    const {
      page = 1,
      limit = 10,
      type,
      date,
      status,
      categoryId,
      tagId,
      sortBy = "date",
      sortOrder = "desc",
      userId,
    } = filters;

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit - 1;

    const startDate = date ? startOfMonth(new Date(date)) : undefined;
    const endDate = date ? endOfMonth(new Date(date)) : undefined;
    let futureTransactions: Transaction[] = [];

    try {
      let query = supabase
        .from("transactions")
        .select(
          `
                  *,
                  payment_status (*),
                  categories (*),
                  tags (*)
                `,
          { count: "exact" }
        )
        .range(startIndex, endIndex)
        .eq("user_id", userId)
        .order(
          sortBy === "payment_status"
            ? "payment_status(description)"
            : sortBy === "category"
            ? "categories(description)"
            : sortBy === "tag"
            ? "tags(description)"
            : sortBy,
          { ascending: sortOrder === "asc" }
        );

      if (type) {
        query = query.eq("type", type);
      }
      if (status) {
        query = query.eq("payment_status.description", status);
      }

      if (categoryId) {
        query = query.eq("category_id", categoryId);
      }

      if (tagId) {
        query = query.eq("tag_id", tagId);
      }

      if (startDate && endDate) {
        const startDateStr = format(startDate, "yyyy-MM-dd HH:mm:ss");
        const endDateStr = format(endDate, "yyyy-MM-dd HH:mm:ss");
        query = query
          .gte("date", startDateStr)
          .lte("date", endDateStr);
      }

      const { data, error, count } = await query;

      if (error) {
        errorLogger.databaseError('SELECT', 'transactions', error, {
          userId,
          filters,
          query: 'transactions with joins',
        });
        throw error;
      }

      // Handle recurring transactions
      if (startDate) {
        try {
          const startDateStr = format(startDate, "yyyy-MM-dd");
          
          const { data: recurringTransactions, error: recurringError } =
            await supabase
              .from("recurring_transactions")
              .select("*")
              .eq("user_id", userId)
              .gte("start_date", startDateStr);

          if (recurringError) {
            errorLogger.databaseError('SELECT', 'recurring_transactions', recurringError, {
              userId,
              startDateStr,
              query: 'recurring_transactions',
            });
            throw recurringError;
          }

          if (recurringTransactions && recurringTransactions.length > 0) {
            const futureTransactionsPromises = recurringTransactions.map((item) =>
              this.generateFutureTransactions(item, filters)
            );
            futureTransactions = (await Promise.all(futureTransactionsPromises)).flat();
          }
        } catch (recurringError) {
          errorLogger.functionError('processRecurringTransactions', recurringError, {
            userId,
            startDate: startDate?.toISOString(),
          });
          throw recurringError;
        }
      }

      const enhancedFutureTransactions = futureTransactions
        .flat()
        .map((transaction) => ({
          ...transaction,
          payment_status: null,
          category: null,
          tag: null,
          recurring_transactions: null,
        }));

      const allTransactions = data
        ? [...data, ...enhancedFutureTransactions]
        : [];

      return {
        data,
        pagination: {
          total: allTransactions?.length || 0,
          page,
          limit,
          totalPages: Math.ceil((allTransactions?.length || 0) / limit),
        },
      };
    } catch (error) {
      errorLogger.functionError('TransactionService.get', error, {
        filters,
        userId,
      });
      throw error;
    }
  }

  async getFuture() {
    // TODO: Implement future transactions retrieval
    return [];
  }
}
