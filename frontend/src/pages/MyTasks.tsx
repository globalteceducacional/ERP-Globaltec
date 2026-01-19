import { useEffect, useState, useMemo, FormEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../store/auth';
import { buttonStyles } from '../utils/buttonStyles';
import { ChecklistItemEntrega } from '../types';
import { toast, formatApiError } from '../utils/toast';
import {
  getStatusColor,
  getStatusLabel,
  getEntregaStatusColor,
  getEntregaStatusLabel,
  getCheckboxStyle,
  getChecklistItemStyle,
  getChecklistTextStyle,
  getChecklistItemStatusColor,
  getChecklistItemStatusLabel,
} from '../utils/statusStyles';

interface Projeto {
  id: number;
  nome: string;
  resumo?: string | null;
  status: string;
  supervisor?: { nome: string } | null;
  progress?: number;
}

interface ChecklistItem {
  texto: string;
  concluido?: boolean;
}

interface Usuario {
  id: number;
  nome: string;
  email: string;
}

interface Etapa {
  id: number;
  nome: string;
  descricao?: string | null;
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'EM_ANALISE' | 'APROVADA' | 'REPROVADA';
  dataInicio?: string | null;
  dataFim?: string | null;
  checklistJson?: ChecklistItem[] | null;
  executorId: number;
  executor?: { nome: string; cargo: string } | null;
  integrantes?: Array<{ usuario: Usuario }>;
  projeto: Projeto;
  subetapas: any[];
  entregas?: EtapaEntrega[];
  checklistEntregas?: ChecklistItemEntrega[];
}

interface EtapaEntrega {
  id: number;
  descricao: string;
  imagemUrl?: string | null;
  status: 'EM_ANALISE' | 'APROVADA' | 'RECUSADA';
  dataEnvio: string;
  comentario?: string | null;
  dataAvaliacao?: string | null;
  executor?: { nome: string } | null;
  avaliadoPor?: { nome: string } | null;
}

interface MyTasksResponse {
  projetos: Projeto[];
  etapasPendentes: Etapa[];
}

export default function MyTasks() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [data, setData] = useState<MyTasksResponse>({ projetos: [], etapasPendentes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEntregaModal, setShowEntregaModal] = useState(false);
  const [selectedEtapa, setSelectedEtapa] = useState<Etapa | null>(null);
  const [editingEntrega, setEditingEntrega] = useState<EtapaEntrega | null>(null);
  const [entregaDescricao, setEntregaDescricao] = useState('');
  const [entregaImagem, setEntregaImagem] = useState<string | null>(null);
  const [entregaPreview, setEntregaPreview] = useState<string | null>(null);
  const [entregaLoading, setEntregaLoading] = useState(false);
  const [entregaError, setEntregaError] = useState<string | null>(null);

  // Envio por objetivo (checklist)
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [selectedChecklistEtapa, setSelectedChecklistEtapa] = useState<Etapa | null>(null);
  const [selectedChecklistIndex, setSelectedChecklistIndex] = useState<number | null>(null);
  const [objetivoDescricao, setObjetivoDescricao] = useState('');
  const [objetivoImagens, setObjetivoImagens] = useState<string[]>([]);
  const [objetivoDocumentos, setObjetivoDocumentos] = useState<string[]>([]);
  const [objetivoPreviews, setObjetivoPreviews] = useState<{ url: string; name: string; type: 'image' | 'document' }[]>([]);
  const [objetivoLoading, setObjetivoLoading] = useState(false);
  const [objetivoError, setObjetivoError] = useState<string | null>(null);
  const [showViewEntregaModal, setShowViewEntregaModal] = useState(false);
  const [selectedViewEntrega, setSelectedViewEntrega] = useState<{ etapa: Etapa; index: number; entrega: ChecklistItemEntrega } | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());

  // Verificar se o usuário tem acesso à página de projetos
  const hasProjectsAccess = useMemo(() => {
    if (!user) return false;

    let paginasPermitidas: string[] = [];
    
    if (typeof user.cargo === 'string') {
      const allowedMap: Record<string, string[]> = {
        DIRETOR: ['/dashboard', '/projects', '/tasks/my', '/stock', '/communications', '/users', '/cargos'],
        SUPERVISOR: ['/tasks/my', '/communications'],
        EXECUTOR: ['/tasks/my', '/communications'],
        COTADOR: ['/tasks/my', '/stock', '/communications'],
        PAGADOR: ['/tasks/my', '/stock', '/communications'],
      };
      paginasPermitidas = allowedMap[user.cargo] || [];
    } else if (user.cargo && typeof user.cargo === 'object' && 'nome' in user.cargo) {
      if (user.cargo.paginasPermitidas && Array.isArray(user.cargo.paginasPermitidas)) {
        paginasPermitidas = user.cargo.paginasPermitidas;
      } else {
        const allowedMap: Record<string, string[]> = {
          DIRETOR: ['/dashboard', '/projects', '/tasks/my', '/stock', '/communications', '/users', '/cargos'],
          SUPERVISOR: ['/tasks/my', '/communications'],
          EXECUTOR: ['/tasks/my', '/communications'],
          COTADOR: ['/tasks/my', '/stock'],
          PAGADOR: ['/tasks/my', '/stock'],
        };
        paginasPermitidas = allowedMap[user.cargo.nome] || [];
      }
    }

    return paginasPermitidas.includes('/projects');
  }, [user]);

  async function fetchTasks() {
    try {
      setLoading(true);
      const { data: responseData } = await api.get<MyTasksResponse>('/tasks/my');
      setData(responseData);
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTasks();
  }, []);

  function resetEntregaForm() {
    setEntregaDescricao('');
    setEntregaImagem(null);
    setEntregaPreview(null);
    setEntregaError(null);
    setEntregaLoading(false);
  }

  function resetChecklistForm() {
    setObjetivoDescricao('');
    setObjetivoImagens([]);
    setObjetivoDocumentos([]);
    setObjetivoPreviews([]);
    setObjetivoError(null);
    setObjetivoLoading(false);
  }

  function handleOpenChecklistModal(etapa: Etapa, index: number) {
    setSelectedChecklistEtapa(etapa);
    setSelectedChecklistIndex(index);
    resetChecklistForm();
    setShowChecklistModal(true);
  }

  function handleCloseChecklistModal() {
    setShowChecklistModal(false);
    setSelectedChecklistEtapa(null);
    setSelectedChecklistIndex(null);
    resetChecklistForm();
  }

  function handleOpenEntregaModal(etapa: Etapa, entrega?: EtapaEntrega) {
    setSelectedEtapa(etapa);
    if (entrega) {
      setEditingEntrega(entrega);
      setEntregaDescricao(entrega.descricao);
      setEntregaImagem(entrega.imagemUrl || null);
      setEntregaPreview(entrega.imagemUrl || null);
    } else {
    resetEntregaForm();
      setEditingEntrega(null);
    }
    setShowEntregaModal(true);
  }

  function handleCloseEntregaModal() {
    setShowEntregaModal(false);
    setSelectedEtapa(null);
    resetEntregaForm();
    setEditingEntrega(null);
  }

  async function handleEntregaImagemChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setEntregaImagem(null);
      setEntregaPreview(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      setEntregaImagem(result);
      setEntregaPreview(result);
    };
    reader.onerror = () => {
      setEntregaError('Falha ao carregar a imagem. Tente novamente.');
    };
    reader.readAsDataURL(file);
  }

  async function handleObjetivoImagensChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      setObjetivoImagens([]);
      setObjetivoPreviews(prev => prev.filter(p => p.type !== 'image'));
      return;
    }

    const newImages: string[] = [];
    const newPreviews: { url: string; name: string; type: 'image' | 'document' }[] = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setObjetivoError(`O arquivo "${file.name}" não é uma imagem válida.`);
        continue;
      }

      const reader = new FileReader();
      await new Promise<void>((resolve, reject) => {
        reader.onload = () => {
          const result = typeof reader.result === 'string' ? reader.result : null;
          if (result) {
            newImages.push(result);
            newPreviews.push({ url: result, name: file.name, type: 'image' });
          }
          resolve();
        };
        reader.onerror = () => {
          setObjetivoError(`Falha ao carregar a imagem "${file.name}".`);
          reject();
        };
        reader.readAsDataURL(file);
      });
    }

    setObjetivoImagens(prev => [...prev, ...newImages]);
    setObjetivoPreviews(prev => [...prev.filter(p => p.type !== 'image'), ...newPreviews]);
  }

  async function handleObjetivoDocumentosChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      setObjetivoDocumentos([]);
      setObjetivoPreviews(prev => prev.filter(p => p.type !== 'document'));
      return;
    }

    const newDocuments: string[] = [];
    const newPreviews: { url: string; name: string; type: 'image' | 'document' }[] = [];

    for (const file of files) {
      const isValidDocument = file.type === 'application/pdf' || file.type.startsWith('image/');
      if (!isValidDocument) {
        setObjetivoError(`O arquivo "${file.name}" não é um documento válido (PDF ou imagem).`);
        continue;
      }

      const reader = new FileReader();
      await new Promise<void>((resolve, reject) => {
        reader.onload = () => {
          const result = typeof reader.result === 'string' ? reader.result : null;
          if (result) {
            newDocuments.push(result);
            newPreviews.push({ url: result, name: file.name, type: 'document' });
          }
          resolve();
        };
        reader.onerror = () => {
          setObjetivoError(`Falha ao carregar o documento "${file.name}".`);
          reject();
        };
        reader.readAsDataURL(file);
      });
    }

    setObjetivoDocumentos(prev => [...prev, ...newDocuments]);
    setObjetivoPreviews(prev => [...prev.filter(p => p.type !== 'document'), ...newPreviews]);
  }

  function removeObjetivoPreview(index: number) {
    const preview = objetivoPreviews[index];
    if (!preview) return;

    if (preview.type === 'image') {
      const imageIndex = objetivoPreviews.slice(0, index).filter(p => p.type === 'image').length;
      setObjetivoImagens(prev => prev.filter((_, i) => i !== imageIndex));
    } else {
      const docIndex = objetivoPreviews.slice(0, index).filter(p => p.type === 'document').length;
      setObjetivoDocumentos(prev => prev.filter((_, i) => i !== docIndex));
    }
    setObjetivoPreviews(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmitChecklistEntrega(e: FormEvent) {
    e.preventDefault();
    if (!selectedChecklistEtapa || selectedChecklistIndex === null) return;

    if (objetivoDescricao.trim().length < 5) {
      setObjetivoError('Descreva o objetivo com pelo menos 5 caracteres.');
      return;
    }

    try {
      setObjetivoLoading(true);
      setObjetivoError(null);
      await api.post(`/tasks/${selectedChecklistEtapa.id}/checklist/${selectedChecklistIndex}/submit`, {
        descricao: objetivoDescricao.trim(),
        imagens: objetivoImagens.length > 0 ? objetivoImagens : undefined,
        documentos: objetivoDocumentos.length > 0 ? objetivoDocumentos : undefined,
      });
      handleCloseChecklistModal();
      await fetchTasks();
      toast.success('Objetivo enviado com sucesso!');
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setObjetivoError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setObjetivoLoading(false);
    }
  }

  async function handleSubmitEntrega(event: FormEvent) {
    event.preventDefault();
    if (!selectedEtapa) return;

    if (entregaDescricao.trim().length < 5) {
      setEntregaError('Descreva a entrega com pelo menos 5 caracteres.');
      return;
    }

    try {
      setEntregaLoading(true);
      setEntregaError(null);
      
      if (editingEntrega) {
        // Atualizar entrega existente
        await api.patch(`/tasks/${selectedEtapa.id}/deliver/${editingEntrega.id}`, {
          descricao: entregaDescricao.trim(),
          imagem: entregaImagem ?? undefined,
        });
      } else {
        // Criar nova entrega
      await api.post(`/tasks/${selectedEtapa.id}/deliver`, {
        descricao: entregaDescricao.trim(),
        imagem: entregaImagem ?? undefined,
      });
      }
      
      handleCloseEntregaModal();
      await fetchTasks();
      toast.success(editingEntrega ? 'Entrega atualizada com sucesso!' : 'Entrega enviada com sucesso!');
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setEntregaError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setEntregaLoading(false);
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-white/70">Carregando tarefas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-md">
        {error}
      </div>
    );
  }

  // Garantir que etapasPendentes e projetos sejam arrays
  const etapasPendentes = Array.isArray(data.etapasPendentes) ? data.etapasPendentes : [];
  const projetos = Array.isArray(data.projetos) ? data.projetos : [];

  // Agrupar etapas por projeto
  const etapasPorProjeto = etapasPendentes.reduce((acc, etapa) => {
    const projetoId = etapa.projeto.id;
    if (!acc[projetoId]) {
      acc[projetoId] = {
        projeto: etapa.projeto,
        etapas: [],
      };
    }
    acc[projetoId].etapas.push(etapa);
    return acc;
  }, {} as Record<number, { projeto: Projeto; etapas: Etapa[] }>);

  // Criar um mapa de projetos com suas etapas para exibição unificada
  const projetosComEtapas = projetos.map(projeto => {
    const etapasDoProjeto = etapasPorProjeto[projeto.id]?.etapas || [];
    return {
      projeto,
      etapas: etapasDoProjeto,
      temEtapasPendentes: etapasDoProjeto.length > 0,
    };
  });

  // Adicionar projetos que têm etapas mas não estão na lista de projetos
  Object.values(etapasPorProjeto).forEach(({ projeto, etapas }) => {
    if (!projetosComEtapas.find(p => p.projeto.id === projeto.id)) {
      projetosComEtapas.push({
        projeto,
        etapas,
        temEtapasPendentes: true,
      });
    }
  });

  const toggleProject = (projetoId: number) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projetoId)) {
        newSet.delete(projetoId);
      } else {
        newSet.add(projetoId);
      }
      return newSet;
    });
  };

  // Calcular estatísticas por projeto
  const getProjetoStats = (projeto: Projeto, etapas: Etapa[]) => {
    const pendentes = etapas.filter(e => e.status === 'PENDENTE').length;
    const emAndamento = etapas.filter(e => e.status === 'EM_ANDAMENTO').length;
    const emAnalise = etapas.filter(e => e.status === 'EM_ANALISE').length;
    const total = etapas.length;
    
    return { pendentes, emAndamento, emAnalise, total };
  };

  return (
    <div className="space-y-6">
      {/* Resumo Geral */}
      {(projetos.length > 0 || etapasPendentes.length > 0) && (
        <div className="bg-neutral/80 border border-white/10 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Resumo</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-slate-600/30 to-slate-700/20 rounded-xl p-4 border border-slate-500/30 shadow-lg">
              <p className="text-slate-300 text-sm mb-1 font-medium">Total de Projetos</p>
              <p className="text-3xl font-bold text-white">{projetosComEtapas.length}</p>
            </div>
            <div className="bg-gradient-to-br from-amber-500/25 to-amber-600/15 rounded-xl p-4 border border-amber-400/40 shadow-lg">
              <p className="text-amber-200 text-sm mb-1 font-medium">Etapas Pendentes</p>
              <p className="text-3xl font-bold text-amber-300">
                {etapasPendentes.filter(e => e.status === 'PENDENTE').length}
              </p>
            </div>
            <div className="bg-gradient-to-br from-sky-500/25 to-sky-600/15 rounded-xl p-4 border border-sky-400/40 shadow-lg">
              <p className="text-sky-200 text-sm mb-1 font-medium">Em Andamento</p>
              <p className="text-3xl font-bold text-sky-300">
                {etapasPendentes.filter(e => e.status === 'EM_ANDAMENTO').length}
              </p>
            </div>
            <div className="bg-gradient-to-br from-violet-500/25 to-violet-600/15 rounded-xl p-4 border border-violet-400/40 shadow-lg">
              <p className="text-violet-200 text-sm mb-1 font-medium">Em Análise</p>
              <p className="text-3xl font-bold text-violet-300">
                {etapasPendentes.filter(e => e.status === 'EM_ANALISE').length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Projetos e Etapas Organizados */}
      {projetosComEtapas.length > 0 ? (
        <div>
          <h2 className="text-xl font-semibold mb-4">Meus Projetos e Tarefas</h2>
          <div className="space-y-4">
            {projetosComEtapas.map(({ projeto, etapas, temEtapasPendentes }) => {
              const isExpanded = expandedProjects.has(projeto.id);
              const stats = getProjetoStats(projeto, etapas);
              const hasEtapas = etapas.length > 0;

              return (
                <div key={projeto.id} className="bg-neutral/80 border border-white/10 rounded-xl overflow-hidden">
                  {/* Cabeçalho do Projeto */}
                  <div
                    className={`p-5 ${
                      hasProjectsAccess && hasEtapas
                        ? 'cursor-pointer hover:bg-white/5 transition-colors'
                        : ''
                }`}
                    onClick={hasProjectsAccess && hasEtapas ? () => toggleProject(projeto.id) : undefined}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">{projeto.nome}</h3>
                  <span className={`px-2 py-1 rounded text-xs ${getStatusColor(projeto.status)}`}>
                    {getStatusLabel(projeto.status)}
                  </span>
                          {projeto.progress !== undefined && (
                            <span className="text-xs text-white/60">
                              {projeto.progress}% concluído
                            </span>
                  )}
                </div>
                        {projeto.resumo && (
                          <p className="text-white/60 text-sm mb-3 line-clamp-2">{projeto.resumo}</p>
                        )}
                        {projeto.progress !== undefined && (
                          <div className="mb-3">
                            <div className="w-full bg-white/10 rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{ width: `${projeto.progress}%` }}
                              />
              </div>
          </div>
                        )}
                        {hasEtapas && (
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-white/60">
                              {stats.total} etapa{stats.total !== 1 ? 's' : ''} pendente{stats.total !== 1 ? 's' : ''}
                            </span>
                                            {stats.pendentes > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/25 text-amber-200 border border-amber-400/40 font-medium">
                                {stats.pendentes} pendente{stats.pendentes !== 1 ? 's' : ''}
                              </span>
                            )}
                            {stats.emAndamento > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-sky-500/25 text-sky-200 border border-sky-400/40 font-medium">
                                {stats.emAndamento} em andamento
                              </span>
                            )}
                            {stats.emAnalise > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-violet-500/25 text-violet-200 border border-violet-400/40 font-medium">
                                {stats.emAnalise} em análise
                              </span>
                            )}
        </div>
      )}
                  </div>
                      <div className="flex items-center gap-2">
                  {hasProjectsAccess && (
                    <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/projects/${projeto.id}`);
                            }}
                            className="px-3 py-1.5 rounded-md bg-primary/20 hover:bg-primary/30 text-primary text-sm border border-primary/30 transition-colors"
                          >
                            Ver Detalhes
                          </button>
                        )}
                        {hasEtapas && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleProject(projeto.id);
                            }}
                            className="p-2 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
                            title={isExpanded ? 'Recolher' : 'Expandir'}
                    >
                            <svg
                              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                    </button>
                  )}
                      </div>
                    </div>
                </div>

                  {/* Etapas do Projeto (Colapsável) */}
                  {hasEtapas && isExpanded && (
                    <div className="border-t border-white/10 p-5 pt-4 space-y-4">
                  {etapas.map((etapa) => {
                        // Verificar se o usuário é executor usando executorId
                        const executorId = etapa.executorId;
                    // Comparar convertendo ambos para número para evitar problemas de tipo
                    const isExecutor = user?.id && executorId && Number(user.id) === Number(executorId);
                    
                    // Verificar se o usuário é integrante (auxiliar) da etapa
                    const integrantesIds = etapa.integrantes?.map(i => i.usuario?.id).filter(Boolean) || [];
                    const isIntegrante = user?.id && integrantesIds.some(id => Number(user.id) === Number(id));
                    
                    // Usuário pode interagir se for executor OU integrante
                    const podeInteragir = isExecutor || isIntegrante;
                    
                    const latestEntrega = etapa.entregas && etapa.entregas.length > 0 ? etapa.entregas[0] : null;
                    
                    // Verificar se há itens do checklist marcados
                    const checklistItems = etapa.checklistJson && Array.isArray(etapa.checklistJson) 
                      ? etapa.checklistJson 
                      : [];
                    const itensMarcados = checklistItems.filter((item) => item.concluido).length;
                    const temItensMarcados = itensMarcados > 0;
                    const totalItens = checklistItems.length;
                    
                    const canEnviarEntrega =
                      podeInteragir && 
                      ['PENDENTE', 'EM_ANDAMENTO', 'REPROVADA'].includes(etapa.status) &&
                      temItensMarcados;

                    return (
                      <div key={etapa.id} className="bg-gradient-to-br from-neutral/80 to-neutral/60 border border-white/15 rounded-xl p-5 shadow-md hover:shadow-lg transition-shadow">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1">
                            <h4 className="font-semibold text-white/90">{etapa.nome}</h4>
                            {etapa.descricao && (
                              <p className="text-sm text-white/70 mt-1">{etapa.descricao}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`px-2 py-1 rounded text-xs ${getStatusColor(etapa.status)}`}>
                              {getStatusLabel(etapa.status)}
                            </span>
                            {podeInteragir && etapa.status === 'EM_ANALISE' && (
                              <span className="text-xs text-white/60">Aguardando revisão</span>
                            )}
                            {canEnviarEntrega && (
                              <button
                                type="button"
                                onClick={() => handleOpenEntregaModal(etapa)}
                                className="px-3 py-1 rounded-md bg-primary/20 hover:bg-primary/30 text-primary text-xs border border-primary/30 transition-colors"
                              >
                                Enviar Entrega ({itensMarcados}/{totalItens})
                              </button>
                            )}
                          </div>
                        </div>

                        {latestEntrega ? (
                          <div className="mt-3 border border-white/10 rounded-md p-3 bg-white/5">
                            <div className="flex items-start justify-between gap-3 mb-2">
            <div>
                                <span className="text-xs text-white/60 block">Última entrega</span>
                                <span className="text-sm text-white/80">
                                  {new Date(latestEntrega.dataEnvio).toLocaleString('pt-BR')}
                                </span>
            </div>
                                  <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded text-xs ${getEntregaStatusColor(latestEntrega.status)}`}>
                                {getEntregaStatusLabel(latestEntrega.status)}
            </span>
                                    {podeInteragir && latestEntrega.status === 'EM_ANALISE' && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEntregaModal(etapa, latestEntrega)}
                                        className="px-2 py-1 rounded text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 transition-colors"
                                        title="Editar entrega"
                                      >
                                        Editar
                                      </button>
                                    )}
                                  </div>
          </div>
                            <p className="text-sm text-white/80 whitespace-pre-wrap">{latestEntrega.descricao}</p>
                            {latestEntrega.imagemUrl && (
                              <img
                                src={latestEntrega.imagemUrl}
                                alt={`Entrega etapa ${etapa.nome}`}
                                className="mt-3 rounded-md border border-white/10 max-h-48 object-cover"
                              />
                            )}
                            {latestEntrega.comentario && (
                              <div className="mt-3 text-xs text-white/70">
                                <span className="font-semibold">Comentário do avaliador:</span>
                                <p className="mt-1 text-white/80">{latestEntrega.comentario}</p>
                              </div>
                            )}
                            {latestEntrega.avaliadoPor && (
                              <p className="mt-2 text-xs text-white/60">
                                Avaliado por {latestEntrega.avaliadoPor.nome}
                                {latestEntrega.dataAvaliacao
                                  ? ` em ${new Date(latestEntrega.dataAvaliacao).toLocaleString('pt-BR')}`
                                  : ''}
                              </p>
                            )}
                          </div>
                        ) : (
                          podeInteragir && (
                            <div className="mt-3 p-3 border border-dashed border-white/20 rounded-md text-sm text-white/60">
                              Finalize a etapa descrevendo o trabalho e anexando uma imagem de evidência.
                            </div>
                          )
                        )}

                      {/* Checklist */}
                      {etapa.checklistJson && Array.isArray(etapa.checklistJson) && etapa.checklistJson.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium text-white/90 block">
                              Checklist de Objetos
                              {etapa.executor && (
                                <span className="text-white/50 text-xs ml-2">
                                  (Executor: {etapa.executor.nome})
                                </span>
                              )}
                            </label>
                            {podeInteragir && totalItens > 0 && (
                              <span className="text-xs text-white/60">
                                {itensMarcados} de {totalItens} marcado{itensMarcados !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className="space-y-2">
                            {etapa.checklistJson.map((item, index) => {
                              const entregaItem = etapa.checklistEntregas?.find((e) => e.checklistIndex === index);
                              const statusItem = entregaItem?.status ?? 'PENDENTE';
                              const podeEnviarObjetivo = podeInteragir && (statusItem === 'PENDENTE' || statusItem === 'REPROVADO');
                              return (
                                <div
                                  key={index}
                                  className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                                    podeInteragir ? 'hover:bg-white/10 hover:scale-[1.01]' : ''
                                  } ${getChecklistItemStyle(item.concluido)}`}
                                >
                                  <div
                                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${getCheckboxStyle(item.concluido)}`}
                                    title="Status do item"
                                  >
                                    {item.concluido && (
                                      <svg className="w-4 h-4 text-white drop-shadow" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </div>
                                  <span className={`flex-1 text-sm ${getChecklistTextStyle(item.concluido)}`}>
                                    {item.texto}
                                  </span>
                                  <span
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${getChecklistItemStatusColor(statusItem)}`}
                                  >
                                    {getChecklistItemStatusLabel(statusItem)}
                                  </span>
                                  {entregaItem && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedViewEntrega({ etapa, index, entrega: entregaItem });
                                        setShowViewEntregaModal(true);
                                      }}
                                      className="ml-2 px-2 py-0.5 rounded text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 transition-colors"
                                      title="Ver detalhes da entrega"
                                    >
                                      Ver detalhes
                                    </button>
                                  )}
                                  {podeEnviarObjetivo && (
            <button
                                      type="button"
                                      onClick={() => handleOpenChecklistModal(etapa, index)}
                                      className="ml-2 px-2 py-0.5 rounded text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 transition-colors"
                                      title="Enviar objetivo para análise"
            >
                                      Enviar
            </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                            {podeInteragir && 
                             ['PENDENTE', 'EM_ANDAMENTO', 'REPROVADA'].includes(etapa.status) && 
                             !temItensMarcados && (
                            <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
                              <p className="text-xs text-yellow-300">
                                💡 Marque pelo menos um item do checklist na página de Projetos para poder enviar a entrega com descrição e imagem.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Informações da etapa */}
                      <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-white/70">
                        {etapa.dataInicio && (
                          <div>
                            <span className="font-medium">Data Início:</span>{' '}
                            {new Date(etapa.dataInicio).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </div>
                        )}
                        {etapa.dataFim && (
                          <div>
                            <span className="font-medium">Data Fim:</span>{' '}
                            {new Date(etapa.dataFim).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </div>
                        )}
                      </div>
                      </div>
                    );
                  })}
          </div>
                  )}
        </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-neutral/80 border border-white/10 rounded-xl p-8 text-center">
          <p className="text-white/60">Nenhum projeto ou tarefa encontrada</p>
        </div>
      )}

      {showEntregaModal && selectedEtapa && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-white/20 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {editingEntrega ? 'Editar entrega' : 'Enviar entrega'}
                </h2>
                <p className="text-sm text-white/60 mt-1">{selectedEtapa.nome}</p>
              </div>
              <button
                type="button"
                onClick={handleCloseEntregaModal}
                className="text-white/50 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitEntrega} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Descrição do trabalho realizado <span className="text-danger">*</span>
                </label>
                <textarea
                  value={entregaDescricao}
                  onChange={(e) => setEntregaDescricao(e.target.value)}
                  required
                  minLength={5}
                  rows={4}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                  placeholder="Explique o que foi realizado nesta etapa"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Imagem (opcional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleEntregaImagemChange}
                  className="w-full text-sm text-white/80 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
                />
                <p className="text-xs text-white/50 mt-1">
                  Anexe uma foto que comprove o andamento ou conclusão do trabalho.
                </p>
                {entregaPreview && (
                  <img
                    src={entregaPreview}
                    alt="Pré-visualização"
                    className="mt-3 rounded-md border border-white/20 max-h-48 object-cover"
                  />
                )}
              </div>

              {entregaError && (
                <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-md text-sm">
                  {entregaError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-white/20">
                <button
                  type="button"
                  onClick={handleCloseEntregaModal}
                  className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
                  disabled={entregaLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-primary hover:bg-primary/80 text-white text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={entregaLoading}
                >
                  {entregaLoading 
                    ? (editingEntrega ? 'Atualizando...' : 'Enviando...') 
                    : (editingEntrega ? 'Atualizar entrega' : 'Enviar para revisão')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showChecklistModal && selectedChecklistEtapa !== null && selectedChecklistIndex !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-white/20 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Enviar objetivo</h2>
                <p className="text-sm text-white/60 mt-1">
                  {selectedChecklistEtapa.nome} • Objetivo #{selectedChecklistIndex + 1}
                </p>
                {selectedChecklistEtapa.checklistJson &&
                  selectedChecklistEtapa.checklistJson[selectedChecklistIndex] && (
                    <p className="text-xs text-white/40">
                      {selectedChecklistEtapa.checklistJson[selectedChecklistIndex]?.texto}
                    </p>
                  )}
              </div>
              <button type="button" onClick={handleCloseChecklistModal} className="text-white/50 hover:text-white transition-colors text-2xl">✕</button>
            </div>

            <form onSubmit={handleSubmitChecklistEntrega} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Descrição do objetivo <span className="text-danger">*</span>
                </label>
                <textarea
                  value={objetivoDescricao}
                  onChange={(e) => setObjetivoDescricao(e.target.value)}
                  required
                  minLength={5}
                  rows={4}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                  placeholder="Explique o que foi realizado para este objetivo"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Imagens (opcional) - Você pode selecionar múltiplas imagens
                  </label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple
                    onChange={handleObjetivoImagensChange} 
                    className="w-full text-sm text-white/80 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary/20 file:text-primary hover:file:bg-primary/30" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Documentos (opcional) - Você pode selecionar múltiplos documentos
                  </label>
                  <input 
                    type="file" 
                    accept="application/pdf,image/*" 
                    multiple
                    onChange={handleObjetivoDocumentosChange} 
                    className="w-full text-sm text-white/80 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary/20 file:text-primary hover:file:bg-primary/30" 
                  />
                  <p className="text-xs text-white/50 mt-1">PDF ou imagem.</p>
                </div>

                {/* Previews dos arquivos */}
                {objetivoPreviews.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <label className="block text-sm font-medium text-white/90">Arquivos selecionados:</label>
                    <div className="grid grid-cols-1 gap-2">
                      {objetivoPreviews.map((preview, index) => (
                        <div key={index} className="flex items-start gap-2 p-2 bg-white/5 rounded-md border border-white/10">
                          {preview.type === 'image' ? (
                            <img 
                              src={preview.url} 
                              alt={preview.name} 
                              className="w-16 h-16 rounded object-cover border border-white/20"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded bg-primary/20 border border-primary/30 flex items-center justify-center">
                              <span className="text-2xl">📄</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white/80 truncate">{preview.name}</p>
                            <p className="text-xs text-white/50">{preview.type === 'image' ? 'Imagem' : 'Documento'}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeObjetivoPreview(index)}
                            className="px-2 py-1 text-xs bg-danger/20 hover:bg-danger/30 text-danger rounded border border-danger/30 transition-colors"
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {objetivoError && (
                <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-md text-sm">{objetivoError}</div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-white/20">
                <button type="button" onClick={handleCloseChecklistModal} className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm transition-colors" disabled={objetivoLoading}>
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 rounded-md bg-primary hover:bg-primary/80 text-white text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={objetivoLoading}>
                  {objetivoLoading ? 'Enviando...' : 'Enviar para análise'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Visualizar Entrega */}
      {showViewEntregaModal && selectedViewEntrega && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-white/20 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Detalhes da Entrega</h2>
                <p className="text-sm text-white/60 mt-1">
                  {selectedViewEntrega.etapa.nome} • Objetivo #{selectedViewEntrega.index + 1}
                </p>
                {selectedViewEntrega.etapa.checklistJson && selectedViewEntrega.etapa.checklistJson[selectedViewEntrega.index] && (
                  <p className="text-xs text-white/40 mt-1">
                    {selectedViewEntrega.etapa.checklistJson[selectedViewEntrega.index]?.texto}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowViewEntregaModal(false);
                  setSelectedViewEntrega(null);
                }}
                className="text-white/50 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Descrição
                </label>
                <div className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-3 text-white whitespace-pre-wrap min-h-[100px]">
                  {selectedViewEntrega.entrega.descricao || 'Não informada'}
                </div>
              </div>

              {/* Imagens - usar array se disponível, senão usar campo único (compatibilidade) */}
              {(() => {
                const imagens = selectedViewEntrega.entrega.imagensUrls && Array.isArray(selectedViewEntrega.entrega.imagensUrls) && selectedViewEntrega.entrega.imagensUrls.length > 0
                  ? selectedViewEntrega.entrega.imagensUrls
                  : selectedViewEntrega.entrega.imagemUrl
                    ? [selectedViewEntrega.entrega.imagemUrl]
                    : [];
                
                return imagens.length > 0 ? (
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Imagens ({imagens.length})
                    </label>
                    <div className="space-y-3">
                      {imagens.map((url, index) => (
                        <img
                          key={index}
                          src={url}
                          alt={`Imagem ${index + 1} da entrega`}
                          className="w-full rounded-md border border-white/20 max-h-96 object-contain bg-white/5"
                        />
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Documentos - usar array se disponível, senão usar campo único (compatibilidade) */}
              {(() => {
                const documentos = selectedViewEntrega.entrega.documentosUrls && Array.isArray(selectedViewEntrega.entrega.documentosUrls) && selectedViewEntrega.entrega.documentosUrls.length > 0
                  ? selectedViewEntrega.entrega.documentosUrls
                  : selectedViewEntrega.entrega.documentoUrl
                    ? [selectedViewEntrega.entrega.documentoUrl]
                    : [];
                
                return documentos.length > 0 ? (
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Documentos ({documentos.length})
                    </label>
                    <div className="space-y-2">
                      {documentos.map((url, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            try {
                              if (url.startsWith('data:')) {
                                // Base64 - criar blob e abrir
                                const parts = url.split(',');
                                if (parts.length < 2) {
                                  toast.error('Formato de documento inválido');
                                  return;
                                }
                                const byteString = atob(parts[1]);
                                const mimeString = parts[0].split(':')[1].split(';')[0];
                                const ab = new ArrayBuffer(byteString.length);
                                const ia = new Uint8Array(ab);
                                for (let i = 0; i < byteString.length; i++) {
                                  ia[i] = byteString.charCodeAt(i);
                                }
                                const blob = new Blob([ab], { type: mimeString });
                                const blobUrl = URL.createObjectURL(blob);
                                const newWindow = window.open(blobUrl, '_blank');
                                if (!newWindow) {
                                  toast.warning('Por favor, permita pop-ups para visualizar o documento');
                                  URL.revokeObjectURL(blobUrl);
                                  return;
                                }
                                // Limpar após um tempo
                                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                              } else {
                                // URL externa - abrir diretamente
                                window.open(url, '_blank');
                              }
                            } catch (error) {
                              console.error('Erro ao abrir documento:', error);
                              toast.error('Erro ao abrir documento. Tente novamente.');
                            }
                          }}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 transition-colors"
                        >
                          <span>📄</span>
                          <span>Abrir documento {index + 1}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
                <div>
                  <label className="block text-xs text-white/60 mb-1">Enviado por</label>
                  <p className="text-sm text-white/90">
                    {selectedViewEntrega.entrega.executor?.nome ?? 'Usuário'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">Data de envio</label>
                  <p className="text-sm text-white/90">
                    {new Date(selectedViewEntrega.entrega.dataEnvio).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">Status</label>
                  <span
                    className={`inline-block px-3 py-1.5 rounded-md text-xs font-semibold ${
                      selectedViewEntrega.entrega.status === 'EM_ANALISE'
                        ? 'bg-violet-500/30 text-violet-200 border border-violet-400/50'
                        : selectedViewEntrega.entrega.status === 'APROVADO'
                        ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50'
                        : selectedViewEntrega.entrega.status === 'REPROVADO'
                        ? 'bg-rose-500/30 text-rose-200 border border-rose-400/50'
                        : 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
                    }`}
                  >
                    {selectedViewEntrega.entrega.status === 'PENDENTE'
                      ? '⏳ Pendente'
                      : selectedViewEntrega.entrega.status === 'EM_ANALISE'
                      ? '🔍 Em análise'
                      : selectedViewEntrega.entrega.status === 'APROVADO'
                      ? '✓ Aprovado'
                      : '✗ Reprovado'}
                  </span>
                </div>
                {selectedViewEntrega.entrega.avaliadoPor && (
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Avaliado por</label>
                    <p className="text-sm text-white/90">
                      {selectedViewEntrega.entrega.avaliadoPor.nome}
                    </p>
                  </div>
                )}
              </div>

              {selectedViewEntrega.entrega.comentario && (
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Comentário da avaliação
                  </label>
                  <div className="w-full bg-warning/10 border border-warning/30 rounded-md px-4 py-3 text-warning whitespace-pre-wrap">
                    {selectedViewEntrega.entrega.comentario}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-white/20">
                <button
                  type="button"
                  onClick={() => {
                    setShowViewEntregaModal(false);
                    setSelectedViewEntrega(null);
                  }}
                  className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
