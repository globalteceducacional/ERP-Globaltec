# 🚀 Guia de Setup - ERP Globaltec

## 📋 Pré-requisitos

- Node.js 20+ instalado
- PostgreSQL 15+ instalado OU Docker
- npm ou yarn

## ⚙️ Setup Local (Sem Docker)

### 1. Configurar Banco de Dados PostgreSQL

```sql
-- Execute no PostgreSQL
CREATE DATABASE erpdb;
CREATE USER erp WITH PASSWORD 'senha123';
GRANT ALL PRIVILEGES ON DATABASE erpdb TO erp;
```

### 2. Configurar Backend

```bash
cd ERP-New/backend

# Instalar dependências
npm install

# Criar arquivo .env
# Copie o conteúdo abaixo para .env:
# DATABASE_URL="postgresql://erp:senha123@localhost:5432/erpdb"
# JWT_SECRET="troque-este-segredo-por-um-seguro"
# PORT=3000

# Gerar cliente Prisma
npm run prisma:generate

# Rodar migrações
npm run prisma:migrate

# Popular banco com dados de exemplo (opcional)
npm run prisma:seed

# Iniciar servidor
npm run start:dev
```

### 3. Configurar Frontend

```bash
cd ERP-New/frontend

# Instalar dependências
npm install

# Criar arquivo .env
# Copie o conteúdo abaixo para .env:
# VITE_API_URL=http://localhost:3000

# Iniciar servidor de desenvolvimento
npm run dev
```

## 🐳 Setup com Docker

```bash
cd ERP-New

# Iniciar todos os serviços
docker-compose up --build

# Em outro terminal, rodar migrações e seed
docker-compose exec backend npm run prisma:generate
docker-compose exec backend npm run prisma:migrate
docker-compose exec backend npm run prisma:seed
```

## 🔐 Credenciais de Acesso (após seed)

- **Administrador**: `admin@globaltec.com` / `admin123`
- **Supervisor**: `supervisor@globaltec.com` / `senha123`
- **Executor**: `executor@globaltec.com` / `senha123`

## 📝 Variáveis de Ambiente

### Backend (`.env`)

```env
DATABASE_URL="postgresql://erp:senha123@localhost:5432/erpdb"
JWT_SECRET="troque-este-segredo-por-um-seguro"
PORT=3000
```

### Frontend (`.env`)

```env
VITE_API_URL=http://localhost:3000
```

## 🔧 Comandos Úteis

### Backend

```bash
npm run prisma:generate    # Gerar cliente Prisma
npm run prisma:migrate    # Rodar migrações
npm run prisma:seed       # Popular banco com dados de exemplo
npm run start:dev         # Iniciar em modo desenvolvimento
npm run build             # Compilar para produção
```

### Frontend

```bash
npm run dev      # Iniciar servidor de desenvolvimento
npm run build    # Compilar para produção
npm run preview  # Preview da build de produção
```

## ✅ Verificação

1. Backend rodando: http://localhost:3000
2. Frontend rodando: http://localhost:5173
3. Teste de login: Use as credenciais acima

## 🐛 Troubleshooting

### Erro: "Cannot find module"
- Execute `npm install` novamente
- Delete `node_modules` e `package-lock.json`, depois reinstale

### Erro: "PrismaClient is not configured"
- Execute `npm run prisma:generate`

### Erro: "Database connection failed"
- Verifique se PostgreSQL está rodando
- Confirme DATABASE_URL no `.env`

### Erro no Frontend: "react-router-dom not found"
- Execute `npm install` no diretório frontend
- Verifique se `@vitejs/plugin-react` está instalado

