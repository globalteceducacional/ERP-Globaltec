-- Criar enum para status dos itens do checklist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ChecklistItemStatus'
  ) THEN
    CREATE TYPE "ChecklistItemStatus" AS ENUM ('PENDENTE', 'EM_ANALISE', 'APROVADO', 'REPROVADO');
    RAISE NOTICE 'ChecklistItemStatus criado com sucesso';
  ELSE
    RAISE NOTICE 'ChecklistItemStatus já existe, pulando criação';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao criar ChecklistItemStatus: %', SQLERRM;
END $$;

-- Criar tabela de entregas de itens do checklist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'ChecklistItemEntrega'
  ) THEN
    CREATE TABLE "ChecklistItemEntrega" (
      "id" SERIAL PRIMARY KEY,
      "etapaId" INTEGER NOT NULL REFERENCES "Etapa"("id") ON DELETE CASCADE,
      "checklistIndex" INTEGER NOT NULL,
      "descricao" TEXT NOT NULL,
      "imagemUrl" TEXT,
      "documentoUrl" TEXT,
      "status" "ChecklistItemStatus" NOT NULL DEFAULT 'PENDENTE',
      "dataEnvio" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "comentario" TEXT,
      "executorId" INTEGER NOT NULL REFERENCES "Usuario"("id") ON DELETE CASCADE,
      "avaliadoPorId" INTEGER REFERENCES "Usuario"("id") ON DELETE SET NULL,
      "dataAvaliacao" TIMESTAMP WITH TIME ZONE,
      UNIQUE("etapaId", "checklistIndex")
    );
    
    CREATE INDEX IF NOT EXISTS "ChecklistItemEntrega_etapaId_idx" ON "ChecklistItemEntrega" ("etapaId");
    CREATE INDEX IF NOT EXISTS "ChecklistItemEntrega_executorId_idx" ON "ChecklistItemEntrega" ("executorId");
    
    RAISE NOTICE 'Tabela ChecklistItemEntrega criada com sucesso';
  ELSE
    RAISE NOTICE 'Tabela ChecklistItemEntrega já existe, pulando criação';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao criar tabela ChecklistItemEntrega: %', SQLERRM;
END $$;

