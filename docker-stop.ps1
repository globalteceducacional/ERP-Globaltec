# Script PowerShell para parar o Docker Compose
# Uso: .\docker-stop.ps1

Write-Host "🛑 Parando containers do ERP Global..." -ForegroundColor Cyan

docker-compose down

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Containers parados com sucesso!" -ForegroundColor Green
} else {
    Write-Host "❌ Erro ao parar containers!" -ForegroundColor Red
    exit 1
}

