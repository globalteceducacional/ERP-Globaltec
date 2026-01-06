-- CreateTable
CREATE TABLE "EstoqueAlocacao" (
    "id" SERIAL NOT NULL,
    "estoqueId" INTEGER NOT NULL,
    "projetoId" INTEGER,
    "etapaId" INTEGER,
    "quantidade" INTEGER NOT NULL,
    "dataAlocacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstoqueAlocacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EstoqueAlocacao_estoqueId_idx" ON "EstoqueAlocacao"("estoqueId");

-- CreateIndex
CREATE INDEX "EstoqueAlocacao_projetoId_idx" ON "EstoqueAlocacao"("projetoId");

-- CreateIndex
CREATE INDEX "EstoqueAlocacao_etapaId_idx" ON "EstoqueAlocacao"("etapaId");

-- AddForeignKey
ALTER TABLE "EstoqueAlocacao" ADD CONSTRAINT "EstoqueAlocacao_estoqueId_fkey" FOREIGN KEY ("estoqueId") REFERENCES "Estoque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstoqueAlocacao" ADD CONSTRAINT "EstoqueAlocacao_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstoqueAlocacao" ADD CONSTRAINT "EstoqueAlocacao_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

