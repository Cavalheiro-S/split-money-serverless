# Sistema de Transações Recorrentes

Este documento explica como funciona o sistema automático de processamento de transações recorrentes no Split Money.

## Como Funciona

O sistema processa automaticamente as transações recorrentes criadas pelos usuários, gerando novas transações baseadas nas regras de recorrência definidas.

### Componentes Principais

1. **Função de Processamento Automático** (`process-recurring-transactions.ts`)
   - Executa diariamente às 6:00 AM UTC via cron job
   - Identifica transações recorrentes que precisam gerar novas instâncias
   - Cria automaticamente as transações baseadas nas regras RRule

2. **Trigger Manual** (`trigger-recurring-transactions.ts`)
   - Endpoint HTTP para execução manual: `POST /admin/process-recurring-transactions`
   - Útil para testes e execuções sob demanda
   - Requer autenticação

3. **Script de Teste** (`test-recurring-transactions.ts`)
   - Ferramenta para testar o sistema localmente
   - Mostra estatísticas e resultados do processamento

## Funcionamento Detalhado

### 1. Identificação de Transações para Processar

O sistema busca todas as transações recorrentes que:
- Não possuem data de fim OU ainda não expiraram
- Precisam gerar novas transações baseadas na regra de recorrência

### 2. Geração de Datas

Para cada transação recorrente:
- Utiliza a biblioteca RRule para calcular as próximas datas
- Considera a data de início e a última data gerada (`last_generated_at`)
- Gera transações até 7 dias no futuro
- Não gera transações com mais de 30 dias de diferença da data atual

### 3. Prevenção de Duplicatas

- Verifica se já existem transações para as datas calculadas
- Só cria transações para datas que ainda não possuem registros
- Atualiza o campo `last_generated_at` após o processamento

### 4. Tratamento de Erros

- Log detalhado de todos os erros
- Utiliza o sistema de `errorLogger` existente
- Continua processando outras transações mesmo se uma falhar

## Configuração do Cron Job

O agendamento está configurado no `serverless.yml`:

```yaml
processRecurringTransactions:
  handler: src/functions/cron/process-recurring-transactions.handler
  events:
    - schedule:
        rate: cron(0 6 * * ? *)  # Todos os dias às 6:00 AM UTC
        description: "Processa transações recorrentes diariamente"
```

### Alterar Horário de Execução

Para alterar o horário, modifique a expressão cron:
- `cron(0 6 * * ? *)` = 6:00 AM UTC diariamente
- `cron(0 */6 * * ? *)` = A cada 6 horas
- `cron(0 8 * * ? *)` = 8:00 AM UTC diariamente

## Como Testar

### 1. Teste Local

Execute o script de teste:

```bash
cd src/functions/cron
npx ts-node test-recurring-transactions.ts
```

### 2. Teste via API

Faça uma requisição POST para o endpoint:

```bash
curl -X POST https://sua-api.com/admin/process-recurring-transactions \
  -H "Authorization: Bearer SEU_TOKEN"
```

### 3. Verificar Logs

Monitore os logs no AWS CloudWatch para ver o processamento automático.

## Monitoramento

### Métricas Importantes

- Número de transações recorrentes processadas
- Número de novas transações geradas
- Erros durante o processamento
- Tempo de execução

### Logs

Os logs incluem:
- Início e fim do processamento
- Detalhes de cada transação recorrente processada
- Número de transações criadas
- Erros detalhados com contexto

## Regras de Negócio

### Limitações

1. **Período de Geração**: Máximo 7 dias no futuro
2. **Período Retroativo**: Máximo 30 dias no passado
3. **Frequência de Execução**: Uma vez por dia
4. **Duplicatas**: Sistema previne criação de transações duplicadas

### Tratamento de Casos Especiais

- **Transações Expiradas**: Não gera novas instâncias para transações com `end_date` no passado
- **Primeira Execução**: Inclui a data de início na primeira geração
- **Regras Inválidas**: Registra erro mas continua processando outras transações

## Estrutura de Dados

### Campos Utilizados

```typescript
interface RecurringTransaction {
  id: string
  description: string
  type: 'income' | 'outcome'
  amount: number
  recurrence_rule: string  // RRule format
  start_date: Date
  end_date?: Date
  last_generated_at?: Date
  user_id: string
}
```

### Exemplo de RRule

- `FREQ=DAILY;INTERVAL=1` = Diariamente
- `FREQ=WEEKLY;INTERVAL=1` = Semanalmente
- `FREQ=MONTHLY;INTERVAL=1` = Mensalmente
- `FREQ=YEARLY;INTERVAL=1` = Anualmente

## Solução de Problemas

### Problemas Comuns

1. **Transações não sendo geradas**
   - Verificar se a transação recorrente está ativa
   - Verificar se a regra RRule é válida
   - Verificar logs de erro

2. **Transações duplicadas**
   - O sistema possui proteção contra duplicatas
   - Se ocorrer, verificar integridade dos dados

3. **Erro de conexão com banco**
   - Verificar configuração do Supabase
   - Verificar variáveis de ambiente

### Debug

1. Execute o script de teste para verificar o estado atual
2. Verifique logs no CloudWatch
3. Execute manualmente via endpoint `/admin/process-recurring-transactions`

## Futuras Melhorias

- [ ] Interface web para monitoramento
- [ ] Notificações de erro via email/Slack
- [ ] Métricas detalhadas no CloudWatch
- [ ] Configuração de horário personalizado por usuário
- [ ] Suporte a regras de recorrência mais complexas
