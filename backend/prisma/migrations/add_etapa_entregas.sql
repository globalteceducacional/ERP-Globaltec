-- IMPORTANTE: Execute este script em uma nova conexão ou após fazer ROLLBACK
-- Se houver erro de transação, execute primeiro: ROLLBACK;

-- Limpar estado de transação se necessário (não causa erro se não houver transação)
DO $$ BEGIN
  -- Este bloco vazio garante que não há transação pendente
  NULL;
END $$;

-- Atualizar enum EtapaStatus adicionando o novo valor EM_ANALISE e removendo CONCLUIDA
DO $$
DECLARE
  enum_em_analise_existe BOOLEAN;
  tipo_temp_existe BOOLEAN;
BEGIN
  -- Verificar se o valor EM_ANALISE já existe no enum EtapaStatus
  SELECT EXISTS(
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'EtapaStatus' AND e.enumlabel = 'EM_ANALISE'
  ) INTO enum_em_analise_existe;

  -- Só fazer a migração se EM_ANALISE não existe
  IF NOT enum_em_analise_existe THEN
    -- Limpar tipo temporário se existir de execução anterior
    SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EtapaStatus_new') INTO tipo_temp_existe;
    IF tipo_temp_existe THEN
      DROP TYPE "EtapaStatus_new";
    END IF;
    
    -- Criar novo tipo com os valores atualizados
    CREATE TYPE "EtapaStatus_new" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'EM_ANALISE', 'APROVADA', 'REPROVADA');

    -- Remover o DEFAULT da coluna antes de alterar o tipo (se existir)
    BEGIN
      ALTER TABLE "Etapa" ALTER COLUMN "status" DROP DEFAULT;
    EXCEPTION
      WHEN OTHERS THEN NULL; -- Ignora se não houver DEFAULT
    END;

    -- Alterar coluna para usar o novo tipo, convertendo CONCLUIDA para EM_ANALISE
    ALTER TABLE "Etapa"
      ALTER COLUMN "status" TYPE "EtapaStatus_new"
      USING (
        CASE "status"::text
          WHEN 'CONCLUIDA' THEN 'EM_ANALISE'::"EtapaStatus_new"
          ELSE "status"::text::"EtapaStatus_new"
        END
      );

    -- Restaurar o DEFAULT após alterar o tipo
    ALTER TABLE "Etapa" ALTER COLUMN "status" SET DEFAULT 'PENDENTE'::"EtapaStatus_new";

    -- Remover tipo antigo e renomear o novo
    DROP TYPE "EtapaStatus";
    ALTER TYPE "EtapaStatus_new" RENAME TO "EtapaStatus";
    
    RAISE NOTICE 'EtapaStatus atualizado com sucesso';
  ELSE
    RAISE NOTICE 'EtapaStatus já contém EM_ANALISE, pulando migração';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Se houver erro, logar e tentar limpar
    RAISE WARNING 'Erro ao atualizar EtapaStatus: %', SQLERRM;
    -- Tentar limpar tipo temporário se criado
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EtapaStatus_new') THEN
        DROP TYPE "EtapaStatus_new";
      END IF;
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END;
END $$;

-- Criar enum para status das entregas de etapas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'EtapaEntregaStatus'
  ) THEN
    CREATE TYPE "EtapaEntregaStatus" AS ENUM ('EM_ANALISE', 'APROVADA', 'RECUSADA');
    RAISE NOTICE 'EtapaEntregaStatus criado com sucesso';
  ELSE
    RAISE NOTICE 'EtapaEntregaStatus já existe, pulando criação';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao criar EtapaEntregaStatus: %', SQLERRM;
END $$;

-- Criar tabela de entregas das etapas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'EtapaEntrega'
  ) THEN
    CREATE TABLE "EtapaEntrega" (
      "id" SERIAL PRIMARY KEY,
      "descricao" TEXT NOT NULL,
      "imagemUrl" TEXT,
      "status" "EtapaEntregaStatus" NOT NULL DEFAULT 'EM_ANALISE',
      "dataEnvio" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "comentario" TEXT,
      "etapaId" INTEGER NOT NULL REFERENCES "Etapa"("id") ON DELETE CASCADE,
      "executorId" INTEGER NOT NULL REFERENCES "Usuario"("id") ON DELETE CASCADE,
      "avaliadoPorId" INTEGER REFERENCES "Usuario"("id") ON DELETE SET NULL,
      "dataAvaliacao" TIMESTAMP WITH TIME ZONE
    );
    
    CREATE INDEX IF NOT EXISTS "EtapaEntrega_etapaId_idx" ON "EtapaEntrega" ("etapaId");
    CREATE INDEX IF NOT EXISTS "EtapaEntrega_executorId_idx" ON "EtapaEntrega" ("executorId");
    
    RAISE NOTICE 'Tabela EtapaEntrega criada com sucesso';
  ELSE
    RAISE NOTICE 'Tabela EtapaEntrega já existe, pulando criação';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao criar tabela EtapaEntrega: %', SQLERRM;
END $$;
