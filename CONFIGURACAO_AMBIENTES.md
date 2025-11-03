# 📚 Documentação Completa - Estrutura Frontend e Integração Backend

## 🏗️ Arquitetura Geral

### Stack Tecnológica

**Frontend:**
- React 18.3.1 + TypeScript 5.4.5
- Vite 5.4.10 (build tool)
- React Router DOM 6.27.0 (roteamento)
- Zustand 4.5.4 (gerenciamento de estado)
- Axios 1.7.8 (HTTP client)
- Tailwind CSS 3.4.14 (estilização)

**Backend:**
- NestJS 10.0.0 (framework)
- Prisma 5.20.0 (ORM)
- PostgreSQL 15 (banco de dados)
- Passport + JWT (autenticação)
- bcrypt (hash de senhas)

---

## 📁 Estrutura do Frontend

```
frontend/
├── src/
│   ├── main.tsx                    # Entry point da aplicação
│   ├── App.tsx                     # Componente raiz com rotas
│   ├── index.css                   # Estilos globais (Tailwind)
│   ├── types.ts                    # Definições de tipos TypeScript
│   ├── vite-env.d.ts              # Tipos do Vite
│   │
│   ├── components/                 # Componentes reutilizáveis
│   │   ├── ProtectedRoute.tsx     # Guard de rota protegida
│   │   └── layout/                 # Layout da aplicação
│   │       ├── AppLayout.tsx       # Layout principal (Sidebar + Header + Content)
│   │       ├── Header.tsx          # Cabeçalho com título e logout
│   │       └── Sidebar.tsx         # Menu lateral com navegação
│   │
│   ├── pages/                      # Páginas da aplicação
│   │   ├── Login.tsx               # Página de login
│   │   ├── Dashboard.tsx           # Dashboard com métricas
│   │   ├── Projects.tsx            # Lista de projetos
│   │   ├── ProjectDetails.tsx      # Detalhes do projeto
│   │   ├── MyTasks.tsx             # Tarefas do usuário logado
│   │   ├── Stock.tsx               # Estoque e compras
│   │   ├── Occurrences.tsx         # Ocorrências
│   │   ├── Requests.tsx            # Requerimentos
│   │   └── Users.tsx                # Gestão de usuários
│   │
│   ├── services/                   # Serviços de API
│   │   └── api.ts                  # Cliente Axios configurado
│   │
│   └── store/                      # Estado global (Zustand)
│       └── auth.ts                  # Store de autenticação
│
├── index.html                      # HTML base
├── package.json                    # Dependências
├── vite.config.ts                  # Configuração do Vite
├── tailwind.config.cjs             # Configuração do Tailwind
└── tsconfig.json                   # Configuração TypeScript
```

---

## 🔄 Fluxo de Autenticação

### 1. Login (`Login.tsx`)

```typescript
// Fluxo completo:
1. Usuário preenche email e senha
2. POST /auth/login → Backend
3. Backend valida credenciais (bcrypt.compare)
4. Backend verifica se usuário está ativo
5. Backend gera JWT token (payload: { sub: userId, role: cargo })
6. Frontend recebe { token, user }
7. Zustand salva token e user no localStorage (persist)
8. Redireciona para /dashboard
```

**Endpoint Backend:**
- `POST /auth/login` → `AuthController.login()`
- Validação: `AuthService.validateUser()` → `AuthService.login()`

### 2. Proteção de Rotas (`ProtectedRoute.tsx`)

```typescript
// Verifica se usuário está autenticado
// Se não tiver token/user → redireciona para /login
// Se tiver → renderiza <Outlet /> (rotas filhas)
```

### 3. Interceptor Axios (`api.ts`)

```typescript
// Request Interceptor:
- Adiciona token JWT no header: Authorization: Bearer {token}
- Usa Zustand para pegar token do estado

// Response Interceptor:
- Se resposta 401 (não autorizado) → logout automático
- Limpa token e user do Zustand
```

---

## 🎨 Sistema de Layout

### AppLayout (`AppLayout.tsx`)

