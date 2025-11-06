-- AlterEnum
-- Os valores antigos (APROVADA, REJEITADA, CONCLUIDA) serão removidos
-- Se houver dados antigos, você precisará atualizá-los manualmente antes de rodar esta migração
ALTER TYPE "CompraStatus" RENAME TO "CompraStatus_old";
CREATE TYPE "CompraStatus" AS ENUM ('PENDENTE', 'COMPRADO_ACAMINHO', 'ENTREGUE');
ALTER TABLE "Compra" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Compra" ALTER COLUMN "status" TYPE "CompraStatus" USING (
  CASE 
    WHEN "status"::text = 'PENDENTE' THEN 'PENDENTE'::"CompraStatus"
    WHEN "status"::text = 'APROVADA' THEN 'COMPRADO_ACAMINHO'::"CompraStatus"
    WHEN "status"::text = 'CONCLUIDA' THEN 'ENTREGUE'::"CompraStatus"
    ELSE 'PENDENTE'::"CompraStatus"
  END
);
ALTER TABLE "Compra" ALTER COLUMN "status" SET DEFAULT 'PENDENTE'::"CompraStatus";
DROP TYPE "CompraStatus_old";

-- AlterTable
ALTER TABLE "Compra" ADD COLUMN "nfUrl" TEXT,
ADD COLUMN "comprovantePagamentoUrl" TEXT;

