-- Migration: Adicionar campo paginasPermitidas na tabela Cargo

ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "paginasPermitidas" JSONB;

-- Atualizar cargos existentes com permissões padrão baseadas no nome
UPDATE "Cargo" SET "paginasPermitidas" = '["/dashboard", "/projects", "/tasks/my", "/stock", "/occurrences", "/requests", "/users", "/cargos"]'::jsonb WHERE nome = 'DIRETOR';
UPDATE "Cargo" SET "paginasPermitidas" = '["/tasks/my", "/occurrences", "/requests"]'::jsonb WHERE nome = 'SUPERVISOR';
UPDATE "Cargo" SET "paginasPermitidas" = '["/tasks/my", "/occurrences", "/requests"]'::jsonb WHERE nome = 'EXECUTOR';
UPDATE "Cargo" SET "paginasPermitidas" = '["/tasks/my", "/stock", "/occurrences"]'::jsonb WHERE nome = 'COTADOR';
UPDATE "Cargo" SET "paginasPermitidas" = '["/tasks/my", "/stock", "/occurrences"]'::jsonb WHERE nome = 'PAGADOR';

