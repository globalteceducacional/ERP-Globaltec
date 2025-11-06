import { useEffect, useState, FormEvent, useRef, ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../store/auth';
import { Cargo } from '../types';
import { buttonStyles } from '../utils/buttonStyles';

interface Usuario {
  id: number;
  nome: string;
  email: string;
  cargo: string | { nome: string };
}

interface Subetapa {
  id: number;
  nome: string;
  descricao?: string | null;
  status: string;
}

interface Etapa {
  id: number;
  nome: string;
  descricao?: string | null;
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'EM_ANALISE' | 'APROVADA' | 'REPROVADA';
  dataInicio?: string | null;
  dataFim?: string | null;
  valorInsumos?: number;
  checklistJson?: Array<{ texto: string; concluido?: boolean }> | null;
  executor: Usuario;
  integrantes?: Array<{ usuario: Usuario }>;
  subetapas: Subetapa[];
  entregas?: EtapaEntrega[];
  checklistEntregas?: Array<{
    checklistIndex: number;
    status: 'PENDENTE' | 'EM_ANALISE' | 'APROVADO' | 'REPROVADO';
    comentario?: string | null;
  }>;
}

interface EtapaEntrega {
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

interface Responsavel {
  id: number;
  usuario: Usuario;
}

interface Compra {
  id: number;
  item: string;
  quantidade: number;
  valorUnitario: number;
  status: string;
  nfUrl?: string | null;
  comprovantePagamentoUrl?: string | null;
}

interface ProjectDetails {
  id: number;
  nome: string;
  resumo?: string | null;
  objetivo?: string | null;
  status: 'EM_ANDAMENTO' | 'FINALIZADO';
  valorTotal: number;
  valorInsumos: number;
  dataCriacao: string;
  supervisor?: Usuario | null;
  responsaveis: Responsavel[];
  etapas: Etapa[];
  compras: Compra[];
}

export default function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<Usuario[]>([]);
  const [showEtapaModal, setShowEtapaModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingEtapa, setEditingEtapa] = useState<Etapa | null>(null);
  const integrantesSelectRef = useRef<HTMLSelectElement>(null);

  const cargoNome =
    typeof user?.cargo === 'string'
      ? user.cargo
      : user?.cargo && typeof user.cargo === 'object' && 'nome' in user.cargo
        ? user.cargo.nome
        : undefined;

  const isDiretor = cargoNome === 'DIRETOR';
  const isSupervisor = cargoNome === 'SUPERVISOR';
  const canReview = isDiretor || isSupervisor;
  const [etapaForm, setEtapaForm] = useState({
    nome: '',
    descricao: '',
    executorId: 0,
    integrantesIds: [] as number[],
    dataInicio: '',
    dataFim: '',
    valorInsumos: 0,
    checklist: [{ texto: '', concluido: false }],
    status: 'PENDENTE' as string,
  });

  const [updatingChecklist, setUpdatingChecklist] = useState<number | null>(null);
  const [showEntregaModal, setShowEntregaModal] = useState(false);
  const [selectedEntregaEtapa, setSelectedEntregaEtapa] = useState<Etapa | null>(null);
  const [entregaDescricao, setEntregaDescricao] = useState('');
  const [entregaImagem, setEntregaImagem] = useState<string | null>(null);
  const [entregaPreview, setEntregaPreview] = useState<string | null>(null);
  const [enviandoEntrega, setEnviandoEntrega] = useState(false);
  const [entregaError, setEntregaError] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [reviewLoading, setReviewLoading] = useState<Record<number, boolean>>({});

  const statusOptions = [
    { value: 'PENDENTE', label: 'Pendente' },
    { value: 'EM_ANDAMENTO', label: 'Em Andamento' },
    { value: 'EM_ANALISE', label: 'Em Análise' },
    { value: 'APROVADA', label: 'Aprovada' },
    { value: 'REPROVADA', label: 'Recusada' },
  ];

  async function refreshProject(showSpinner = false) {
    if (!id) {
      setError('ID do projeto não fornecido');
      setLoading(false);
      return;
    }

    if (showSpinner) {
      setLoading(true);
    }

    try {
      if (showSpinner) {
        setError(null);
      }
      const { data } = await api.get<ProjectDetails>(`/projects/${id}`);
      setProject(data);
    } catch (err: any) {
      const message = err.response?.data?.message ?? 'Erro ao carregar projeto';
      setError(message);
      if (!showSpinner) {
        throw err;
      }
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    async function loadUsers() {
      try {
        const { data } = await api.get<Usuario[]>('/users/options');
        setUsers(data);
      } catch (err) {
        console.error('Erro ao carregar usuários:', err);
      }
    }

    refreshProject(true);
    loadUsers();
  }, [id]);

  async function handleCreateEtapa(event: FormEvent) {
    event.preventDefault();
    if (!id || !project) return;

    setError(null);
    setSubmitting(true);

    try {
      const payload: any = {
        projetoId: Number(id),
        nome: etapaForm.nome.trim(),
        executorId: Number(etapaForm.executorId),
      };

      if (etapaForm.descricao && etapaForm.descricao.trim().length > 0) {
        payload.descricao = etapaForm.descricao.trim();
      }

      if (etapaForm.dataInicio) {
        payload.dataInicio = new Date(etapaForm.dataInicio).toISOString();
      }

      if (etapaForm.dataFim) {
        payload.dataFim = new Date(etapaForm.dataFim).toISOString();
      }

      if (etapaForm.valorInsumos && etapaForm.valorInsumos > 0) {
        payload.valorInsumos = Number(etapaForm.valorInsumos);
      }

      if (etapaForm.checklist && etapaForm.checklist.length > 0) {
        const checklistFiltrado = etapaForm.checklist
          .filter((item) => item.texto && item.texto.trim().length > 0)
          .map((item) => ({
            texto: item.texto.trim(),
            concluido: item.concluido || false,
          }));
        
        if (checklistFiltrado.length > 0) {
          payload.checklist = checklistFiltrado;
        }
      }

      if (etapaForm.integrantesIds && etapaForm.integrantesIds.length > 0) {
        payload.integrantesIds = etapaForm.integrantesIds;
      }

      if (editingEtapa && etapaForm.status) {
        payload.status = etapaForm.status as string;
      }

      if (editingEtapa) {
        await api.patch(`/tasks/${editingEtapa.id}`, payload);
      } else {
        await api.post('/tasks', payload);
      }

      setShowEtapaModal(false);
      setEditingEtapa(null);
      setEtapaForm({
        nome: '',
        descricao: '',
        executorId: 0,
        integrantesIds: [],
        dataInicio: '',
        dataFim: '',
        valorInsumos: 0,
        checklist: [{ texto: '', concluido: false }],
        status: 'PENDENTE',
      });

      // Recarregar o projeto
      await refreshProject();
    } catch (err: any) {
      let errorMessage = editingEtapa ? 'Erro ao atualizar etapa' : 'Erro ao criar etapa';
      if (err.response?.data?.message) {
        if (Array.isArray(err.response.data.message)) {
          errorMessage = err.response.data.message
            .map((msg: any) => {
              if (typeof msg === 'string') return msg;
              if (msg.constraints) {
                return Object.values(msg.constraints).join(', ');
              }
              return JSON.stringify(msg);
            })
            .join('. ');
        } else {
          errorMessage = err.response.data.message;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  function handleEditEtapa(etapa: Etapa) {
    setEditingEtapa(etapa);
    
    // Formatar datas para datetime-local
    const formatDateForInput = (dateString: string | null | undefined) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    setEtapaForm({
      nome: etapa.nome || '',
      descricao: etapa.descricao || '',
      executorId: etapa.executor?.id || 0,
      integrantesIds: etapa.integrantes ? etapa.integrantes.filter(i => i.usuario?.id).map((i) => i.usuario.id) : [],
      dataInicio: formatDateForInput(etapa.dataInicio),
      dataFim: formatDateForInput(etapa.dataFim),
      valorInsumos: etapa.valorInsumos || 0,
      checklist:
        etapa.checklistJson && Array.isArray(etapa.checklistJson) && etapa.checklistJson.length > 0
          ? etapa.checklistJson.map((item: any) => ({
              texto: item.texto || '',
              concluido: item.concluido || false,
            }))
          : [{ texto: '', concluido: false }],
      status: etapa.status || 'PENDENTE',
    });
    setShowEtapaModal(true);
  }

  async function handleChecklistUpdate(etapaId: number, checklistIndex: number, concluido: boolean) {
    if (!project) return;
    
    const etapa = project.etapas.find((e) => e.id === etapaId);
    if (!etapa || !etapa.checklistJson) return;

    const updatedChecklist = [...etapa.checklistJson];
    updatedChecklist[checklistIndex] = {
      ...updatedChecklist[checklistIndex],
      concluido,
    };

    try {
      setUpdatingChecklist(etapaId);
      await api.patch(`/tasks/${etapaId}/checklist`, {
        checklist: updatedChecklist,
      });
      
      await refreshProject();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Falha ao atualizar checklist');
    } finally {
      setUpdatingChecklist(null);
    }
  }

  function resetEntregaModal() {
    setEntregaDescricao('');
    setEntregaImagem(null);
    setEntregaPreview(null);
    setEntregaError(null);
    setEnviandoEntrega(false);
  }

  function handleOpenEntregaModal(etapa: Etapa) {
    setSelectedEntregaEtapa(etapa);
    resetEntregaModal();
    setShowEntregaModal(true);
  }

  function handleCloseEntregaModal() {
    setShowEntregaModal(false);
    setSelectedEntregaEtapa(null);
    resetEntregaModal();
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
      setEntregaError('Não foi possível ler a imagem. Tente novamente.');
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmitEntrega(event: FormEvent) {
    event.preventDefault();
    if (!selectedEntregaEtapa) return;

    setError(null);
    if (entregaDescricao.trim().length < 5) {
      setEntregaError('Descreva a entrega com pelo menos 5 caracteres.');
      return;
    }

    try {
      setEnviandoEntrega(true);
      setEntregaError(null);
      await api.post(`/tasks/${selectedEntregaEtapa.id}/deliver`, {
        descricao: entregaDescricao.trim(),
        imagem: entregaImagem ?? undefined,
      });
      handleCloseEntregaModal();
      await refreshProject();
    } catch (err: any) {
      setEntregaError(err.response?.data?.message ?? 'Falha ao enviar entrega.');
    } finally {
      setEnviandoEntrega(false);
    }
  }

  function handleReviewNoteChange(etapaId: number, value: string) {
    setReviewNotes((prev) => ({ ...prev, [etapaId]: value }));
  }

  async function handleApproveEtapa(etapaId: number) {
    setReviewLoading((prev) => ({ ...prev, [etapaId]: true }));
    try {
      setError(null);
      await api.post(`/tasks/${etapaId}/approve`, {
        comentario: reviewNotes[etapaId]?.trim() || undefined,
      });
      setReviewNotes((prev) => ({ ...prev, [etapaId]: '' }));
      await refreshProject();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Falha ao aprovar a entrega');
    } finally {
      setReviewLoading((prev) => ({ ...prev, [etapaId]: false }));
    }
  }

  async function handleRejectEtapa(etapaId: number) {
    setReviewLoading((prev) => ({ ...prev, [etapaId]: true }));
    try {
      setError(null);
      await api.post(`/tasks/${etapaId}/reject`, {
        reason: reviewNotes[etapaId]?.trim() || undefined,
      });
      setReviewNotes((prev) => ({ ...prev, [etapaId]: '' }));
      await refreshProject();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Falha ao recusar a entrega');
    } finally {
      setReviewLoading((prev) => ({ ...prev, [etapaId]: false }));
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'EM_ANDAMENTO':
        return 'bg-blue-500/20 text-blue-300';
      case 'FINALIZADO':
        return 'bg-green-500/20 text-green-300';
      case 'EM_ANALISE':
        return 'bg-purple-500/20 text-purple-300';
      case 'APROVADA':
      case 'ENTREGUE':
        return 'bg-green-500/20 text-green-300';
      case 'PENDENTE':
        return 'bg-yellow-500/20 text-yellow-300';
      case 'COMPRADO_ACAMINHO':
        return 'bg-blue-500/20 text-blue-300';
      case 'REPROVADA':
        return 'bg-red-500/20 text-red-300';
      default:
        return 'bg-gray-500/20 text-gray-300';
    }
  }

  function getStatusLabel(status: string) {
    const labels: Record<string, string> = {
      EM_ANDAMENTO: 'Em Andamento',
      FINALIZADO: 'Finalizado',
      PENDENTE: 'Pendente',
      EM_ANALISE: 'Em Análise',
      APROVADA: 'Aprovada',
      REPROVADA: 'Recusada',
      COMPRADO_ACAMINHO: 'Comprado/A Caminho',
      ENTREGUE: 'Entregue',
    };
    return labels[status] || status;
  }

  function getEntregaStatusColor(status: string) {
    switch (status) {
      case 'EM_ANALISE':
        return 'bg-purple-500/20 text-purple-300 border border-purple-500/40';
      case 'APROVADA':
        return 'bg-green-500/20 text-green-300 border border-green-500/40';
      case 'RECUSADA':
        return 'bg-red-500/20 text-red-300 border border-red-500/40';
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
      <div className="flex items-center justify-center h-64">
        <p className="text-white/70">Carregando detalhes do projeto...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/projects')}
          className="text-primary hover:text-primary/80 flex items-center space-x-2"
        >
          <span>←</span>
          <span>Voltar para Projetos</span>
        </button>
        <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-md">
          {error ?? 'Projeto não encontrado'}
        </div>
      </div>
    );
  }

  const totalEtapas = project.etapas.length;
  const etapasConcluidas = project.etapas.filter((e) => e.status === 'EM_ANALISE' || e.status === 'APROVADA').length;
  const progresso = totalEtapas > 0 ? Math.round((etapasConcluidas / totalEtapas) * 100) : 0;

  const projectStatusForDisplay = progresso === 0
    ? 'PENDENTE'
    : progresso === 100
      ? 'FINALIZADO'
      : project.status;

  const projectStatusLabel = getStatusLabel(projectStatusForDisplay);
  const projectStatusColor = getStatusColor(projectStatusForDisplay);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/projects')}
            className="text-primary hover:text-primary/80 transition-colors"
          >
            ← Voltar
          </button>
          <div>
            <h2 className="text-2xl font-bold">{project.nome}</h2>
            <span className={`px-2 py-1 rounded text-xs ${projectStatusColor}`}>
              {projectStatusLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Informações Gerais */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-neutral/80 border border-white/10 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold border-b border-white/10 pb-2">Informações Gerais</h3>
          
          <div>
            <label className="text-sm text-white/70">Resumo</label>
            <p className="mt-1 text-white/90">{project.resumo || '—'}</p>
          </div>

          <div>
            <label className="text-sm text-white/70">Objetivo</label>
            <p className="mt-1 text-white/90">{project.objetivo || '—'}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/10">
            <div>
              <label className="text-sm text-white/70">Valor Total</label>
              <p className="mt-1 text-lg font-semibold text-primary">
                {project.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
            <div>
              <label className="text-sm text-white/70">Valor Insumos</label>
              <p className="mt-1 text-lg font-semibold">
                {project.valorInsumos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10">
            <label className="text-sm text-white/70">Data de Criação</label>
            <p className="mt-1">
              {new Date(project.dataCriacao).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>

        <div className="bg-neutral/80 border border-white/10 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold border-b border-white/10 pb-2">Equipe</h3>
          
          <div>
            <label className="text-sm text-white/70">Supervisor</label>
            <p className="mt-1 text-white/90">
              {project.supervisor ? (
                <span>
                  {project.supervisor.nome} <span className="text-white/50">({project.supervisor.email})</span>
                </span>
              ) : (
                '—'
              )}
            </p>
          </div>

          <div>
            <label className="text-sm text-white/70">
              Responsáveis ({project.responsaveis.length})
            </label>
            {project.responsaveis.length > 0 ? (
              <div className="mt-2 space-y-1">
                {project.responsaveis.map((resp) => {
                  if (!resp.usuario) return null;
                  const cargoNome = typeof resp.usuario.cargo === 'string' 
                    ? resp.usuario.cargo 
                    : (resp.usuario.cargo?.nome || 'Sem cargo');
                  return (
                    <div key={resp.id} className="text-sm text-white/90">
                      • {resp.usuario.nome} <span className="text-white/50">({cargoNome})</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-1 text-white/50">Nenhum responsável atribuído</p>
            )}
          </div>
        </div>
      </div>

      {/* Progresso */}
      {totalEtapas > 0 && (
        <div className="bg-neutral/80 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">Progresso do Projeto</h3>
            <span className="text-sm text-white/70">
              {etapasConcluidas} de {totalEtapas} etapas concluídas
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3">
            <div
              className="bg-primary h-3 rounded-full transition-all"
              style={{ width: `${progresso}%` }}
            />
          </div>
          <p className="text-sm text-white/70 mt-2">{progresso}% concluído</p>
        </div>
      )}

      {/* Etapas */}
      <div className="bg-neutral/80 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold border-b border-white/10 pb-2">
          Etapas ({totalEtapas})
        </h3>
          {isDiretor && (
            <button
              onClick={() => {
                setEditingEtapa(null);
                setEtapaForm({
                  nome: '',
                  descricao: '',
                  executorId: 0,
                  integrantesIds: [],
                  dataInicio: '',
                  dataFim: '',
                  valorInsumos: 0,
                  checklist: [{ texto: '', concluido: false }],
                  status: 'PENDENTE',
                });
                setShowEtapaModal(true);
              }}
              className={buttonStyles.primary}
            >
              + Adicionar Etapa
            </button>
          )}
        </div>
        {project.etapas.length === 0 ? (
          <p className="text-white/50 text-center py-8">Nenhuma etapa cadastrada</p>
        ) : (
          <div className="space-y-4">
            {project.etapas.map((etapa) => {
              const latestEntrega = etapa.entregas && etapa.entregas.length > 0 ? etapa.entregas[0] : null;
              // Comparar convertendo ambos para número para evitar problemas de tipo
              const executorId = etapa.executor?.id;
              const isExecutor = user?.id && executorId && Number(user.id) === Number(executorId);
              
              // Verificar se há itens do checklist marcados
              const checklistItems = etapa.checklistJson && Array.isArray(etapa.checklistJson) 
                ? etapa.checklistJson 
                : [];
              const itensMarcados = checklistItems.filter((item) => item.concluido).length;
              const temItensMarcados = itensMarcados > 0;
              const totalItens = checklistItems.length;
              
              // Na página de projetos, permitir marcar checkboxes livremente
              // Mas só permitir enviar entrega se for executor e tiver itens marcados
              const canEnviarEntrega = 
                isExecutor && 
                ['PENDENTE', 'EM_ANDAMENTO', 'REPROVADA'].includes(etapa.status) &&
                temItensMarcados;
              
              // Permitir marcar checklist livremente (sem restrição de executor)
              const podeMarcarChecklist = true;
              const awaitingReview = latestEntrega?.status === 'EM_ANALISE';
              const reviewValue = reviewNotes[etapa.id] ?? '';
              const isReviewing = reviewLoading[etapa.id] ?? false;

              return (
                <div key={etapa.id} className="bg-neutral/60 border border-white/10 rounded-lg p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-white/90">{etapa.nome}</h4>
                      {etapa.descricao && (
                        <p className="text-sm text-white/70 mt-1">{etapa.descricao}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-start md:items-end gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(etapa.status)}`}>
                          {getStatusLabel(etapa.status)}
                        </span>
                        {isDiretor && (
                          <button onClick={() => handleEditEtapa(etapa)} className={buttonStyles.edit}>
                            Editar
                          </button>
                        )}
                      </div>
                      {isExecutor && etapa.status === 'EM_ANALISE' && (
                        <span className="text-xs text-white/60">Aguardando avaliação do supervisor</span>
                      )}
                      {isExecutor && 
                       ['PENDENTE', 'EM_ANDAMENTO', 'REPROVADA'].includes(etapa.status) && 
                       !temItensMarcados && 
                       totalItens > 0 && (
                        <span className="text-xs text-yellow-400">
                          Marque itens do checklist para enviar
                        </span>
                      )}
                      {canEnviarEntrega && (
                        <button
                          type="button"
                          onClick={() => handleOpenEntregaModal(etapa)}
                          className="px-3 py-1 rounded-md bg-primary/20 hover:bg-primary/30 text-primary text-xs border border-primary/30 transition-colors"
                        >
                          Enviar entrega ({itensMarcados}/{totalItens})
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-sm text-white/70">
                    {etapa.executor && (
                      <div>
                        <span className="font-medium">Executor:</span> {etapa.executor.nome} ({typeof etapa.executor.cargo === 'string' ? etapa.executor.cargo : (etapa.executor.cargo?.nome || 'Sem cargo')})
                      </div>
                    )}
                    {etapa.integrantes && etapa.integrantes.length > 0 && (
                      <div>
                        <span className="font-medium">Integrantes:</span>{' '}
                        {etapa.integrantes.map((i, idx) => {
                          if (!i.usuario) return null;
                          return (
                            <span key={i.usuario.id || idx}>
                              {i.usuario.nome}
                              {idx < etapa.integrantes.length - 1 ? ', ' : ''}
                            </span>
                          );
                        })}
                      </div>
                    )}
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
                    {etapa.valorInsumos && etapa.valorInsumos > 0 && (
                      <div>
                        <span className="font-medium">Valor Insumos:</span>{' '}
                        {etapa.valorInsumos.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </div>
                    )}
                  </div>

                  {latestEntrega ? (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="flex items-start justify-between gap-3">
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
                      <p className="mt-2 text-sm text-white/80 whitespace-pre-wrap">{latestEntrega.descricao}</p>
                      {latestEntrega.imagemUrl && (
                        <img
                          src={latestEntrega.imagemUrl}
                          alt={`Entrega da etapa ${etapa.nome}`}
                          className="mt-3 rounded-md border border-white/10 max-h-64 object-cover"
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

                      {awaitingReview && canReview && (
                        <div className="mt-4 p-4 border border-white/20 rounded-lg bg-white/5 space-y-3">
                          <label className="text-sm font-medium text-white/80 block">
                            Avaliação da etapa
                          </label>
                          <textarea
                            value={reviewValue}
                            onChange={(e) => handleReviewNoteChange(etapa.id, e.target.value)}
                            rows={3}
                            placeholder="Adicione um comentário (opcional)"
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => handleRejectEtapa(etapa.id)}
                              disabled={isReviewing}
                              className="px-4 py-2 rounded-md bg-danger/20 hover:bg-danger/30 text-danger text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isReviewing ? 'Processando...' : 'Recusar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApproveEtapa(etapa.id)}
                              disabled={isReviewing}
                              className="px-4 py-2 rounded-md bg-success/20 hover:bg-success/30 text-success text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isReviewing ? 'Processando...' : 'Aprovar'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    isExecutor && (
                      <div className="mt-3 pt-3 border-t border-dashed border-white/20 text-sm text-white/60">
                        Você ainda não enviou uma entrega para esta etapa. Clique em "Enviar entrega" para encaminhar ao supervisor.
                      </div>
                    )
                  )}

                  {etapa.checklistJson && Array.isArray(etapa.checklistJson) && etapa.checklistJson.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-white/70 block font-medium">
                          Checklist de Objetos ({etapa.checklistJson.length})
                          {isExecutor && (
                            <span className="text-white/50 text-xs ml-2">(Você pode marcar os itens)</span>
                          )}
                        </label>
                        {isExecutor && totalItens > 0 && (
                          <span className="text-xs text-white/60">
                            {itensMarcados} de {totalItens} marcado{itensMarcados !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {etapa.checklistJson.map((item: { texto: string; concluido?: boolean }, index: number) => {
                          const entregaItem = etapa.checklistEntregas?.find((e) => e.checklistIndex === index);
                          const statusItem = entregaItem?.status ?? 'PENDENTE';
                          const canApprove = canReview && statusItem === 'EM_ANALISE';
                          return (
                            <div
                              key={index}
                              className={`flex items-center gap-2 text-sm ${isExecutor ? 'hover:bg-white/5 p-1 rounded' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={item.concluido || false}
                                onChange={(e) => handleChecklistUpdate(etapa.id, index, e.target.checked)}
                                disabled={updatingChecklist === etapa.id}
                                className="w-4 h-4 rounded border-white/30 bg-white/10 text-primary focus:ring-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <span className={item.concluido ? 'text-white/50 line-through' : 'text-white/80'}>
                                {item.texto}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] border ml-1 ${
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
                              {canApprove && (
                                <div className="ml-2 flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        setReviewLoading((prev) => ({ ...prev, [`${etapa.id}-${index}`]: true } as any));
                                        await api.patch(`/tasks/${etapa.id}/checklist/${index}/review`, {
                                          status: 'APROVADO',
                                          comentario: reviewNotes[`${etapa.id}-${index}` as any]?.trim() || undefined,
                                        });
                                        setReviewNotes((prev) => ({ ...prev, [`${etapa.id}-${index}`]: '' } as any));
                                        await refreshProject();
                                      } catch (err: any) {
                                        setError(err.response?.data?.message ?? 'Falha ao aprovar objetivo');
                                      } finally {
                                        setReviewLoading((prev) => ({ ...prev, [`${etapa.id}-${index}`]: false } as any));
                                      }
                                    }}
                                    className="px-2 py-0.5 rounded text-xs bg-success/20 hover:bg-success/30 text-success border border-success/30"
                                  >
                                    Aprovar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        setReviewLoading((prev) => ({ ...prev, [`${etapa.id}-${index}`]: true } as any));
                                        await api.patch(`/tasks/${etapa.id}/checklist/${index}/review`, {
                                          status: 'REPROVADO',
                                          comentario: reviewNotes[`${etapa.id}-${index}` as any]?.trim() || undefined,
                                        });
                                        await refreshProject();
                                      } catch (err: any) {
                                        setError(err.response?.data?.message ?? 'Falha ao recusar objetivo');
                                      } finally {
                                        setReviewLoading((prev) => ({ ...prev, [`${etapa.id}-${index}`]: false } as any));
                                      }
                                    }}
                                    className="px-2 py-0.5 rounded text-xs bg-danger/20 hover:bg-danger/30 text-danger border border-danger/30"
                                  >
                                    Recusar
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {isExecutor && 
                       ['PENDENTE', 'EM_ANDAMENTO', 'REPROVADA'].includes(etapa.status) && 
                       !temItensMarcados && (
                        <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
                          <p className="text-xs text-yellow-300">
                            💡 Como executor, marque pelo menos um item do checklist para poder enviar a entrega com descrição e imagem.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {etapa.subetapas.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <label className="text-xs text-white/70 mb-2 block">
                        Subetapas ({etapa.subetapas.length})
                      </label>
                      <div className="space-y-1">
                        {etapa.subetapas.map((sub) => (
                          <div key={sub.id} className="text-sm text-white/80 flex items-center justify-between">
                            <span>• {sub.nome}</span>
                            <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(sub.status)}`}>
                              {getStatusLabel(sub.status)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Compras */}
      {project.compras.length > 0 && (
        <div className="bg-neutral/80 border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold border-b border-white/10 pb-2 mb-4">
            Compras Relacionadas ({project.compras.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white/5 text-white/70">
                <tr>
                  <th className="px-4 py-2 text-left">Item</th>
                  <th className="px-4 py-2 text-left">Quantidade</th>
                  <th className="px-4 py-2 text-left">Valor Unitário</th>
                  <th className="px-4 py-2 text-left">Total</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {project.compras.map((compra) => (
                  <tr key={compra.id} className="border-t border-white/5">
                    <td className="px-4 py-2">{compra.item}</td>
                    <td className="px-4 py-2">{compra.quantidade}</td>
                    <td className="px-4 py-2">
                      {compra.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-2 font-semibold">
                      {(compra.quantidade * compra.valorUnitario).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(compra.status)}`}>
                        {getStatusLabel(compra.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Modal Enviar Entrega */}
      {showEntregaModal && selectedEntregaEtapa && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-white/20 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Enviar entrega</h2>
                <p className="text-sm text-white/60 mt-1">{selectedEntregaEtapa.nome}</p>
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
                  disabled={enviandoEntrega}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-primary hover:bg-primary/80 text-white text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={enviandoEntrega}
                >
                  {enviandoEntrega ? 'Enviando...' : 'Enviar para revisão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Adicionar Etapa */}
      {showEtapaModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral border-b border-white/20 px-8 py-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                {editingEtapa ? 'Editar Etapa' : 'Adicionar Etapa'}
              </h2>
              <button
                onClick={() => {
                  setShowEtapaModal(false);
                  setError(null);
                  setEditingEtapa(null);
                  setEtapaForm({
                    nome: '',
                    descricao: '',
                    executorId: 0,
                    integrantesIds: [],
                    dataInicio: '',
                    dataFim: '',
                    valorInsumos: 0,
                    checklist: [{ texto: '', concluido: false }],
                    status: 'PENDENTE',
                  });
                }}
                className="text-white/50 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateEtapa} className="p-8 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Nome da Etapa *</label>
                <input
                  type="text"
                  required
                  value={etapaForm.nome}
                  onChange={(e) => setEtapaForm({ ...etapaForm, nome: e.target.value })}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Ex: Planejamento inicial"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Descrição</label>
                <textarea
                  value={etapaForm.descricao}
                  onChange={(e) => setEtapaForm({ ...etapaForm, descricao: e.target.value })}
                  rows={4}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Descreva os objetivos e detalhes desta etapa..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Responsável *</label>
                <select
                  required
                  value={etapaForm.executorId}
                  onChange={(e) => setEtapaForm({ ...etapaForm, executorId: Number(e.target.value) })}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="0" className="bg-neutral text-white">Selecione um responsável...</option>
                  {users.map((user) => {
                    if (!user) return null;
                    const cargoNome = typeof user.cargo === 'string' 
                      ? user.cargo 
                      : (user.cargo?.nome || 'Sem cargo');
                    return (
                      <option key={user.id} value={user.id} className="bg-neutral text-white">
                        {user.nome} ({cargoNome})
                      </option>
                    );
                  })}
                </select>
              </div>

              {editingEtapa && isDiretor && (
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">Status da Etapa</label>
                  <select
                    value={etapaForm.status}
                    onChange={(e) => setEtapaForm({ ...etapaForm, status: e.target.value })}
                    className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value} className="bg-neutral text-white">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Integrantes (Auxiliares)</label>
                <select
                  ref={integrantesSelectRef}
                  value=""
                  onChange={(e) => {
                    const selectedUserId = Number(e.target.value);
                    if (selectedUserId && !etapaForm.integrantesIds.includes(selectedUserId)) {
                      setEtapaForm({
                        ...etapaForm,
                        integrantesIds: [...etapaForm.integrantesIds, selectedUserId],
                      });
                    }
                    // Resetar o select após seleção
                    if (integrantesSelectRef.current) {
                      integrantesSelectRef.current.value = '';
                    }
                  }}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="" className="bg-neutral text-white">Selecione um integrante...</option>
                  {users
                    .filter((user) => user && user.id !== etapaForm.executorId && !etapaForm.integrantesIds.includes(user.id))
                    .map((user) => {
                      if (!user) return null;
                      const cargoNome = typeof user.cargo === 'string' 
                        ? user.cargo 
                        : (user.cargo?.nome || 'Sem cargo');
                      return (
                        <option key={user.id} value={user.id} className="bg-neutral text-white">
                          {user.nome} ({cargoNome})
                        </option>
                      );
                    })}
                </select>
                {etapaForm.integrantesIds.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {etapaForm.integrantesIds.map((integranteId) => {
                      const integrante = users.find((u) => u && u.id === integranteId);
                      if (!integrante) return null;
                      const cargoNome = typeof integrante.cargo === 'string' 
                        ? integrante.cargo 
                        : (integrante.cargo?.nome || 'Sem cargo');
                      return (
                        <div
                          key={integranteId}
                          className="flex items-center justify-between bg-white/5 border border-white/10 rounded-md px-3 py-2"
                        >
                          <span className="text-sm text-white/90">
                            {integrante.nome} ({cargoNome})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEtapaForm({
                                ...etapaForm,
                                integrantesIds: etapaForm.integrantesIds.filter((id) => id !== integranteId),
                              });
                            }}
                            className="text-danger hover:text-danger/80 text-sm font-medium transition-colors"
                          >
                            Remover
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {etapaForm.integrantesIds.length === 0 && (
                  <p className="text-xs text-white/50 mt-2">Nenhum integrante adicionado ainda</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">Data Início</label>
                  <input
                    type="datetime-local"
                    value={etapaForm.dataInicio}
                    onChange={(e) => setEtapaForm({ ...etapaForm, dataInicio: e.target.value })}
                    className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">Data Fim</label>
                  <input
                    type="datetime-local"
                    value={etapaForm.dataFim}
                    onChange={(e) => setEtapaForm({ ...etapaForm, dataFim: e.target.value })}
                    className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Valor de Insumos (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={etapaForm.valorInsumos}
                  onChange={(e) => setEtapaForm({ ...etapaForm, valorInsumos: Number(e.target.value) })}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Checklist de Objetos</label>
                <div className="space-y-2">
                  {etapaForm.checklist.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={item.texto}
                        onChange={(e) => {
                          const newChecklist = [...etapaForm.checklist];
                          newChecklist[index] = { ...newChecklist[index], texto: e.target.value };
                          setEtapaForm({ ...etapaForm, checklist: newChecklist });
                        }}
                        className="flex-1 bg-white/10 border border-white/30 rounded-md px-4 py-2 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        placeholder={`Objeto ${index + 1}`}
                      />
                      {etapaForm.checklist.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newChecklist = etapaForm.checklist.filter((_, i) => i !== index);
                            setEtapaForm({ ...etapaForm, checklist: newChecklist });
                          }}
                          className={buttonStyles.danger}
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setEtapaForm({
                        ...etapaForm,
                        checklist: [...etapaForm.checklist, { texto: '', concluido: false }],
                      });
                    }}
                    className={`${buttonStyles.secondary} w-full text-center`}
                  >
                    + Adicionar Item
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-md text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end space-x-4 pt-4 border-t border-white/20">
                <button
                  type="button"
                  onClick={() => {
                    setShowEtapaModal(false);
                    setError(null);
                    setEditingEtapa(null);
                    setEtapaForm({
                      nome: '',
                      descricao: '',
                      executorId: 0,
                      dataInicio: '',
                      dataFim: '',
                      valorInsumos: 0,
                      checklist: [{ texto: '', concluido: false }],
                      status: 'PENDENTE',
                    });
                  }}
                  className={buttonStyles.secondary}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`${buttonStyles.primary} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {submitting ? (editingEtapa ? 'Salvando...' : 'Criando...') : editingEtapa ? 'Salvar Alterações' : 'Criar Etapa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

