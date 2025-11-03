# 🗄️ Como Configurar o Banco de Dados PostgreSQL

## ❌ Erro: "Authentication failed"

O erro que você está vendo significa que o PostgreSQL não reconhece o usuário `erp` ou a senha está incorreta.

## ✅ Solução Rápida (Recomendada)

### Opção 1: Usar usuário `postgres` padrão

1. **Execute o script de correção**:
```powershell
cd ERP-New\backend
.\scripts\setup-db-simple.ps1
```

2. **O script vai**:
   - Pedir a senha do usuário `postgres`
   - Criar o banco `erpdb`
   - Gerar a string de conexão correta

3. **Copie a string gerada e cole no `.env`**:
```env
DATABASE_URL="postgresql://postgres:SUA_SENHA@localhost:5432/erpdb"
```

4. **Execute as migrações**:
```powershell
npm run prisma:migrate
npm run prisma:seed
```

### Opção 2: Criar usuário `erp` manualmente

1. **Conecte ao PostgreSQL**:
```powershell
psql -U postgres
```

2. **Execute os comandos**:
```sql
-- Criar usuário
CREATE USER erp WITH PASSWORD 'senha123';

-- Criar banco
CREATE DATABASE erpdb;

-- Dar permissões
GRANT ALL PRIVILEGES ON DATABASE erpdb TO erp;

-- Conectar ao banco
\c erpdb

-- Dar permissões no schema
GRANT ALL ON SCHEMA public TO erp;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO erp;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO erp;
```

3. **Configure o `.env`**:
```env
DATABASE_URL="postgresql://erp:senha123@localhost:5432/erpdb"
```

### Opção 3: Usar Docker (Mais Fácil)

```powershell
cd ERP-New
docker-compose up db -d
```

Isso cria automaticamente:
- Usuário: `erp`
- Senha: `senha123`
- Banco: `erpdb`

Depois configure o `.env`:
```env
DATABASE_URL="postgresql://erp:senha123@localhost:5432/erpdb"
```

## 🔍 Verificar se PostgreSQL está rodando

```powershell
# Verificar serviço
Get-Service -Name postgresql*

# Tentar conectar
psql -U postgres -l
```

## 📝 Estrutura do .env

O arquivo `backend/.env` deve ter:

```env
# Use UMA das opções abaixo:

# Opção 1: Usuário postgres (mais comum)
DATABASE_URL="postgresql://postgres:SUA_SENHA_POSTGRES@localhost:5432/erpdb"

# Opção 2: Usuário erp customizado
DATABASE_URL="postgresql://erp:senha123@localhost:5432/erpdb"

# Opção 3: Docker
DATABASE_URL="postgresql://erp:senha123@localhost:5432/erpdb"

JWT_SECRET="troque-este-segredo"
PORT=3000
```

## ✅ Depois de configurar

```powershell
# 1. Gerar cliente Prisma
npm run prisma:generate

# 2. Criar tabelas
npm run prisma:migrate

# 3. Popular com dados de exemplo (opcional)
npm run prisma:seed

# 4. Iniciar servidor
npm run start:dev
```

## 🆘 Ainda com problemas?

Veja `TROUBLESHOOTING.md` para mais detalhes.

