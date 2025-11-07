-- AlterEnum
ALTER TYPE "CompraStatus" ADD VALUE 'REPROVADO';

-- AlterTable
ALTER TABLE "Compra" ADD COLUMN "motivoRejeicao" TEXT;

