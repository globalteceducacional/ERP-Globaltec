# 🐳 Como Instalar Docker no Windows

## 📥 Download

1. **Baixe o Docker Desktop:**
   - Acesse: https://www.docker.com/products/docker-desktop/
   - Ou direto: https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe

2. **Instale:**
   - Execute o instalador
   - Marque "Use WSL 2 instead of Hyper-V" (se aparecer)
   - Reinicie o computador quando solicitado

3. **Inicie o Docker Desktop:**
   - Procure "Docker Desktop" no menu Iniciar
   - Aguarde o ícone da baleia aparecer na bandeja do sistema (canto inferior direito)

## ✅ Verificar Instalação

```powershell
# Verificar versão
docker --version

# Verificar docker-compose
docker compose version
```

**Nota:** Versões novas do Docker usam `docker compose` (sem hífen) em vez de `docker-compose`.

## 🚀 Usar Docker

Depois de instalado:

```powershell
cd ERP-New

# Versão nova (recomendado)
docker compose up --build

# Ou versão antiga (se não funcionar)
docker-compose up --build
```

## ⚠️ Requisitos

- Windows 10/11 (64-bit)
- WSL 2 (Windows Subsystem for Linux) - geralmente instalado automaticamente
- Pelo menos 4GB de RAM disponível
- Virtualização habilitada no BIOS

## 🆘 Problemas Comuns

### "WSL 2 installation is incomplete"
1. Baixe o kernel WSL2: https://aka.ms/wsl2kernel
2. Instale e reinicie

### "Virtualization is disabled"
1. Entre no BIOS (F2, F10, Del na inicialização)
2. Habilite "Virtualization Technology" ou "VT-x"
3. Salve e reinicie

### Docker não inicia
1. Execute como Administrador
2. Verifique se o serviço está rodando: `Get-Service *docker*`
3. Reinicie o Docker Desktop

## 💡 Alternativa: Não Precisa Instalar!

Se você já tem tudo rodando localmente, **não precisa do Docker** para desenvolvimento. Use Docker apenas se:
- Quiser testar deploy
- Não quiser instalar PostgreSQL
- Quiser ambiente isolado

