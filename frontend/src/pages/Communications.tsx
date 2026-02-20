import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { toast, formatApiError } from '../utils/toast';
import { compressImage } from '../utils/stockHelpers';
import { FORMAS_PAGAMENTO, INITIAL_COTACAO } from '../constants/stock';
import type { Cotacao, Supplier, Projeto } from '../types/stock';

type RequerimentoTipo = 'SOLICITACAO' | 'APROVACAO' | 'INFORMACAO' | 'RECLAMACAO' | 'SUGESTAO' | 'COMPRA' | 'OUTRO';

interface Request {
  id: number;
  texto: string;
  tipo: RequerimentoTipo;
  status: string;
  dataCriacao: string;
  dataResposta?: string | null;
  resposta?: string | null;
  anexo?: string | null;
  anexoResposta?: string | null;
  usuario?: { nome: string } | null;
  destinatario?: { nome: string } | null;
  etapa?: { nome: string } | null;
  compras?: CompraDetail[];
}

interface CompraDetail {
  id: number;
  item: string;
  descricao?: string | null;
  quantidade: number;
  valorUnitario?: number | null;
  imagemUrl?: string | null;
  cotacoesJson?: any;
  status: string;
  categoria?: { nome: string } | null;
  projeto?: { nome: string } | null;
  etapa?: { nome: string } | null;
  observacao?: string | null;
}

interface SimpleUser {
  id: number;
  nome: string;
}

interface Category {
  id: number;
  nome: string;
  ativo: boolean;
}

interface CompraItem {
  item: string;
  descricao?: string;
  quantidade: number;
  imagemUrl?: string;
  categoriaId?: number;
  projetoId?: number;
  cotacoes: Cotacao[];
  observacao?: string;
}

