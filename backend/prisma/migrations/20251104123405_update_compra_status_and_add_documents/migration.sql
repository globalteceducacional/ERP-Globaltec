/*
  Warnings:

  - The values [APROVADA,REJEITADA,CONCLUIDA] on the enum `CompraStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CompraStatus_new" AS ENUM ('PENDENTE', 'COMPRADO_ACAMINHO', 'ENTREGUE');
ALTER TABLE "Compra" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Compra" ALTER COLUMN "status" TYPE "CompraStatus_new" USING ("status"::text::"CompraStatus_new");
ALTER TYPE "CompraStatus" RENAME TO "CompraStatus_old";
ALTER TYPE "CompraStatus_new" RENAME TO "CompraStatus";
DROP TYPE "CompraStatus_old";
ALTER TABLE "Compra" ALTER COLUMN "status" SET DEFAULT 'PENDENTE';
COMMIT;

-- AlterTable
ALTER TABLE "Compra" ADD COLUMN     "comprovantePagamentoUrl" TEXT,
ADD COLUMN     "nfUrl" TEXT;