**Estrutura:**
```
┌─────────────────────────────────────┐
│  Sidebar (w-64)  │  Main Content    │
│                  │  ┌─────────────┐ │
│  - Logo          │  │   Header     │ │
│  - Menu         │  └─────────────┘ │
│                 │  ┌─────────────┐ │
│                 │  │   Content   │ │
│                 │  │   (Outlet)  │ │
│                 │  └─────────────┘ │
└─────────────────────────────────────┘
```

**Componentes:**
1. **Sidebar** (`Sidebar.tsx`):
   - Menu lateral fixo (sticky)
   - Filtra links baseado no cargo do usuário
   - Links: Dashboard, Projetos, Meu Trabalho, Compras & Estoque, Ocorrências, Requerimentos, Usuários
   - Dependência: `useAuthStore` para pegar cargo do usuário

2. **Header** (`Header.tsx`):
   - Título dinâmico baseado na rota
   - Subtítulo contextual
   - Email do usuário logado
   - Botão de logout

3. **Content** (`<Outlet />`):
   - Renderiza a página atual baseada na rota

---

## 📄 Páginas e Integração com Backend

### 1. Dashboard (`Dashboard.tsx`)

**Endpoints utilizados:**
- `GET /projects` → Lista todos os projetos

**Funcionalidades:**
- Exibe cards com métricas:
  - Projetos Ativos
  - Projetos Finalizados
  - Valor Total (soma de todos os projetos)
- Lista últimos 5 projetos

**Backend:**
- `ProjectsController.findAll()` → `ProjectsService.findAll()`
- Filtros: status, search (opcional)
- Permissão: `@Roles(Cargo.DIRETOR)`

---

### 2. Projects (`Projects.tsx`)

**Endpoints utilizados:**
- `GET /projects` → Lista projetos
- `GET /users/options` → Lista usuários para seleção
- `POST /projects` → Cria novo projeto

**Funcionalidades:**
- Tabela de projetos (nome, status, supervisor, valor total)
- Modal para criar projeto:
  - Nome, resumo, objetivo
  - Valor total, valor insumos
  - Supervisor (select)
  - Responsáveis (checkboxes múltiplos)
- Navegação: clicar na linha → `/projects/:id`

**Backend:**
- `POST /projects` → `ProjectsController.create()`
- DTO: `CreateProjectDto`
- Validação: valorInsumos não pode exceder valorTotal
- Permissão: `@Roles(Cargo.DIRETOR)`

---

### 3. ProjectDetails (`ProjectDetails.tsx`)

**Endpoints utilizados:**
- `GET /projects/:id` → Detalhes completos do projeto

**Funcionalidades:**
- Informações gerais: resumo, objetivo, valores, data criação
- Equipe: supervisor, responsáveis
- Barra de progresso: % de etapas concluídas
- Lista de etapas com subetapas
- Tabela de compras relacionadas

**Backend:**
- `GET /projects/:id` → `ProjectsController.findOne()`
- Include: supervisor, responsaveis, etapas (com subetapas), compras
- Sem restrição de cargo (qualquer usuário autenticado)

---

### 4. MyTasks (`MyTasks.tsx`)

**Endpoints utilizados:**
- `GET /tasks/my` → Tarefas do usuário logado
- `POST /tasks/:id/deliver` → Entrega de tarefa

**Funcionalidades:**
- Lista etapas atribuídas ao usuário
- Exibe: nome, projeto, descrição, status
- Botão "Entregar" para marcar como concluída

**Backend:**
- `GET /tasks/my` → `TasksController.findMyTasks()`
- Usa `@CurrentUser()` para pegar userId do JWT
- `POST /tasks/:id/deliver` → `TasksController.deliver()`
- Permissão: `@Roles(Cargo.EXECUTOR, Cargo.SUPERVISOR, Cargo.DIRETOR)`

---

### 5. Stock (`Stock.tsx`)

**Endpoints utilizados:**
- `GET /stock/items` → Lista itens do estoque
- `GET /stock/purchases` → Lista compras
- `GET /projects` → Lista projetos (para modal de compra)
- `POST /stock/items` → Cria item no estoque
- `POST /stock/purchases` → Cria compra

