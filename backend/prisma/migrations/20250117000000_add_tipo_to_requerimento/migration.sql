-- CreateEnum
CREATE TYPE "RequerimentoTipo" AS ENUM ('SOLICITACAO', 'APROVACAO', 'INFORMACAO', 'RECLAMACAO', 'SUGESTAO', 'OUTRO');

-- AlterTable
ALTER TABLE "Requerimento" ADD COLUMN "tipo" "RequerimentoTipo" NOT NULL DEFAULT 'OUTRO';
