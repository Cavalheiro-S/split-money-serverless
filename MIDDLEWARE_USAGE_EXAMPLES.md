# Guia de Uso dos Middlewares

## ✅ Problema Resolvido

O `errorMiddleware.ts` tinha um erro de tipo ao usar o tipo `Handler` do AWS Lambda, que espera 3 argumentos (event, context, callback).

**Solução:** Criamos o tipo `AsyncHandler` que é mais adequado para handlers async modernos que retornam Promises.

## Tipos Disponíveis

```typescript
// Handler assíncrono genérico
type AsyncHandler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

// Handler autenticado (com userId injetado)
type AuthenticatedHandler = (event: AuthenticatedEvent) => Promise<APIGatewayProxyResult>;

// Event com userId
interface AuthenticatedEvent extends APIGatewayProxyEvent {
  userId: string;
}
```

## Exemplos de Uso

### 1. Handler Público (sem autenticação)

```typescript
import { withPublicMiddleware, ResponseBuilder } from '@/presentation/middleware';

export const handler = withPublicMiddleware(async (event) => {
  // Lógica do handler público
  return ResponseBuilder.ok({ message: 'Public endpoint' });
});
```

### 2. Handler Protegido (com autenticação)

```typescript
import {
  withStandardMiddleware,
  AuthenticatedEvent,
  ResponseBuilder,
  NotFoundError,
} from '@/presentation/middleware';

export const handler = withStandardMiddleware(async (event: AuthenticatedEvent) => {
  const userId = event.userId; // ✅ Já validado pelo middleware

  const item = await getItem(userId);
  if (!item) {
    throw new NotFoundError('Item'); // ✅ Automaticamente retorna 404
  }

  return ResponseBuilder.ok(item);
});
```

### 3. Handler com Validação Zod

```typescript
import { z } from 'zod';
import {
  withStandardMiddleware,
  AuthenticatedEvent,
  ResponseBuilder,
  ValidationError,
} from '@/presentation/middleware';

const schema = z.object({
  name: z.string().min(3).max(50),
  email: z.string().email(),
});

export const handler = withStandardMiddleware(async (event: AuthenticatedEvent) => {
  const body = JSON.parse(event.body || '{}');

  // Validação com Zod
  const result = schema.safeParse(body);
  if (!result.success) {
    // ✅ O errorMiddleware vai capturar e formatar automaticamente
    throw result.error;
  }

  const data = result.data;
  const userId = event.userId;

  // Lógica do handler
  const created = await createItem(userId, data);

  return ResponseBuilder.created(created, 'Item created successfully');
});
```

### 4. Handler com Tratamento Manual de Erros

```typescript
import {
  withStandardMiddleware,
  AuthenticatedEvent,
  ResponseBuilder,
  ConflictError,
} from '@/presentation/middleware';

export const handler = withStandardMiddleware(async (event: AuthenticatedEvent) => {
  const userId = event.userId;
  const { id } = event.pathParameters || {};

  // Verificar dependências antes de deletar
  const hasDependents = await checkDependents(id, userId);
  if (hasDependents) {
    // ✅ Lançar erro tipado que será formatado automaticamente
    throw new ConflictError(
      'Cannot delete category with transactions',
      'HAS_DEPENDENT_RECORDS'
    );
  }

  await deleteItem(id, userId);

  return ResponseBuilder.noContent();
});
```

### 5. Handler com Composição Manual de Middlewares

```typescript
import {
  withAuth,
  withErrorHandling,
  AuthenticatedEvent,
  ResponseBuilder,
} from '@/presentation/middleware';

// Aplicar middlewares manualmente (mesma coisa que withStandardMiddleware)
export const handler = withErrorHandling(
  withAuth(async (event: AuthenticatedEvent) => {
    const userId = event.userId;

    // Lógica do handler
    const data = await getData(userId);

    return ResponseBuilder.ok(data);
  })
);
```

### 6. Handler com Múltiplos Middlewares Customizados

```typescript
import {
  compose,
  withAuth,
  withErrorHandling,
  AuthenticatedEvent,
  ResponseBuilder,
} from '@/presentation/middleware';

// Criar middleware customizado (exemplo: rate limiting)
function withRateLimiting(handler: AsyncHandler): AsyncHandler {
  return async (event) => {
    const userId = event.userId; // Assumindo que withAuth já foi aplicado

    const isRateLimited = await checkRateLimit(userId);
    if (isRateLimited) {
      return ResponseBuilder.custom(429, {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests',
        },
      });
    }

    return handler(event);
  };
}

// Compor múltiplos middlewares
export const handler = compose([
  withErrorHandling,
  withAuth,
  withRateLimiting,
])(async (event: AuthenticatedEvent) => {
  // Handler logic
  return ResponseBuilder.ok({ message: 'Success' });
});
```

