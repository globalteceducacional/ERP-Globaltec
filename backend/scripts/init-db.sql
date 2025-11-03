-- Script SQL para inicializar o banco de dados PostgreSQL localmente
-- Execute este script após criar o banco de dados

-- Criar banco de dados (execute manualmente antes)
-- CREATE DATABASE erpdb;

-- Conectar ao banco
-- \c erpdb;

-- Nota: Este script não cria as tabelas - elas são criadas pelo Prisma Migrate
-- Execute: npx prisma migrate dev --name init

-- Apenas para referência, aqui estão as tabelas que serão criadas:
/*
- usuarios
- projetos  
- projeto_responsavel
- etapas
- subetapas
- compras
- estoque
- ocorrencias
- requerimentos
- notificacoes
*/

-- Criar usuário administrador padrão (após migrações)
-- IMPORTANTE: Execute apenas após rodar as migrações do Prisma

-- Exemplo de INSERT (execute após migrações):
-- INSERT INTO usuarios (nome, email, senha, cargo, ativo, "dataCadastro")
-- VALUES (
--   'Administrador',
--   'admin@globaltec.com',
--   '$2b$10$...hash_aqui...', -- Use bcrypt para gerar o hash da senha
--   'DIRETOR',
--   true,
--   NOW()
-- );

-- Para criar hash da senha em Node.js:
-- const bcrypt = require('bcrypt');
-- const hash = await bcrypt.hash('senha123', 10);
-- console.log(hash);

