# Script PowerShell para iniciar o Docker Compose
# Uso: .\docker-start.ps1

Write-Host "🐳 Iniciando ERP Global com Docker..." -ForegroundColor Cyan

# Verificar se Docker está instalado
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker não está instalado!" -ForegroundColor Red
    Write-Host "Instale o Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Verificar se docker-compose está disponível
if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker Compose não está instalado!" -ForegroundColor Red
    exit 1
}

# Verificar se existe arquivo .env
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  Arquivo .env não encontrado!" -ForegroundColor Yellow
    Write-Host "📝 Criando .env a partir de env.example..." -ForegroundColor Cyan
    
    if (Test-Path "env.example") {
        Copy-Item "env.example" ".env"
        Write-Host "✅ Arquivo .env criado. Por favor, edite-o com suas configurações." -ForegroundColor Green
    } else {
        Write-Host "❌ Arquivo env.example não encontrado!" -ForegroundColor Red
        exit 1
    }
}

Write-Host "🔨 Construindo e iniciando containers..." -ForegroundColor Cyan
docker-compose up -d --build

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Containers iniciados com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Status dos containers:" -ForegroundColor Cyan
    docker-compose ps
    
    Write-Host ""
    Write-Host "🌐 Acesse a aplicação:" -ForegroundColor Cyan
    Write-Host "   Frontend: http://localhost:5173" -ForegroundColor White
    Write-Host "   Backend:  http://localhost:3000" -ForegroundColor White
    Write-Host "   Health:   http://localhost:3000/health" -ForegroundColor White
    Write-Host ""
    Write-Host "📝 Para ver os logs:" -ForegroundColor Cyan
    Write-Host "   docker-compose logs -f" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "❌ Erro ao iniciar containers!" -ForegroundColor Red
    Write-Host "Verifique os logs com: docker-compose logs" -ForegroundColor Yellow
    exit 1
}

