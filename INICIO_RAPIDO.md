# ⚡ Início Rápido - ERP Globaltec

## 🔧 Passos para Começar

### 1. Instalar Dependências

```powershell
# Backend
cd ERP-New\backend
npm install

# Frontend
cd ERP-New\frontend
npm install
```

### 2. Configurar Banco de Dados

#### Opção A: PostgreSQL Local

```powershell
# Execute o script
cd ERP-New\backend
.\scripts\init-local-db.ps1
```

Ou manualmente:
```sql
CREATE DATABASE erpdb;
CREATE USER erp WITH PASSWORD 'senha123';
GRANT ALL PRIVILEGES ON DATABASE erpdb TO erp;
```

#### Opção B: Docker

```powershell
cd ERP-New
docker-compose up db -d
```

### 3. Configurar Backend

Crie `backend/.env`:
```env
DATABASE_URL="postgresql://erp:senha123@localhost:5432/erpdb"
JWT_SECRET="troque-este-segredo-por-um-seguro"
PORT=3000
```

Execute:
```powershell
cd ERP-New\backend
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

### 4. Configurar Frontend

Crie `frontend/.env`:
```env
VITE_API_URL=http://localhost:3000
```

### 5. Iniciar Aplicação

```powershell
# Terminal 1 - Backend
cd ERP-New\backend
npm run start:dev

# Terminal 2 - Frontend
cd ERP-New\frontend
npm run dev
```

### 6. Acessar

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## 🔐 Login

Após executar o seed:

- **Email**: `admin@globaltec.com`
- **Senha**: `admin123`

## ✅ Verificação

1. ✅ Dependências instaladas
2. ✅ Banco de dados criado e migrado
3. ✅ Seed executado (usuários de exemplo criados)
4. ✅ Backend rodando na porta 3000
5. ✅ Frontend rodando na porta 5173

## 🐛 Problemas Comuns

### Erro: "Cannot find module"
**Solução**: Execute `npm install` novamente no diretório correspondente

### Erro: "PrismaClient is not configured"
**Solução**: Execute `npm run prisma:generate` no backend

### Erro: "Database connection failed"
**Solução**: 
- Verifique se PostgreSQL está rodando
- Confirme a `DATABASE_URL` no `.env`
- Teste conexão: `psql -U erp -d erpdb`

### Erro: "Port already in use"
**Solução**: Altere a porta no `.env` ou encerre o processo que está usando a porta

## 📚 Documentação Completa

Veja `SETUP.md` para instruções detalhadas.