**Funcionalidades:**
- **Seção Estoque:**
  - Tabela de itens (item, quantidade, valor unitário, status)
  - Modal para adicionar item:
    - Nome, descrição, quantidade
    - Upload de imagem (Base64)
    - Sistema de cotações múltiplas:
      - Valor unitário, frete, impostos, link
      - Seleção de cotação (radio button)
      - Cálculo automático de total

- **Seção Compras:**
  - Tabela de compras
  - Modal para criar compra:
    - Seleção de projeto (obrigatório)
    - Mesmo sistema de cotações do estoque

**Backend:**
- `POST /stock/items` → `StockController.createItem()`
- DTO: `CreateStockItemDto` (inclui `cotacoes` array)
- Backend salva `valorUnitario` = soma da cotação selecionada
- Backend salva `cotacoesJson` como JSON no Prisma
- Permissão: `@Roles(Cargo.DIRETOR, Cargo.COTADOR, Cargo.PAGADOR)`

---

### 6. Occurrences (`Occurrences.tsx`)

**Endpoints utilizados:**
- `GET /occurrences/sent` → Ocorrências enviadas
- `GET /occurrences/received` → Ocorrências recebidas
- `GET /users/options` → Lista usuários
- `POST /occurrences` → Cria ocorrência

**Funcionalidades:**
- Tabs: "Enviadas" e "Recebidas"
- Formulário para criar ocorrência:
  - Destinatário (select)
  - Texto (textarea)
- Tabela com: mensagem, usuário, data, status

**Backend:**
- `POST /occurrences` → `OccurrencesController.create()`
- Usa `@CurrentUser()` para pegar remetente
- DTO: `CreateOccurrenceDto` (destinatarioId, texto)
- Permissão: Qualquer usuário autenticado

---

### 7. Requests (`Requests.tsx`)

**Endpoints utilizados:**
- `GET /requests/sent` → Requerimentos enviados
- `GET /requests/received` → Requerimentos recebidos
- `GET /users/options` → Lista usuários
- `POST /requests` → Cria requerimento

**Funcionalidades:**
- Similar a Occurrences, mas para requerimentos formais
- Tabs: "Enviados" e "Recebidos"
- Tabela com: mensagem, usuário, status, resposta

**Backend:**
- `POST /requests` → `RequestsController.create()`
- Usa `@CurrentUser()` para pegar remetente
- DTO: `CreateRequestDto`
- Permissão: Qualquer usuário autenticado

---

### 8. Users (`Users.tsx`)

**Endpoints utilizados:**
- `GET /users` → Lista todos os usuários
- `PATCH /users/:id/activate` → Ativa usuário
- `PATCH /users/:id/deactivate` → Desativa usuário
- `PATCH /users/:id/role` → Altera cargo

**Funcionalidades:**
- Tabela de usuários (nome, email, cargo, status)
- Select para alterar cargo (inline)
- Botão para ativar/desativar

**Backend:**
- `GET /users` → `UsersController.findAll()`
- `PATCH /users/:id/role` → `UsersController.assignRole()`
- DTO: `UpdateRoleDto` (cargo)
- Permissão: `@Roles(Cargo.DIRETOR)` apenas

---

## 🔌 Serviço de API (`api.ts`)

**Configuração:**
```typescript
baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
```

**Interceptors:**
1. **Request:**
   - Adiciona `Authorization: Bearer {token}` em todas as requisições
   - Token vem de `useAuthStore.getState().token`

2. **Response:**
   - Se 401 → logout automático
   - Limpa estado do Zustand

---

## 🗄️ Estado Global (Zustand)

### Auth Store (`store/auth.ts`)

**Estado:**
```typescript
{
  user: Usuario | null,
  token: string | null
}
```

**Ações:**
- `setCredentials({ user, token })` → Salva login
- `logout()` → Limpa estado

**Persistência:**
- Usa `persist` middleware do Zustand
- Salva no localStorage com chave `'erp-auth'`
- Recupera automaticamente ao recarregar página

---

## 🎨 Estilização (Tailwind CSS)

### Cores Personalizadas