## Exceções Customizadas Disponíveis

```typescript
// 400 Bad Request
throw new ValidationError('Invalid input', { field: 'email', error: 'Invalid format' });

// 401 Unauthorized
throw new UnauthorizedError('Invalid token');

// 403 Forbidden
throw new ForbiddenError('Insufficient permissions');

// 404 Not Found
throw new NotFoundError('Category'); // Mensagem: "Category not found"

// 409 Conflict
throw new ConflictError('Resource already exists', 'DUPLICATE');

// Custom error
throw new AppError(418, 'IM_A_TEAPOT', "I'm a teapot");
```

## ResponseBuilder - Métodos Disponíveis

```typescript
// 200 OK
ResponseBuilder.ok(data);
ResponseBuilder.ok(data, { pagination: { page: 1, limit: 10, ... } });
ResponseBuilder.ok(data, { stats: { totalCreated: 10 } });

// 201 Created
ResponseBuilder.created(data, 'Resource created');

// 204 No Content
ResponseBuilder.noContent();

// 400 Bad Request
ResponseBuilder.badRequest('Invalid input', { email: 'Invalid format' });

// 401 Unauthorized
ResponseBuilder.unauthorized('Invalid token');

// 403 Forbidden
ResponseBuilder.forbidden('Access denied');

// 404 Not Found
ResponseBuilder.notFound('Category');

// 409 Conflict
ResponseBuilder.conflict('Already exists', 'DUPLICATE');

// 500 Internal Server Error
ResponseBuilder.internalError('Database error', requestId);

// Custom
ResponseBuilder.custom(418, { message: "I'm a teapot" });
```

## Migração de Handler Antigo para Novo Padrão

### ANTES (50+ linhas)

```typescript
import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { z } from 'zod';
import { supabase } from '../../libs/supabase';

const schema = z.object({
  description: z.string().min(3).max(50),
});

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
  try {
    const { id } = event.pathParameters || {};
    const body = JSON.parse(event.body || '{}');

    const { success, data, error } = schema.safeParse(body);
    if (error || !success) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid data', error }),
      };
    }

    const userId = event.requestContext.authorizer.jwt.claims.sub;
    if (!userId || typeof userId !== 'string') {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Unauthorized' }),
      };
    }

    const { data: item, error: dbError } = await supabase
      .from('categories')
      .update({ description: data.description, updated_at: new Date() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (dbError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Error updating category', error: dbError }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Category updated', data: item }),
    };
  } catch (error) {
    console.log({ error });
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal error', error }),
    };
  }
};
```

### DEPOIS (20 linhas)

```typescript
import { z } from 'zod';
import { supabase } from '../../libs/supabase';
import {
  withStandardMiddleware,
  AuthenticatedEvent,
  ResponseBuilder,
} from '../../presentation/middleware';

const schema = z.object({
  description: z.string().min(3).max(50),
});

export const handler = withStandardMiddleware(async (event: AuthenticatedEvent) => {
  const { id } = event.pathParameters || {};
  const body = JSON.parse(event.body || '{}');

  // ✅ Se falhar, errorMiddleware captura e formata automaticamente
  const data = schema.parse(body);
  const userId = event.userId; // ✅ Já validado

  const { data: item, error } = await supabase
    .from('categories')
    .update({ description: data.description, updated_at: new Date() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error; // ✅ errorMiddleware mapeia para resposta apropriada

  return ResponseBuilder.ok(item);
});
```

## Benefícios

✅ **Redução de 60% no código** (50+ linhas → 20 linhas)
✅ **Eliminação de duplicação** (auth, error handling, response formatting)
✅ **Type safety completo** (TypeScript strict mode)
✅ **Error handling consistente** (todos erros formatados igual)
✅ **Logging estruturado** (ErrorLogger integrado)
✅ **Fácil manutenção** (mudanças em um lugar afetam todos handlers)
✅ **Testabilidade** (mocks simplificados, handlers puros)

## Próximos Passos

1. Migrar handlers piloto (get-category, create-tag, get-recurring-transactions)
2. Escrever testes de integração para handlers migrados
3. Escalar para todos os 35 handlers
4. Configurar pre-commit hooks para garantir padrão
