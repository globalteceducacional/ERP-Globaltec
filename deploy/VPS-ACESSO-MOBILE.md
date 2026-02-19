# Acesso pelo celular na VPS (mesmo link do PC)

O projeto roda na **VPS**; no Docker em localhost funciona. Se no celular o mesmo link dá erro, o motivo está na **configuração da VPS**, não no código local.

## Por que o celular quebra e o PC não?

- No **PC** você pode estar acessando por domínio (ex.: `http://erp.alenxandriaglobaltec.com`) e o frontend foi buildado com `VITE_API_URL` apontando para um endereço que no PC resolve (ex.: IP da VPS com porta).
- No **celular**, o mesmo frontend chama a **mesma URL da API**. Dependendo da rede (4G, outro Wi‑Fi), essa URL pode:
  - ser bloqueada (mixed content, CORS, firewall do provedor), ou
  - apontar para IP/porta que só funciona na rede do servidor.

Ou seja: o problema é a **URL absoluta da API** usada no build do frontend na VPS. A solução é fazer a API ser acessada pelo **mesmo domínio** (sem IP nem porta na mão).

## Solução na VPS (3 passos)

### 1. Nginx: proxy da API no mesmo domínio

Na VPS, o Nginx deve servir o frontend **e** encaminhar `/api` para o backend. Assim, tanto o PC quanto o celular usam só o domínio (ex.: `erp.alenxandriaglobaltec.com`).

Use o arquivo `deploy/nginx-erp.conf` deste repositório. Exemplo do bloco importante:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3001/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

- Coloque esse `server` (com `location /` e `location /api/`) no site do ERP (ex.: `/etc/nginx/sites-available/erp`).
- Teste e recarregue: `sudo nginx -t && sudo systemctl reload nginx`.

### 2. Build do frontend na VPS com API relativa

Para o frontend usar o **mesmo domínio** para a API, o build na VPS **não pode** usar URL absoluta (ex.: `http://...:3001`). Se aparecer `http://localhost:3001/auth/login` no DevTools, o build foi feito com valor errado.

- No `.env` da **VPS** (raiz do projeto, ex.: `/opt/ERP-Globaltec/.env`), use **uma** das opções:
  ```env
  VITE_API_URL=
  ```
  ou
  ```env
  VITE_API_URL=/api
  ```
  (não use `http://erp....:3001` nem `http://localhost:3001` na VPS.)

- Rebuild do frontend na VPS para o valor entrar no build:
  ```bash
  docker compose build --no-cache frontend
  docker compose up -d frontend
  ```

Com isso, o frontend em produção usa `baseURL: '/api'`: as chamadas vão para `https://seu-dominio/api/...`, e o Nginx encaminha para o backend na porta 3001.

### 3. Resumo

| Onde       | O que fazer |
|-----------|-------------|
| **VPS**   | Nginx com `location /api/` → `proxy_pass http://127.0.0.1:3001/` |
| **VPS**   | `.env` com `VITE_API_URL=` (vazio) |
| **VPS**   | Rebuild do frontend e subir de novo o container |

Depois disso, o **mesmo link** (ex.: `http://erp.alenxandriaglobaltec.com`) deve funcionar no PC e no celular. O Docker em localhost continua funcionando usando `VITE_API_URL` com a URL do backend (ex.: `http://localhost:3000` ou `http://localhost:3001`) no seu `.env` local; a mudança acima é só para a VPS.
