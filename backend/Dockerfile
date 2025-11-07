# Etapa de build
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar arquivos de dependências
COPY package.json package-lock.json* ./

# Instalar dependências
RUN npm ci

# Copiar schema do Prisma e gerar o client
COPY prisma ./prisma
RUN npx prisma generate

# Copiar código fonte e arquivos de configuração
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

# Fazer build
RUN npm run build

# Verificar se o build foi bem-sucedido
RUN test -f dist/main.js || (echo "❌ ERRO: main.js não encontrado após build!" && exit 1)

# Etapa final (produção)
FROM node:20-alpine

WORKDIR /app

# Instalar dependências do sistema necessárias
RUN apk add --no-cache wget

# Copiar arquivos de dependências
COPY package.json package-lock.json* ./

# Instalar apenas dependências de produção
RUN npm ci --omit=dev

# Instalar Prisma CLI globalmente para migrations
RUN npm install -g prisma@latest

# Copiar schema do Prisma
COPY prisma ./prisma

# Gerar Prisma Client
RUN prisma generate

# Copiar código compilado do builder
COPY --from=builder /app/dist ./dist

# Verificar se os arquivos foram copiados corretamente
RUN test -f dist/main.js || (echo "❌ main.js não encontrado!" && exit 1)

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expor porta
EXPOSE 3000

# Health check endpoint (será adicionado no main.ts)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Comando para iniciar
CMD ["node", "dist/main.js"]
