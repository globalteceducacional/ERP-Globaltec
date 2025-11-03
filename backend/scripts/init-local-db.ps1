# Script para inicializar banco de dados PostgreSQL localmente
# Requer PostgreSQL instalado e psql no PATH

Write-Host "🗄️ Inicializando banco de dados PostgreSQL local..." -ForegroundColor Cyan

$dbName = "erpdb"
$dbUser = "erp"
$dbPassword = "senha123"

# Verificar se psql está disponível
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Host "❌ psql não encontrado. Instale PostgreSQL e adicione ao PATH." -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternativa: Use o usuário 'postgres' padrão no .env" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ PostgreSQL encontrado" -ForegroundColor Green

# Solicitar senha do PostgreSQL (usuário postgres)
Write-Host ""
Write-Host "⚠️ Você precisará informar a senha do usuário 'postgres'" -ForegroundColor Yellow
Write-Host "Pressione Enter para continuar..." -ForegroundColor Gray
$null = Read-Host

# Criar banco de dados
Write-Host "📦 Criando banco de dados '$dbName'..." -ForegroundColor Yellow

$createDbQuery = "CREATE DATABASE $dbName;"
$createUserQuery = "CREATE USER $dbUser WITH PASSWORD '$dbPassword';"
$grantQuery = "GRANT ALL PRIVILEGES ON DATABASE $dbName TO $dbUser;"

# Tentar criar banco (ignorar se já existir)
try {
    $env:PGPASSWORD = $env:POSTGRES_PASSWORD
    psql -U postgres -c $createDbQuery 2>$null
    Write-Host "✅ Banco de dados criado ou já existe" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Erro ao criar banco (pode já existir)" -ForegroundColor Yellow
}

# Criar usuário
Write-Host "👤 Criando usuário '$dbUser'..." -ForegroundColor Yellow
try {
    psql -U postgres -c $createUserQuery 2>$null
    Write-Host "✅ Usuário criado" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Usuário pode já existir - tentando atualizar senha..." -ForegroundColor Yellow
    $alterPassQuery = "ALTER USER $dbUser WITH PASSWORD '$dbPassword';"
    psql -U postgres -c $alterPassQuery 2>$null
}

# Conceder permissões
Write-Host "🔐 Configurando permissões..." -ForegroundColor Yellow
try {
    psql -U postgres -c $grantQuery 2>$null
    Write-Host "✅ Permissões configuradas" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Erro ao configurar permissões" -ForegroundColor Yellow
}

# Conceder permissões no schema public
try {
    psql -U postgres -d $dbName -c "GRANT ALL ON SCHEMA public TO $dbUser;" 2>$null
    psql -U postgres -d $dbName -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $dbUser;" 2>$null
    Write-Host "✅ Permissões de schema configuradas" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Erro ao configurar permissões de schema" -ForegroundColor Yellow
}

$env:PGPASSWORD = ""

Write-Host ""
Write-Host "✅ Configuração do banco concluída!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Configure o .env no backend com:" -ForegroundColor Cyan
Write-Host "   DATABASE_URL=`"postgresql://$dbUser`:$dbPassword@localhost:5432/$dbName`"" -ForegroundColor Gray
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Cyan
Write-Host "1. Verifique se o .env está correto" -ForegroundColor White
Write-Host "2. Execute: npm run prisma:migrate" -ForegroundColor White
Write-Host "3. Execute: npm run prisma:seed (opcional)" -ForegroundColor White
