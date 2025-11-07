-- AlterEnum
ALTER TYPE "CompraStatus" ADD VALUE 'SOLICITADO';

-- AlterTable
ALTER TABLE "Compra" ADD COLUMN "solicitadoPorId" INTEGER;
ALTER TABLE "Compra" ALTER COLUMN "projetoId" DROP NOT NULL;
ALTER TABLE "Compra" ALTER COLUMN "valorUnitario" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

