# 🔧 Troubleshooting - ERP Backend

## ❌ Erro: "Authentication failed against database server"

Este erro significa que o PostgreSQL não está aceitando as credenciais fornecidas.

### Soluções:

#### Solução 1: Usar usuário `postgres` padrão (Mais Simples)

1. **Atualize o `.env`** para usar o usuário `postgres`:
```env
DATABASE_URL="postgresql://postgres:SUA_SENHA_POSTGRES@localhost:5432/erpdb"
```

2. **Crie o banco manualmente**:
```sql
-- Conecte-se como postgres
psql -U postgres

-- Execute:
CREATE DATABASE erpdb;
```

3. **Teste a conexão**:
```powershell
npm run prisma:migrate
```

#### Solução 2: Criar usuário `erp` manualmente

1. **Conecte-se ao PostgreSQL**:
```powershell
psql -U postgres
```

2. **Execute os comandos SQL**:
```sql
CREATE USER erp WITH PASSWORD 'senha123';
CREATE DATABASE erpdb;
GRANT ALL PRIVILEGES ON DATABASE erpdb TO erp;

-- Conecte ao banco
\c erpdb

-- Conceda permissões no schema
GRANT ALL ON SCHEMA public TO erp;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO erp;
```

3. **Atualize o `.env`**:
```env
DATABASE_URL="postgresql://erp:senha123@localhost:5432/erpdb"
```

#### Solução 3: Usar Docker (Recomendado)

```powershell
cd ERP-New
docker-compose up db -d
```

Isso cria automaticamente:
- Usuário: `erp`
- Senha: `senha123`
- Banco: `erpdb`

### Verificar se PostgreSQL está rodando

```powershell
# Verificar serviço
Get-Service -Name postgresql*

# Ou tentar conectar
psql -U postgres -l
```

### Verificar credenciais

```powershell
# Testar conexão manual
psql -U postgres -d postgres

# Se funcionar, o problema está no .env
# Se não funcionar, o PostgreSQL pode não estar rodando
```

## ❌ Erro: "Database does not exist"

**Solução**: Crie o banco manualmente:
```sql
CREATE DATABASE erpdb;
```

## ❌ Erro: "Role does not exist"

**Solução**: O usuário não existe. Crie-o:
```sql
CREATE USER erp WITH PASSWORD 'senha123';
```

## ✅ Script de Correção Automática

Execute:
```powershell
cd ERP-New\backend
.\scripts\fix-db-auth.ps1
```

Este script ajuda a configurar o banco corretamente.

