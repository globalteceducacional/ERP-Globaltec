-- Migration: Transformar enum Cargo em tabela dinâmica

-- 1. Criar tabela Cargo (usando nome temporário primeiro para evitar conflito)
CREATE TABLE IF NOT EXISTS "CargoTable" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CargoTable_pkey" PRIMARY KEY ("id")
);

-- 2. Criar índice único para nome
CREATE UNIQUE INDEX IF NOT EXISTS "CargoTable_nome_key" ON "CargoTable"("nome");

-- 3. Inserir cargos existentes (ignorar se já existirem)
INSERT INTO "CargoTable" ("nome", "descricao", "ativo") 
SELECT * FROM (VALUES
    ('DIRETOR', 'Diretor com acesso total ao sistema', true),
    ('SUPERVISOR', 'Supervisor de projetos', true),
    ('EXECUTOR', 'Executor de tarefas', true),
    ('COTADOR', 'Responsável por cotações', true),
    ('PAGADOR', 'Responsável por pagamentos', true)
) AS v(nome, descricao, ativo)
WHERE NOT EXISTS (SELECT 1 FROM "CargoTable" WHERE "CargoTable"."nome" = v.nome);

-- 4. Adicionar coluna cargoId na tabela Usuario
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "cargoId" INTEGER;

-- 5. Migrar dados do enum para a nova estrutura
-- Primeiro, atualizar usuarios com DIRETOR
UPDATE "Usuario" SET "cargoId" = (SELECT id FROM "CargoTable" WHERE nome = 'DIRETOR') 
WHERE "cargo"::text = 'DIRETOR' AND "cargoId" IS NULL;

-- Atualizar usuarios com SUPERVISOR
UPDATE "Usuario" SET "cargoId" = (SELECT id FROM "CargoTable" WHERE nome = 'SUPERVISOR') 
WHERE "cargo"::text = 'SUPERVISOR' AND "cargoId" IS NULL;

-- Atualizar usuarios com EXECUTOR
UPDATE "Usuario" SET "cargoId" = (SELECT id FROM "CargoTable" WHERE nome = 'EXECUTOR') 
WHERE "cargo"::text = 'EXECUTOR' AND "cargoId" IS NULL;

-- Atualizar usuarios com COTADOR
UPDATE "Usuario" SET "cargoId" = (SELECT id FROM "CargoTable" WHERE nome = 'COTADOR') 
WHERE "cargo"::text = 'COTADOR' AND "cargoId" IS NULL;

-- Atualizar usuarios com PAGADOR
UPDATE "Usuario" SET "cargoId" = (SELECT id FROM "CargoTable" WHERE nome = 'PAGADOR') 
WHERE "cargo"::text = 'PAGADOR' AND "cargoId" IS NULL;

-- Para usuarios sem cargo definido, usar EXECUTOR como padrão
UPDATE "Usuario" SET "cargoId" = (SELECT id FROM "CargoTable" WHERE nome = 'EXECUTOR') 
WHERE "cargoId" IS NULL;

-- 6. Tornar cargoId obrigatório
ALTER TABLE "Usuario" ALTER COLUMN "cargoId" SET NOT NULL;

-- 7. Adicionar foreign key
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_cargoId_fkey" 
FOREIGN KEY ("cargoId") REFERENCES "CargoTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8. Remover coluna cargo antiga (enum)
ALTER TABLE "Usuario" DROP COLUMN IF EXISTS "cargo";

-- 9. Remover tipo enum Cargo (apenas se não houver outras referências)
-- Verificar se há alguma coluna usando o enum antes de remover
DO $$
BEGIN
    -- Verificar se o enum ainda está sendo usado
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND udt_name = 'Cargo'
    ) THEN
        DROP TYPE IF EXISTS "Cargo";
    END IF;
END $$;

-- 10. Renomear tabela para o nome final (Cargo)
ALTER TABLE "CargoTable" RENAME TO "Cargo";

-- 11. Renomear constraint e índices
ALTER INDEX "CargoTable_pkey" RENAME TO "Cargo_pkey";
ALTER INDEX "CargoTable_nome_key" RENAME TO "Cargo_nome_key";

-- 12. Atualizar constraint de foreign key para referenciar a tabela renomeada
ALTER TABLE "Usuario" DROP CONSTRAINT IF EXISTS "Usuario_cargoId_fkey";
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_cargoId_fkey" 
FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

