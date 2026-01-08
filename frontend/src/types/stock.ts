// Tipos e interfaces relacionados ao módulo de Estoque

export interface Cotacao {
  valorUnitario: number;
  frete: number;
  impostos: number;
  desconto?: number;
  link?: string;
  fornecedorId?: number;
  formaPagamento?: string;
}

export interface SimpleUser {
  id: number;
  nome: string;
}

export interface StockItem {
  id: number;
  item: string;
  quantidade: number;
  valorUnitario: number;
  status: string;
  descricao?: string | null;
  imagemUrl?: string | null;
  cotacoesJson?: Cotacao[] | null;
  projetoId?: number | null;
  etapaId?: number | null;
  quantidadeAlocada?: number;
  quantidadeDisponivel?: number;
}

export interface Purchase {
  id: number;
  item: string;
  quantidade: number;
  valorUnitario: number;
  status: string;
  projetoId: number;
  descricao?: string | null;
  imagemUrl?: string | null;
  nfUrl?: string | null;
  comprovantePagamentoUrl?: string | null;
  cotacoesJson?: Cotacao[] | null;
  dataCompra?: string | null;
  dataSolicitacao?: string | null;
  formaPagamento?: string | null;
  statusEntrega?: string | null;
  previsaoEntrega?: string | null;
  dataEntrega?: string | null;
  enderecoEntrega?: string | null;
  recebidoPor?: string | null;
  observacao?: string | null;
  solicitadoPorId?: number | null;
  solicitadoPor?: { id: number; nome: string; cargo?: { nome: string } } | null;
  categoriaId?: number | null;
}

export interface Projeto {
  id: number;
  nome: string;
}

export interface Etapa {
  id: number;
  nome: string;
}

export interface Supplier {
  id: number;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  ativo: boolean;
}

export interface Category {
  id: number;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
}

export interface Alocacao {
  id: number;
  estoqueId: number;
  projetoId?: number | null;
  etapaId?: number | null;
  usuarioId?: number | null;
  quantidade: number;
  projeto?: Projeto | null;
  etapa?: Etapa | null;
  usuario?: SimpleUser | null;
}

export interface CreateItemForm {
  item: string;
  codigo?: string;
  categoria?: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  unidadeMedida?: string;
  localizacao?: string;
  imagemUrl: string;
  categoriaId?: number;
  nfUrl?: string;
  comprovantePagamentoUrl?: string;
  cotacoes?: Cotacao[];
  selectedCotacaoIndex?: number;
}

export interface CreatePurchaseForm extends Omit<CreateItemForm, 'valorUnitario'> {
  projetoId: number;
  cotacoes: Cotacao[];
  selectedCotacaoIndex: number;
  dataCompra?: string;
  categoriaId?: number;
  observacao?: string;
}

export interface AlocacaoForm {
  projetoId?: number;
  etapaId?: number;
  usuarioId?: number;
  quantidade: number;
}

export interface SupplierForm {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  endereco: string;
  contato: string;
  ativo: boolean;
}

export interface CategoryForm {
  nome: string;
  descricao: string;
}

// Tipos para abas
export type StockTab = 'estoque' | 'compras' | 'solicitacoes';
export type PurchaseSubTab = 'pendente' | 'a-caminho' | 'entregue';
export type SortDirection = 'asc' | 'desc';

// Status de compra
export type PurchaseStatus = 
  | 'PENDENTE' 
  | 'COMPRADO_ACAMINHO' 
  | 'ENTREGUE' 
  | 'SOLICITADO' 
  | 'REPROVADO';

// Status de entrega
export type DeliveryStatus = 
  | 'NAO_ENTREGUE' 
  | 'PARCIAL' 
  | 'ENTREGUE' 
  | 'CANCELADO';
