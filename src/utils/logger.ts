export interface LogContext {
  requestId?: string;
  userId?: string;
  functionName?: string;
  timestamp?: string;
  [key: string]: any;
}

export class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = {
      timestamp: new Date().toISOString(),
      ...context,
    };
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const logEntry = {
      level,
      message,
      ...this.context,
      ...(data && { data }),
    };
    return JSON.stringify(logEntry, null, 2);
  }

  info(message: string, data?: any): void {
    console.log(this.formatMessage('INFO', message, data));
  }

  warn(message: string, data?: any): void {
    console.warn(this.formatMessage('WARN', message, data));
  }

  error(message: string, error?: any, data?: any): void {
    const errorData = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error;

    console.error(this.formatMessage('ERROR', message, {
      error: errorData,
      ...(data && { additionalData: data }),
    }));
  }

  debug(message: string, data?: any): void {
    console.log(this.formatMessage('DEBUG', message, data));
  }

  // Métodos específicos para diferentes tipos de operações
  databaseQuery(operation: string, table: string, filters?: any): void {
    this.info(`Database query: ${operation}`, {
      operation,
      table,
      filters,
    });
  }

  databaseError(operation: string, table: string, error: any): void {
    this.error(`Database error in ${operation}`, error, {
      operation,
      table,
    });
  }

  validationError(field: string, value: any, rule: string): void {
    this.warn('Validation error', {
      field,
      value,
      rule,
    });
  }

  functionStart(functionName: string, params?: any): void {
    this.info(`Function started: ${functionName}`, {
      functionName,
      params,
    });
  }

  functionEnd(functionName: string, result?: any): void {
    this.info(`Function completed: ${functionName}`, {
      functionName,
      result,
    });
  }

  functionError(functionName: string, error: any): void {
    this.error(`Function error: ${functionName}`, error, {
      functionName,
    });
  }
}

// Função helper para criar logger com contexto
export function createLogger(context: LogContext): Logger {
  return new Logger(context);
}
