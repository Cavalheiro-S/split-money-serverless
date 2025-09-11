# 💰 Split Money Serverless

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![AWS](https://img.shields.io/badge/Amazon_AWS-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)](https://aws.amazon.com/)
[![Serverless](https://img.shields.io/badge/Serverless-FD5750?style=for-the-badge&logo=serverless&logoColor=white)](https://www.serverless.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)

> **Uma aplicação serverless completa para gerenciamento financeiro e divisão de despesas entre usuários**

## 📋 Sobre o Projeto

O **Split Money Serverless** é o backend de uma aplicação financeira robusta que permite aos usuários gerenciar despesas compartilhadas de forma eficiente. Com funcionalidades avançadas de autenticação, transações recorrentes, categorização e controle de pagamentos, a aplicação oferece uma solução completa para o gerenciamento financeiro pessoal e em grupo.

### 🔗 Projetos Relacionados

- **Frontend**: [split-money](https://github.com/Cavalheiro-S/split-money) - Interface Next.js
- **Aplicação Live**: [split-money.vercel.app](https://split-money.vercel.app)
- **Backend**: Este repositório (split-money-serverless)

### ✨ Principais Características

- 🔐 **Autenticação Segura** - Integração completa com AWS Cognito
- 💳 **Transações Recorrentes** - Suporte a despesas periódicas com regras RRULE
- 👥 **Divisão de Despesas** - Sistema inteligente de split entre usuários
- 📊 **Categorização Avançada** - Organização por categorias e tags
- 💰 **Controle de Pagamentos** - Acompanhamento de status de pagamentos
- 🚀 **Arquitetura Serverless** - Escalabilidade automática na AWS
- 📱 **API REST Completa** - 25 endpoints organizados em módulos

## 🛠️ Tecnologias Utilizadas

### Backend & Infraestrutura
- **Serverless Framework** - Arquitetura serverless na AWS
- **TypeScript** - Linguagem principal com tipagem forte
- **AWS Lambda** - Funções serverless
- **AWS API Gateway** - API REST
- **AWS Cognito** - Autenticação e autorização

### Banco de Dados & Serviços
- **Supabase** - Banco de dados PostgreSQL
- **Node.js** - Runtime JavaScript
- **rrule** - Regras de recorrência para transações
- **uuid** - Geração de identificadores únicos

## 🚀 Funcionalidades Disponíveis

### 🔐 Autenticação (5 endpoints)
- `POST /auth/sign-in` - Login de usuários
- `POST /auth/confirm-email` - Confirmação de email
- `POST /auth/forgot-password` - Recuperação de senha
- `POST /auth/reset-password` - Redefinição de senha
- `POST /auth/refresh-token` - Renovação de tokens

### 👤 Gerenciamento de Usuários (5 endpoints)
- `POST /user/create` - Criação de novos usuários
- `GET /user/me` - Informações do usuário logado
- `GET /user/{id}` - Busca usuário por ID
- `PUT /user/update-email` - Atualização de email
- `POST /user/confirm` - Confirmação de usuário

### 💰 Transações (5 endpoints)
- `POST /transaction/create` - Criação de transações
- `GET /transaction` - Listagem de transações
- `GET /transaction/{id}` - Busca transação específica
- `PUT /transaction/{id}` - Atualização de transações
- `DELETE /transaction/{id}` - Exclusão de transações

### 📂 Categorias (4 endpoints)
- `POST /category/create` - Criação de categorias
- `GET /category` - Busca de categorias
- `PUT /category/{id}` - Atualização de categorias
- `DELETE /category/{id}` - Exclusão de categorias

### 🏷️ Tags (4 endpoints)
- `POST /tag/create` - Criação de tags
- `GET /tag` - Busca de tags
- `PUT /tag/{id}` - Atualização de tags
- `DELETE /tag/{id}` - Exclusão de tags

### 💳 Status de Pagamento (4 endpoints)
- `POST /payment/create` - Criação de status de pagamento
- `GET /payment` - Busca de status de pagamento
- `PUT /payment/{id}` - Atualização de status de pagamento
- `DELETE /payment/{id}` - Exclusão de status de pagamento

## 🏗️ Arquitetura do Sistema

O Split Money é composto por dois repositórios principais:

### 🖥️ Frontend (Next.js)
- **Repositório**: [split-money](https://github.com/Cavalheiro-S/split-money)
- **Deploy**: [split-money.vercel.app](https://split-money.vercel.app)
- **Tecnologias**: Next.js, TypeScript, Tailwind CSS
- **Funcionalidades**: Interface de usuário, autenticação, gerenciamento de transações

### ⚙️ Backend (Serverless)
- **Repositório**: Este repositório (split-money-serverless)
- **Tecnologias**: AWS Lambda, TypeScript, Supabase
- **Funcionalidades**: API REST, autenticação, banco de dados

## 📁 Estrutura do Projeto Backend

```
src/
├── functions/              # Funções Lambda organizadas por módulo
│   ├── auth/              # 🔐 Autenticação
│   ├── user/              # 👤 Usuários
│   ├── transaction/       # 💰 Transações
│   ├── category/          # 📂 Categorias
│   ├── tag/              # 🏷️ Tags
│   └── payment-status/    # 💳 Status de pagamento
├── libs/                  # 📚 Bibliotecas (Cognito, Supabase)
├── types/                 # 🏗️ Tipos TypeScript
│   └── database/         # 🗄️ Tipos do banco de dados
├── services/             # ⚙️ Serviços de negócio
├── utils/                # 🛠️ Utilitários
└── enums/                # 📋 Enumerações
```

## 🔗 Integração Frontend + Backend

O frontend Next.js consome as APIs do backend serverless através de:

- **Autenticação**: AWS Cognito para login e autorização
- **API REST**: Endpoints serverless para todas as operações
- **Banco de Dados**: Supabase PostgreSQL compartilhado
- **Deploy**: Frontend na Vercel, Backend na AWS

### 📡 Fluxo de Dados
```
Frontend (Next.js) → API Gateway → Lambda Functions → Supabase
```

## 🚀 Como Executar

### Pré-requisitos
- Node.js (versão 18 ou superior)
- AWS CLI configurado
- Conta no Supabase
- Serverless Framework instalado globalmente

### Instalação

1. **Clone o repositório**
```bash
git clone https://github.com/Cavalheiro-S/split-money-serverless.git
cd split-money-serverless
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
cp .env.example .env
# Edite o arquivo .env com suas credenciais
```

4. **Deploy da aplicação**
```bash
serverless deploy
```

### Desenvolvimento Local

Para desenvolvimento local, use o comando:

```bash
serverless dev
```

Este comando iniciará um emulador local do AWS Lambda e tunelará suas requisições, permitindo que você interaja com suas funções como se estivessem rodando na nuvem.

## 📊 Estatísticas do Projeto

- **25 endpoints** organizados em 6 módulos principais
- **100% TypeScript** para desenvolvimento seguro
- **Arquitetura serverless** com escalabilidade automática
- **Autenticação robusta** com AWS Cognito
- **Banco relacional** PostgreSQL via Supabase
- **Suporte a transações recorrentes** com regras RRULE

## 🤝 Contribuição

Contribuições são sempre bem-vindas! Para contribuir:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'feat: add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

### Padrões de Commit

Este projeto segue o padrão [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - Nova funcionalidade
- `fix:` - Correção de bug
- `docs:` - Documentação
- `style:` - Formatação, ponto e vírgula, etc
- `refactor:` - Refatoração de código
- `test:` - Adição de testes
- `chore:` - Mudanças no build, dependências, etc

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 👨‍💻 Autor

**Lucas Cavalheiro**
- GitHub: [@Cavalheiro-S](https://github.com/Cavalheiro-S)
- LinkedIn: [Lucas Cavalheiro](https://www.linkedin.com/in/cavalheirolucas/)


⭐ **Se este projeto foi útil para você, considere dar uma estrela!**