-- CreateEnum
CREATE TYPE "Cargo" AS ENUM ('DIRETOR', 'SUPERVISOR', 'EXECUTOR', 'COTADOR', 'PAGADOR');

-- CreateEnum
CREATE TYPE "ProjetoStatus" AS ENUM ('EM_ANDAMENTO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "EtapaStatus" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'APROVADA', 'REPROVADA');

-- CreateEnum
CREATE TYPE "SubetapaStatus" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "CompraStatus" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "EstoqueStatus" AS ENUM ('DISPONIVEL', 'ALOCADO', 'RESERVADO');

-- CreateEnum
CREATE TYPE "NotificacaoTipo" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "dataNascimento" TIMESTAMP(3),
    "formacao" TEXT,
    "funcao" TEXT,
    "cargo" "Cargo" NOT NULL DEFAULT 'EXECUTOR',
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "senha" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "dataCadastro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Projeto" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "resumo" TEXT,
    "objetivo" TEXT,
    "valorTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorInsumos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ProjetoStatus" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataFinalizacao" TIMESTAMP(3),
    "planilhaJson" JSONB,
    "supervisorId" INTEGER,

    CONSTRAINT "Projeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjetoResponsavel" (
    "projetoId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "ProjetoResponsavel_pkey" PRIMARY KEY ("projetoId","usuarioId")
);

-- CreateTable
CREATE TABLE "Etapa" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "EtapaStatus" NOT NULL DEFAULT 'PENDENTE',
    "dataInicio" TIMESTAMP(3),
    "dataFim" TIMESTAMP(3),
    "valorInsumos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "iniciada" BOOLEAN NOT NULL DEFAULT false,
    "projetoId" INTEGER NOT NULL,
    "executorId" INTEGER NOT NULL,

    CONSTRAINT "Etapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subetapa" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "SubetapaStatus" NOT NULL DEFAULT 'PENDENTE',
    "dataInicio" TIMESTAMP(3),
    "dataFim" TIMESTAMP(3),
    "etapaId" INTEGER NOT NULL,

    CONSTRAINT "Subetapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compra" (
    "id" SERIAL NOT NULL,
    "item" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "valorUnitario" DOUBLE PRECISION NOT NULL,
    "status" "CompraStatus" NOT NULL DEFAULT 'PENDENTE',
    "dataSolicitacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataConfirmacao" TIMESTAMP(3),
    "projetoId" INTEGER NOT NULL,

    CONSTRAINT "Compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estoque" (
    "id" SERIAL NOT NULL,
    "item" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "valorUnitario" DOUBLE PRECISION NOT NULL,
    "status" "EstoqueStatus" NOT NULL DEFAULT 'DISPONIVEL',
    "projetoId" INTEGER,
    "etapaId" INTEGER,

    CONSTRAINT "Estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ocorrencia" (
    "id" SERIAL NOT NULL,
    "texto" TEXT NOT NULL,
    "anexo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER NOT NULL,
    "destinatarioId" INTEGER,

    CONSTRAINT "Ocorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requerimento" (
    "id" SERIAL NOT NULL,
    "texto" TEXT NOT NULL,
    "anexo" TEXT,
    "anexoResposta" TEXT,
    "resposta" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataResposta" TIMESTAMP(3),
    "usuarioId" INTEGER NOT NULL,
    "destinatarioId" INTEGER,
    "etapaId" INTEGER,

    CONSTRAINT "Requerimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "tipo" "NotificacaoTipo" NOT NULL DEFAULT 'INFO',
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- AddForeignKey
ALTER TABLE "Projeto" ADD CONSTRAINT "Projeto_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjetoResponsavel" ADD CONSTRAINT "ProjetoResponsavel_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjetoResponsavel" ADD CONSTRAINT "ProjetoResponsavel_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Etapa" ADD CONSTRAINT "Etapa_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Etapa" ADD CONSTRAINT "Etapa_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subetapa" ADD CONSTRAINT "Subetapa_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estoque" ADD CONSTRAINT "Estoque_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estoque" ADD CONSTRAINT "Estoque_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ocorrencia" ADD CONSTRAINT "Ocorrencia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ocorrencia" ADD CONSTRAINT "Ocorrencia_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requerimento" ADD CONSTRAINT "Requerimento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requerimento" ADD CONSTRAINT "Requerimento_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requerimento" ADD CONSTRAINT "Requerimento_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
