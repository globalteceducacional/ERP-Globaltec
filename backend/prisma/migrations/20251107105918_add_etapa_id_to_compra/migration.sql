-- AlterTable
ALTER TABLE "Compra" ADD COLUMN "etapaId" INTEGER;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

