# Script para corrigir problemas de autenticação do PostgreSQL
# Este script ajuda a configurar o banco usando o usuário padrão 'postgres'

Write-Host "🔧 Corrigindo autenticação do PostgreSQL..." -ForegroundColor Cyan
Write-Host ""

$dbName = "erpdb"

# Opção 1: Usar usuário postgres padrão
Write-Host "Opção 1: Usar usuário 'postgres' (mais simples)" -ForegroundColor Yellow
Write-Host ""

# Solicitar senha do postgres
Write-Host "Digite a senha do usuário 'postgres':" -ForegroundColor Cyan
$postgresPassword = Read-Host -AsSecureString
$postgresPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($postgresPassword)
)

# Testar conexão
Write-Host ""
Write-Host "Testando conexão..." -ForegroundColor Yellow
$env:PGPASSWORD = $postgresPasswordPlain

try {
    $testResult = psql -U postgres -d postgres -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Conexão bem-sucedida!" -ForegroundColor Green
        
        # Criar banco se não existir
        Write-Host ""
        Write-Host "Criando banco '$dbName'..." -ForegroundColor Yellow
        psql -U postgres -c "CREATE DATABASE $dbName;" 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0 -or $testResult -match "already exists") {
            Write-Host "✅ Banco '$dbName' criado ou já existe" -ForegroundColor Green
        }
        
        Write-Host ""
        Write-Host "📝 Atualize o arquivo .env com:" -ForegroundColor Cyan
        Write-Host "   DATABASE_URL=`"postgresql://postgres:$postgresPasswordPlain@localhost:5432/$dbName`"" -ForegroundColor Gray
        Write-Host ""
        Write-Host "⚠️ IMPORTANTE: Guarde esta senha em segurança!" -ForegroundColor Yellow
        
    } else {
        Write-Host "❌ Falha na conexão. Verifique:" -ForegroundColor Red
        Write-Host "   - PostgreSQL está rodando?" -ForegroundColor White
        Write-Host "   - Senha está correta?" -ForegroundColor White
    }
} catch {
    Write-Host "❌ Erro ao conectar: $_" -ForegroundColor Red
}

$env:PGPASSWORD = ""
$postgresPasswordPlain = ""

Write-Host ""
Write-Host "Opção 2: Criar usuário 'erp' manualmente" -ForegroundColor Yellow
Write-Host "Execute no psql:" -ForegroundColor White
Write-Host "  CREATE USER erp WITH PASSWORD 'senha123';" -ForegroundColor Gray
Write-Host "  CREATE DATABASE erpdb;" -ForegroundColor Gray
Write-Host "  GRANT ALL PRIVILEGES ON DATABASE erpdb TO erp;" -ForegroundColor Gray
Write-Host "  \c erpdb" -ForegroundColor Gray
Write-Host "  GRANT ALL ON SCHEMA public TO erp;" -ForegroundColor Gray

