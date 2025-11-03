# 🌐 Deploy em Produção - Guia Completo

## ✅ Como Funciona Atualmente

O sistema já está **configurado para rodar tanto local quanto online** através de variáveis de ambiente:

### 🔧 **Backend (NestJS)**
- Usa `ConfigService` para ler variáveis do `.env`
- Porta configurável via `PORT` (padrão: 3000)
- CORS habilitado para aceitar requisições de qualquer origem

### ⚛️ **Frontend (React)**
- Usa `VITE_API_URL` para definir a URL do backend
- Fallback para `http://localhost:3000` se não configurado
- Build de produção é estático (pode ser servido por qualquer servidor web)

## 📋 Configuração por Ambiente

### 🏠 **Local (Desenvolvimento)**

**Backend (`backend/.env`):**
```env
DATABASE_URL="postgresql://postgres:senha@localhost:5432/erpdb"
JWT_SECRET="seu-segredo-local"
PORT=3000
```

**Frontend (`frontend/.env`):**
```env
VITE_API_URL=http://localhost:3000
```

**Como rodar:**
```powershell
# Backend
cd backend
npm run start:dev

# Frontend
cd frontend
npm run dev
```

### 🌐 **Produção (Online)**

**Backend (`backend/.env`):**
```env
DATABASE_URL="postgresql://usuario:senha@servidor-db:5432/erpdb"
JWT_SECRET="segredo-super-seguro-producao-mude-isso"
PORT=3000
NODE_ENV=production
```

**Frontend (`frontend/.env.production`):**
```env
VITE_API_URL=https://api.seudominio.com
```

**Como buildar:**
```powershell
# Backend
cd backend
npm run build
npm run start:prod

# Frontend
cd frontend
npm run build
# Arquivos estáticos em dist/
```

## 🚀 Opções de Deploy

### 1. **Vercel + Railway (Mais Fácil)** ⭐

#### Frontend (Vercel)
1. Conecte seu repositório GitHub na Vercel
2. Configure variável de ambiente:
   - `VITE_API_URL=https://seu-backend.railway.app`
3. Deploy automático!

#### Backend (Railway)
1. Conecte repositório no Railway
2. Configure variáveis:
   - `DATABASE_URL` (Railway cria PostgreSQL automaticamente)
   - `JWT_SECRET`
   - `PORT` (Railway define automaticamente)
3. Deploy!

**Custo:** Grátis para começar (limites generosos)

---

### 2. **AWS / Azure / Google Cloud**

#### Backend
- Use **Elastic Beanstalk** (AWS) ou **App Service** (Azure)
- Configure `.env` no painel
- Deploy via Git ou Docker

#### Frontend
- Use **S3 + CloudFront** (AWS) ou **Storage + CDN** (Azure)
- Upload da pasta `dist/` após build
- Configure `VITE_API_URL` antes do build

---

### 3. **VPS (DigitalOcean, Linode, etc.)**

#### Passo a passo:

1. **Instalar Node.js e PostgreSQL:**
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql
```

2. **Clonar e configurar backend:**
```bash
git clone seu-repo
cd ERP-New/backend
npm install
npm run build

# Configurar .env
nano .env
```

3. **Configurar banco:**
```bash
sudo -u postgres psql
CREATE DATABASE erpdb;
CREATE USER erp WITH PASSWORD 'senha-segura';
GRANT ALL PRIVILEGES ON DATABASE erpdb TO erp;
```

4. **Rodar migrações:**
```bash
npm run prisma:migrate
npm run prisma:seed
```

5. **Usar PM2 para manter backend rodando:**
```bash
npm install -g pm2
pm2 start dist/main.js --name erp-backend
pm2 save
pm2 startup
```

6. **Configurar Nginx para frontend:**
```nginx
server {
    listen 80;
    server_name seudominio.com;

    root /var/www/erp-frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

7. **Build e deploy frontend:**
```bash
cd ERP-New/frontend
# Editar .env.production com URL do backend
VITE_API_URL=https://api.seudominio.com
npm run build
# Copiar dist/ para /var/www/erp-frontend/
```

---

### 4. **Docker Compose (VPS)**

Crie um `docker-compose.prod.yml`:

```yaml
version: "3.9"

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: erp
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: erpdb
    volumes:
      - db_data:/var/lib/postgresql/data

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://erp:${DB_PASSWORD}@db:5432/erpdb
      JWT_SECRET: ${JWT_SECRET}
      PORT: 3000
    ports:
      - "3000:3000"
    depends_on:
      - db

  frontend:
    build: ./frontend
    environment:
      VITE_API_URL: https://api.seudominio.com
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  db_data:
```

**Deploy:**
```bash
docker compose -f docker-compose.prod.yml up -d
```

## 🔒 Segurança em Produção

### ✅ Checklist

- [ ] **JWT_SECRET** forte e único
- [ ] **DATABASE_URL** com senha segura
- [ ] **HTTPS** habilitado (Let's Encrypt grátis)
- [ ] **CORS** configurado corretamente
- [ ] **Rate limiting** no backend (opcional)
- [ ] **Backup automático** do banco
- [ ] **Variáveis de ambiente** não commitadas no Git
- [ ] **Logs** configurados
- [ ] **Monitoramento** (opcional)

### 🔐 Configurar HTTPS (Nginx + Let's Encrypt)

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx

# Obter certificado
sudo certbot --nginx -d seudominio.com -d www.seudominio.com

# Renovação automática
sudo certbot renew --dry-run
```

## 📊 Estrutura de URLs em Produção

```
https://seudominio.com          → Frontend (React)
https://api.seudominio.com      → Backend (NestJS)
```

Ou tudo no mesmo domínio:

```
https://seudominio.com          → Frontend
https://seudominio.com/api      → Backend (via proxy Nginx)
```

## 🧪 Testar Localmente como Produção

```powershell
# Backend
cd backend
npm run build
npm run start:prod

# Frontend (outro terminal)
cd frontend
# Criar .env.production
echo "VITE_API_URL=http://localhost:3000" > .env.production
npm run build
npm run preview  # Serve arquivos de produção
```

## 📝 Arquivos de Configuração

### `backend/.env.example`
```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/erpdb"
JWT_SECRET="troque-este-segredo"
PORT=3000
NODE_ENV=development
```

### `frontend/.env.example`
```env
VITE_API_URL=http://localhost:3000
```

### `frontend/.env.production`
```env
VITE_API_URL=https://api.seudominio.com
```

## ✅ Resumo

| Ambiente | Backend URL | Frontend URL | Config |
|---------|------------|--------------|--------|
| **Local** | `http://localhost:3000` | `http://localhost:5173` | `.env` |
| **Produção** | `https://api.seudominio.com` | `https://seudominio.com` | `.env.production` |

**O sistema já está pronto!** Basta configurar as variáveis de ambiente corretas para cada ambiente.

