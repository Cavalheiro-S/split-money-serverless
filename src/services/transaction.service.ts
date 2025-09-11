import {
  addMonths,
  endOfMonth,
  format,
  isAfter,
  isEqual,
  startOfMonth,
} from "date-fns";
import { RRule } from "rrule";
import { supabase } from "../libs/supabase";
import { Database } from "../types/database/database.type";
import { ExtendedTransaction } from "../types/database/transaction.type";
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
  ): Promise<
    (Transaction & {
      payment_status?: any;
      category?: any;
      tag?: any;
    })[]
  > {
    const errorLogger = createErrorLogger({
      userId: recurringTransaction.user_id,
      functionName: "generateFutureTransactions",
    });

    const now = new Date();

    try {
      const recurringStartDate = new Date(recurringTransaction.start_date);
      const originalRule = RRule.fromString(
        recurringTransaction.recurrence_rule
      );

      const rule = new RRule({
        freq: originalRule.options.freq,
        count: originalRule.options.count,
        interval: originalRule.options.interval || 1,
        dtstart: recurringStartDate,
        bymonthday: [recurringStartDate.getUTCDate()],
        byhour: [recurringStartDate.getUTCHours()],
        byminute: [recurringStartDate.getUTCMinutes()],
        bysecond: [recurringStartDate.getUTCSeconds()],
      });

      const requestDate = filters?.date ? new Date(filters.date) : now;

      if (isAfter(recurringStartDate, requestDate)) {
        return [];
      }

      let searchStartDate: Date;
      let searchEndDate: Date;

      if (filters?.date) {
        searchStartDate = startOfMonth(requestDate);
        searchEndDate = endOfMonth(requestDate);
      } else {
        searchStartDate = now;
        searchEndDate = addMonths(now, 12);
      }

      let finalEndDate: Date;

      if (recurringTransaction.end_date) {
        finalEndDate = new Date(
          Math.min(
            recurringTransaction.end_date.getTime(),
            searchEndDate.getTime()
          )
        );
      } else if (rule.options.until) {
        finalEndDate = new Date(
          Math.min(rule.options.until.getTime(), searchEndDate.getTime())
        );
      } else {
        finalEndDate = searchEndDate;
      }

      let allDates: Date[];

      if (filters?.date && rule.options.count) {
        const requestStartDate = new Date(requestDate);
        requestStartDate.setUTCDate(recurringStartDate.getUTCDate());
        requestStartDate.setUTCHours(recurringStartDate.getUTCHours());
        requestStartDate.setUTCMinutes(recurringStartDate.getUTCMinutes());
        requestStartDate.setUTCSeconds(recurringStartDate.getUTCSeconds());

        const requestRule = new RRule({
          freq: originalRule.options.freq,
          count: originalRule.options.count,
          interval: originalRule.options.interval || 1,
          dtstart: requestStartDate,
          bymonthday: [recurringStartDate.getUTCDate()],
          byhour: [recurringStartDate.getUTCHours()],
          byminute: [recurringStartDate.getUTCMinutes()],
          bysecond: [recurringStartDate.getUTCSeconds()],
        });

        allDates = requestRule.all();
      } else if (rule.options.count) {
        allDates = rule.all();
      } else {
        allDates = rule.between(recurringStartDate, finalEndDate, true);
      }

      let dates = allDates.filter(
        (date) => date >= searchStartDate && date <= searchEndDate
      );

      if (filters?.date) {
        // Include all dates for specific date requests
      } else {
        dates = dates.filter(
          (date) => isAfter(date, now) || isEqual(date, now)
        );
      }

      const existingTransactionDates = new Set<string>();

      if (dates.length > 0) {
        const dateStrings = dates.map((date) => format(date, "yyyy-MM-dd"));

        try {
          // Verificar transações existentes para esta transação recorrente
          const { data: existingTransactions, error: existingError } =
            await supabase
              .from("transactions")
              .select("date")
              .eq("user_id", recurringTransaction.user_id)
              .eq("recurrent_transaction_id", recurringTransaction.id);

          if (existingError) {
            errorLogger.databaseError("SELECT", "transactions", existingError, {
              recurringTransactionId: recurringTransaction.id,
              userId: recurringTransaction.user_id,
              query: "check existing transactions",
            });
            throw existingError;
          }

          if (existingTransactions) {
            existingTransactions.forEach((transaction: any) => {
              existingTransactionDates.add(
                format(new Date(transaction.date), "yyyy-MM-dd")
              );
            });
          }
        } catch (checkError) {
          errorLogger.functionError("checkExistingTransactions", checkError, {
            recurringTransactionId: recurringTransaction.id,
            userId: recurringTransaction.user_id,
            dates: dateStrings,
          });
          return [];
        }
      }

      const futureTransactions = dates
        .filter(
          (date) => !existingTransactionDates.has(format(date, "yyyy-MM-dd"))
        )
        .map((date) => ({
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
          payment_status: null,
          category: null,
          tag: null,
        }));

      // Update last_generated_at
      if (futureTransactions.length > 0) {
        try {
          const { error: updateError } = await (supabase as any)
            .from("recurring_transactions")
            .update({ last_generated_at: now })
            .eq("id", recurringTransaction.id);

          if (updateError) {
            errorLogger.databaseError(
              "UPDATE",
              "recurring_transactions",
              updateError,
              {
                recurringTransactionId: recurringTransaction.id,
                operation: "update last_generated_at",
              }
            );
          }
        } catch (updateError) {
          errorLogger.functionError("updateLastGeneratedAt", updateError, {
            recurringTransactionId: recurringTransaction.id,
          });
        }
      }

      return futureTransactions;
    } catch (error) {
      errorLogger.functionError("generateFutureTransactions", error, {
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

  async get(filters: Filters): Promise<{
    data: ExtendedTransaction[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const errorLogger = createErrorLogger({
      userId: filters.userId,
      functionName: "TransactionService.get",
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

    const startDate = date ? startOfMonth(new Date(date)) : undefined;
    const endDate = date ? endOfMonth(new Date(date)) : undefined;

    try {
      // Primeiro, busque todas as transações regulares (sem paginação)
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
        .eq("user_id", userId);

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
        query = query.gte("date", startDateStr).lte("date", endDateStr);
      }

      const { data: regularTransactions, error, count } = await query;

      if (error) {
        errorLogger.databaseError("SELECT", "transactions", error, {
          userId,
          filters,
          query: "transactions with joins",
        });
        throw error;
      }

      // Busque transações recorrentes futuras
      let futureTransactions: Transaction[] = [];
      try {
        const now = new Date();
        const requestDate = filters?.date ? new Date(filters.date) : now;

        const { data: recurringTransactions, error: recurringError } =
          await supabase
            .from("recurring_transactions")
            .select("*")
            .eq("user_id", userId);

        if (recurringError) {
          errorLogger.databaseError(
            "SELECT",
            "recurring_transactions",
            recurringError,
            {
              userId,
              requestDate: format(requestDate, "yyyy-MM-dd"),
              query: "recurring_transactions",
            }
          );
          throw recurringError;
        }

        if (recurringTransactions && recurringTransactions.length > 0) {
          const activeRecurringTransactions = recurringTransactions.filter(
            (transaction: any) => {
              const transactionStartDate = new Date(transaction.start_date);

              if (transaction.end_date) {
                const transactionEndDate = new Date(transaction.end_date);
                return transactionEndDate >= requestDate;
              }

              return true;
            }
          );

          if (activeRecurringTransactions.length > 0) {
            const futureTransactionsPromises = activeRecurringTransactions.map(
              (item) => this.generateFutureTransactions(item, filters)
            );
            futureTransactions = (
              await Promise.all(futureTransactionsPromises)
            ).flat();
          }
        }
      } catch (recurringError) {
        errorLogger.functionError(
          "processRecurringTransactions",
          recurringError,
          {
            userId,
            requestDate: filters?.date,
          }
        );
        throw recurringError;
      }

      // Processe e filtre transações futuras
      const enhancedFutureTransactions = futureTransactions
        .flat()
        .map((transaction) => ({
          ...transaction,
          recurring_transactions: null,
          is_recurring_generated: true,
          is_virtual: true,
        }));

      let filteredFutureTransactions = enhancedFutureTransactions;

      if (type) {
        filteredFutureTransactions = filteredFutureTransactions.filter(
          (t) => t.type === type
        );
      }

      if (startDate && endDate) {
        filteredFutureTransactions = filteredFutureTransactions.filter((t) => {
          const transactionDate = new Date(t.date);
          return transactionDate >= startDate && transactionDate <= endDate;
        });
      }

      // Combine todas as transações e remova duplicatas
      const allTransactions = [
        ...(regularTransactions || []),
        ...filteredFutureTransactions,
      ];

      // Remover duplicatas baseado em ID, data e descrição
      const uniqueTransactions = allTransactions.reduce((acc: any[], current: any) => {
        const isDuplicate = acc.some((existing: any) => {
          // Se é uma transação real, não pode ter duplicata virtual
          if (existing.recurrent_transaction_id && current.recurrent_transaction_id) {
            return existing.recurrent_transaction_id === current.recurrent_transaction_id &&
                   format(new Date(existing.date), "yyyy-MM-dd") === format(new Date(current.date), "yyyy-MM-dd");
          }
          // Se é uma transação virtual, verificar se já existe uma real para a mesma data
          if (current.is_virtual && !existing.is_virtual) {
            return existing.recurrent_transaction_id === current.recurrent_transaction_id &&
                   format(new Date(existing.date), "yyyy-MM-dd") === format(new Date(current.date), "yyyy-MM-dd");
          }
          return false;
        });

        if (!isDuplicate) {
          acc.push(current);
        }
        return acc;
      }, []);

      // Aplique ordenação
      const sortedTransactions = uniqueTransactions.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortBy) {
          case "payment_status":
            aValue = (a as any).payment_status?.description || "";
            bValue = (b as any).payment_status?.description || "";
            break;
          case "category":
            aValue = (a as any).categories?.description || "";
            bValue = (b as any).categories?.description || "";
            break;
          case "tag":
            aValue = (a as any).tags?.description || "";
            bValue = (b as any).tags?.description || "";
            break;
          case "date":
            aValue = new Date(a.date);
            bValue = new Date(b.date);
            break;
          case "amount":
            aValue = a.amount;
            bValue = b.amount;
            break;
          default:
            aValue = (a as any)[sortBy] || "";
            bValue = (b as any)[sortBy] || "";
        }

        if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
        if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });

      // Aplique paginação corretamente
      const total = sortedTransactions.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedTransactions = sortedTransactions.slice(startIndex, endIndex);

      return {
        data: paginatedTransactions,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      errorLogger.functionError("TransactionService.get", error, {
        filters,
        userId,
      });
      throw error;
    }
  }

  async getFuture() {
    return [];
  }
}
