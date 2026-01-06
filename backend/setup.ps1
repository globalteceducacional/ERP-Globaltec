# Script PowerShell para setup do backend

Write-Host "🚀 Iniciando setup do backend..." -ForegroundColor Cyan

# Verificar Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js não encontrado. Instale Node.js 20+ primeiro." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Node.js encontrado: $(node --version)" -ForegroundColor Green

# Instalar dependências
Write-Host "📦 Instalando dependências..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao instalar dependências" -ForegroundColor Red
    exit 1
}

# Verificar se .env existe
if (-not (Test-Path .env)) {
    Write-Host "⚠️ Arquivo .env não encontrado. Criando..." -ForegroundColor Yellow
    @"
DATABASE_URL="postgresql://erp:senha123@localhost:5432/erpdb"
JWT_SECRET="troque-este-segredo-por-um-seguro"
PORT=3000
"@ | Out-File -FilePath .env -Encoding UTF8
    Write-Host "✅ Arquivo .env criado. Configure as variáveis se necessário." -ForegroundColor Green
}

# Gerar cliente Prisma
Write-Host "🔧 Gerando cliente Prisma..." -ForegroundColor Yellow
npm run prisma:generate

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao gerar cliente Prisma" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Setup concluído!" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Cyan
Write-Host "1. Configure o PostgreSQL e crie o banco 'erpdb'" -ForegroundColor White
Write-Host "2. Execute: npm run prisma:migrate" -ForegroundColor White
Write-Host "3. Execute: npm run prisma:seed (opcional)" -ForegroundColor White
Write-Host "4. Execute: npm run start:dev" -ForegroundColor White

