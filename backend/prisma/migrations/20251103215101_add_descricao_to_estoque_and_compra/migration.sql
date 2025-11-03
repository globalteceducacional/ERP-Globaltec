-- AlterTable
ALTER TABLE "Compra" ADD COLUMN     "cotacoesJson" JSONB,
ADD COLUMN     "descricao" TEXT,
ADD COLUMN     "imagemUrl" TEXT;

-- AlterTable
ALTER TABLE "Estoque" ADD COLUMN     "cotacoesJson" JSONB,
ADD COLUMN     "descricao" TEXT,
ADD COLUMN     "imagemUrl" TEXT;
