# ERP Globaltec (Nova Arquitetura)

Reescrita completa do ERP utilizando **NestJS + Prisma + PostgreSQL** no backend e **React + Vite + Tailwind** no frontend.

## 📦 Estrutura

```
ERP-New/
├── backend/              # API REST NestJS
│   ├── src/
│   │   ├── modules/      # Domínios (auth, users, projects, tasks, etc.)
│   │   ├── prisma/       # Serviço Prisma compartilhado
│   │   └── main.ts       # Bootstrap
│   ├── prisma/           # schema.prisma e migrações
│   ├── package.json
│   └── Dockerfile
├── frontend/             # Painel React + Tailwind
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── services/
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml    # Orquestra PostgreSQL + backend + frontend
└── README.md             # Este arquivo
```

## 🚀 Quickstart

### ✅ Setup Local (Recomendado para Desenvolvimento)

**O sistema funciona perfeitamente localmente sem Docker!**

Execute os scripts de setup:

```powershell
# Backend
cd ERP-New\backend
.\setup.ps1

# Frontend  
cd ERP-New\frontend
.\setup.ps1
```

Ou use o script completo:
```powershell
cd ERP-New
.\scripts\setup-local.ps1
```

### Configurar Banco de Dados

```powershell
# Com PostgreSQL local
cd ERP-New\backend
.\scripts\init-local-db.ps1

# Ou configure manualmente (veja SETUP.md)
```

### Rodar o Sistema

```powershell
# Terminal 1 - Backend
cd ERP-New\backend
npm run start:dev

# Terminal 2 - Frontend  
cd ERP-New\frontend
npm run dev
```

Serviços disponíveis:

- ✅ Backend: http://localhost:3000
- ✅ Frontend: http://localhost:5173
- ✅ PostgreSQL: localhost:5432 (user: `erp`, senha: `senha123`, banco: `erpdb`)

### 🐳 Docker (Opcional - Pendente)

Docker está configurado mas com problemas no build. Para desenvolvimento, **não é necessário**. Veja `DOCKER_PENDENTE.md` para mais detalhes.

## ⚙️ Variáveis de Ambiente

### Backend (`backend/.env`)

```
DATABASE_URL=postgresql://erp:senha123@localhost:5432/erpdb
JWT_SECRET=troque-este-segredo
PORT=3000
```

> Gere o arquivo copiando de `.env.example` (crie manualmente caso necessário).

### Frontend (`frontend/.env`)

```
VITE_API_URL=http://localhost:3000
```

## 🛠️ Scripts Úteis

### Backend

```bash
# Instalação
cd backend
npm install

# Prisma (com PostgreSQL local)
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed

# Desenvolvimento
npm run start:dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## 🔐 Autenticação & RBAC

- JWT com expiração de 8h
- Cargos: Diretor, Supervisor, Executor, Cotador, Pagador
- Guards e decorators (`JwtAuthGuard`, `RolesGuard`, `@Roles`) protegem todas as rotas sensíveis

## 📚 Domínios Implementados

| Módulo | Descrição |
|--------|-----------|
| auth | Login e registro com bcrypt & JWT |
| users | Gestão de usuários, ativação, mudança de cargo |
| projects | CRUD de projetos, responsáveis e finalização |
| tasks | Etapas, subetapas, entrega, aprovação, rejeição |
| stock | Estoque e compras (com integração automática) |
| occurrences | Registros e comunicação interna |
| requests | Requerimentos e respostas formais |
| notifications | Notificações com marcação de leitura |

## 🧪 Próximos Passos

- Adicionar testes unitários (Jest) e2e (Playwright)
- Implementar upload de arquivos com S3/MinIO
- Configurar CI/CD e lint no pipeline
- Criar documentação Swagger automaticamente (`@nestjs/swagger`)

## 🤝 Contribuindo

1. Configure o PostgreSQL local (veja `backend/COMO_CONFIGURAR_BANCO.md`)
2. Rode `npm install` nas pastas `backend` e `frontend`
3. Execute as migrações do Prisma (`npm run prisma:migrate`)
4. Execute o backend (`npm run start:dev`) e o frontend (`npm run dev`)
5. Utilize o Postman/Insomnia para validar endpoints

---

Qualquer dúvida ou sugestão, me avise! 💙
