# 🐳 Configuração Docker - ERP Global

Este guia explica como configurar e executar o ERP Global usando Docker.

## 📋 Pré-requisitos

- Docker instalado (versão 20.10 ou superior)
- Docker Compose instalado (versão 2.0 ou superior)

### Verificar instalação

```bash
docker --version
docker-compose --version
```

## 🚀 Início Rápido

### 1. Configurar variáveis de ambiente

Copie o arquivo `.env.example` para `.env` e ajuste as variáveis conforme necessário:

```bash
cp .env.example .env
```

Edite o arquivo `.env` e configure:
- `POSTGRES_PASSWORD`: Senha do banco de dados (altere em produção!)
- `JWT_SECRET`: Chave secreta para JWT (altere em produção!)
- `VITE_API_URL`: URL da API (ajuste se necessário)

### 2. Construir e iniciar os containers

```bash
# Construir e iniciar todos os serviços
docker-compose up -d --build

# Ver logs
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

### 3. Acessar a aplicação

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## 📦 Estrutura dos Serviços

### Banco de Dados (PostgreSQL)
- **Container**: `erp-db`
- **Porta**: 5432
- **Volume**: `db_data` (persistência de dados)

### Backend (NestJS)
- **Container**: `erp-backend`
- **Porta**: 3000
- **Funcionalidades**:
  - Executa migrations automaticamente na inicialização
  - Executa seed do banco (se configurado)
  - Health check em `/health`

### Frontend (React + Vite)
- **Container**: `erp-frontend`
- **Porta**: 5173
- **Servidor**: Nginx

## 🔧 Comandos Úteis

### Gerenciar containers

```bash
# Iniciar serviços
docker-compose up -d

# Parar serviços
docker-compose down

# Parar e remover volumes (⚠️ apaga dados do banco)
docker-compose down -v

# Reiniciar um serviço específico
docker-compose restart backend

# Reconstruir um serviço específico
docker-compose up -d --build backend
```

### Executar comandos dentro dos containers

```bash
# Acessar shell do backend
docker-compose exec backend sh

# Executar migrations manualmente
docker-compose exec backend npx prisma migrate deploy

# Executar seed manualmente
docker-compose exec backend npx prisma db seed

# Acessar banco de dados
docker-compose exec db psql -U erp -d erpdb
```

### Ver logs

```bash
# Todos os serviços
docker-compose logs -f

# Serviço específico
docker-compose logs -f backend

# Últimas 100 linhas
docker-compose logs --tail=100 backend
```

### Limpar e reconstruir

```bash
# Parar e remover containers
docker-compose down

# Remover imagens e reconstruir
docker-compose build --no-cache

# Iniciar novamente
docker-compose up -d
```

## 🔄 Desenvolvimento

Para desenvolvimento com hot reload, use o arquivo `docker-compose.dev.yml`:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

**Nota**: O modo de desenvolvimento monta volumes para hot reload, mas pode ser mais lento.

## 🐛 Troubleshooting

### Backend não inicia

1. Verifique os logs:
   ```bash
   docker-compose logs backend
   ```

2. Verifique se o banco está saudável:
   ```bash
   docker-compose ps
   ```

3. Verifique a conexão com o banco:
   ```bash
   docker-compose exec backend sh
   # Dentro do container:
   npx prisma migrate status
   ```

### Frontend não carrega

1. Verifique se o backend está rodando:
   ```bash
   curl http://localhost:3000/health
   ```

2. Verifique a variável `VITE_API_URL` no `.env`

3. Verifique os logs:
   ```bash
   docker-compose logs frontend
   ```

### Banco de dados não conecta

1. Verifique se o container está rodando:
   ```bash
   docker-compose ps db
   ```

2. Verifique as variáveis de ambiente:
   ```bash
   docker-compose exec db env | grep POSTGRES
   ```

3. Teste a conexão:
   ```bash
   docker-compose exec db psql -U erp -d erpdb -c "SELECT 1;"
   ```

### Limpar tudo e começar do zero

```bash
# Parar tudo
docker-compose down -v

# Remover imagens
docker rmi erp-backend erp-frontend

# Reconstruir
docker-compose build --no-cache

# Iniciar
docker-compose up -d
```

## 🔒 Produção

Para produção, certifique-se de:

1. **Alterar todas as senhas** no arquivo `.env`
2. **Usar um JWT_SECRET forte** e único
3. **Configurar HTTPS** (usando nginx reverso ou similar)
4. **Configurar backups** do banco de dados
5. **Monitorar logs** regularmente
6. **Usar variáveis de ambiente** seguras (não commitar `.env`)

### Exemplo de configuração para produção

```env
POSTGRES_PASSWORD=senha-super-segura-aqui
JWT_SECRET=chave-jwt-super-secreta-aqui
NODE_ENV=production
VITE_API_URL=https://api.seudominio.com
```

## 📝 Notas

- O banco de dados persiste dados no volume `db_data`
- As migrations são executadas automaticamente na inicialização do backend
- O seed é executado automaticamente (se configurado no Prisma)
- Health checks estão configurados para todos os serviços
- Os containers usam rede interna `erp-network` para comunicação

## 🆘 Suporte

Se encontrar problemas:

1. Verifique os logs: `docker-compose logs -f`
2. Verifique o status: `docker-compose ps`
3. Consulte a documentação do Docker
4. Verifique se todas as portas estão disponíveis

