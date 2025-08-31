# Configuração para Testes Locais

## Problema: `supabaseUrl is required`

Este erro ocorre porque as variáveis de ambiente do Supabase não estão configuradas. Para resolver:

## ✅ Solução Rápida

### 1. Criar arquivo `.env`

Crie um arquivo `.env` na **raiz do projeto** (mesmo nível do `package.json`):

```bash
# Supabase Configuration
SUPABASE_URL=https://sua-url-do-projeto.supabase.co
SUPABASE_KEY=sua_chave_anonima_muito_longa_aqui

# Outras variáveis (opcional para testes)
COGNITO_CLIENT_ID=seu_client_id_cognito
```

### 2. Obter as Credenciais do Supabase

1. Acesse seu projeto no [Supabase Dashboard](https://supabase.com/dashboard)
2. Vá em **Settings** → **API**
3. Copie:
   - **Project URL** → `SUPABASE_URL`
   - **Anon Public Key** → `SUPABASE_KEY`

### 3. Executar o Teste

```bash
# Na raiz do projeto
npm run test:recurring
```

## 🔧 Estrutura de Arquivos

```
split-money-serverless/
├── .env                 ← Criar este arquivo
├── package.json
├── serverless.yml
└── src/
    └── functions/
        └── cron/
            └── test-recurring-transactions.ts
```

## 📝 Exemplo de `.env`

```env
SUPABASE_URL=https://xyzabc123.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## ⚠️ Importante

- **NUNCA** commite o arquivo `.env` no git
- O arquivo `.env` já está no `.gitignore`
- Use apenas a chave **anônima** (anon key), não a service key

## ✅ Verificação

Após criar o `.env`, execute:

```bash
npm run test:recurring
```

Se configurado corretamente, você verá:
```
=== TESTE DO SISTEMA DE TRANSAÇÕES RECORRENTES ===

1. Verificando transações recorrentes existentes...
Encontradas X transações recorrentes
...
```
