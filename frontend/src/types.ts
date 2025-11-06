export interface Cargo {
  id: number;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
  paginasPermitidas?: string[];
  dataCriacao: string;
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
