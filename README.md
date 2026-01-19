# 🏢 ERP Globaltec

Sistema de gestão empresarial completo desenvolvido com tecnologias modernas, oferecendo controle total sobre projetos, estoque, compras, tarefas, usuários e muito mais.

## 📋 Índice

- [Sobre o Projeto](#-sobre-o-projeto)
- [Stack Tecnológica](#-stack-tecnológica)
- [Funcionalidades](#-funcionalidades)
- [Arquitetura](#-arquitetura)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação e Configuração](#-instalação-e-configuração)
- [Uso](#-uso)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Sistema de Permissões](#-sistema-de-permissões)
- [API e Endpoints](#-api-e-endpoints)
- [Banco de Dados](#-banco-de-dados)
- [Docker](#-docker)
- [Desenvolvimento](#-desenvolvimento)
- [Troubleshooting](#-troubleshooting)
- [Contribuindo](#-contribuindo)

---

## 🎯 Sobre o Projeto

O **ERP Globaltec** é uma solução completa de gestão empresarial que permite:

- ✅ **Gestão de Projetos**: Criação, acompanhamento e finalização de projetos com controle de etapas e subetapas
- ✅ **Sistema de Estoque**: Controle completo de itens, alocações e movimentações
- ✅ **Gestão de Compras**: Solicitação, aprovação, cotações múltiplas e rastreamento de entregas
- ✅ **Tarefas e Etapas**: Sistema completo de workflow com checklists, entregas e aprovações
- ✅ **Comunicação Interna**: Ocorrências e requerimentos formais entre usuários
- ✅ **Gestão de Usuários**: Controle de acesso baseado em cargos (RBAC)
- ✅ **Fornecedores e Categorias**: Cadastro e integração com API de CNPJ
- ✅ **Relatórios**: Geração de PDFs e planilhas Excel com dados detalhados

---

## 🛠️ Stack Tecnológica

### Backend
- **NestJS 10.0.0** - Framework Node.js progressivo
- **Prisma 5.20.0** - ORM moderno e type-safe
- **PostgreSQL 15** - Banco de dados relacional
- **Passport + JWT** - Autenticação e autorização
- **bcrypt** - Hash de senhas
- **TypeScript 5.4.5** - Tipagem estática
- **class-validator** - Validação de DTOs
- **jsPDF** - Geração de PDFs

### Frontend
- **React 18.3.1** - Biblioteca UI
- **Vite 5.4.10** - Build tool e dev server
- **TypeScript 5.4.5** - Tipagem estática
- **React Router DOM 6.27.0** - Roteamento
- **Zustand 4.5.4** - Gerenciamento de estado
- **Axios 1.7.8** - Cliente HTTP
- **Tailwind CSS 3.4.14** - Framework CSS utility-first
- **jsPDF 3.0.3** - Geração de PDFs
- **xlsx + xlsx-js-style** - Geração de planilhas Excel formatadas

### DevOps
- **Docker & Docker Compose** - Containerização
- **Nginx** - Servidor web para frontend (produção)
- **PostgreSQL 15 Alpine** - Banco de dados containerizado

---

## ✨ Funcionalidades

### 🔐 Autenticação e Autorização
- Login com JWT (expiração de 8 horas)
- Registro de novos usuários
- Sistema RBAC (Role-Based Access Control)
- Guards de autenticação e autorização
- Controle de acesso por cargo e páginas permitidas
- Ativação/desativação de usuários

### 👥 Gestão de Usuários e Cargos
- CRUD completo de usuários
- CRUD completo de cargos
- Atribuição de cargos a usuários
- Sistema de permissões granular
- Níveis de acesso (NIVEL_0 a NIVEL_4)
- Páginas permitidas por cargo (JSON configurável)

### 📁 Gestão de Projetos
- CRUD completo de projetos
- Atribuição de supervisor e responsáveis múltiplos
- Cálculo automático de progresso (baseado em checklist)
- Finalização de projetos
- Controle de valores (total e insumos)
- Visualização detalhada com etapas e compras relacionadas
- Filtros e busca

### 📋 Gestão de Etapas e Tarefas
- CRUD completo de etapas
- Subetapas com status independente
- Checklist de objetivos configurável
- Sistema de entregas com imagens e documentos
- Aprovação/rejeição de entregas
- Edição de entregas em análise
- Atribuição de executor e integrantes múltiplos
- Status: PENDENTE, EM_ANDAMENTO, EM_ANALISE, APROVADA, REPROVADA
- Cálculo de progresso baseado em checklist

### 🛒 Estoque e Compras
- CRUD completo de itens de estoque
- Sistema de alocação para projetos/etapas/usuários
- Cálculo automático de quantidade disponível vs alocada
- Sistema completo de compras
- Solicitação de compras com descrição e motivo
- Aprovação/rejeição de solicitações
- Cotações múltiplas por item
- Upload de imagens (base64)
- Status: SOLICITADO, REPROVADO, PENDENTE, COMPRADO_ACAMINHO, ENTREGUE
- Integração automática: compra → estoque quando ENTREGUE
- Rastreamento de entregas (previsão, data, endereço, recebido por)
- Filtros avançados: categoria, datas (compra, recebimento, entrega), busca textual
- Relatórios detalhados em PDF e Excel

### 🏪 Fornecedores e Categorias
- CRUD completo de fornecedores
- Integração com API ReceitaWS para busca automática por CNPJ
- Preenchimento automático de dados (razão social, endereço, etc.)
- CRUD completo de categorias de compra
- Associação de categorias a itens e compras

### 📢 Ocorrências e Requerimentos
- CRUD completo de ocorrências
- CRUD completo de requerimentos
- Envio e recebimento entre usuários
- Respostas a requerimentos
- Anexos (imagens e documentos)
- Status de pendência e resolução

### 🔔 Notificações
- Sistema de notificações em tempo real
- Tipos: INFO, SUCCESS, WARNING, ERROR
- Marcação de leitura
- Notificações por usuário

### 📊 Relatórios
- Relatórios de compras em PDF
- Relatórios de compras em Excel formatado
- Filtros e tabelas interativas no Excel
- Estatísticas detalhadas (por status, categoria, fornecedor)
- Exportação com formatação profissional

---

## 🏗️ Arquitetura

### Estrutura Geral

```
ERP-Globaltec/
├── backend/                 # API REST NestJS
│   ├── src/
│   │   ├── modules/         # Módulos de domínio
│   │   │   ├── auth/       # Autenticação
│   │   │   ├── users/      # Usuários
│   │   │   ├── cargos/     # Cargos
│   │   │   ├── projects/   # Projetos
│   │   │   ├── tasks/      # Tarefas e Etapas
│   │   │   ├── stock/      # Estoque e Compras
│   │   │   ├── suppliers/  # Fornecedores
│   │   │   ├── categories/ # Categorias
│   │   │   ├── occurrences/# Ocorrências
│   │   │   ├── requests/   # Requerimentos
│   │   │   └── notifications/ # Notificações
│   │   ├── common/         # Recursos compartilhados
│   │   │   ├── decorators/ # Decorators customizados
│   │   │   └── guards/     # Guards de autenticação/autorização
│   │   ├── prisma/         # Serviço Prisma
│   │   └── main.ts         # Bootstrap da aplicação
│   ├── prisma/
│   │   ├── schema.prisma   # Schema do banco
│   │   ├── migrations/     # Migrações
│   │   └── seed.ts         # Seed do banco
│   ├── package.json
│   └── Dockerfile
│
├── frontend/                # Aplicação React
│   ├── src/
│   │   ├── pages/          # Páginas da aplicação
│   │   ├── components/    # Componentes reutilizáveis
│   │   │   ├── layout/     # Layout (Sidebar, Header)
│   │   │   └── stock/     # Componentes de estoque
│   │   ├── hooks/         # Hooks customizados
│   │   ├── services/      # Serviços de API
│   │   ├── store/         # Estado global (Zustand)
│   │   ├── types/         # Tipos TypeScript
│   │   ├── utils/         # Utilitários
│   │   └── constants/     # Constantes
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml      # Orquestração Docker
├── env.example            # Exemplo de variáveis de ambiente
└── README.md              # Este arquivo
```

### Fluxo de Dados

```
Frontend (React)
    ↓ (HTTP + JWT)
Backend (NestJS)
    ↓ (Prisma ORM)
PostgreSQL Database
```

### Padrões de Arquitetura

- **Backend**: Arquitetura modular (NestJS Modules)
- **Frontend**: Component-based architecture (React)
- **Estado**: Zustand para estado global, useState para estado local
- **Roteamento**: React Router com rotas protegidas
- **API**: RESTful com DTOs validados
- **Banco**: Relacional com Prisma ORM

---

## 📦 Pré-requisitos

### Para Desenvolvimento Local
- **Node.js** 20+ ([Download](https://nodejs.org/))
- **PostgreSQL** 15+ ([Download](https://www.postgresql.org/download/))
- **npm** ou **yarn**
- **Git**

### Para Docker
- **Docker** 20+ ([Download](https://www.docker.com/get-started))
- **Docker Compose** 2.0+

### Recomendado
- **VS Code** com extensões:
  - ESLint
  - Prettier
  - Prisma
  - Tailwind CSS IntelliSense

---

## 🚀 Instalação e Configuração

### Opção 1: Docker (Recomendado para Produção)

1. **Clone o repositório**:
```bash
git clone <repository-url>
cd ERP-Globaltec-main
```

2. **Configure as variáveis de ambiente**:
```powershell
Copy-Item env.example .env
# Edite o .env com suas configurações (opcional)
```

3. **Inicie os serviços**:
```powershell
docker-compose up -d --build
```

4. **Execute as migrações** (primeira vez):
```powershell
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npx prisma db seed
```

5. **Acesse a aplicação**:
- Frontend: http://localhost:5174
- Backend: http://localhost:3001
- Health Check: http://localhost:3001/health

**Ver logs**:
```powershell
docker-compose logs -f
```

**Parar serviços**:
```powershell
docker-compose down
```

### Opção 2: Desenvolvimento Local

#### 1. Configurar Banco de Dados PostgreSQL

**Opção A: Usar Docker apenas para o banco**:
```powershell
docker-compose up db -d
```

**Opção B: PostgreSQL local**:
```sql
-- Conecte ao PostgreSQL (psql -U postgres)
CREATE DATABASE erpdb;
CREATE USER erp WITH PASSWORD 'senha123';
GRANT ALL PRIVILEGES ON DATABASE erpdb TO erp;
\c erpdb
GRANT ALL ON SCHEMA public TO erp;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO erp;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO erp;
```

#### 2. Configurar Backend

```powershell
cd backend

# Instalar dependências
npm install

# Criar arquivo .env
# Copie o conteúdo abaixo:
# DATABASE_URL="postgresql://erp:senha123@localhost:5432/erpdb"
# JWT_SECRET="troque-este-segredo-por-um-seguro"
# PORT=3000

# Gerar cliente Prisma
npm run prisma:generate

# Executar migrações
npm run prisma:migrate

# Popular banco com dados de exemplo (opcional)
npm run prisma:seed

# Iniciar servidor de desenvolvimento
npm run start:dev
```

#### 3. Configurar Frontend

```powershell
cd frontend

# Instalar dependências
npm install

# Criar arquivo .env
# Copie o conteúdo abaixo:
# VITE_API_URL=http://localhost:3000

# Iniciar servidor de desenvolvimento
npm run dev
```

#### 4. Acessar a Aplicação

- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- Health Check: http://localhost:3000/health

### Credenciais Padrão (após seed)

- **Administrador**: `admin@globaltec.com` / `admin123`
- **Supervisor**: `supervisor@globaltec.com` / `senha123`
- **Executor**: `executor@globaltec.com` / `senha123`
- **Cotador**: `cotador@globaltec.com` / `senha123`
- **Pagador**: `pagador@globaltec.com` / `senha123`

---

## 📖 Uso

### Autenticação

1. Acesse a página de login
2. Informe email e senha
3. O sistema redireciona automaticamente para a primeira página permitida ao seu cargo

### Navegação

O sistema possui um menu lateral (Sidebar) que filtra automaticamente as opções baseado no seu cargo:

- **Dashboard**: Visão geral (apenas Diretor)
- **Projetos**: Gestão de projetos (apenas Diretor)
- **Meu Trabalho**: Tarefas atribuídas
- **Compras & Estoque**: Gestão de estoque e compras
- **Ocorrências**: Comunicação informal
- **Requerimentos**: Comunicação formal
- **Usuários**: Gestão de usuários (apenas Diretor)
- **Cargos**: Gestão de cargos (apenas Diretor)
- **Fornecedores**: Cadastro de fornecedores
- **Categorias**: Categorias de compra

### Funcionalidades Principais

#### Criar Projeto
1. Acesse "Projetos"
2. Clique em "Novo Projeto"
3. Preencha os dados (nome, valores, supervisor, responsáveis)
4. Salve

#### Criar Compra
1. Acesse "Compras & Estoque" → aba "Compras"
2. Clique em "Nova Compra"
3. Selecione projeto, preencha item e quantidade
4. Adicione cotações (múltiplas opções)
5. Salve

#### Alocar Estoque
1. Acesse "Compras & Estoque" → aba "Estoque"
2. Clique em "Alocar" no item desejado
3. Selecione projeto/etapa/usuário e quantidade
4. Confirme

#### Gerar Relatório
1. Acesse "Compras & Estoque" → aba "Compras"
2. Use os filtros para selecionar as compras desejadas
3. Clique em "Gerar Relatório"
4. Escolha entre PDF ou Excel

---

## 📁 Estrutura do Projeto

### Backend (`backend/`)

```
backend/
├── src/
│   ├── modules/              # Módulos de domínio
│   │   ├── auth/            # Autenticação JWT
│   │   ├── users/           # Gestão de usuários
│   │   ├── cargos/          # Gestão de cargos
│   │   ├── projects/        # Gestão de projetos
│   │   ├── tasks/           # Gestão de etapas/tarefas
│   │   ├── stock/           # Estoque e compras
│   │   ├── suppliers/       # Fornecedores
│   │   ├── categories/      # Categorias
│   │   ├── occurrences/     # Ocorrências
│   │   ├── requests/        # Requerimentos
│   │   └── notifications/    # Notificações
│   ├── common/              # Recursos compartilhados
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   └── roles.decorator.ts
│   │   └── guards/
│   │       ├── jwt-auth.guard.ts
│   │       └── roles.guard.ts
│   ├── prisma/
│   │   ├── prisma.service.ts
│   │   └── prisma.module.ts
│   └── main.ts              # Entry point
├── prisma/
│   ├── schema.prisma        # Schema do banco
│   ├── migrations/          # Histórico de migrações
│   └── seed.ts              # Dados iniciais
├── package.json
├── tsconfig.json
└── Dockerfile
```

### Frontend (`frontend/`)

```
frontend/
├── src/
│   ├── pages/               # Páginas da aplicação
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Projects.tsx
│   │   ├── ProjectDetails.tsx
│   │   ├── MyTasks.tsx
│   │   ├── Stock.tsx
│   │   ├── Occurrences.tsx
│   │   ├── Requests.tsx
│   │   ├── Users.tsx
│   │   ├── Cargos.tsx
│   │   ├── Suppliers.tsx
│   │   └── Categories.tsx
│   ├── components/         # Componentes reutilizáveis
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   ├── stock/
│   │   │   ├── modals/
│   │   │   ├── filters/
│   │   │   └── tables/
│   │   ├── ProtectedRoute.tsx
│   │   ├── Notifications.tsx
│   │   └── ToastContainer.tsx
│   ├── hooks/              # Hooks customizados
│   │   ├── useStockData.ts
│   │   └── usePurchaseFilters.ts
│   ├── services/
│   │   └── api.ts          # Cliente Axios
│   ├── store/
│   │   └── auth.ts         # Estado de autenticação
│   ├── types/              # Tipos TypeScript
│   │   ├── stock.ts
│   │   └── types.ts
│   ├── utils/              # Utilitários
│   │   ├── validation.ts
│   │   ├── toast.ts
│   │   └── getFirstAllowedPage.ts
│   ├── constants/          # Constantes
│   │   └── stock.ts
│   ├── App.tsx             # Componente raiz
│   └── main.tsx            # Entry point
├── package.json
├── vite.config.ts
├── tailwind.config.cjs
└── Dockerfile
```

---

## 🔐 Sistema de Permissões

### Cargos Disponíveis

1. **DIRETOR** (NIVEL_4)
   - Acesso total ao sistema
   - Dashboard, Projetos, Usuários, Cargos
   - Todas as outras funcionalidades

2. **SUPERVISOR** (NIVEL_3)
   - Gestão de projetos atribuídos
   - Meu Trabalho, Ocorrências, Requerimentos
   - Visualização de projetos

3. **EXECUTOR** (NIVEL_2)
   - Execução de tarefas atribuídas
   - Meu Trabalho, Ocorrências, Requerimentos

4. **COTADOR** (NIVEL_1)
   - Gestão de compras e cotações
   - Meu Trabalho, Compras & Estoque, Ocorrências

5. **PAGADOR** (NIVEL_1)
   - Gestão de pagamentos
   - Meu Trabalho, Compras & Estoque, Ocorrências

### Implementação

**Backend**:
- Guards: `JwtAuthGuard` (autenticação) + `RolesGuard` (autorização)
- Decorators: `@Roles(Cargo.DIRETOR)` para restringir rotas
- `@CurrentUser()` para obter usuário do JWT

**Frontend**:
- Sidebar filtra links baseado no cargo
- `ProtectedRoute` verifica autenticação
- Redirecionamento para primeira página permitida

---

## 🌐 API e Endpoints

### Autenticação

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| POST | `/auth/login` | Login | Público |
| POST | `/auth/register` | Registro | Público |

### Projetos

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | `/projects` | Listar projetos | DIRETOR |
| GET | `/projects/:id` | Detalhes do projeto | Autenticado |
| POST | `/projects` | Criar projeto | DIRETOR |
| PATCH | `/projects/:id` | Atualizar projeto | DIRETOR |
| PATCH | `/projects/:id/finalize` | Finalizar projeto | DIRETOR |

### Tarefas/Etapas

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | `/tasks/my` | Minhas tarefas | Autenticado |
| POST | `/tasks/:id/deliver` | Entregar tarefa | EXECUTOR+ |
| POST | `/tasks/:id/approve` | Aprovar entrega | SUPERVISOR+ |
| POST | `/tasks/:id/reject` | Rejeitar entrega | SUPERVISOR+ |

### Estoque e Compras

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | `/stock/items` | Listar itens | Autenticado |
| POST | `/stock/items` | Criar item | COTADOR+ |
| GET | `/stock/purchases` | Listar compras | Autenticado |
| POST | `/stock/purchases` | Criar compra | Autenticado |
| POST | `/stock/allocate` | Alocar estoque | Autenticado |
| PATCH | `/stock/purchases/:id/approve` | Aprovar compra | DIRETOR |
| PATCH | `/stock/purchases/:id/reject` | Rejeitar compra | DIRETOR |

### Usuários

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | `/users` | Listar usuários | DIRETOR |
| GET | `/users/options` | Opções para select | Autenticado |
| PATCH | `/users/:id/activate` | Ativar usuário | DIRETOR |
| PATCH | `/users/:id/deactivate` | Desativar usuário | DIRETOR |
| PATCH | `/users/:id/role` | Alterar cargo | DIRETOR |

### Fornecedores

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | `/suppliers` | Listar fornecedores | Autenticado |
| POST | `/suppliers` | Criar fornecedor | Autenticado |
| GET | `/suppliers/cnpj/:cnpj` | Buscar por CNPJ | Autenticado |
| PATCH | `/suppliers/:id` | Atualizar fornecedor | Autenticado |
| DELETE | `/suppliers/:id` | Deletar fornecedor | Autenticado |

### Categorias

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | `/categories` | Listar categorias | Autenticado |
| POST | `/categories` | Criar categoria | Autenticado |
| PATCH | `/categories/:id` | Atualizar categoria | Autenticado |
| DELETE | `/categories/:id` | Deletar categoria | Autenticado |

### Ocorrências

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | `/occurrences/sent` | Ocorrências enviadas | Autenticado |
| GET | `/occurrences/received` | Ocorrências recebidas | Autenticado |
| POST | `/occurrences` | Criar ocorrência | Autenticado |

### Requerimentos

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | `/requests/sent` | Requerimentos enviados | Autenticado |
| GET | `/requests/received` | Requerimentos recebidos | Autenticado |
| POST | `/requests` | Criar requerimento | Autenticado |
| POST | `/requests/:id/respond` | Responder requerimento | Autenticado |

### Notificações

| Método | Endpoint | Descrição | Permissão |
|--------|----------|-----------|-----------|
| GET | `/notifications` | Listar notificações | Autenticado |
| PATCH | `/notifications/:id/read` | Marcar como lida | Autenticado |

---

## 🗄️ Banco de Dados

### Schema Principal

O banco de dados utiliza **PostgreSQL** com **Prisma ORM**. Principais entidades:

- **Usuario**: Usuários do sistema
- **Cargo**: Cargos e permissões
- **Projeto**: Projetos da empresa
- **Etapa**: Etapas dos projetos
- **Subetapa**: Subetapas das etapas
- **Compra**: Solicitações e compras
- **Estoque**: Itens em estoque
- **EstoqueAlocacao**: Alocações de estoque
- **Fornecedor**: Fornecedores cadastrados
- **CategoriaCompra**: Categorias de compra
- **Ocorrencia**: Ocorrências entre usuários
- **Requerimento**: Requerimentos formais
- **Notificacao**: Notificações do sistema

### Migrações

As migrações estão em `backend/prisma/migrations/`. Para criar uma nova migração:

```bash
cd backend
npx prisma migrate dev --name nome_da_migracao
```

### Seed

O arquivo `backend/prisma/seed.ts` popula o banco com dados de exemplo. Execute:

```bash
npm run prisma:seed
```

---

## 🐳 Docker

### Estrutura Docker

O projeto utiliza **Docker Compose** para orquestrar três serviços:

1. **db** (PostgreSQL): Banco de dados
2. **backend** (NestJS): API REST
3. **frontend** (React + Nginx): Interface web

### Comandos Docker

```powershell
# Iniciar todos os serviços
docker-compose up -d

# Reconstruir imagens
docker-compose build --no-cache

# Ver logs
docker-compose logs -f

# Parar serviços
docker-compose down

# Parar e remover volumes
docker-compose down -v

# Executar comando no container
docker-compose exec backend npm run prisma:migrate
```

### Variáveis de Ambiente (Docker)

Configure no arquivo `.env` na raiz:

```env
# PostgreSQL
POSTGRES_USER=erp
POSTGRES_PASSWORD=senha123
POSTGRES_DB=erpdb
POSTGRES_PORT=5432

# Backend
DATABASE_URL=postgresql://erp:senha123@db:5432/erpdb
JWT_SECRET=super-segredo-alterar-em-producao
BACKEND_PORT=3000
NODE_ENV=production

# Frontend
VITE_API_URL=http://localhost:3001
FRONTEND_PORT=5174
```

---

## 💻 Desenvolvimento

### Scripts Disponíveis

#### Backend

```bash
npm run build          # Compilar TypeScript
npm run start          # Iniciar em produção
npm run start:dev      # Iniciar em desenvolvimento (watch)
npm run lint           # Executar ESLint
npm run prisma:generate # Gerar Prisma Client
npm run prisma:migrate # Criar/executar migrações
npm run prisma:seed    # Popular banco com seed
npm run db:setup       # Setup completo (generate + migrate + seed)
```

#### Frontend

```bash
npm run dev            # Servidor de desenvolvimento
npm run build          # Build para produção
npm run preview        # Preview da build
```

### Convenções de Código

- **TypeScript**: Tipagem estrita habilitada
- **ESLint**: Configurado para React e NestJS
- **Prettier**: Formatação automática
- **Nomenclatura**:
  - Componentes: PascalCase (`UserCard.tsx`)
  - Funções/Variáveis: camelCase (`getUserData`)
  - Constantes: UPPER_SNAKE_CASE (`API_BASE_URL`)
  - Tipos/Interfaces: PascalCase (`UserData`)

### Estrutura de Commits

```
feat: adiciona funcionalidade de relatórios
fix: corrige erro de validação em compras
refactor: reorganiza componentes de estoque
docs: atualiza README com novas instruções
style: ajusta formatação do código
test: adiciona testes para módulo de usuários
chore: atualiza dependências
```

---

## 🔧 Troubleshooting

### Erro: "Cannot find module"
```bash
# Backend
cd backend
rm -rf node_modules package-lock.json
npm install

# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Erro: "PrismaClient is not configured"
```bash
cd backend
npm run prisma:generate
```

### Erro: "Database connection failed"
1. Verifique se PostgreSQL está rodando
2. Confirme `DATABASE_URL` no `.env`
3. Teste conexão: `psql -U erp -d erpdb`

### Erro: "Port already in use"
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### Erro no Docker: "Container keeps restarting"
```bash
# Ver logs detalhados
docker-compose logs backend

# Verificar health check
docker-compose ps
```

### Erro: "JWT token expired"
- Faça logout e login novamente
- Tokens expiram após 8 horas

### Frontend não conecta ao backend
1. Verifique `VITE_API_URL` no `.env` do frontend
2. Confirme que backend está rodando
3. Verifique CORS no backend (deve permitir origem do frontend)

---

## 🤝 Contribuindo

1. **Fork** o projeto
2. **Crie** uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. **Commit** suas mudanças (`git commit -m 'feat: Adiciona AmazingFeature'`)
4. **Push** para a branch (`git push origin feature/AmazingFeature`)
5. **Abra** um Pull Request

### Checklist para Pull Requests

- [ ] Código segue as convenções do projeto
- [ ] Testes passam localmente
- [ ] Documentação atualizada (se necessário)
- [ ] Sem erros de lint
- [ ] Commits seguem o padrão de mensagens

---

## 📄 Licença

Este projeto é privado e de uso interno da Globaltec.

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Consulte a documentação em `CONFIGURACAO_AMBIENTES.md`
2. Veja `backend/COMO_CONFIGURAR_BANCO.md` para problemas de banco
3. Verifique `ANALISE_MVP.md` para funcionalidades implementadas

---

**Desenvolvido com ❤️ pela equipe Globaltec**
