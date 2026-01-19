export type CargoNivel = 'NIVEL_0' | 'NIVEL_1' | 'NIVEL_2' | 'NIVEL_3' | 'NIVEL_4';

export interface CargoPermission {
  id: number;
  modulo: string;
  acao: string;
  chave: string;
  descricao?: string | null;
}

export interface Cargo {
  id: number;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
  paginasPermitidas?: string[];
  dataCriacao: string;
  nivelAcesso: CargoNivel;
  herdaPermissoes: boolean;
  permissions?: CargoPermission[];
  _count?: {
    usuarios: number;
  };
}

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  cargo: Cargo;
  ativo: boolean;
  telefone?: string | null;
  formacao?: string | null;
  funcao?: string | null;
  dataNascimento?: string | null;
}

export interface Projeto {
  id: number;
  nome: string;
  status: 'EM_ANDAMENTO' | 'FINALIZADO';
  resumo?: string | null;
  objetivo?: string | null;
  valorTotal: number;
  valorInsumos: number;
  supervisor?: Usuario | null;
  responsaveis?: { usuario: Usuario }[];
  _count?: { etapas: number };
  progress?: number;
}

export interface Etapa {
  id: number;
  nome: string;
  descricao?: string | null;
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'EM_ANALISE' | 'APROVADA' | 'REPROVADA';
  projeto: Projeto;
  executor: Usuario;
}

export interface EtapaEntrega {
  id: number;
  descricao: string;
  imagemUrl?: string | null;
  status: 'EM_ANALISE' | 'APROVADA' | 'RECUSADA';
  dataEnvio: string;
  comentario?: string | null;
  dataAvaliacao?: string | null;
  executor: Usuario;
  avaliadoPor?: Usuario | null;
}

export interface ChecklistItemEntrega {
  id: number;
  checklistIndex: number;
  descricao: string;
  imagemUrl?: string | null; // Mantido para compatibilidade (deprecated)
  documentoUrl?: string | null; // Mantido para compatibilidade (deprecated)
  imagensUrls?: string[] | null; // Array de imagens (base64 ou URLs)
  documentosUrls?: string[] | null; // Array de documentos (base64 ou URLs)
  status: 'PENDENTE' | 'EM_ANALISE' | 'APROVADO' | 'REPROVADO';
  dataEnvio: string;
  comentario?: string | null;
  executor?: Usuario | null;
  avaliadoPor?: Usuario | null;
  dataAvaliacao?: string | null;
}

export interface Notificacao {
  id: number;
  titulo: string;
  mensagem: string;
  tipo: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  lida: boolean;
  dataCriacao: string;
  requerimentoId?: number | null; // Link para o requerimento com detalhes completos
}