```javascript
primary: '#4CACFC'    // Azul principal
secondary: '#1f77b4'  // Azul secundário
success: '#28A745'    // Verde
warning: '#FFA500'    // Laranja
danger: '#ff4b4b'     // Vermelho
neutral: '#1C1C1E'    // Fundo escuro
```

### Tema
- **Dark mode** por padrão
- Fonte: Montserrat
- Background: `bg-neutral`
- Bordes: `border-white/10` (transparência)

---

## 🔐 Sistema de Permissões (RBAC)

### Cargos

1. **DIRETOR** → Acesso total
   - Dashboard
   - Projetos (CRUD completo)
   - Usuários (gestão completa)
   - Todas as outras páginas

2. **SUPERVISOR** → Gestão de projetos
   - Dashboard (não acessa)
   - Meu Trabalho
   - Ocorrências
   - Requerimentos

3. **EXECUTOR** → Execução de tarefas
   - Meu Trabalho
   - Ocorrências
   - Requerimentos

4. **COTADOR** → Gestão de compras
   - Meu Trabalho
   - Compras & Estoque
   - Ocorrências

5. **PAGADOR** → Pagamentos
   - Meu Trabalho
   - Compras & Estoque
   - Ocorrências

### Implementação no Frontend

**Sidebar (`Sidebar.tsx`):**
```typescript
const links = [
  { to: '/dashboard', allowed: ['DIRETOR'] },
  { to: '/projects', allowed: ['DIRETOR'] },
  { to: '/tasks/my', allowed: ['DIRETOR', 'SUPERVISOR', ...] },
  // ...
];

// Filtra links baseado no cargo do usuário
const filteredLinks = links.filter(link => 
  link.allowed.includes(user.cargo)
);
```

**Backend Guards:**
- `@UseGuards(JwtAuthGuard, RolesGuard)` → Proteção de rotas
- `@Roles(Cargo.DIRETOR)` → Apenas diretores
- `@CurrentUser()` → Extrai userId do JWT token

---

## 🌐 Rotas (`App.tsx`)

**Estrutura:**
```
/ (redirect) → /dashboard
/login → Login (pública)
/dashboard → Dashboard (protegida)
/projects → Projects (protegida)
/projects/:id → ProjectDetails (protegida)
/tasks/my → MyTasks (protegida)
/stock → Stock (protegida)
/occurrences → Occurrences (protegida)
/requests → Requests (protegida)
/users → Users (protegida)
```

**Proteção:**
- Todas as rotas (exceto `/login`) são protegidas por `<ProtectedRoute />`
- Se não autenticado → redireciona para `/login`
- Se autenticado → renderiza `<AppLayout />` com Sidebar e Header

---

## 📊 Mapeamento Frontend ↔ Backend

### Autenticação
| Frontend | Backend |
|----------|---------|
| `POST /auth/login` | `AuthController.login()` |
| `POST /auth/register` | `AuthController.register()` |

### Projetos
| Frontend | Backend |
|----------|---------|
| `GET /projects` | `ProjectsController.findAll()` |
| `GET /projects/:id` | `ProjectsController.findOne()` |
| `POST /projects` | `ProjectsController.create()` |
| `PATCH /projects/:id` | `ProjectsController.update()` |
| `PATCH /projects/:id/responsibles` | `ProjectsController.updateResponsibles()` |
| `PATCH /projects/:id/finalize` | `ProjectsController.finalize()` |

### Tarefas
| Frontend | Backend |
|----------|---------|
| `GET /tasks/my` | `TasksController.findMyTasks()` |
| `POST /tasks/:id/deliver` | `TasksController.deliver()` |
| `POST /tasks/:id/approve` | `TasksController.approve()` |
| `POST /tasks/:id/reject` | `TasksController.reject()` |

### Usuários
| Frontend | Backend |
|----------|---------|
| `GET /users` | `UsersController.findAll()` |
| `GET /users/options` | `UsersController.findOptions()` |
| `PATCH /users/:id/activate` | `UsersController.activate()` |
| `PATCH /users/:id/deactivate` | `UsersController.deactivate()` |
| `PATCH /users/:id/role` | `UsersController.assignRole()` |

