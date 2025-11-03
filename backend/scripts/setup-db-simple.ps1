# Script simplificado para configurar banco usando usuário postgres padrão

Write-Host "🔧 Configuração Simplificada do Banco de Dados" -ForegroundColor Cyan
Write-Host ""

$dbName = "erpdb"

Write-Host "Este script vai usar o usuário 'postgres' padrão do PostgreSQL." -ForegroundColor Yellow
Write-Host "Você precisará informar a senha do postgres." -ForegroundColor Yellow
Write-Host ""

# Solicitar senha do postgres
$postgresPassword = Read-Host "Digite a senha do usuário 'postgres'" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($postgresPassword)
$postgresPasswordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

$env:PGPASSWORD = $postgresPasswordPlain

Write-Host ""
Write-Host "Testando conexão..." -ForegroundColor Yellow

try {
    $test = psql -U postgres -d postgres -c "SELECT 1;" 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Conexão bem-sucedida!" -ForegroundColor Green
        
        # Criar banco
        Write-Host ""
        Write-Host "Criando banco '$dbName'..." -ForegroundColor Yellow
        psql -U postgres -c "CREATE DATABASE $dbName;" 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq 1) {
            Write-Host "✅ Banco '$dbName' configurado" -ForegroundColor Green
        }
        
        Write-Host ""
        Write-Host "═══════════════════════════════════════" -ForegroundColor Green
        Write-Host "✅ Configuração concluída!" -ForegroundColor Green
        Write-Host "═══════════════════════════════════════" -ForegroundColor Green
        Write-Host ""
        Write-Host "📝 Atualize o arquivo backend\.env com:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "DATABASE_URL=`"postgresql://postgres:$postgresPasswordPlain@localhost:5432/$dbName`"" -ForegroundColor White
        Write-Host ""
        Write-Host "Depois execute:" -ForegroundColor Cyan
        Write-Host "  npm run prisma:migrate" -ForegroundColor White
        Write-Host "  npm run prisma:seed" -ForegroundColor White
        
    } else {
        Write-Host "❌ Falha na conexão. Verifique:" -ForegroundColor Red
        Write-Host "   - PostgreSQL está rodando?" -ForegroundColor White
        Write-Host "   - Senha está correta?" -ForegroundColor White
        Write-Host "   - Serviço PostgreSQL está iniciado?" -ForegroundColor White
    }
} catch {
    Write-Host "❌ Erro: $_" -ForegroundColor Red
}

$env:PGPASSWORD = ""
$postgresPasswordPlain = ""

