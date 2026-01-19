# 🔄 Atualizar Docker com Novos Arquivos - ERP Globaltec

## 📋 Comandos para Atualizar sem Desfazer Configuração

### 1. Atualizar Backend e Frontend (Reconstruir com novos arquivos)

```powershell
# Reconstruir apenas as imagens que mudaram e reiniciar containers
docker-compose up -d --build
```

**O que faz:**
- Detecta arquivos alterados
- Reconstrói apenas as imagens necessárias
- Reinicia os containers com o novo código
- **NÃO remove volumes ou dados do banco**

---

### 2. Atualizar Apenas Backend

```powershell
# Reconstruir e reiniciar apenas o backend
docker-compose up -d --build backend
```

---

### 3. Atualizar Apenas Frontend

```powershell
# Reconstruir e reiniciar apenas o frontend
docker-compose up -d --build frontend
```

---

### 4. Forçar Reconstrução Completa (sem cache)

```powershell
# Reconstruir tudo do zero (sem usar cache)
docker-compose build --no-cache

# Depois iniciar
docker-compose up -d
```

---

### 5. Atualizar e Recriar Containers (mantém volumes)

```powershell
# Recriar containers mas manter volumes (dados do banco)
docker-compose up -d --build --force-recreate
```

---

### 6. Verificar Atualizações

```powershell
# Ver logs após atualização
docker-compose logs -f

# Ver status
docker-compose ps
```

---

## 🎯 Comando Recomendado (Mais Simples)

Para atualizar tudo com os novos arquivos:

```powershell
docker-compose up -d --build
```

Este comando:
- ✅ Reconstrói imagens com código atualizado
- ✅ Reinicia containers
- ✅ **NÃO remove volumes** (dados do banco permanecem)
- ✅ **NÃO remove configurações** existentes
- ✅ Aplica apenas as mudanças de código

---

## 📝 Fluxo Completo de Atualização

```powershell
# 1. Verificar status atual
docker-compose ps

# 2. Atualizar com novos arquivos
docker-compose up -d --build

# 3. Verificar logs para confirmar
docker-compose logs -f backend
docker-compose logs -f frontend

# 4. Testar aplicação
# Frontend: http://localhost:5174
# Backend: http://localhost:3000/health
```

---

## ⚠️ Importante

- Os **dados do banco** são preservados (estão em volumes)
- As **configurações do .env** são mantidas
- Apenas o **código** é atualizado
- Os **containers** são recriados com o novo código

---

**Pronto!** Use `docker-compose up -d --build` sempre que quiser atualizar o Docker com novos arquivos! 🚀
