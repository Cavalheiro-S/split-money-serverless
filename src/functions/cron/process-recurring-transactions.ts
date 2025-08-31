import { RRule } from "rrule";
import { format, addDays, isAfter, isBefore } from "date-fns";
import { supabase } from "../../libs/supabase";
import { createErrorLogger } from "../../utils/error-logger";
import { v4 as uuidv4 } from "uuid";

export const handler = async () => {
  const errorLogger = createErrorLogger({
    functionName: "process-recurring-transactions"
  });

  try {
    console.log("Iniciando processamento de transações recorrentes...");
    
    const now = new Date();
    const today = format(now, "yyyy-MM-dd");
    
    // Buscar todas as transações recorrentes ativas
    const { data: recurringTransactions, error: fetchError } = await (supabase as any)
      .from("recurring_transactions")
      .select("*")
      .or(`end_date.is.null,end_date.gte.${today}`);
    
    if (fetchError) {
      console.error("Erro ao buscar transações recorrentes:", fetchError);
      errorLogger.databaseError("SELECT", "recurring_transactions", fetchError, {
        operation: "fetch_active_recurring_transactions",
        date: today
      });
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: "Erro ao buscar transações recorrentes",
          error: fetchError
        })
      };
    }

    if (!recurringTransactions || recurringTransactions.length === 0) {
      console.log("Nenhuma transação recorrente encontrada");
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Nenhuma transação recorrente para processar",
          processedCount: 0
        })
      };
    }

    console.log(`Encontradas ${recurringTransactions.length} transações recorrentes para verificar`);

    let totalProcessed = 0;
    let totalGenerated = 0;

    // Processar cada transação recorrente
    for (const recurringTransaction of recurringTransactions) {
      try {
        const generated = await processRecurringTransaction(recurringTransaction, now, errorLogger);
        totalGenerated += generated;
        totalProcessed++;
      } catch (error) {
        console.error(`Erro ao processar transação recorrente ${recurringTransaction.id}:`, error);
        errorLogger.functionError("processRecurringTransaction", error, {
          recurringTransactionId: recurringTransaction.id,
          description: recurringTransaction.description
        });
      }
    }

    console.log(`Processamento concluído: ${totalProcessed} transações verificadas, ${totalGenerated} novas transações geradas`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Processamento de transações recorrentes concluído",
        processedCount: totalProcessed,
        generatedCount: totalGenerated
      })
    };

  } catch (error) {
    console.error("Erro geral no processamento de transações recorrentes:", error);
    errorLogger.functionError("processRecurringTransactions", error, {
      operation: "cron_job"
    });
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Erro no processamento de transações recorrentes",
        error: error instanceof Error ? error.message : String(error)
      })
    };
  }
};

