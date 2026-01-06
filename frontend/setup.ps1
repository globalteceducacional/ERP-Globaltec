# Script PowerShell para setup do frontend

Write-Host "🚀 Iniciando setup do frontend..." -ForegroundColor Cyan

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
VITE_API_URL=http://localhost:3000
"@ | Out-File -FilePath .env -Encoding UTF8
    Write-Host "✅ Arquivo .env criado." -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ Setup concluído!" -ForegroundColor Green
Write-Host ""
Write-Host "Para iniciar o servidor:" -ForegroundColor Cyan
Write-Host "npm run dev" -ForegroundColor White

