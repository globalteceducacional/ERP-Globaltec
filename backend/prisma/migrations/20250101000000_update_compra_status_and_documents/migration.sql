-- Garantir que o tipo antigo exista antes de renomear
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompraStatus') THEN
    ALTER TYPE "CompraStatus" RENAME TO "CompraStatus_old";
  END IF;
END $$;

-- Criar o tipo novo, se ainda não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompraStatus') THEN
    CREATE TYPE "CompraStatus" AS ENUM ('PENDENTE', 'COMPRADO_ACAMINHO', 'ENTREGUE');
  END IF;
END $$;

-- Atualizar coluna somente se a tabela existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Compra' AND column_name = 'status'
  ) THEN
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
  END IF;
END $$;

-- Remover tipo antigo, se foi renomeado
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompraStatus_old') THEN
    DROP TYPE "CompraStatus_old";
  END IF;
END $$;

-- AlterTable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'Compra'
  ) THEN
    ALTER TABLE "Compra" ADD COLUMN IF NOT EXISTS "nfUrl" TEXT;
    ALTER TABLE "Compra" ADD COLUMN IF NOT EXISTS "comprovantePagamentoUrl" TEXT;
  END IF;
END $$;

