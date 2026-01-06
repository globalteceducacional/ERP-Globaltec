# Script para inicializar o banco de dados e iniciar o backend

Write-Host "🚀 Iniciando configuração do banco de dados..." -ForegroundColor Cyan

# Verificar se o arquivo .env existe
if (-not (Test-Path .env)) {
    Write-Host "❌ Arquivo .env não encontrado!" -ForegroundColor Red
    Write-Host "Crie o arquivo .env com a configuração do banco de dados." -ForegroundColor Yellow
    exit 1
}

# Ler DATABASE_URL do .env
$envContent = Get-Content .env
$databaseUrl = ($envContent | Select-String "DATABASE_URL=").ToString().Split("=")[1].Trim('"')

# Extrair informações da URL
if ($databaseUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $dbHost = $matches[3]
    $dbPort = $matches[4]
    $dbName = $matches[5]
    
    Write-Host "✅ Configuração encontrada:" -ForegroundColor Green
    Write-Host "   Usuário: $dbUser" -ForegroundColor White
    Write-Host "   Host: $dbHost" -ForegroundColor White
    Write-Host "   Porta: $dbPort" -ForegroundColor White
    Write-Host "   Banco: $dbName" -ForegroundColor White
} else {
    Write-Host "❌ Erro ao parsear DATABASE_URL" -ForegroundColor Red
    exit 1
}

# Tentar encontrar psql no PATH ou em locais comuns
$psqlPath = $null
$possiblePaths = @(
    "C:\Program Files\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files\PostgreSQL\15\bin\psql.exe",
    "C:\Program Files\PostgreSQL\14\bin\psql.exe",
    "C:\Program Files\PostgreSQL\13\bin\psql.exe",
    "C:\Program Files (x86)\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files (x86)\PostgreSQL\15\bin\psql.exe"
)

foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $psqlPath = $path
        break
    }
}

# Se não encontrou, tentar pelo PATH
if (-not $psqlPath) {
    $psqlPath = Get-Command psql -ErrorAction SilentlyContinue
    if ($psqlPath) {
        $psqlPath = $psqlPath.Source
    }
}

if (-not $psqlPath) {
    Write-Host "⚠️ psql não encontrado no PATH" -ForegroundColor Yellow
    Write-Host "Tentando criar banco via Prisma..." -ForegroundColor Yellow
    
    # Tentar criar banco via Prisma (pode não funcionar se o banco não existir)
    Write-Host "📦 Gerando cliente Prisma..." -ForegroundColor Yellow
    npm run prisma:generate
    
    Write-Host "🔄 Executando migrações..." -ForegroundColor Yellow
    npm run prisma:migrate
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Banco configurado com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "❌ Erro ao executar migrações. Verifique se o PostgreSQL está rodando." -ForegroundColor Red
        Write-Host "   Execute manualmente: CREATE DATABASE $dbName;" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "✅ psql encontrado: $psqlPath" -ForegroundColor Green
    
    # Configurar variável de ambiente para senha
    $env:PGPASSWORD = $dbPassword
    
    # Verificar se o banco existe
    Write-Host "🔍 Verificando se o banco '$dbName' existe..." -ForegroundColor Yellow
    $dbExists = & $psqlPath -U $dbUser -h $dbHost -p $dbPort -lqt | Select-String "\b$dbName\b"
    
    if (-not $dbExists) {
        Write-Host "📝 Criando banco de dados '$dbName'..." -ForegroundColor Yellow
        & $psqlPath -U $dbUser -h $dbHost -p $dbPort -d postgres -c "CREATE DATABASE $dbName;"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Banco de dados criado!" -ForegroundColor Green
        } else {
            Write-Host "❌ Erro ao criar banco de dados" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "✅ Banco de dados já existe" -ForegroundColor Green
    }
    
    # Limpar senha da memória
    Remove-Item Env:\PGPASSWORD
}

# Gerar cliente Prisma
Write-Host "📦 Gerando cliente Prisma..." -ForegroundColor Yellow
npm run prisma:generate

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao gerar cliente Prisma" -ForegroundColor Red
    exit 1
}

# Executar migrações
Write-Host "🔄 Executando migrações..." -ForegroundColor Yellow
npm run prisma:migrate

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao executar migrações" -ForegroundColor Red
    exit 1
}

# Executar seed (opcional)
Write-Host "🌱 Executando seed (populando banco com dados iniciais)..." -ForegroundColor Yellow
npm run prisma:seed

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Aviso: Seed não executado (pode ser normal)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Banco de dados configurado com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Credenciais padrão:" -ForegroundColor Cyan
Write-Host "   Admin: admin@globaltec.com / admin123" -ForegroundColor White
Write-Host "   Supervisor: supervisor@globaltec.com / senha123" -ForegroundColor White
Write-Host "   Executor: executor@globaltec.com / senha123" -ForegroundColor White
Write-Host ""