export default function Communications() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [subTab, setSubTab] = useState<'sent' | 'received'>('sent');
  const [requests, setRequests] = useState<Request[]>([]);
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<Projeto[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [itensCompra, setItensCompra] = useState<CompraItem[]>([
    { item: '', descricao: '', quantidade: 1, categoriaId: undefined, projetoId: undefined, cotacoes: [{ ...INITIAL_COTACAO }] },
  ]);
  const [form, setForm] = useState<{ destinatarioId?: number; tipo: RequerimentoTipo; texto?: string }>({
    tipo: 'OUTRO',
    texto: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deletingRequestId, setDeletingRequestId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<Request | null>(null);

  // Verificar parâmetros da URL (quando vem de uma notificação)
  useEffect(() => {
    const tab = searchParams.get('tab');
    const requestId = searchParams.get('id');

    if (tab === 'received') {
      setSubTab('received');
    }

    // Se tiver um ID de requerimento na URL, carregar o detalhe
    if (requestId) {
      loadRequestDetail(parseInt(requestId, 10));
      // Limpar os parâmetros da URL após carregar
      setSearchParams({});
    }
  }, [searchParams]);

  async function loadUsers() {
    try {
      const { data } = await api.get<SimpleUser[]>('/users/options');
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadCategories() {
    try {
      const { data } = await api.get<Category[]>('/categories');
      setCategories(data.filter((c) => c.ativo));
    } catch (err) {
      console.error(err);
    }
  }

  async function loadProjects() {
    try {
      const { data } = await api.get<Projeto[]>('/projects/options');
      setProjects(data);
    } catch (err) {
      console.error('Erro ao carregar projetos:', err);
    }
  }

  async function loadSuppliers() {
    try {
      const { data } = await api.get<Supplier[]>('/suppliers');
      setSuppliers(data.filter((s) => s.ativo));
    } catch (err) {
      console.error(err);
    }
  }

  async function loadRequests(currentTab: 'sent' | 'received') {
    try {
      setLoading(true);
      const { data } = await api.get<Request[]>(`/requests/${currentTab}`);
      setRequests(data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Erro ao carregar requerimentos');
    } finally {
      setLoading(false);
    }
  }

  async function loadRequestDetail(id: number) {
    try {
      setLoadingDetail(true);
      const { data } = await api.get<Request>(`/requests/${id}`);
      setSelectedRequest(data);
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoadingDetail(false);
    }
  }

  function handleRequestClick(request: Request) {
    loadRequestDetail(request.id);
  }

  function handleBackToList() {
    setSelectedRequest(null);
  }

  async function handleDeleteRequest(request: Request) {
    setRequestToDelete(request);
    setShowDeleteConfirm(true);
  }

  async function confirmDelete() {
    if (!requestToDelete) return;

    try {
      setDeletingRequestId(requestToDelete.id);
      await api.delete(`/requests/${requestToDelete.id}`);
      toast.success('Requerimento excluído com sucesso!');
      setShowDeleteConfirm(false);
      setRequestToDelete(null);
      loadRequests(subTab); // Recarregar a lista
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      toast.error(errorMessage);
    } finally {
      setDeletingRequestId(null);
    }
  }

  useEffect(() => {
    loadUsers();
    loadCategories();
    loadProjects();
    loadSuppliers();
  }, []);

  useEffect(() => {
    loadRequests(subTab);
    
    // Atualizar requerimentos a cada 10 segundos quando estiver na aba de recebidos
    if (subTab === 'received') {
      const interval = setInterval(() => {
        loadRequests('received');
      }, 10000);
      
      return () => clearInterval(interval);
    }
  }, [subTab]);

  useEffect(() => {
    // Resetar itens quando mudar o tipo
    if (form.tipo !== 'COMPRA') {
      setItensCompra([{ item: '', descricao: '', quantidade: 1, categoriaId: undefined, projetoId: undefined, cotacoes: [{ ...INITIAL_COTACAO }] }]);
    } else if (itensCompra.length === 0) {
      setItensCompra([{ item: '', descricao: '', quantidade: 1, categoriaId: undefined, projetoId: undefined, cotacoes: [{ ...INITIAL_COTACAO }] }]);
    }
  }, [form.tipo, itensCompra.length]);

  function addItem() {
    setItensCompra([...itensCompra, { item: '', descricao: '', quantidade: 1, categoriaId: undefined, projetoId: undefined, cotacoes: [{ ...INITIAL_COTACAO }] }]);
  }

  function removeItem(index: number) {
    if (itensCompra.length > 1) {
      setItensCompra(itensCompra.filter((_, i) => i !== index));
    }
  }

  function updateItem(index: number, field: keyof CompraItem, value: any) {
    const newItens = [...itensCompra];
    newItens[index] = { ...newItens[index], [field]: value };
    setItensCompra(newItens);
  }

  async function handleFileUpload(index: number, field: 'imagemUrl', file: File) {
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const compressed = await compressImage(base64);
        updateItem(index, field, compressed);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error('Erro ao processar arquivo');
    }
  }

  function updateCotacaoItem(itemIndex: number, cotacaoIndex: number, field: keyof Cotacao, value: any) {
    const newItens = [...itensCompra];
    const newCotacoes = [...newItens[itemIndex].cotacoes];
    newCotacoes[cotacaoIndex] = { ...newCotacoes[cotacaoIndex], [field]: value };
    newItens[itemIndex] = { ...newItens[itemIndex], cotacoes: newCotacoes };
    setItensCompra(newItens);
  }

  function addCotacaoItem(itemIndex: number) {
    const newItens = [...itensCompra];
    newItens[itemIndex] = {
      ...newItens[itemIndex],
      cotacoes: [...newItens[itemIndex].cotacoes, { ...INITIAL_COTACAO }],
    };
    setItensCompra(newItens);
  }

  function removeCotacaoItem(itemIndex: number, cotacaoIndex: number) {
    const newItens = [...itensCompra];
    if (newItens[itemIndex].cotacoes.length > 1) {
      newItens[itemIndex] = {
        ...newItens[itemIndex],
        cotacoes: newItens[itemIndex].cotacoes.filter((_, i) => i !== cotacaoIndex),
      };
      setItensCompra(newItens);
    }
  }

  function calculateTotal(cotacao: Cotacao, quantidade: number): number {
    return (cotacao.valorUnitario + cotacao.frete + cotacao.impostos - (cotacao.desconto || 0)) * quantidade;
  }

  function getSupplierName(fornecedorId?: number): string {
    if (!fornecedorId) return '-';
    const supplier = suppliers.find((s) => s.id === fornecedorId);
    return supplier ? supplier.nomeFantasia : '-';
  }

  async function handleSubmitRequest(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // Validar itens se for tipo COMPRA
      if (form.tipo === 'COMPRA') {
        const itensValidos = itensCompra.filter((item) => item.item.trim() && item.quantidade > 0);
        if (itensValidos.length === 0) {
          setError('Adicione pelo menos um item válido');
          setSubmitting(false);
          return;
        }

        // Validar que pelo menos uma cotação tenha link em cada item
        for (const item of itensValidos) {
          if (!item.cotacoes || item.cotacoes.length === 0) {
            setError(`O item "${item.item}" deve ter pelo menos uma cotação`);
            setSubmitting(false);
            return;
          }

          const temLink = item.cotacoes.some((cotacao) => cotacao.link && cotacao.link.trim().length > 0);
          if (!temLink) {
            setError(`O item "${item.item}" deve ter pelo menos uma cotação com link`);
            setSubmitting(false);
            return;
          }
        }

        const payload: any = {
          tipo: form.tipo,
          itensCompra: itensValidos,
        };
        await api.post('/requests', payload);
      } else {
        if (!form.destinatarioId) {
          setError('Selecione um destinatário');
          setSubmitting(false);
          return;
        }
        const textoTrimmed = form.texto?.trim() ?? '';
        if (!textoTrimmed) {
          setError('Escreva a mensagem do requerimento');
          setSubmitting(false);
          return;
        }
        const payload: any = {
          tipo: form.tipo,
          destinatarioId: Number(form.destinatarioId),
          texto: textoTrimmed,
        };
        await api.post('/requests', payload);
      }

      setForm({ tipo: 'OUTRO', texto: '' });
      setItensCompra([{ item: '', descricao: '', quantidade: 1, categoriaId: undefined, projetoId: undefined, cotacoes: [{ ...INITIAL_COTACAO }] }]);
      loadRequests('sent');
      toast.success('Requerimento enviado com sucesso!');
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  // Se houver um requerimento selecionado, mostrar visualização detalhada
  if (selectedRequest) {
    const tipoLabels: Record<RequerimentoTipo, string> = {
      SOLICITACAO: 'Solicitação',
      APROVACAO: 'Aprovação',
      INFORMACAO: 'Informação',
      RECLAMACAO: 'Reclamação',
      SUGESTAO: 'Sugestão',
      COMPRA: 'Compra',
      OUTRO: 'Outro',
    };

    return (
      <div className="space-y-6">
        <button
          onClick={handleBackToList}
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar para lista
        </button>

        <div className="bg-neutral/80 border border-white/10 rounded-xl p-6 space-y-6">
          {/* Cabeçalho do E-mail */}
          <div className="border-b border-white/10 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">{tipoLabels[selectedRequest.tipo] || selectedRequest.tipo}</h2>
              <span className="px-3 py-1 rounded text-sm bg-primary/20 text-primary border border-primary/30">
                {selectedRequest.status}
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-white/60">De:</span>
                <p className="text-white font-medium">{selectedRequest.usuario?.nome ?? '—'}</p>
              </div>
              <div>
                <span className="text-white/60">Para:</span>
                <p className="text-white font-medium">{selectedRequest.destinatario?.nome ?? '—'}</p>
              </div>
              <div>
                <span className="text-white/60">Data:</span>
                <p className="text-white">{new Date(selectedRequest.dataCriacao).toLocaleString('pt-BR')}</p>
              </div>
              {selectedRequest.etapa && (
                <div>
                  <span className="text-white/60">Etapa:</span>
                  <p className="text-white">{selectedRequest.etapa.nome}</p>
                </div>
              )}
            </div>
          </div>

          {/* Conteúdo */}
          {selectedRequest.tipo === 'COMPRA' && selectedRequest.compras ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Itens de Compra</h3>
              {selectedRequest.compras.map((compra, index) => (
                <div key={compra.id} className="bg-neutral/60 border border-white/10 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <h4 className="font-semibold text-lg">Item {index + 1}: {compra.item}</h4>
                    <span className="px-2 py-1 rounded text-xs bg-white/10 text-white/70">{compra.status}</span>
                  </div>
                  {compra.descricao && (
                    <div>
                      <span className="text-white/60 text-sm">Descrição:</span>
                      <p className="text-white">{compra.descricao}</p>
                    </div>
                  )}
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-white/60">Quantidade:</span>
                      <p className="text-white font-medium">{compra.quantidade}</p>
                    </div>
                    {compra.categoria && (
                      <div>
                        <span className="text-white/60">Categoria:</span>
                        <p className="text-white">{compra.categoria.nome}</p>
                      </div>
                    )}
                    {compra.projeto && (
                      <div>
                        <span className="text-white/60">Projeto:</span>
                        <p className="text-white">{compra.projeto.nome}</p>
                      </div>
                    )}
                  </div>
                  {compra.imagemUrl && (
                    <div>
                      <span className="text-white/60 text-sm block mb-2">Imagem:</span>
                      <img src={compra.imagemUrl} alt={compra.item} className="max-w-md max-h-64 rounded border border-white/10" />
                    </div>
                  )}
                  {compra.cotacoesJson && Array.isArray(compra.cotacoesJson) && compra.cotacoesJson.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <h5 className="font-semibold mb-3">Cotações</h5>
                      <div className="space-y-3">
                        {compra.cotacoesJson.map((cotacao: any, cotIndex: number) => (
                          <div key={cotIndex} className="bg-neutral/40 border border-white/5 rounded-lg p-3">
                            <div className="grid md:grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-white/60">Valor Unitário:</span>
                                <p className="text-white">
                                  {Number(cotacao.valorUnitario || 0).toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })}
                                </p>
                              </div>
                              <div>
                                <span className="text-white/60">Frete:</span>
                                <p className="text-white">
                                  {Number(cotacao.frete || 0).toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })}
                                </p>
                              </div>
                              <div>
                                <span className="text-white/60">Impostos:</span>
                                <p className="text-white">
                                  {Number(cotacao.impostos || 0).toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })}
                                </p>
                              </div>
                              <div>
                                <span className="text-white/60">Desconto:</span>
                                <p className="text-white">
                                  {Number(cotacao.desconto || 0).toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })}
                                </p>
                              </div>
                              {cotacao.link && (
                                <div className="md:col-span-2">
                                  <span className="text-white/60">Link:</span>
                                  <p className="text-white">
                                    <a href={cotacao.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                      {cotacao.link}
                                    </a>
                                  </p>
                                </div>
                              )}
                              {cotacao.fornecedorId && (
                                <div>
                                  <span className="text-white/60">Fornecedor:</span>
                                  <p className="text-white">{getSupplierName(cotacao.fornecedorId)}</p>
                                </div>
                              )}
                              {cotacao.formaPagamento && (
                                <div>
                                  <span className="text-white/60">Forma de Pagamento:</span>
                                  <p className="text-white">{cotacao.formaPagamento}</p>
                                </div>
                              )}
                            </div>
                            <div className="mt-3 pt-3 border-t border-white/5">
                              <span className="text-white/60 text-sm">
                                Total ({compra.quantidade} unidades):{' '}
                              </span>
                              <span className="font-semibold text-primary">
                                {(
                                  (Number(cotacao.valorUnitario || 0) +
                                    Number(cotacao.frete || 0) +
                                    Number(cotacao.impostos || 0) -
                                    Number(cotacao.desconto || 0)) *
                                    compra.quantidade
                                ).toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <span className="text-white/60 text-sm font-medium">Observação:</span>
                    <p className="text-white mt-2 whitespace-pre-wrap">{compra.observacao || 'Nenhuma observação'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold mb-3">Mensagem</h3>
              <div className="bg-neutral/60 border border-white/10 rounded-lg p-4">
                <p className="text-white whitespace-pre-wrap">{selectedRequest.texto || '—'}</p>
              </div>
              {selectedRequest.anexo && (
                <div className="mt-4">
                  <span className="text-white/60 text-sm">Anexo:</span>
                  <a href={selectedRequest.anexo} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-2">
                    Ver anexo
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Resposta */}
          {selectedRequest.resposta && (
            <div className="border-t border-white/10 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Resposta</h3>
                {selectedRequest.dataResposta && (
                  <span className="text-sm text-white/60">
                    {new Date(selectedRequest.dataResposta).toLocaleString('pt-BR')}
                  </span>
                )}
              </div>
              <div className="bg-neutral/60 border border-white/10 rounded-lg p-4">
                <p className="text-white whitespace-pre-wrap">{selectedRequest.resposta}</p>
              </div>
              {selectedRequest.anexoResposta && (
                <div>
                  <span className="text-white/60 text-sm">Anexo da Resposta:</span>
                  <a
                    href={selectedRequest.anexoResposta}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline ml-2"
                  >
                    Ver anexo
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs: Enviados / Recebidos */}
      <div className="flex gap-2">
        <button
          onClick={() => setSubTab('sent')}
          className={`px-4 py-2 rounded-md transition-colors ${
            subTab === 'sent' ? 'bg-primary text-neutral font-semibold' : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          Enviados
        </button>
        <button
          onClick={() => setSubTab('received')}
          className={`px-4 py-2 rounded-md transition-colors ${
            subTab === 'received' ? 'bg-primary text-neutral font-semibold' : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          Recebidos
        </button>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmitRequest} className="bg-neutral/80 border border-white/10 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold">Novo Requerimento</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm text-white/70">
            Tipo
            <select
              value={form.tipo}
              onChange={(e) => setForm((prev) => ({ ...prev, tipo: e.target.value as RequerimentoTipo }))}
              className="mt-1 w-full bg-neutral/60 border border-white/10 rounded-md px-3 py-2 text-white"
              required
            >
              <option value="SOLICITACAO" className="bg-neutral text-white">
                Solicitação
              </option>
              <option value="APROVACAO" className="bg-neutral text-white">
                Aprovação
              </option>
              <option value="INFORMACAO" className="bg-neutral text-white">
                Informação
              </option>
              <option value="RECLAMACAO" className="bg-neutral text-white">
                Reclamação
              </option>
              <option value="SUGESTAO" className="bg-neutral text-white">
                Sugestão
              </option>
              <option value="COMPRA" className="bg-neutral text-white">
                Compra
              </option>
              <option value="OUTRO" className="bg-neutral text-white">
                Outro
              </option>
            </select>
          </label>
          {form.tipo !== 'COMPRA' && (
            <label className="text-sm text-white/70">
              Destinatário
              <select
                value={form.destinatarioId || 0}
                onChange={(e) => setForm((prev) => ({ ...prev, destinatarioId: Number(e.target.value) }))}
                className="mt-1 w-full bg-neutral/60 border border-white/10 rounded-md px-3 py-2 text-white"
                required
              >
                <option value={0} className="bg-neutral text-white">
                  Selecione...
                </option>
                {users.map((user) => (
                  <option key={user.id} value={user.id} className="bg-neutral text-white">
                    {user.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {/* Campo de mensagem para tipos que não são Compra */}
        {form.tipo !== 'COMPRA' && (
          <label className="text-sm text-white/70 block">
            Mensagem *
            <textarea
              value={form.texto ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, texto: e.target.value }))}
              className="mt-1 w-full min-h-[120px] bg-neutral/60 border border-white/10 rounded-md px-3 py-2 text-white placeholder:text-white/50 focus:border-primary focus:outline-none resize-y"
              placeholder="Escreva o conteúdo do requerimento..."
              required
              maxLength={1500}
            />
            <span className="text-xs text-white/50 mt-1 block">
              {(form.texto?.length ?? 0)}/1500 caracteres
            </span>
          </label>
        )}
        {form.tipo === 'COMPRA' && (
          <label className="text-sm text-white/70 block">
            Destinatário
            <input
              type="text"
              value="Cargo de Compras (Automático)"
              disabled
              className="mt-1 w-full bg-neutral/40 border border-white/10 rounded-md px-3 py-2 text-white/60 cursor-not-allowed"
            />
          </label>
        )}
        {/* Formulário de Itens de Compra */}
        {form.tipo === 'COMPRA' && (
          <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
            <div className="flex justify-between items-center">
              <h4 className="text-md font-semibold">Itens de Compra</h4>
              <button
                type="button"
                onClick={addItem}
                className="px-3 py-1.5 rounded-md bg-primary/20 hover:bg-primary/30 text-primary text-sm transition-colors"
              >
                + Adicionar Item
              </button>
            </div>
            {itensCompra.map((item, index) => (
              <div key={index} className="bg-neutral/60 border border-white/10 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-medium text-white/80">Item {index + 1}</span>
                  {itensCompra.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-danger hover:text-danger/80 text-sm"
                    >
                      Remover
                    </button>
                  )}
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <label className="text-sm text-white/70">
                    Item *
                    <input
                      type="text"
                      value={item.item}
                      onChange={(e) => updateItem(index, 'item', e.target.value)}
                      className="mt-1 w-full bg-neutral/80 border border-white/10 rounded-md px-3 py-2 text-white"
                      required={form.tipo === 'COMPRA'}
                      placeholder="Nome do item"
                    />
                  </label>
                  <label className="text-sm text-white/70">
                    Categoria
                    <select
                      value={item.categoriaId || ''}
                      onChange={(e) => updateItem(index, 'categoriaId', e.target.value ? Number(e.target.value) : undefined)}
                      className="mt-1 w-full bg-neutral/80 border border-white/10 rounded-md px-3 py-2 text-white"
                    >
                      <option value="" className="bg-neutral text-white">
                        Selecione...
                      </option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id} className="bg-neutral text-white">
                          {cat.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-white/70">
                    Quantidade *
                    <input
                      type="number"
                      min="1"
                      value={item.quantidade}
                      onChange={(e) => updateItem(index, 'quantidade', Number(e.target.value))}
                      className="mt-1 w-full bg-neutral/80 border border-white/10 rounded-md px-3 py-2 text-white"
                      required={form.tipo === 'COMPRA'}
                    />
                  </label>
                  <label className="text-sm text-white/70">
                    Projeto
                    <select
                      value={item.projetoId || ''}
                      onChange={(e) => updateItem(index, 'projetoId', e.target.value ? Number(e.target.value) : undefined)}
                      className="mt-1 w-full bg-neutral/80 border border-white/10 rounded-md px-3 py-2 text-white"
                    >
                      <option value="" className="bg-neutral text-white">
                        Sem projeto (opcional)
                      </option>
                      {projects.map((proj) => (
                        <option key={proj.id} value={proj.id} className="bg-neutral text-white">
                          {proj.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-white/70 md:col-span-2">
                    Motivo da Solicitação
                    <textarea
                      value={item.descricao || ''}
                      onChange={(e) => updateItem(index, 'descricao', e.target.value)}
                      className="mt-1 w-full h-24 bg-neutral/80 border border-white/10 rounded-md px-3 py-2 text-white placeholder:text-white/50"
                      placeholder="Descreva o motivo da solicitação..."
                    />
                  </label>
                  <label className="text-sm text-white/70">
                    Imagem
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(index, 'imagemUrl', file);
                      }}
                      className="mt-1 w-full bg-neutral/80 border border-white/10 rounded-md px-3 py-2 text-white text-sm"
                    />
                  </label>
                  <label className="text-sm text-white/70 md:col-span-2">
                    Observação
                    <textarea
                      value={item.observacao || ''}
                      onChange={(e) => updateItem(index, 'observacao', e.target.value)}
                      className="mt-1 w-full h-20 bg-neutral/80 border border-white/10 rounded-md px-3 py-2 text-white placeholder:text-white/50"
                      placeholder="Observações gerais (opcional)"
                    />
                  </label>
                </div>
                {item.imagemUrl && (
                  <div className="mt-2">
                    <img src={item.imagemUrl} alt="Preview" className="max-w-xs max-h-32 rounded border border-white/10" />
                    <button
                      type="button"
                      onClick={() => updateItem(index, 'imagemUrl', undefined)}
                      className="mt-1 text-xs text-danger hover:text-danger/80"
                    >
                      Remover imagem
                    </button>
                  </div>
                )}
                
                {/* Cotações */}
                <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                  <div className="flex justify-between items-center">
                    <h5 className="text-sm font-semibold">Cotações</h5>
                    <button
                      type="button"
                      onClick={() => addCotacaoItem(index)}
                      className="px-2 py-1 rounded-md bg-primary/20 hover:bg-primary/30 text-primary text-xs transition-colors"
                    >
                      + Adicionar Cotação
                    </button>
                  </div>
                  {item.cotacoes.map((cotacao, cotacaoIndex) => (
                    <div key={cotacaoIndex} className="bg-neutral/40 border border-white/5 rounded-lg p-3 space-y-2">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-medium text-white/70">Cotação {cotacaoIndex + 1}</span>
                        {item.cotacoes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCotacaoItem(index, cotacaoIndex)}
                            className="text-xs text-danger hover:text-danger/80"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                      <div className="grid md:grid-cols-2 gap-2">
                        <label className="text-xs text-white/70">
                          Valor Unitário (R$)
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cotacao.valorUnitario}
                            onChange={(e) => updateCotacaoItem(index, cotacaoIndex, 'valorUnitario', Number(e.target.value))}
                            className="mt-1 w-full bg-neutral/80 border border-white/10 rounded-md px-2 py-1.5 text-white text-sm"
                          />
                        </label>
                        <label className="text-xs text-white/70">
                          Frete (R$)
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cotacao.frete}
                            onChange={(e) => updateCotacaoItem(index, cotacaoIndex, 'frete', Number(e.target.value))}
                            className="mt-1 w-full bg-neutral/80 border border-white/10 rounded-md px-2 py-1.5 text-white text-sm"
                          />
                        </label>
                        <label className="text-xs text-white/70">
                          Impostos (R$)
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cotacao.impostos}
                            onChange={(e) => updateCotacaoItem(index, cotacaoIndex, 'impostos', Number(e.target.value))}
                            className="mt-1 w-full bg-neutral/80 border border-white/10 rounded-md px-2 py-1.5 text-white text-sm"
                          />
                        </label>
                        <label className="text-xs text-white/70">
                          Desconto (R$)
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cotacao.desconto || 0}
                            onChange={(e) => updateCotacaoItem(index, cotacaoIndex, 'desconto', Number(e.target.value))}
                            className="mt-1 w-full bg-neutral/80 border border-white/10 rounded-md px-2 py-1.5 text-white text-sm"
                          />
                        </label>
                        <label className="text-xs text-white/70">
                          Link
                          <input
                            type="url"
                            value={cotacao.link || ''}
                            onChange={(e) => updateCotacaoItem(index, cotacaoIndex, 'link', e.target.value)}
                            className="mt-1 w-full bg-neutral/80 border border-white/10 rounded-md px-2 py-1.5 text-white text-sm"
                            placeholder="https://..."
                          />
                        </label>
                        <label className="text-xs text-white/70">
                          Fornecedor
                          <select
                            value={cotacao.fornecedorId || ''}
                            onChange={(e) => updateCotacaoItem(index, cotacaoIndex, 'fornecedorId', e.target.value ? Number(e.target.value) : undefined)}
                            className="mt-1 w-full bg-neutral/80 border border-white/10 rounded-md px-2 py-1.5 text-white text-sm"
                          >
                            <option value="" className="bg-neutral text-white">
                              Selecione um fornecedor (opcional)
                            </option>
                            {suppliers.map((supplier) => (
                              <option key={supplier.id} value={supplier.id} className="bg-neutral text-white">
                                {supplier.nomeFantasia}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs text-white/70 md:col-span-2">
                          Forma de Pagamento
                          <select
                            value={cotacao.formaPagamento || ''}
                            onChange={(e) => updateCotacaoItem(index, cotacaoIndex, 'formaPagamento', e.target.value)}
                            className="mt-1 w-full bg-neutral/80 border border-white/10 rounded-md px-2 py-1.5 text-white text-sm"
                          >
                            <option value="" className="bg-neutral text-white">
                              Selecione (opcional)
                            </option>
                            {FORMAS_PAGAMENTO.map((forma) => (
                              <option key={forma} value={forma} className="bg-neutral text-white">
                                {forma}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="mt-2 pt-2 border-t border-white/5 text-xs text-white/70">
                        <div>
                          Total por unidade:{' '}
                          <span className="font-semibold text-white">
                            {(cotacao.valorUnitario + cotacao.frete + cotacao.impostos - (cotacao.desconto || 0)).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </span>
                        </div>
                        <div>
                          Total ({item.quantidade} unidades):{' '}
                          <span className="font-semibold text-primary">
                            {calculateTotal(cotacao, item.quantidade).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-danger text-sm">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded-md bg-primary hover:bg-primary/80 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Enviando...' : 'Enviar Requerimento'}
        </button>
      </form>

      {/* Tabela de Requerimentos */}
      <div className="bg-neutral/80 border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-white/60">Carregando...</div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-white/60">Nenhum requerimento encontrado</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-white/5 text-white/70">
              <tr>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Mensagem</th>
                <th className="px-4 py-3 text-left">Usuário</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Resposta</th>
                <th className="px-4 py-3 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => {
                const tipoLabels: Record<RequerimentoTipo, string> = {
                  SOLICITACAO: 'Solicitação',
                  APROVACAO: 'Aprovação',
                  INFORMACAO: 'Informação',
                  RECLAMACAO: 'Reclamação',
                  SUGESTAO: 'Sugestão',
                  COMPRA: 'Compra',
                  OUTRO: 'Outro',
                };

                return (
                  <tr
                    key={request.id}
                    className="border-t border-white/5 hover:bg-white/10 transition-colors"
                  >
                    <td 
                      className="px-4 py-3 cursor-pointer"
                      onClick={() => handleRequestClick(request)}
                    >
                      <span className="px-2 py-1 rounded text-xs bg-primary/20 text-primary border border-primary/30">
                        {tipoLabels[request.tipo] || request.tipo}
                      </span>
                    </td>
                    <td 
                      className="px-4 py-3 max-w-xl cursor-pointer"
                      onClick={() => handleRequestClick(request)}
                    >
                      <p className="font-medium text-white/90">
                        {request.tipo === 'COMPRA' ? 'Solicitação de Compra' : request.texto || '—'}
                      </p>
                      <p className="text-xs text-white/50 mt-1">
                        {new Date(request.dataCriacao).toLocaleString('pt-BR')}
                      </p>
                    </td>
                    <td 
                      className="px-4 py-3 text-white/80 cursor-pointer"
                      onClick={() => handleRequestClick(request)}
                    >
                      {subTab === 'sent' ? request.destinatario?.nome ?? '—' : request.usuario?.nome ?? '—'}
                    </td>
                    <td 
                      className="px-4 py-3 text-white/60 cursor-pointer"
                      onClick={() => handleRequestClick(request)}
                    >
                      {request.status}
                    </td>
                    <td 
                      className="px-4 py-3 text-white/70 cursor-pointer"
                      onClick={() => handleRequestClick(request)}
                    >
                      {request.resposta ? (
                        <span className="text-primary">Respondido</span>
                      ) : (
                        <span className="text-white/40">Pendente</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRequest(request);
                        }}
                        disabled={deletingRequestId === request.id}
                        className="text-danger hover:text-danger/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Excluir requerimento"
                      >
                        {deletingRequestId === request.id ? (
                          <span className="text-sm">Excluindo...</span>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteConfirm && requestToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">Confirmar Exclusão</h3>
              <p className="text-white/80 mb-6">
                Tem certeza que deseja excluir este requerimento? Esta ação não pode ser desfeita.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setRequestToDelete(null);
                  }}
                  className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
                  disabled={deletingRequestId !== null}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deletingRequestId !== null}
                  className="px-4 py-2 rounded-md bg-danger hover:bg-danger/80 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingRequestId !== null ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