async function processRecurringTransaction(
  recurringTransaction: any,
  now: Date,
  errorLogger: any
): Promise<number> {
  console.log(`Processando transação recorrente: ${recurringTransaction.description} (${recurringTransaction.id})`);

  const startDate = new Date(recurringTransaction.start_date);
  const endDate = recurringTransaction.end_date ? new Date(recurringTransaction.end_date) : null;
  const lastGenerated = recurringTransaction.last_generated_at ? new Date(recurringTransaction.last_generated_at) : null;

  // Definir o período para gerar transações
  const generateFrom = lastGenerated || startDate;
  const generateUntil = addDays(now, 7);

  // Se há uma data fim e ela já passou, não gerar nada
  if (endDate && isBefore(endDate, now)) {
    console.log(`Transação recorrente ${recurringTransaction.id} expirou em ${format(endDate, "yyyy-MM-dd")}`);
    return 0;
  }

  try {
    // Criar regra RRule
    const rrule = RRule.fromString(`RRULE:${recurringTransaction.recurrence_rule}`);
    
    // Gerar datas a partir da data de início até a data limite
    const dates = rrule.between(startDate, generateUntil, true);
    
    // Filtrar apenas datas que são posteriores à última gerada
    const newDates = dates.filter(date => {
      if (lastGenerated) {
        return isAfter(date, lastGenerated);
      }
      return isAfter(date, addDays(startDate, -1));
    });

    // Filtrar datas que já não são passadas demais
    const validDates = newDates.filter(date => {
      const daysDiff = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 30;
    });

    if (validDates.length === 0) {
      console.log(`Nenhuma nova data encontrada para a transação recorrente ${recurringTransaction.id}`);
      return 0;
    }

    console.log(`Gerando ${validDates.length} transações para ${recurringTransaction.description}`);

    // Verificar quais transações já existem
    const existingTransactions = await getExistingTransactions(
      recurringTransaction.id,
      validDates,
      errorLogger
    );

    const existingDatesSet = new Set(
      existingTransactions.map((t: any) => format(new Date(t.date), "yyyy-MM-dd"))
    );

    // Filtrar apenas datas que ainda não foram criadas
    const datesToCreate = validDates.filter(date => 
      !existingDatesSet.has(format(date, "yyyy-MM-dd"))
    );

    if (datesToCreate.length === 0) {
      console.log(`Todas as transações já existem para ${recurringTransaction.description}`);
      
      // Atualizar last_generated_at mesmo se não criou nada
      await updateLastGenerated(recurringTransaction.id, now, errorLogger);
      return 0;
    }

    // Criar as novas transações
    const transactionsToInsert = datesToCreate.map(date => ({
      id: uuidv4(),
      description: recurringTransaction.description,
      amount: recurringTransaction.amount,
      type: recurringTransaction.type,
      date: date, // Usar a data correta da recorrência
      note: recurringTransaction.note,
      user_id: recurringTransaction.user_id,
      recurrent_transaction_id: recurringTransaction.id,
      updated_at: date // Usar a data da recorrência, não a data atual
    }));

    const { error: insertError } = await (supabase as any)
      .from("transactions")
      .insert(transactionsToInsert);

    if (insertError) {
      console.error(`Erro ao inserir transações para ${recurringTransaction.id}:`, insertError);
      errorLogger.databaseError("INSERT", "transactions", insertError, {
        recurringTransactionId: recurringTransaction.id,
        transactionCount: transactionsToInsert.length
      });
      throw insertError;
    }

    // Atualizar last_generated_at
    await updateLastGenerated(recurringTransaction.id, now, errorLogger);

    console.log(`Criadas ${transactionsToInsert.length} transações para ${recurringTransaction.description}`);
    return transactionsToInsert.length;

  } catch (error) {
    console.error(`Erro ao processar rrule para transação ${recurringTransaction.id}:`, error);
    throw error;
  }
}

async function getExistingTransactions(
  recurringTransactionId: string,
  dates: Date[],
  errorLogger: any
) {
  const dateStrings = dates.map(date => format(date, "yyyy-MM-dd"));
  
  const { data, error } = await (supabase as any)
    .from("transactions")
    .select("date")
    .eq("recurrent_transaction_id", recurringTransactionId)
    .in("date", dateStrings);

  if (error) {
    console.error("Erro ao buscar transações existentes:", error);
    errorLogger.databaseError("SELECT", "transactions", error, {
      recurringTransactionId,
      dateCount: dateStrings.length
    });
    return [];
  }

  return data || [];
}

async function updateLastGenerated(recurringTransactionId: string, date: Date, errorLogger: any) {
  const { error } = await (supabase as any)
    .from("recurring_transactions")
    .update({ last_generated_at: date })
    .eq("id", recurringTransactionId);

  if (error) {
    console.error(`Erro ao atualizar last_generated_at para ${recurringTransactionId}:`, error);
    errorLogger.databaseError("UPDATE", "recurring_transactions", error, {
      recurringTransactionId,
      lastGeneratedAt: date.toISOString()
    });
    throw error;
  }
}
