# Script para executar a migration e regenerar o Prisma Client

Write-Host "Executando migration SQL..." -ForegroundColor Yellow
Write-Host "Por favor, execute manualmente no PostgreSQL:" -ForegroundColor Yellow
Write-Host "psql -U seu_usuario -d seu_banco -f prisma/migrations/add_multiple_files_checklist.sql" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pressione Enter após executar a migration SQL..." -ForegroundColor Yellow
Read-Host

Write-Host "Regenerando Prisma Client..." -ForegroundColor Green
npx prisma generate

Write-Host "Prisma Client regenerado com sucesso!" -ForegroundColor Green

