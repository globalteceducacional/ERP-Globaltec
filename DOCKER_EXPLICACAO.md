# 🐳 Docker - Para que serve?

## 📋 O que é Docker?

Docker é uma tecnologia que **empacota** sua aplicação com todas as dependências em "containers" isolados. É como uma máquina virtual leve, mas mais rápida.

## 🎯 Propósitos do Docker neste projeto

### 1. **Ambiente Isolado e Padronizado** ✅

**Problema sem Docker:**
- Você tem PostgreSQL na sua máquina
- Outro desenvolvedor precisa instalar PostgreSQL
- Em produção, o servidor pode ter versões diferentes
- "Funciona na minha máquina" 😅

**Solução com Docker:**
- Todo mundo usa a **mesma versão** do PostgreSQL (15)
- Mesma configuração para todos
- Mesmo ambiente de desenvolvimento e produção

### 2. **Facilidade de Setup** 🚀

**Sem Docker:**
```powershell
# Precisa instalar:
- PostgreSQL
- Node.js
- Configurar banco
- Criar usuários
- Configurar variáveis de ambiente
# ... muitas etapas manuais
```

**Com Docker:**
```powershell
# Versão nova do Docker (recomendado)
docker compose up

# Ou versão antiga
docker-compose up

# Tudo configurado automaticamente!
```

### 3. **Simulação de Produção** 🏭

O Docker permite testar como a aplicação vai rodar em produção:
- Mesma estrutura de rede entre serviços
- Mesmas variáveis de ambiente
- Mesmo comportamento

### 4. **Deploy Simplificado** 📦

Para colocar em produção (AWS, Azure, DigitalOcean):
- Basta ter Docker instalado
- `docker-compose up` e está rodando
- Não precisa configurar nada manualmente

## 📊 Quando usar cada abordagem?

### ✅ **Desenvolvimento Local** (o que você está fazendo agora)

**Use quando:**
- Desenvolvendo código ativamente
- Precisa de hot-reload (mudanças refletem instantaneamente)
- Debugging mais fácil
- Quer performance máxima

**Vantagens:**
- Mudanças no código são instantâneas
- Debugging mais direto
- Performance melhor (sem virtualização)

**Desvantagens:**
- Precisa instalar PostgreSQL localmente
- Configuração manual do banco
- Pode ter diferenças entre devs

### 🐳 **Docker** (para deploy e testes)

**Use quando:**
- Quer testar ambiente de produção
- Vai fazer deploy
- Quer isolamento completo
- Não quer instalar PostgreSQL localmente
- Trabalha em equipe e quer padronização

**Vantagens:**
- Ambiente isolado e limpo
- Fácil de resetar (apaga container e recria)
- Padronizado para toda equipe
- Pronto para produção

**Desvantagens:**
- Pode ser mais lento (virtualização)
- Hot-reload pode ser mais complexo
- Consome mais recursos

## 🎯 Recomendação para este projeto

### **Desenvolvimento Ativo → Use Local**
```powershell
# Backend
cd backend
npm run start:dev

# Frontend  
cd frontend
npm run dev

# PostgreSQL local (já configurado)
```

### **Testar Deploy / Produção → Use Docker**
```powershell
cd ERP-New
docker compose up --build
# Ou: docker-compose up --build (versão antiga)
```

### **Apenas o Banco PostgreSQL → Docker**
Se não quer instalar PostgreSQL, pode usar apenas o banco:
```powershell
# Só subir o banco
docker-compose up db -d

# Backend e frontend rodam localmente
# Mas conectam no banco do Docker
```

## 📝 O que o docker-compose.yml faz?

```yaml
services:
  db:                    # PostgreSQL 15
    - Cria banco automaticamente
    - Usuário: erp
    - Senha: senha123
    - Porta: 5432

  backend:               # NestJS API
    - Compila TypeScript
    - Roda na porta 3000
    - Conecta no banco automaticamente

  frontend:              # React App
    - Build da aplicação
    - Serve na porta 5173
    - Conecta no backend
```

## 🔄 Como alternar?

### De Local para Docker:
```powershell
# Parar processos locais
# Ctrl+C nos terminais

# Subir Docker
cd ERP-New
docker compose up
# Ou: docker-compose up (versão antiga)
```

### De Docker para Local:
```powershell
# Parar Docker
docker compose down
# Ou: docker-compose down (versão antiga)

# Rodar localmente
cd backend && npm run start:dev
cd frontend && npm run dev
```

## 💡 Dica: Híbrido

Você pode usar **Docker só para o banco** e o resto local:

```powershell
# 1. Subir só o banco
docker compose up db -d
# Ou: docker-compose up db -d (versão antiga)

# 2. Backend local (conecta no banco Docker)
cd backend
npm run start:dev

# 3. Frontend local
cd frontend
npm run dev
```

## ✅ Resumo

| Situação | Usar |
|----------|------|
| Desenvolvendo código | **Local** (mais rápido) |
| Testar deploy | **Docker** (simula produção) |
| Não quer instalar PostgreSQL | **Docker** (só o banco) |
| Trabalho em equipe | **Docker** (padronização) |
| Deploy em servidor | **Docker** (obrigatório) |

**Para seu caso atual:** Continue usando local! Docker é útil quando quiser testar produção ou fazer deploy.

