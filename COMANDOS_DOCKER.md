# 🐳 Comandos para Deploy no Docker - ERP Globaltec

## 📋 Pré-requisitos

- Docker instalado e rodando
- Docker Compose instalado
- Arquivo `.env` configurado na raiz do projeto

---

## 🚀 Passo a Passo para Deploy

### 1. Configurar Variáveis de Ambiente

Crie ou edite o arquivo `.env` na raiz do projeto:

```powershell
# Copiar exemplo
Copy-Item env.example .env

# Editar o .env com suas configurações de produção
```

**Exemplo de `.env` para produção:**

```env
# PostgreSQL
POSTGRES_USER=erp
POSTGRES_PASSWORD=senha_segura_aqui
POSTGRES_DB=erpdb
POSTGRES_PORT=5432

# Backend
DATABASE_URL=postgresql://erp:senha_segura_aqui@db:5432/erpdb
JWT_SECRET=seu-jwt-secret-super-seguro-aqui
BACKEND_PORT=3000
NODE_ENV=production

# Frontend
VITE_API_URL=http://seu-dominio.com:3000
FRONTEND_PORT=80
```

---

### 2. Parar Containers Existentes (se houver)

```powershell
docker-compose down
```

---

### 3. Construir e Iniciar os Serviços

```powershell
# Construir imagens e iniciar todos os serviços
docker-compose up -d --build
```

**O que este comando faz:**
- Constrói as imagens do backend e frontend
- Cria e inicia os containers (db, backend, frontend)
- Executa migrações automaticamente
- Executa seed (se necessário)

---

### 4. Verificar Status dos Containers

```powershell
# Ver status dos containers
docker-compose ps

# Ver logs em tempo real
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

---

### 5. Executar Migrações Manualmente (se necessário)

```powershell
# Executar migrações
docker-compose exec backend npx prisma migrate deploy

# Executar seed (opcional)
docker-compose exec backend npx prisma db seed
```

---

### 6. Verificar se Está Funcionando

```powershell
# Health check do backend
curl http://localhost:3000/health

# Ou no navegador:
# Backend: http://localhost:3000/health
# Frontend: http://localhost:5174
```

---

## 🔄 Comandos Úteis para Manutenção

### Parar Serviços

```powershell
# Parar todos os serviços
docker-compose stop

# Parar e remover containers
docker-compose down

# Parar, remover containers e volumes (CUIDADO: apaga dados!)
docker-compose down -v
```

### Reiniciar Serviços

```powershell
# Reiniciar todos os serviços
docker-compose restart

# Reiniciar um serviço específico
docker-compose restart backend
docker-compose restart frontend
```

### Reconstruir Imagens

```powershell
# Reconstruir todas as imagens (sem cache)
docker-compose build --no-cache

# Reconstruir e reiniciar
docker-compose up -d --build --force-recreate
```

### Atualizar Código

```powershell
# 1. Parar serviços
docker-compose down

# 2. Reconstruir com código atualizado
docker-compose up -d --build

# 3. Verificar logs
docker-compose logs -f
```

---

## 🔍 Comandos de Diagnóstico

### Ver Logs

```powershell
# Todos os logs
docker-compose logs -f

# Últimas 100 linhas
docker-compose logs --tail=100

# Logs de um serviço específico
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

### Entrar no Container

```powershell
# Entrar no container do backend
docker-compose exec backend sh

# Entrar no container do frontend
docker-compose exec frontend sh

# Entrar no container do banco
docker-compose exec db psql -U erp -d erpdb
```

### Verificar Recursos

```powershell
# Uso de recursos dos containers
docker stats

# Informações detalhadas de um container
docker inspect erp-backend
docker inspect erp-frontend
docker inspect erp-db
```

---

## 🗄️ Comandos do Banco de Dados

### Backup do Banco

```powershell
# Fazer backup
docker-compose exec db pg_dump -U erp erpdb > backup_$(Get-Date -Format "yyyyMMdd_HHmmss").sql

# Restaurar backup
docker-compose exec -T db psql -U erp erpdb < backup.sql
```

### Acessar Banco de Dados

```powershell
# Conectar ao PostgreSQL
docker-compose exec db psql -U erp -d erpdb
```

---

## 🔧 Comandos de Desenvolvimento

### Executar Comandos no Backend

```powershell
# Executar migrações
docker-compose exec backend npx prisma migrate deploy

# Gerar Prisma Client
docker-compose exec backend npx prisma generate

# Executar seed
docker-compose exec backend npx prisma db seed

# Executar qualquer comando npm
docker-compose exec backend npm run <comando>
```

### Executar Comandos no Frontend

```powershell
# Executar qualquer comando npm
docker-compose exec frontend npm run <comando>
```

---

## 📊 Monitoramento

### Ver Status dos Containers

```powershell
# Lista de containers
docker-compose ps

# Status detalhado
docker-compose ps -a
```

### Ver Uso de Recursos

```powershell
# Estatísticas em tempo real
docker stats

# Uso de disco
docker system df
```

---

## 🚨 Troubleshooting

### Container não inicia

```powershell
# Ver logs de erro
docker-compose logs backend
docker-compose logs frontend

# Verificar se porta está em uso
netstat -ano | findstr :3000
netstat -ano | findstr :5174
```

### Reconstruir do zero

```powershell
# Parar tudo
docker-compose down -v

# Remover imagens
docker rmi erp-backend erp-frontend

# Reconstruir
docker-compose up -d --build
```

### Limpar Docker (CUIDADO!)

```powershell
# Limpar containers parados
docker container prune

# Limpar imagens não usadas
docker image prune

# Limpar tudo (CUIDADO: remove tudo!)
docker system prune -a
```

---

## 🌐 Deploy em Servidor Remoto

### 1. Transferir Código para o Servidor

```powershell
# Usando SCP (Linux/Mac) ou WinSCP (Windows)
# Ou usar Git para clonar no servidor
```

### 2. No Servidor, executar:

```bash
# Instalar Docker e Docker Compose (se não tiver)
# Ubuntu/Debian:
sudo apt-get update
sudo apt-get install docker.io docker-compose

# Criar arquivo .env
nano .env

# Construir e iniciar
docker-compose up -d --build

# Verificar logs
docker-compose logs -f
```

### 3. Configurar Firewall (se necessário)

```bash
# Permitir portas
sudo ufw allow 3000/tcp  # Backend
sudo ufw allow 80/tcp    # Frontend (se usar porta 80)
sudo ufw allow 5174/tcp  # Frontend (se usar porta 5174)
```

---

## 📝 Checklist de Deploy

- [ ] Arquivo `.env` configurado com valores de produção
- [ ] `JWT_SECRET` alterado para um valor seguro
- [ ] `POSTGRES_PASSWORD` alterado para uma senha forte
- [ ] `VITE_API_URL` apontando para a URL correta do backend
- [ ] Docker e Docker Compose instalados
- [ ] Portas disponíveis (3000, 5174, 5432)
- [ ] Executado `docker-compose up -d --build`
- [ ] Verificado logs: `docker-compose logs -f`
- [ ] Testado acesso: Frontend e Backend respondendo
- [ ] Migrações executadas com sucesso
- [ ] Seed executado (se necessário)

---

## 🎯 Comandos Rápidos (Resumo)

```powershell
# Deploy completo
docker-compose up -d --build

# Ver logs
docker-compose logs -f

# Parar
docker-compose down

# Reiniciar
docker-compose restart

# Reconstruir
docker-compose up -d --build --force-recreate

# Status
docker-compose ps
```

---

**Pronto!** Com esses comandos você consegue fazer o deploy completo do ERP no Docker! 🚀
