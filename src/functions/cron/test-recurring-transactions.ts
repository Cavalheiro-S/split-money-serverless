import { handler as processRecurringTransactions } from "./process-recurring-transactions";
import { supabase } from "../../libs/supabase";
import dotenv from "dotenv";

// Carregar variáveis de ambiente
dotenv.config();

/**
 * Script de teste para verificar o funcionamento do processamento de transações recorrentes
 * 
 * PREREQUISITOS:
 * 1. Criar arquivo .env na raiz do projeto com:
 *    SUPABASE_URL=sua_url_do_supabase
 *    SUPABASE_KEY=sua_chave_anonima_do_supabase
 * 
 * 2. Executar: npm run test:recurring
 */
async function testRecurringTransactions() {
  console.log("=== TESTE DO SISTEMA DE TRANSAÇÕES RECORRENTES ===\n");

  // Verificar se as variáveis de ambiente estão configuradas
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error("❌ Erro: Variáveis de ambiente do Supabase não configuradas!");
    console.log("\n📋 Para executar este teste, você precisa:");
    console.log("1. Criar um arquivo .env na raiz do projeto");
    console.log("2. Adicionar as seguintes variáveis:");
    console.log("   SUPABASE_URL=sua_url_do_supabase");
    console.log("   SUPABASE_KEY=sua_chave_anonima_do_supabase");
    console.log("\n💡 Veja o arquivo .env.example para referência");
    return;
  }

  try {
    // 1. Verificar transações recorrentes existentes
    console.log("1. Verificando transações recorrentes existentes...");
    const { data: recurringTransactions, error: fetchError } = await (supabase as any)
      .from("recurring_transactions")
      .select("*")
      .limit(10);

    if (fetchError) {
      console.error("Erro ao buscar transações recorrentes:", fetchError);
      return;
    }

    console.log(`Encontradas ${recurringTransactions?.length || 0} transações recorrentes`);
    
    if (recurringTransactions && recurringTransactions.length > 0) {
      console.log("\nTransações recorrentes encontradas:");
      recurringTransactions.forEach((transaction: any, index: number) => {
        console.log(`${index + 1}. ${transaction.description}`);
        console.log(`   Tipo: ${transaction.type}`);
        console.log(`   Valor: R$ ${transaction.amount}`);
        console.log(`   Regra: ${transaction.recurrence_rule}`);
        console.log(`   Início: ${transaction.start_date}`);
        console.log(`   Última geração: ${transaction.last_generated_at || 'Nunca'}`);
        console.log("");
      });
    }

    // 2. Executar o processamento
    console.log("2. Executando processamento de transações recorrentes...");
    const result = await processRecurringTransactions();

    console.log("Resultado do processamento:");
    console.log(JSON.stringify(JSON.parse(result.body), null, 2));

    // 3. Verificar transações criadas recentemente
    console.log("\n3. Verificando transações criadas hoje...");
    const today = new Date().toISOString().split('T')[0];
    
    const { data: todayTransactions, error: todayError } = await (supabase as any)
      .from("transactions")
      .select(`
        id,
        description,
        amount,
        type,
        date,
        recurrent_transaction_id
      `)
      .gte("created_at", `${today}T00:00:00`)
      .not("recurrent_transaction_id", "is", null)
      .order("created_at", { ascending: false });

    if (todayError) {
      console.error("Erro ao buscar transações de hoje:", todayError);
      return;
    }

    if (todayTransactions && todayTransactions.length > 0) {
      console.log(`Encontradas ${todayTransactions.length} transações recorrentes criadas hoje:`);
      todayTransactions.forEach((transaction: any, index: number) => {
        console.log(`${index + 1}. ${transaction.description}`);
        console.log(`   Valor: R$ ${transaction.amount} (${transaction.type})`);
        console.log(`   Data: ${transaction.date}`);
        console.log(`   ID Recorrente: ${transaction.recurrent_transaction_id}`);
        console.log("");
      });
    } else {
      console.log("Nenhuma transação recorrente criada hoje");
    }

    console.log("=== TESTE CONCLUÍDO ===");

  } catch (error) {
    console.error("Erro durante o teste:", error);
  }
}

// Executar o teste se o arquivo for chamado diretamente
if (require.main === module) {
  testRecurringTransactions();
}

export { testRecurringTransactions };
