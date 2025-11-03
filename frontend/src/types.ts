export type Cargo = 'DIRETOR' | 'SUPERVISOR' | 'EXECUTOR' | 'COTADOR' | 'PAGADOR';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  cargo: Cargo;
  ativo: boolean;
  telefone?: string | null;
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
}

export interface Etapa {
  id: number;
  nome: string;
  descricao?: string | null;
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'APROVADA' | 'REPROVADA';
  projeto: Projeto;
  executor: Usuario;
}
