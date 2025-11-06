-- Script de limpeza: Execute este ANTES de executar add_etapa_entregas.sql
-- Este script limpa qualquer estado de transação e tipos temporários

-- Limpar transação se houver erro
ROLLBACK;

-- Limpar tipo temporário se existir de execução anterior
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EtapaStatus_new') THEN
    -- Verificar se está em uso
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'Etapa' AND data_type = 'USER-DEFINED' 
      AND udt_name = 'EtapaStatus_new'
    ) THEN
      DROP TYPE "EtapaStatus_new";
      RAISE NOTICE 'Tipo temporário EtapaStatus_new removido';
    ELSE
      RAISE WARNING 'Tipo EtapaStatus_new está em uso, não pode ser removido';
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao limpar tipo temporário: %', SQLERRM;
END $$;

