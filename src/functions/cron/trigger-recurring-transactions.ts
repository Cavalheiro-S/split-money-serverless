import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { handler as processRecurringTransactions } from "./process-recurring-transactions";

/**
 * Endpoint para executar manualmente o processamento de transações recorrentes
 * Útil para testes e execuções sob demanda
 */
export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
  try {
    console.log("Executando processamento manual de transações recorrentes...");
    
    // Chamar a função de processamento
    const result = await processRecurringTransactions();
    
    console.log("Processamento manual concluído:", result);
    
    return result;
    
  } catch (error) {
    console.error("Erro no processamento manual:", error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Erro no processamento manual de transações recorrentes",
        error: error instanceof Error ? error.message : String(error)
      })
    };
  }
};
