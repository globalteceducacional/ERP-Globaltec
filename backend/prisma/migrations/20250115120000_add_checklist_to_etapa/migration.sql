-- AlterTable (executar somente se a tabela existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'Etapa'
  ) THEN
    ALTER TABLE "Etapa" ADD COLUMN IF NOT EXISTS "checklistJson" JSONB;
  END IF;
END $$;

