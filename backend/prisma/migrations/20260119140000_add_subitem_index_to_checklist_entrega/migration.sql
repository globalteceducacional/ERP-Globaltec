-- AlterTable
ALTER TABLE "ChecklistItemEntrega" ADD COLUMN "subitemIndex" INTEGER;

-- AlterTable: Remover constraint antiga e criar nova com subitemIndex
ALTER TABLE "ChecklistItemEntrega" DROP CONSTRAINT IF EXISTS "ChecklistItemEntrega_etapaId_checklistIndex_key";

-- Criar nova constraint única incluindo subitemIndex
ALTER TABLE "ChecklistItemEntrega" ADD CONSTRAINT "ChecklistItemEntrega_etapaId_checklistIndex_subitemIndex_key" UNIQUE ("etapaId", "checklistIndex", "subitemIndex");
