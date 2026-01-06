# Script completo de setup local

Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🚀 ERP Globaltec - Setup Local" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $rootDir "backend"
$frontendDir = Join-Path $rootDir "frontend"

# Setup Backend
Write-Host "📦 Configurando Backend..." -ForegroundColor Yellow
Set-Location $backendDir
& .\setup.ps1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro no setup do backend" -ForegroundColor Red
    exit 1
}

# Setup Frontend
Write-Host ""
Write-Host "📦 Configurando Frontend..." -ForegroundColor Yellow
Set-Location $frontendDir
& .\setup.ps1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro no setup do frontend" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅ Setup completo!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Cyan
Write-Host "1. Configure PostgreSQL e crie o banco 'erpdb'" -ForegroundColor White
Write-Host "2. No backend: npm run prisma:migrate" -ForegroundColor White
Write-Host "3. No backend: npm run prisma:seed (dados de exemplo)" -ForegroundColor White
Write-Host "4. Inicie backend: cd backend && npm run start:dev" -ForegroundColor White
Write-Host "5. Inicie frontend: cd frontend && npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Credenciais (após seed):" -ForegroundColor Cyan
Write-Host "  Admin: admin@globaltec.com / admin123" -ForegroundColor White

