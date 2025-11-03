# Etapa de build
FROM node:20-alpine AS builder
WORKDIR /app

# Copiar arquivos de dependências
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./

# Instalar dependências
RUN if [ -f package-lock.json ]; then npm ci; elif [ -f pnpm-lock.yaml ]; then npm install -g pnpm && pnpm install; elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; else npm install; fi

# Copiar schema do Prisma e gerar o client
COPY prisma ./prisma
RUN npx prisma generate

# Copiar código fonte e arquivos de configuração
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

# Fazer build e verificar
RUN echo "=== Executando build ===" && npm run build
RUN echo "=== Verificando estrutura do dist/ ===" && ls -la dist/ || echo "dist/ não existe!"
RUN echo "=== Procurando main.js ===" && find . -name "main.js" -type f 2>/dev/null | head -5 || echo "main.js não encontrado!"
RUN echo "=== Todos os arquivos .js em dist/ ===" && find dist -name "*.js" -type f 2>/dev/null | head -10 || echo "Nenhum .js encontrado!"

# Verificar se main.js existe em dist/ ou dist/src/
RUN if [ -f dist/main.js ]; then \
      echo "✅ main.js encontrado em dist/main.js"; \
    elif [ -f dist/src/main.js ]; then \
      echo "✅ main.js encontrado em dist/src/main.js - movendo para dist/"; \
      mv dist/src/main.js dist/main.js; \
    else \
      echo "❌ ERRO: main.js não encontrado!"; \
      echo "=== Estrutura completa do dist/ ==="; \
      find dist -type f -o -type d | head -30; \
      exit 1; \
    fi

# Etapa final (produção)
FROM node:20-alpine
WORKDIR /app

# Copiar arquivos de dependências
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./

# Instalar apenas dependências de produção
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; elif [ -f pnpm-lock.yaml ]; then npm install -g pnpm && pnpm install --prod; elif [ -f yarn.lock ]; then yarn install --production; else npm install --omit=dev; fi

# Copiar schema do Prisma
COPY prisma ./prisma

# Gerar Prisma Client (instalar Prisma CLI temporariamente se necessário)
RUN npm install -g prisma@latest && prisma generate

# Copiar código compilado do builder
COPY --from=builder /app/dist ./dist

# Verificar se os arquivos foram copiados corretamente
RUN ls -la dist/ && test -f dist/main.js || (echo "❌ main.js not found in dist!" && exit 1)

# Expor porta
EXPOSE 3000

# Comando para iniciar
CMD ["node", "dist/main.js"]
