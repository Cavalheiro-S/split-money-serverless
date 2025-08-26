export interface ErrorLogContext {
  requestId?: string;
  userId?: string;
  functionName?: string;
  timestamp?: string;
  environment?: string;
  [key: string]: any;
}

export class ErrorLogger {
  private context: ErrorLogContext;

  constructor(context: ErrorLogContext = {}) {
    this.context = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      ...context,
    };
  }

  private formatErrorLog(level: 'ERROR' | 'WARN', message: string, error: any, additionalData?: any): string {
    const errorData = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error;

    const logEntry = {
      level,
      message,
      error: errorData,
      ...this.context,
      ...(additionalData && { additionalData }),
    };

    return JSON.stringify(logEntry, null, 2);
  }

  // Log de erro principal
  error(message: string, error: any, additionalData?: any): void {
    console.error(this.formatErrorLog('ERROR', message, error, additionalData));
  }

  // Log de warning
  warn(message: string, error: any, additionalData?: any): void {
    console.warn(this.formatErrorLog('WARN', message, error, additionalData));
  }

  // Log de erro de validação
  validationError(field: string, value: any, rule: string, error?: any): void {
    this.error('Validation error', error || new Error(`Invalid ${field}`), {
      field,
      value,
      rule,
      type: 'validation',
    });
  }

  // Log de erro de banco de dados
  databaseError(operation: string, table: string, error: any, query?: any): void {
    this.error(`Database error in ${operation}`, error, {
      operation,
      table,
      query,
      type: 'database',
    });
  }

  // Log de erro de função
  functionError(functionName: string, error: any, params?: any): void {
    this.error(`Function error: ${functionName}`, error, {
      functionName,
      params,
      type: 'function',
    });
  }

  // Log de erro de API
  apiError(endpoint: string, method: string, error: any, requestData?: any): void {
    this.error(`API error: ${method} ${endpoint}`, error, {
      endpoint,
      method,
      requestData,
      type: 'api',
    });
  }

  // Log de erro de autenticação
  authError(operation: string, error: any, userId?: string): void {
    this.error(`Authentication error in ${operation}`, error, {
      operation,
      userId,
      type: 'authentication',
    });
  }

  // Log de erro de integração externa
  integrationError(service: string, operation: string, error: any, requestData?: any): void {
    this.error(`Integration error: ${service} - ${operation}`, error, {
      service,
      operation,
      requestData,
      type: 'integration',
    });
  }

  // Log de erro de timeout
  timeoutError(operation: string, timeout: number, error?: any): void {
    this.error(`Timeout error in ${operation}`, error || new Error(`Operation timed out after ${timeout}ms`), {
      operation,
      timeout,
      type: 'timeout',
    });
  }

  // Log de erro de memória
  memoryError(operation: string, error: any, memoryUsage?: any): void {
    this.error(`Memory error in ${operation}`, error, {
      operation,
      memoryUsage,
      type: 'memory',
    });
  }

  // Log de erro de rede
  networkError(operation: string, error: any, url?: string): void {
    this.error(`Network error in ${operation}`, error, {
      operation,
      url,
      type: 'network',
    });
  }
}

// Função helper para criar error logger com contexto
export function createErrorLogger(context: ErrorLogContext): ErrorLogger {
  return new ErrorLogger(context);
}

// Função helper para log rápido de erro
export function logError(message: string, error: any, context?: ErrorLogContext): void {
  const logger = createErrorLogger(context || {});
  logger.error(message, error);
}
