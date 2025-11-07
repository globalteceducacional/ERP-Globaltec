import { useEffect, useState, useMemo, FormEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../store/auth';
import { buttonStyles } from '../utils/buttonStyles';
import { ChecklistItemEntrega } from '../types';

interface Projeto {
  id: number;
  nome: string;
  resumo?: string | null;
  status: string;
  supervisor?: { nome: string } | null;
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

  // Verificar se o usuário tem acesso à página de projetos
  const hasProjectsAccess = useMemo(() => {
    if (!user) return false;

    let paginasPermitidas: string[] = [];
    
    if (typeof user.cargo === 'string') {
      const allowedMap: Record<string, string[]> = {
        DIRETOR: ['/dashboard', '/projects', '/tasks/my', '/stock', '/occurrences', '/requests', '/users', '/cargos'],
        SUPERVISOR: ['/tasks/my', '/occurrences', '/requests'],
        EXECUTOR: ['/tasks/my', '/occurrences', '/requests'],
        COTADOR: ['/tasks/my', '/stock', '/occurrences'],
        PAGADOR: ['/tasks/my', '/stock', '/occurrences'],
      };
      paginasPermitidas = allowedMap[user.cargo] || [];
    } else if (user.cargo && typeof user.cargo === 'object' && 'nome' in user.cargo) {
      if (user.cargo.paginasPermitidas && Array.isArray(user.cargo.paginasPermitidas)) {
        paginasPermitidas = user.cargo.paginasPermitidas;
      } else {
        const allowedMap: Record<string, string[]> = {
          DIRETOR: ['/dashboard', '/projects', '/tasks/my', '/stock', '/occurrences', '/requests', '/users', '/cargos'],
          SUPERVISOR: ['/tasks/my', '/occurrences', '/requests'],
          EXECUTOR: ['/tasks/my', '/occurrences', '/requests'],
          COTADOR: ['/tasks/my', '/stock', '/occurrences'],
          PAGADOR: ['/tasks/my', '/stock', '/occurrences'],
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
      setError(err.response?.data?.message ?? 'Falha ao buscar tarefas');
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

  function handleOpenEntregaModal(etapa: Etapa) {
    setSelectedEtapa(etapa);
    resetEntregaForm();
    setShowEntregaModal(true);
  }

  function handleCloseEntregaModal() {
    setShowEntregaModal(false);
    setSelectedEtapa(null);
    resetEntregaForm();
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
    } catch (err: any) {
      setObjetivoError(err.response?.data?.message ?? 'Falha ao enviar objetivo.');
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
      await api.post(`/tasks/${selectedEtapa.id}/deliver`, {
        descricao: entregaDescricao.trim(),
        imagem: entregaImagem ?? undefined,
      });
      handleCloseEntregaModal();
      await fetchTasks();
    } catch (err: any) {
      setEntregaError(err.response?.data?.message ?? 'Falha ao enviar entrega.');
    } finally {
      setEntregaLoading(false);
    }
  }


  function getStatusColor(status: string) {
    switch (status) {
      case 'PENDENTE':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50';
      case 'EM_ANDAMENTO':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/50';
      case 'EM_ANALISE':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/50';
      case 'APROVADA':
        return 'bg-green-500/20 text-green-300 border-green-500/50';
      case 'REPROVADA':
        return 'bg-danger/20 text-danger border-danger/50';
      default:
        return 'bg-white/10 text-white/70 border-white/30';
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case 'PENDENTE':
        return 'Pendente';
      case 'EM_ANDAMENTO':
        return 'Em Andamento';
      case 'EM_ANALISE':
        return 'Em Análise';
      case 'APROVADA':
        return 'Aprovada';
      case 'REPROVADA':
        return 'Recusada';
      default:
        return status;
    }
  }

  function getEntregaStatusColor(status: string) {
    switch (status) {
      case 'EM_ANALISE':
        return 'bg-purple-500/20 text-purple-300 border border-purple-500/40';
      case 'APROVADA':
        return 'bg-green-500/20 text-green-300 border border-green-500/40';
      case 'RECUSADA':
        return 'bg-danger/20 text-danger border border-danger/40';
      default:
        return 'bg-white/10 text-white/70 border border-white/20';
    }
  }

  function getEntregaStatusLabel(status: string) {
    switch (status) {
      case 'EM_ANALISE':
        return 'Em Análise';
      case 'APROVADA':
        return 'Aprovada';
      case 'RECUSADA':
        return 'Recusada';
      default:
        return status;
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

  return (
    <div className="space-y-6">
      {/* Projetos onde o usuário é responsável */}
      {projetos.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Meus Projetos</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {projetos.map((projeto) => (
              <div
                key={projeto.id}
                onClick={hasProjectsAccess ? () => navigate(`/projects/${projeto.id}`) : undefined}
                className={`bg-neutral/80 border border-white/10 rounded-xl p-5 ${
                  hasProjectsAccess 
                    ? 'cursor-pointer hover:border-primary/50 transition-colors' 
                    : 'cursor-default'
                }`}
              >
                <h3 className="text-lg font-semibold mb-2">{projeto.nome}</h3>
                {projeto.resumo && (
                  <p className="text-white/60 text-sm mb-3 line-clamp-2">{projeto.resumo}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 rounded text-xs ${getStatusColor(projeto.status)}`}>
                    {getStatusLabel(projeto.status)}
                  </span>
                  {hasProjectsAccess && (
                    <span className="text-primary text-sm font-medium">Ver detalhes →</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Etapas Pendentes */}
      {etapasPendentes.length > 0 ? (
        <div>
          <h2 className="text-xl font-semibold mb-4">Etapas Pendentes e em Andamento</h2>
          <div className="space-y-6">
            {Object.values(etapasPorProjeto).map(({ projeto, etapas }) => (
              <div key={projeto.id} className="bg-neutral/80 border border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{projeto.nome}</h3>
                    <p className="text-white/60 text-sm">{etapas.length} etapa(s) pendente(s)</p>
                  </div>
                  {hasProjectsAccess && (
                    <button
                      onClick={() => navigate(`/projects/${projeto.id}`)}
                      className={buttonStyles.secondary}
                    >
                      Ver Projeto
                    </button>
                  )}
                </div>

    <div className="space-y-4">
                  {etapas.map((etapa) => {
                    // Verificar se o usuário é executor usando executorId ou executor.id como fallback
                    const executorId = etapa.executorId || etapa.executor?.id;
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
                      <div key={etapa.id} className="bg-neutral/60 border border-white/10 rounded-lg p-4">
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
                            {podeInteragir && 
                             ['PENDENTE', 'EM_ANDAMENTO', 'REPROVADA'].includes(etapa.status) && 
                             !temItensMarcados && 
                             totalItens > 0 && (
                              <span className="text-xs text-yellow-400">
                                Marque itens do checklist na página de Projetos para enviar
                              </span>
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
                              <span className={`px-2 py-1 rounded text-xs ${getEntregaStatusColor(latestEntrega.status)}`}>
                                {getEntregaStatusLabel(latestEntrega.status)}
            </span>
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
                                  className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
                                    podeInteragir ? 'hover:bg-white/5' : ''
                                  }`}
                                >
                                  <div
                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                      item.concluido
                                        ? 'bg-primary border-primary'
                                        : 'border-white/30 bg-white/10'
                                    }`}
                                    title="Marque os itens na página de Projetos"
                                  >
                                    {item.concluido && (
                                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </div>
                                  <span
                                    className={`flex-1 text-sm ${
                                      item.concluido
                                        ? 'text-white/50 line-through'
                                        : 'text-white/80'
                                    }`}
                                  >
                                    {item.texto}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] border ${
                                      statusItem === 'EM_ANALISE'
                                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                        : statusItem === 'APROVADO'
                                        ? 'bg-green-500/20 text-green-300 border-green-500/40'
                                        : statusItem === 'REPROVADO'
                                        ? 'bg-danger/20 text-danger border-danger/40'
                                        : 'bg-white/10 text-white/70 border-white/20'
                                    }`}
                                  >
                                    {statusItem === 'PENDENTE'
                                      ? 'Pendente'
                                      : statusItem === 'EM_ANALISE'
                                      ? 'Em análise'
                                      : statusItem === 'APROVADO'
                                      ? 'Aprovado'
                                      : 'Reprovado'}
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
        </div>
      ))}
          </div>
        </div>
      ) : (
        projetos.length === 0 && (
          <div className="text-center py-12">
            <p className="text-white/50">Nenhuma tarefa atribuída.</p>
          </div>
        )
      )}

      {projetos.length === 0 && etapasPendentes.length === 0 && (
        <div className="text-center py-12">
          <p className="text-white/50">Você não está atribuído a nenhum projeto ou etapa no momento.</p>
        </div>
      )}

      {showEntregaModal && selectedEtapa && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-white/20 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Enviar entrega</h2>
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
                  {entregaLoading ? 'Enviando...' : 'Enviar para revisão'}
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
                                  alert('Formato de documento inválido');
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
                                  alert('Por favor, permita pop-ups para visualizar o documento');
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
                              alert('Erro ao abrir documento. Tente novamente.');
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
                    className={`inline-block px-2 py-1 rounded text-xs ${
                      selectedViewEntrega.entrega.status === 'EM_ANALISE'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        : selectedViewEntrega.entrega.status === 'APROVADO'
                        ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                        : selectedViewEntrega.entrega.status === 'REPROVADO'
                        ? 'bg-danger/20 text-danger border border-danger/40'
                        : 'bg-white/10 text-white/70 border border-white/20'
                    }`}
                  >
                    {selectedViewEntrega.entrega.status === 'PENDENTE'
                      ? 'Pendente'
                      : selectedViewEntrega.entrega.status === 'EM_ANALISE'
                      ? 'Em análise'
                      : selectedViewEntrega.entrega.status === 'APROVADO'
                      ? 'Aprovado'
                      : 'Reprovado'}
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