### Estoque
| Frontend | Backend |
|----------|---------|
| `GET /stock/items` | `StockController.listItems()` |
| `POST /stock/items` | `StockController.createItem()` |
| `GET /stock/purchases` | `StockController.listPurchases()` |
| `POST /stock/purchases` | `StockController.createPurchase()` |

### Ocorrências
| Frontend | Backend |
|----------|---------|
| `GET /occurrences/sent` | `OccurrencesController.listSent()` |
| `GET /occurrences/received` | `OccurrencesController.listReceived()` |
| `POST /occurrences` | `OccurrencesController.create()` |

### Requerimentos
| Frontend | Backend |
|----------|---------|
| `GET /requests/sent` | `RequestsController.listSent()` |
| `GET /requests/received` | `RequestsController.listReceived()` |
| `POST /requests` | `RequestsController.create()` |
| `POST /requests/:id/respond` | `RequestsController.respond()` |

---

## 🔧 Variáveis de Ambiente

### Frontend (`.env`)
```env
VITE_API_URL=http://localhost:3000
```

**Uso:**
- `import.meta.env.VITE_API_URL` no código
- Fallback para `http://localhost:3000` se não configurado

### Backend (`.env`)
```env
DATABASE_URL=postgresql://erp:senha123@localhost:5432/erpdb
JWT_SECRET=troque-este-segredo
PORT=3000
```

---

## 🚀 Build e Deploy

### Desenvolvimento
```bash
# Frontend
npm run dev        # http://localhost:5173

# Backend
npm run start:dev  # http://localhost:3000
```

### Produção
```bash
# Frontend
npm run build      # Gera dist/
# Servir com Nginx ou servidor estático

# Backend
npm run build      # Gera dist/
npm run start:prod # Node dist/main.js
```

---

## 📝 Tipos TypeScript (`types.ts`)

```typescript
export type Cargo = 'DIRETOR' | 'SUPERVISOR' | 'EXECUTOR' | 'COTADOR' | 'PAGADOR';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  cargo: Cargo;
  ativo: boolean;
  telefone?: string | null;
}

export interface Projeto {
  id: number;
  nome: string;
  status: 'EM_ANDAMENTO' | 'FINALIZADO';
  resumo?: string | null;
  objetivo?: string | null;
  valorTotal: number;
  valorInsumos: number;
  supervisor?: Usuario | null;
}

export interface Etapa {
  id: number;
  nome: string;
  descricao?: string | null;
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'APROVADA' | 'REPROVADA';
  projeto: Projeto;
  executor: Usuario;
}
```

**Observação:** Algumas páginas definem tipos localmente (ex: `ProjectDetails.tsx`, `Stock.tsx`) quando precisam de mais campos do que os tipos globais.

---

## ✅ Resumo da Integração

1. **Autenticação:** JWT token enviado em todas as requisições via Axios interceptor
2. **Proteção:** Rotas protegidas por `ProtectedRoute` + Backend Guards
3. **Estado:** Zustand com persistência no localStorage
4. **API:** Axios configurado com interceptors para token e logout automático
5. **Permissões:** Sidebar filtra links + Backend valida com `@Roles()`
6. **Layout:** Componente único (`AppLayout`) com Sidebar e Header fixos
7. **Estilização:** Tailwind CSS com tema dark customizado

---

## 🎯 Fluxo Completo de uma Requisição

```
1. Usuário interage com UI (ex: clica "Criar Projeto")
   ↓
2. Componente React chama api.post('/projects', data)
   ↓
3. Axios interceptor adiciona: Authorization: Bearer {token}
   ↓
4. Requisição HTTP → Backend NestJS
   ↓
5. JwtAuthGuard valida token
   ↓
6. RolesGuard verifica cargo (se necessário)
   ↓
7. Controller recebe requisição
   ↓
8. Service processa lógica de negócio
   ↓
9. Prisma executa query no PostgreSQL
   ↓
10. Resposta JSON retorna ao frontend
    ↓
11. Componente atualiza estado (useState)
    ↓
12. UI re-renderiza com novos dados
```

---

Fim da documentação completa! 🎉

