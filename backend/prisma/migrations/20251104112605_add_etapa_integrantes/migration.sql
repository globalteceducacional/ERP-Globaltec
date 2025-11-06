-- CreateTable
CREATE TABLE ""EtapaIntegrante"" (
  ""etapaId"" INTEGER NOT NULL,
  ""usuarioId"" INTEGER NOT NULL,
  CONSTRAINT ""EtapaIntegrante_pkey"" PRIMARY KEY (""etapaId"", ""usuarioId"")
);

-- AddForeignKeys
ALTER TABLE ""EtapaIntegrante"" ADD CONSTRAINT ""EtapaIntegrante_etapaId_fkey"" FOREIGN KEY (""etapaId"") REFERENCES ""Etapa""(""id"") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE ""EtapaIntegrante"" ADD CONSTRAINT ""EtapaIntegrante_usuarioId_fkey"" FOREIGN KEY (""usuarioId"") REFERENCES ""Usuario""(""id"") ON DELETE CASCADE ON UPDATE CASCADE;
