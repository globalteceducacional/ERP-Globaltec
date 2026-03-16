import { useEffect, useState, FormEvent, useRef, ChangeEvent, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../store/auth';
import { ChecklistItemEntrega, ChecklistItem, ChecklistSubItem, ProjetoArquivo } from '../types';
import { btn } from '../utils/buttonStyles';
import { DataTable, DataTableColumn } from '../components/DataTable';
import { FileDropInput } from '../components/FileDropInput';
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

interface Sessao {
  id: number;
  projetoId: number;
  nome: string;
  ordem: number;
}

interface Etapa {
  id: number;
  nome: string;
  descricao?: string | null;
  sessaoId?: number | null;
  aba?: string | null;
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'EM_ANALISE' | 'APROVADA' | 'REPROVADA';
  dataInicio?: string | null;
  dataFim?: string | null;
  valorInsumos?: number;
  checklistJson?: ChecklistItem[] | null;
  executor: Usuario;
  responsavel?: Usuario | null;
  sessao?: Sessao | null;
  integrantes?: Array<{ usuario: Usuario }>;
  subetapas: Subetapa[];
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
  executor: Usuario;
  avaliadoPor?: Usuario | null;
  foiEditada?: boolean;
  dataEdicao?: string | null;
  editadoPor?: Usuario | null;
}

interface Responsavel {
  id: number;
  usuario: Usuario;
}

interface Compra {
  id: number;
  item: string;
  quantidade: number;
  valorUnitario: number | null;
  status: string;
  nfUrl?: string | null;
  comprovantePagamentoUrl?: string | null;
  motivoRejeicao?: string | null;
  etapaId?: number | null;
  etapa?: { id: number; nome: string } | null;
}

interface ProjectDetails {
  id: number;
  nome: string;
  resumo?: string | null;
  objetivo?: string | null;
  descricaoLonga?: string | null;
  descricaoArquivos?: ProjetoArquivo[] | null;
  status: 'EM_ANDAMENTO' | 'FINALIZADO';
  valorTotal: number;
  valorInsumos: number;
  dataCriacao: string;
  supervisor?: Usuario | null;
  responsaveis: Responsavel[];
  sessoes?: Sessao[];
  etapas: Etapa[];
  compras: Compra[];
}

interface EditProjectForm {
  nome: string;
  resumo?: string;
  objetivo?: string;
  valorTotal?: number;
  supervisorId?: number;
  responsavelIds: number[];
  status?: 'EM_ANDAMENTO' | 'FINALIZADO';
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
  const [projectDescricaoTexto, setProjectDescricaoTexto] = useState<string>('');
  const [projectDescricaoArquivos, setProjectDescricaoArquivos] = useState<ProjetoArquivo[]>([]);
  const [projectDescricaoSaving, setProjectDescricaoSaving] = useState(false);
  const [projectDescricaoError, setProjectDescricaoError] = useState<string | null>(null);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editProjectForm, setEditProjectForm] = useState<EditProjectForm>({
    nome: '',
    resumo: '',
    objetivo: '',
    valorTotal: undefined,
    supervisorId: undefined,
    responsavelIds: [],
    status: 'EM_ANDAMENTO',
  });
  const [editProjectSubmitting, setEditProjectSubmitting] = useState(false);
  const [editProjectError, setEditProjectError] = useState<string | null>(null);
  // Nota: a edição de entregas de checklist é feita pela tela Meu Trabalho.
  // Este componente não possui o fluxo completo de envio/edição de objetivos,
  // portanto qualquer tentativa de editar a entrega a partir daqui é desabilitada.

  const cargoNome =
    typeof user?.cargo === 'string'
      ? user.cargo
      : user?.cargo && typeof user.cargo === 'object' && 'nome' in user.cargo
        ? user.cargo.nome
        : undefined;

  const isDiretor = cargoNome === 'DIRETOR' || cargoNome === 'GM';
  const isSupervisor = cargoNome === 'SUPERVISOR';
  const permissionKeys = useMemo(() => {
    if (!user) {
      return new Set<string>();
    }

    const cargoData =
      typeof user.cargo === 'string'
        ? null
        : user.cargo && typeof user.cargo === 'object'
          ? (user.cargo as any)
          : null;

    if (!cargoData || !Array.isArray(cargoData.permissions)) {
      return new Set<string>();
    }

    return new Set<string>(
      cargoData.permissions.map((permission: any) => permission.chave ?? `${permission.modulo}:${permission.acao}`),
    );
  }, [user]);

  const canReview = isDiretor || isSupervisor || permissionKeys.has('trabalhos:avaliar');
  const canEditProject = isDiretor || permissionKeys.has('projetos:editar');
  const [reorderingEtapas, setReorderingEtapas] = useState(false);
  const [openEtapaMenuId, setOpenEtapaMenuId] = useState<number | null>(null);
  /** IDs das etapas expandidas (conteúdo visível). Inicializado com todas ao carregar o projeto. */
  const [expandedEtapas, setExpandedEtapas] = useState<Set<number>>(new Set());
  const [expandedDescricaoEtapas, setExpandedDescricaoEtapas] = useState<Set<number>>(new Set());
  const [extraAbas, setExtraAbas] = useState<string[]>([]);
  const [selectedAba, setSelectedAba] = useState<string>('Todas');
  // Sessão: 'all' = todas, null = sem sessão, number = id da sessão
  const [selectedSessaoId, setSelectedSessaoId] = useState<number | null | 'all'>('all');

  useEffect(() => {
    if (project?.etapas?.length) {
      setExpandedEtapas(new Set(project.etapas.map((e) => e.id)));
    }
  }, [project?.id, project?.etapas?.length]);

  useEffect(() => {
    if (!project) return;
    setProjectDescricaoTexto(project.descricaoLonga ?? '');
    const arquivos = Array.isArray(project.descricaoArquivos) ? project.descricaoArquivos : [];
    setProjectDescricaoArquivos(arquivos);
  }, [project?.id]);

  function openEditProjectModal() {
    if (!project) return;
    setEditProjectForm({
      nome: project.nome,
      resumo: project.resumo ?? '',
      objetivo: project.objetivo ?? '',
      valorTotal: project.valorTotal ?? undefined,
      supervisorId: project.supervisor?.id ?? undefined,
      responsavelIds: project.responsaveis
        ? project.responsaveis
            .filter((r) => !!r.usuario)
            .map((r) => r.usuario.id)
        : [],
      status: project.status,
    });
    setEditProjectError(null);
    setShowEditProjectModal(true);
  }

  async function handleSubmitEditProject(event: FormEvent) {
    event.preventDefault();
    if (!project) return;

    try {
      setEditProjectSubmitting(true);
      setEditProjectError(null);

      const payload: any = {
        nome: editProjectForm.nome.trim(),
      };

      if (typeof editProjectForm.resumo === 'string') {
        payload.resumo = editProjectForm.resumo?.trim() ?? '';
      }
      if (typeof editProjectForm.objetivo === 'string') {
        payload.objetivo = editProjectForm.objetivo?.trim() ?? '';
      }
      if (typeof editProjectForm.valorTotal === 'number') {
        payload.valorTotal = editProjectForm.valorTotal;
      }
      if (typeof editProjectForm.supervisorId !== 'undefined') {
        payload.supervisorId = editProjectForm.supervisorId;
      }
      if (editProjectForm.status) {
        payload.status = editProjectForm.status;
      }

      payload.descricaoLonga = projectDescricaoTexto?.trim() || null;
      // descricaoArquivos agora é gerenciado separadamente pelos endpoints específicos

      // eslint-disable-next-line no-console
      console.log('[ProjectDetails] handleSubmitEditProject payload', {
        id: project.id,
      });

      await api.patch(`/projects/${project.id}`, payload);

      await api.patch(`/projects/${project.id}/responsibles`, {
        responsavelIds: editProjectForm.responsavelIds,
      });

      await refreshProject(false);
      toast.success('Projeto atualizado com sucesso!');
      setShowEditProjectModal(false);
    } catch (err: any) {
      const message = formatApiError(err);
      setEditProjectError(message);
      toast.error(message);
    } finally {
      setEditProjectSubmitting(false);
    }
  }

  // Projeto novo: uma sessão "Geral" → selecionar essa sessão por padrão (evita "Sem sessão" / "Todas")
  useEffect(() => {
    if (!project?.sessoes?.length || project.sessoes.length !== 1) return;
    const hasEtapaSemSessao = (project?.etapas ?? []).some((e) => e.sessaoId == null);
    if (!hasEtapaSemSessao) {
      setSelectedSessaoId(project.sessoes[0].id);
    }
  }, [project?.id, project?.sessoes, project?.etapas]);

  // Ao trocar de sessão, voltar aba para "Todas" para que as abas exibidas sejam só as dessa sessão
  useEffect(() => {
    setSelectedAba('Todas');
  }, [selectedSessaoId]);

  // Etapas filtradas pela sessão selecionada (Sessão → Abas → Etapas)
  const etapasPorSessao = useMemo(() => {
    if (!project?.etapas) return [];
    if (selectedSessaoId === 'all') return project.etapas;
    return project.etapas.filter((etapa) => {
      if (selectedSessaoId === null) return etapa.sessaoId == null;
      return etapa.sessaoId === selectedSessaoId;
    });
  }, [project?.etapas, selectedSessaoId]);

  // Abas apenas da sessão selecionada — cada sessão tem suas próprias abas
  const abas = useMemo(() => {
    const set = new Set<string>();
    etapasPorSessao.forEach((etapa) => {
      const nomeAba = (etapa.aba && etapa.aba.trim()) || 'Geral';
      set.add(nomeAba);
    });
    // extraAbas só na visão "Todas" as sessões, para não misturar abas de outras sessões
    if (selectedSessaoId === 'all') {
      extraAbas.forEach((aba) => {
        if (aba && aba.trim().length > 0) set.add(aba.trim());
      });
    }
    const nomesOrdenados = Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return ['Todas', ...nomesOrdenados];
  }, [etapasPorSessao, extraAbas, selectedSessaoId]);

  const etapasFiltradas = useMemo(() => {
    if (etapasPorSessao.length === 0) return [];
    if (selectedAba === 'Todas') return etapasPorSessao;
    return etapasPorSessao.filter((etapa) => {
      const nomeAba = (etapa.aba && etapa.aba.trim()) || 'Geral';
      return nomeAba === selectedAba;
    });
  }, [etapasPorSessao, selectedAba]);

  function handleAddAba() {
    if (!project) return;
    setNovaAbaNome('');
    setShowAbaModal(true);
  }

  function handleOpenRenameAba() {
    if (!project || selectedAba === 'Todas') return;
    setRenameAbaNome(selectedAba);
    setShowRenameAbaModal(true);
  }

  function handleOpenDeleteAba() {
    if (!project || selectedAba === 'Todas') return;
    setShowDeleteAbaModal(true);
  }

  async function handleConfirmNovaAba(event: FormEvent) {
    event.preventDefault();
    if (!project) return;

    const trimmed = novaAbaNome.trim();
    if (!trimmed || trimmed.length < 2) {
      toast.warning('Informe um nome de aba com pelo menos 2 caracteres.');
      return;
    }

    // Adicionar aba à lista extra (somente frontend) caso ainda não exista
    setExtraAbas((prev) => {
      const existing = new Set(prev.map((a) => a.trim()));
      if (!existing.has(trimmed)) {
        return [...prev, trimmed];
      }
      return prev;
    });

    setSelectedAba(trimmed);
    setShowAbaModal(false);
    toast.success('Aba criada com sucesso. Agora você pode adicionar etapas nela.');
  }

  async function handleCreateSessao(e: FormEvent) {
    e.preventDefault();
    if (!project) return;
    const nome = novaSessaoNome.trim();
    if (!nome || nome.length < 2) {
      toast.warning('Informe um nome de sessão com pelo menos 2 caracteres.');
      return;
    }
    setSessaoModalLoading(true);
    try {
      await api.post(`/projects/${project.id}/sessoes`, { nome, ordem: (project.sessoes?.length ?? 0) });
      setNovaSessaoNome('');
      setShowSessaoModal(false);
      await refreshProject(false);
      toast.success('Sessão criada.');
    } catch (err: any) {
      toast.error(formatApiError(err));
    } finally {
      setSessaoModalLoading(false);
    }
  }

  async function handleUpdateSessao(e: FormEvent) {
    e.preventDefault();
    if (!project || !editingSessao) return;
    const nome = editSessaoNome.trim();
    if (!nome || nome.length < 2) {
      toast.warning('Informe um nome com pelo menos 2 caracteres.');
      return;
    }
    setSessaoModalLoading(true);
    try {
      await api.patch(`/projects/${project.id}/sessoes/${editingSessao.id}`, { nome });
      setEditingSessao(null);
      setEditSessaoNome('');
      await refreshProject(false);
      toast.success('Sessão atualizada.');
    } catch (err: any) {
      toast.error(formatApiError(err));
    } finally {
      setSessaoModalLoading(false);
    }
  }

  async function handleDeleteSessao() {
    if (!project || !sessaoToDelete) return;
    setSessaoModalLoading(true);
    try {
      await api.delete(`/projects/${project.id}/sessoes/${sessaoToDelete.id}`);
      setShowDeleteSessaoModal(false);
      setSessaoToDelete(null);
      if (selectedSessaoId === sessaoToDelete.id) setSelectedSessaoId('all');
      await refreshProject(false);
      toast.success('Sessão excluída.');
    } catch (err: any) {
      toast.error(formatApiError(err));
    } finally {
      setSessaoModalLoading(false);
    }
  }

  function toggleEtapa(etapaId: number) {
    setExpandedEtapas((prev) => {
      const next = new Set(prev);
      if (next.has(etapaId)) next.delete(etapaId);
      else next.add(etapaId);
      return next;
    });
  }

  const [etapaForm, setEtapaForm] = useState({
    nome: '',
    descricao: '',
    sessaoId: undefined as number | undefined,
    aba: '',
    executorId: 0,
    responsavelId: 0 as number | undefined,
    integrantesIds: [] as number[],
    dataInicio: '',
    dataFim: '',
    valorInsumos: 0,
    checklist: [{ texto: '', concluido: false, descricao: '', subitens: [] as ChecklistSubItem[] }] as ChecklistItem[],
    status: 'PENDENTE' as string,
    estoqueItems: [] as Array<{ itemId: number; quantidade: number }>,
  });
  const [availableStockItems, setAvailableStockItems] = useState<any[]>([]);
  const [loadingStockItems, setLoadingStockItems] = useState(false);
  const [stockSearchTerm, setStockSearchTerm] = useState('');
  const [selectedStockItemId, setSelectedStockItemId] = useState<number | null>(null);
  const [selectedStockQuantity, setSelectedStockQuantity] = useState<number>(1);
  const [showAbaModal, setShowAbaModal] = useState(false);
  const [novaAbaNome, setNovaAbaNome] = useState('');
  const [showRenameAbaModal, setShowRenameAbaModal] = useState(false);
  const [renameAbaNome, setRenameAbaNome] = useState('');
  const [showDeleteAbaModal, setShowDeleteAbaModal] = useState(false);
  const [abaModalLoading, setAbaModalLoading] = useState(false);
  const [showSessaoModal, setShowSessaoModal] = useState(false);
  const [novaSessaoNome, setNovaSessaoNome] = useState('');
  const [editingSessao, setEditingSessao] = useState<Sessao | null>(null);
  const [editSessaoNome, setEditSessaoNome] = useState('');
  const [showDeleteSessaoModal, setShowDeleteSessaoModal] = useState(false);
  const [sessaoToDelete, setSessaoToDelete] = useState<Sessao | null>(null);
  const [sessaoModalLoading, setSessaoModalLoading] = useState(false);
  const [showFullResumo, setShowFullResumo] = useState(false);
  const [showFullObjetivo, setShowFullObjetivo] = useState(false);
  const [showFullDescricao, setShowFullDescricao] = useState(false);

  const getTruncatedText = (text: string, maxChars: number, expanded: boolean): string => {
    const trimmed = text.trim();
    if (expanded || trimmed.length <= maxChars) return trimmed;
    return `${trimmed.slice(0, maxChars).trimEnd()}...`;
  };

  const LinkifiedText = ({ text, className }: { text: string; className?: string }) => {
    if (!text) return null;

    const urlRegex =
      /((https?:\/\/|www\.)[^\s<]+)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

    const parts: Array<{ type: 'text' | 'link'; value: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // eslint-disable-next-line no-cond-assign
    while ((match = urlRegex.exec(text)) !== null) {
      const matchText = match[0];
      const index = match.index;

      if (index > lastIndex) {
        parts.push({ type: 'text', value: text.slice(lastIndex, index) });
      }

      parts.push({ type: 'link', value: matchText });
      lastIndex = index + matchText.length;
    }

    if (lastIndex < text.length) {
      parts.push({ type: 'text', value: text.slice(lastIndex) });
    }

    return (
      <span className={className}>
        {parts.map((part, index) => {
          if (part.type === 'link') {
            const raw = part.value;
            const isEmail =
              raw.includes('@') && !raw.startsWith('http') && !raw.startsWith('www.');
            const href = isEmail
              ? `mailto:${raw}`
              : raw.startsWith('http')
                ? raw
                : `http://${raw}`;

            return (
              <a
                key={`${raw}-${index}`}
                href={href}
                target={isEmail ? '_self' : '_blank'}
                rel={isEmail ? undefined : 'noreferrer'}
                className="text-primary hover:underline break-words"
              >
                {raw}
              </a>
            );
          }

          return <span key={`text-${index}`}>{part.value}</span>;
        })}
      </span>
    );
  };

  const resolveFileUrl = (url: string | null | undefined) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }

    const base = api.defaults.baseURL || '';
    try {
      const baseUrl = new URL(base, window.location.origin);
      const origin = baseUrl.origin; // ex.: http://localhost:3000
      const path = url.startsWith('/') ? url : `/${url}`;
      return `${origin}${path}`;
    } catch {
      return url;
    }
  };

  const getFileExtension = (file: ProjetoArquivo): string => {
    const nameOrUrl = (file.originalName || file.url || '').toLowerCase();
    const match = nameOrUrl.match(/\.([a-z0-9]+)(?:\?|#|$)/);
    return match ? match[1] : '';
  };

  const getFileKind = (file: ProjetoArquivo): 'image' | 'pdf' | 'excel' | 'word' | 'ppt' | 'text' | 'other' => {
    const mime = (file.mimeType || '').toLowerCase();
    const ext = getFileExtension(file);

    if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
    if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
    if (
      mime.includes('excel') ||
      mime === 'application/vnd.ms-excel' ||
      mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      ['xls', 'xlsx', 'xlsm', 'csv'].includes(ext)
    ) return 'excel';
    if (
      mime === 'application/msword' ||
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ['doc', 'docx', 'rtf'].includes(ext)
    ) return 'word';
    if (
      mime === 'application/vnd.ms-powerpoint' ||
      mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      ['ppt', 'pptx'].includes(ext)
    ) return 'ppt';
    if (mime.startsWith('text/') || ['txt', 'md', 'log'].includes(ext)) return 'text';
    return 'other';
  };

  const getFileBadgeLabel = (file: ProjetoArquivo): string => {
    const ext = getFileExtension(file);
    if (!ext) return 'arquivo';
    return ext.toUpperCase();
  };

  const [updatingChecklist, setUpdatingChecklist] = useState<number | null>(null);
  
  // Estado para controlar expansão de detalhes dos itens do checklist
  const [expandedChecklistDetails, setExpandedChecklistDetails] = useState<Set<string>>(new Set());

  const toggleChecklistDetails = (key: string) => {
    setExpandedChecklistDetails((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };
  const [showEntregaModal, setShowEntregaModal] = useState(false);
  const [selectedEntregaEtapa, setSelectedEntregaEtapa] = useState<Etapa | null>(null);
  const [entregaDescricao, setEntregaDescricao] = useState('');
  const [entregaImagem, setEntregaImagem] = useState<string | null>(null);
  const [entregaPreview, setEntregaPreview] = useState<string | null>(null);
  const [enviandoEntrega, setEnviandoEntrega] = useState(false);
  const [entregaError, setEntregaError] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [reviewLoading, setReviewLoading] = useState<Record<string, boolean>>({});
  const [showViewEntregaModal, setShowViewEntregaModal] = useState(false);
  const [selectedViewEntrega, setSelectedViewEntrega] = useState<{ etapa: Etapa; index: number; entrega: ChecklistItemEntrega } | null>(null);
  const [modalReviewComment, setModalReviewComment] = useState('');
  const [modalReviewLoading, setModalReviewLoading] = useState(false);
  const [etapaEstoque, setEtapaEstoque] = useState<Record<number, any[]>>({});
  const [loadingEstoqueCompras, setLoadingEstoqueCompras] = useState<Record<number, boolean>>({});
  const [showCompraModal, setShowCompraModal] = useState(false);
  const [selectedEtapaForCompra, setSelectedEtapaForCompra] = useState<Etapa | null>(null);
  const [showDeleteEtapaModal, setShowDeleteEtapaModal] = useState(false);
  const [etapaToDelete, setEtapaToDelete] = useState<Etapa | null>(null);
  const [deletingEtapa, setDeletingEtapa] = useState(false);
  const [deletingCompraId, setDeletingCompraId] = useState<number | null>(null);
  const [compraForm, setCompraForm] = useState({
    item: '',
    descricao: '',
    quantidade: 1,
    cotacoes: [{ valorUnitario: 0, frete: 0, impostos: 0 }] as Array<{ valorUnitario: number; frete: number; impostos: number; link?: string }>,
    selectedCotacaoIndex: 0,
    imagemUrl: '',
  });

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
      // Log para debug: verificar status das etapas após atualização
      if (data.etapas) {
        data.etapas.forEach(etapa => {
          const checklistItems = etapa.checklistJson && Array.isArray(etapa.checklistJson) ? etapa.checklistJson : [];
          const todosMarcados = checklistItems.length > 0 && checklistItems.every(item => item.concluido === true);
          if (todosMarcados && etapa.status !== 'APROVADA') {
            console.warn(`[refreshProject] Etapa ${etapa.id} tem todas as checkboxes marcadas mas status é ${etapa.status}`);
          }
        });
      }
    } catch (err: any) {
      const message = err.response?.data?.message ?? 'Erro ao carregar projeto';
      setError(message);
      console.error('Erro ao atualizar projeto:', err);
      // Não lançar erro para não causar problemas em cascata
      // Se for erro crítico (401), o interceptor já trata
      if (showSpinner) {
        // Em modo spinner, apenas logar o erro
      }
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }

  async function handleDeleteCompra(compra: Compra) {
    if (!window.confirm(`Excluir o item "${compra.item}" do histórico de compras?`)) return;
    setDeletingCompraId(compra.id);
    setError(null);
    try {
      await api.delete(`/stock/purchases/${compra.id}`);
      toast.success('Item removido do histórico.');
      await refreshProject(false);
    } catch (err: any) {
      const msg = formatApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setDeletingCompraId(null);
    }
  }

  async function loadEtapaEstoqueCompras(etapaId: number) {
    if (loadingEstoqueCompras[etapaId]) return;
    
    setLoadingEstoqueCompras((prev) => ({ ...prev, [etapaId]: true }));
    try {
      const alocacoesRes = await api.get(`/stock/alocacoes?etapaId=${etapaId}`);
      // Transformar alocações em formato de itens para exibição
      const estoqueItems = (alocacoesRes.data || []).map((aloc: any) => ({
        id: aloc.estoque.id,
        item: aloc.estoque.item,
        quantidade: aloc.quantidade, // Quantidade alocada
        valorUnitario: aloc.estoque.valorUnitario,
        descricao: aloc.estoque.descricao,
        imagemUrl: aloc.estoque.imagemUrl,
        alocacaoId: aloc.id,
      }));
      setEtapaEstoque((prev) => ({ ...prev, [etapaId]: estoqueItems }));
    } catch (err) {
      console.error('Erro ao carregar estoque da etapa:', err);
    } finally {
      setLoadingEstoqueCompras((prev) => ({ ...prev, [etapaId]: false }));
    }
  }

  async function loadAvailableStockItems(etapaId?: number) {
    if (!id) return;
    setLoadingStockItems(true);
    try {
      // Carregar itens de estoque do projeto ou sem etapa associada
      const { data } = await api.get(`/stock/items?projetoId=${id}`);
      
      // Se estiver editando uma etapa, buscar alocações atuais para ajustar quantidadeDisponivel
      let alocacoesAtuais: any[] = [];
      if (etapaId) {
        try {
          const { data: alocacoes } = await api.get(`/stock/alocacoes?etapaId=${etapaId}`);
          alocacoesAtuais = alocacoes || [];
        } catch (err) {
          console.error('Erro ao carregar alocações da etapa:', err);
        }
      }
      
      // Ajustar quantidadeDisponivel: se há alocação nesta etapa, adicionar de volta
      const itemsAjustados = (data || []).map((item: any) => {
        const alocacaoNestaEtapa = alocacoesAtuais.find((aloc: any) => aloc.estoqueId === item.id);
        if (alocacaoNestaEtapa) {
          // Adicionar de volta a quantidade já alocada nesta etapa ao disponível
          return {
            ...item,
            quantidadeDisponivel: (item.quantidadeDisponivel ?? item.quantidade) + alocacaoNestaEtapa.quantidade,
          };
        }
        return item;
      });
      
      setAvailableStockItems(itemsAjustados);
    } catch (err) {
      console.error('Erro ao carregar itens de estoque:', err);
      setAvailableStockItems([]);
    } finally {
      setLoadingStockItems(false);
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

  // Projetos criados sem sessão (ex.: antes do backend criar "Geral"): criar sessão padrão ao abrir
  useEffect(() => {
    if (
      !project ||
      !id ||
      (project.sessoes?.length ?? 0) > 0 ||
      (project.etapas?.length ?? 0) > 0
    ) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await api.post(`/projects/${id}/sessoes`, { nome: 'Geral', ordem: 0 });
        if (!cancelled) await refreshProject(false);
      } catch (e) {
        if (!cancelled) console.error('Erro ao criar sessão padrão:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, project?.id, project?.sessoes?.length, project?.etapas?.length]);

  useEffect(() => {
    if (project?.etapas) {
      project.etapas.forEach((etapa) => {
        loadEtapaEstoqueCompras(etapa.id);
      });
    }
  }, [project?.etapas]);

  async function handleCreateEtapa(event: FormEvent) {
    event.preventDefault();
    if (!id || !project) return;

    setError(null);
    setSubmitting(true);

    // Validar executorId antes de enviar
    const executorId = Number(etapaForm.executorId);
    if (!executorId || executorId === 0 || isNaN(executorId)) {
      setError('É necessário selecionar um executor para a etapa');
      setSubmitting(false);
      return;
    }

    try {
      const payload: any = {
        projetoId: Number(id),
        nome: etapaForm.nome.trim(),
        executorId: executorId,
      };

      const abaTrim = etapaForm.aba?.trim();
      if (abaTrim) payload.aba = abaTrim;
      if (etapaForm.sessaoId != null && etapaForm.sessaoId > 0) payload.sessaoId = etapaForm.sessaoId;
      if (editingEtapa && (etapaForm.sessaoId == null || etapaForm.sessaoId === 0)) payload.sessaoId = null;

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
            descricao: item.descricao?.trim() || '',
            subitens: (item.subitens || [])
              .filter((sub) => sub.texto && sub.texto.trim().length > 0)
              .map((sub) => ({
                texto: sub.texto.trim(),
                concluido: sub.concluido || false,
                descricao: sub.descricao?.trim() || '',
              })),
          }));
        
        if (checklistFiltrado.length > 0) {
          payload.checklist = checklistFiltrado;
        }
      }

      if (etapaForm.integrantesIds && etapaForm.integrantesIds.length > 0) {
        payload.integrantesIds = etapaForm.integrantesIds;
      }

      // Executor e responsável devem ser a mesma pessoa
      if (executorId && executorId > 0) {
        payload.responsavelId = executorId;
      } else if (editingEtapa) {
        payload.responsavelId = null;
      }

      if (editingEtapa && etapaForm.status) {
        payload.status = etapaForm.status as string;
      }

      let etapaId: number;
      if (editingEtapa) {
        const updated = await api.patch(`/tasks/${editingEtapa.id}`, payload);
        etapaId = editingEtapa.id;
        
        // Se estiver editando, gerenciar alocações (remover, atualizar ou criar)
        try {
          // Buscar alocações atuais da etapa
          const { data: currentAlocacoes } = await api.get(`/stock/alocacoes?etapaId=${etapaId}`);
          
          // Criar mapas para facilitar a busca
          const currentAlocacoesMap = new Map(
            (currentAlocacoes || []).map((aloc: any) => [aloc.estoqueId, aloc])
          );
          const selectedItemsMap = new Map(
            etapaForm.estoqueItems.map((item) => [item.itemId, item])
          );
          
          // Remover alocações que não estão mais na lista
          const alocacoesToRemove = (currentAlocacoes || []).filter(
            (aloc: any) => !selectedItemsMap.has(aloc.estoqueId)
          );
          await Promise.all(
            alocacoesToRemove.map((aloc: any) =>
              api.delete(`/stock/alocacoes/${aloc.id}`)
            )
          );
          
          // Atualizar ou criar alocações para os itens selecionados
          for (const estoqueItem of etapaForm.estoqueItems) {
            const existingAloc = currentAlocacoesMap.get(estoqueItem.itemId) as { id: number; quantidade: number; estoqueId: number } | undefined;
            if (existingAloc) {
              // Atualizar alocação existente se a quantidade mudou
              if (existingAloc.quantidade !== estoqueItem.quantidade) {
                await api.patch(`/stock/alocacoes/${existingAloc.id}`, {
                  quantidade: estoqueItem.quantidade,
                });
              }
      } else {
              // Criar nova alocação
              await api.post('/stock/alocacoes', {
                estoqueId: estoqueItem.itemId,
                projetoId: Number(id),
                etapaId: etapaId,
                quantidade: estoqueItem.quantidade,
              });
            }
          }
        } catch (err: any) {
          console.error('Erro ao atualizar alocações de estoque:', err);
          setError(err.response?.data?.message ?? 'Erro ao atualizar alocações de estoque');
        }
      } else {
        const created = await api.post('/tasks', payload);
        etapaId = created.data.id;
        
        // Criar alocações para os itens de estoque selecionados (nova etapa)
        if (etapaForm.estoqueItems && etapaForm.estoqueItems.length > 0) {
          try {
            await Promise.all(
              etapaForm.estoqueItems.map((estoqueItem) =>
                api.post('/stock/alocacoes', {
                  estoqueId: estoqueItem.itemId,
                  projetoId: Number(id),
                  etapaId: etapaId,
                  quantidade: estoqueItem.quantidade,
                })
              )
            );
          } catch (err: any) {
            console.error('Erro ao criar alocações de estoque:', err);
            setError(err.response?.data?.message ?? 'Erro ao alocar itens de estoque');
          }
        }
      }

      setShowEtapaModal(false);
      setEditingEtapa(null);
      setEtapaForm({
        nome: '',
        descricao: '',
        sessaoId: undefined,
        aba: '',
        executorId: 0,
        responsavelId: undefined,
        integrantesIds: [],
        dataInicio: '',
        dataFim: '',
        valorInsumos: 0,
        checklist: [{ texto: '', concluido: false, descricao: '', subitens: [] }],
        status: 'PENDENTE',
        estoqueItems: [],
      });
      setStockSearchTerm('');
      setSelectedStockItemId(null);
      setSelectedStockQuantity(1);

      // Recarregar o projeto
      await refreshProject();
      // Recarregar estoque/compras da etapa
      await loadEtapaEstoqueCompras(etapaId);
      toast.success(editingEtapa ? 'Etapa atualizada com sucesso!' : 'Etapa criada com sucesso!');
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteEtapa(etapa: Etapa) {
    setEtapaToDelete(etapa);
    setShowDeleteEtapaModal(true);
  }

  async function confirmDeleteEtapa() {
    if (!etapaToDelete) return;

    try {
      setDeletingEtapa(true);
      await api.delete(`/tasks/${etapaToDelete.id}`);
      toast.success('Etapa deletada com sucesso!');
      await refreshProject();
      setShowDeleteEtapaModal(false);
      setEtapaToDelete(null);
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setDeletingEtapa(false);
    }
  }

  async function handleReorderEtapas(direction: 'up' | 'down', currentIndex: number) {
    if (!project) return;
    const etapas = project.etapas;
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= etapas.length) return;

    const newOrder = [...etapas];
    [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];
    const etapaIds = newOrder.map((e) => e.id);

    try {
      setReorderingEtapas(true);
      setError(null);
      await api.patch(`/projects/${project.id}/etapas/reorder`, { etapaIds });
      toast.success('Ordem das etapas atualizada.');
      await refreshProject(false);
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'Falha ao reordenar etapas';
      setError(msg);
      toast.error(msg);
    } finally {
      setReorderingEtapas(false);
    }
  }

  async function handleEditEtapa(etapa: Etapa) {
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

    // Carregar alocações de estoque relacionadas à etapa
    let estoqueItems: Array<{ itemId: number; quantidade: number }> = [];
    try {
      const { data: alocacoes } = await api.get(`/stock/alocacoes?etapaId=${etapa.id}`);
      if (alocacoes && Array.isArray(alocacoes)) {
        estoqueItems = alocacoes.map((aloc: any) => ({
          itemId: aloc.estoqueId,
          quantidade: aloc.quantidade,
        }));
      }
    } catch (err) {
      console.error('Erro ao carregar alocações de estoque da etapa:', err);
    }
    
    // Carregar itens disponíveis ajustando para esta etapa (adiciona de volta as alocações desta etapa)
    await loadAvailableStockItems(etapa.id);

    setEtapaForm({
      nome: etapa.nome || '',
      descricao: etapa.descricao || '',
      sessaoId: etapa.sessaoId ?? undefined,
      aba: etapa.aba || '',
      executorId: etapa.executor?.id || 0,
      // Executor e responsável passam a ser sempre o mesmo usuário
      responsavelId: etapa.executor?.id || undefined,
      integrantesIds: etapa.integrantes ? etapa.integrantes.filter(i => i.usuario?.id).map((i) => i.usuario.id) : [],
      dataInicio: formatDateForInput(etapa.dataInicio),
      dataFim: formatDateForInput(etapa.dataFim),
      valorInsumos: etapa.valorInsumos || 0,
      checklist:
        etapa.checklistJson && Array.isArray(etapa.checklistJson) && etapa.checklistJson.length > 0
          ? etapa.checklistJson.map((item: any) => ({
              texto: item.texto || '',
              concluido: item.concluido || false,
              descricao: item.descricao || '',
              subitens: item.subitens && Array.isArray(item.subitens)
                ? item.subitens.map((sub: any) => ({
                    texto: sub.texto || '',
                    concluido: sub.concluido || false,
                    descricao: sub.descricao || '',
                  }))
                : [],
            }))
          : [{ texto: '', concluido: false, descricao: '', subitens: [] }],
      status: etapa.status || 'PENDENTE',
      estoqueItems,
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

    // Verificar se todas as checkboxes estão marcadas
    const todosMarcados = updatedChecklist.length > 0 && updatedChecklist.every(item => item.concluido === true);
    console.log(`[handleChecklistUpdate] Etapa ${etapaId}, item ${checklistIndex}, concluido=${concluido}, todosMarcados=${todosMarcados}`);

    try {
      setUpdatingChecklist(etapaId);
      const response = await api.patch(`/tasks/${etapaId}/checklist`, {
        checklist: updatedChecklist,
      });
      
      console.log(`[handleChecklistUpdate] Resposta do backend:`, response.data);
      
      // Aguardar um pouco antes de atualizar para garantir que o backend processou
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await refreshProject();
    } catch (err: any) {
      console.error(`[handleChecklistUpdate] Erro:`, err);
      const errorMessage = err.response?.data?.message ?? 'Falha ao atualizar checklist';
      
      // Se for erro 401 (não autorizado), mostrar mensagem específica sem fazer logout
      if (err.response?.status === 401) {
        toast.warning('Você não tem permissão para atualizar este checklist. Apenas o supervisor do projeto ou GM/DIRETOR podem fazer isso.');
      } else {
        setError(errorMessage);
        toast.error(errorMessage);
      }
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

  async function handleEntregaImagemChange(file?: File | null) {
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
    setReviewNotes((prev) => ({ ...prev, [String(etapaId)]: value }));
  }

  async function handleApproveEtapa(etapaId: number) {
    setReviewLoading((prev) => ({ ...prev, [String(etapaId)]: true }));
    try {
      setError(null);
      await api.post(`/tasks/${etapaId}/approve`, {
        comentario: reviewNotes[String(etapaId)]?.trim() || undefined,
      });
      setReviewNotes((prev) => ({ ...prev, [String(etapaId)]: '' }));
      await refreshProject();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Falha ao aprovar a entrega');
    } finally {
      setReviewLoading((prev) => ({ ...prev, [String(etapaId)]: false }));
    }
  }

  async function handleRejectEtapa(etapaId: number) {
    setReviewLoading((prev) => ({ ...prev, [String(etapaId)]: true }));
    try {
      setError(null);
      await api.post(`/tasks/${etapaId}/reject`, {
        reason: reviewNotes[String(etapaId)]?.trim() || undefined,
      });
      setReviewNotes((prev) => ({ ...prev, [etapaId]: '' }));
      await refreshProject();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Falha ao recusar a entrega');
    } finally {
      setReviewLoading((prev) => ({ ...prev, [String(etapaId)]: false }));
    }
  }

  const filteredCompras = useMemo(() => {
    if (!project) return [];
    if (!selectedEtapaForCompra) return project.compras;
    return project.compras.filter((compra) => {
      const etapaId = compra.etapaId ?? compra.etapa?.id ?? null;
      return etapaId === selectedEtapaForCompra.id;
    });
  }, [project, selectedEtapaForCompra]);

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
  
  // Função para verificar se uma etapa está concluída
  const isEtapaConcluida = (etapa: Etapa) => {
    // Etapas com status EM_ANALISE ou APROVADA são consideradas concluídas
    if (etapa.status === 'EM_ANALISE' || etapa.status === 'APROVADA') {
      return true;
    }
    
    // Se a etapa tem checklist, verificar se todos os itens foram aprovados
    if (etapa.checklistJson && Array.isArray(etapa.checklistJson) && etapa.checklistJson.length > 0) {
      const totalItens = etapa.checklistJson.length;
      
      // Verificar itens aprovados através das entregas do checklist
      const itensAprovados = etapa.checklistEntregas?.filter(
        (entrega) => entrega.status === 'APROVADO'
      ).length || 0;
      
      // Verificar itens marcados como concluídos no checklistJson
      const itensMarcados = etapa.checklistJson.filter(
        (item) => item.concluido === true
      ).length;
      
      // Se todos os itens do checklist foram aprovados OU marcados como concluídos, considerar a etapa concluída
      if ((itensAprovados === totalItens || itensMarcados === totalItens) && totalItens > 0) {
        return true;
      }
    }
    
    return false;
  };
  
  const etapasConcluidas = project.etapas.filter(isEtapaConcluida).length;
  const progresso = totalEtapas > 0 ? Math.round((etapasConcluidas / totalEtapas) * 100) : 0;

  // Calcular valorInsumos como soma das etapas (garantia de que sempre está correto)
  const valorInsumosCalculado = project.etapas.reduce((sum, etapa) => {
    return sum + (etapa.valorInsumos || 0);
  }, 0);

  const projectStatusForDisplay = progresso === 0
    ? 'PENDENTE'
    : progresso === 100
      ? 'FINALIZADO'
      : project.status;

  const projectStatusLabel = getStatusLabel(projectStatusForDisplay);
  const projectStatusColor = getStatusColor(projectStatusForDisplay);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header: Voltar à esquerda, nome do projeto à direita */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => navigate('/projects')}
          className="text-primary hover:text-primary/80 transition-colors text-sm sm:text-base shrink-0"
        >
          ← Voltar
        </button>
        <div className="min-w-0 flex-1 flex items-center justify-end">
          <div className="min-w-0 text-right">
            <h2 className="text-xl font-bold truncate sm:text-2xl">{project.nome}</h2>
            <span className={`inline-block mt-1 px-2 py-1 rounded text-xs ${projectStatusColor}`}>
              {projectStatusLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Informações Gerais */}
      <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-neutral/80 border border-white/10 rounded-xl p-4 space-y-4 sm:p-6">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
            <h3 className="text-lg font-semibold">Informações Gerais</h3>
            {canEditProject && (
              <button
                type="button"
                onClick={openEditProjectModal}
                className={`${btn.primarySoft} text-xs px-3 py-1.5`}
              >
                Editar Projeto
              </button>
            )}
          </div>

          <div>
            <label className="text-sm text-white/70">Resumo</label>
            <p className="mt-1 text-white/90 text-sm whitespace-pre-wrap break-words">
              {project.resumo && project.resumo.trim().length > 0 ? (
                <>
                  {getTruncatedText(project.resumo, 180, showFullResumo)}
                  {project.resumo.trim().length > 180 && (
                    <button
                      type="button"
                      onClick={() => setShowFullResumo((prev) => !prev)}
                      className="ml-1 text-primary text-xs hover:underline"
                    >
                      {showFullResumo ? 'ver menos' : 'ver mais'}
                    </button>
                  )}
                </>
              ) : (
                '—'
              )}
            </p>
          </div>

          <div>
            <label className="text-sm text-white/70">Objetivo</label>
            <p className="mt-1 text-white/90 text-sm whitespace-pre-wrap break-words">
              {project.objetivo && project.objetivo.trim().length > 0 ? (
                <>
                  {getTruncatedText(project.objetivo, 220, showFullObjetivo)}
                  {project.objetivo.trim().length > 220 && (
                    <button
                      type="button"
                      onClick={() => setShowFullObjetivo((prev) => !prev)}
                      className="ml-1 text-primary text-xs hover:underline"
                    >
                      {showFullObjetivo ? 'ver menos' : 'ver mais'}
                    </button>
                  )}
                </>
              ) : (
                '—'
              )}
            </p>
          </div>

          <div>
            <label className="text-sm text-white/70 flex items-center justify-between">
              <span>Descrição do Projeto</span>
            </label>
            <p className="mt-1 text-white/90 whitespace-pre-wrap break-words text-sm">
              {project.descricaoLonga && project.descricaoLonga.trim().length > 0 ? (
                <>
                  <LinkifiedText
                    text={getTruncatedText(project.descricaoLonga, 400, showFullDescricao)}
                  />
                  {project.descricaoLonga.trim().length > 400 && (
                    <button
                      type="button"
                      onClick={() => setShowFullDescricao((prev) => !prev)}
                      className="ml-1 text-primary text-xs hover:underline"
                    >
                      {showFullDescricao ? 'ver menos' : 'ver mais'}
                    </button>
                  )}
                </>
              ) : (
                '—'
              )}
            </p>
            {Array.isArray(project.descricaoArquivos) && project.descricaoArquivos.length > 0 && (
              <div className="mt-3 space-y-2">
                {/* Galeria de imagens */}
                {project.descricaoArquivos.some((f) => getFileKind(f) === 'image') && (
                  <div>
                    <p className="text-xs text-white/60 mb-1">Imagens do projeto</p>
                    <div className="flex flex-wrap gap-2">
                      {project.descricaoArquivos
                        .filter((file) => getFileKind(file) === 'image')
                        .map((file, index) => {
                          const url = resolveFileUrl(file.url);
                          const displayName = file.originalName || file.url;
                          return (
                            <a
                              key={`${file.url}-${index}`}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="w-20 h-20 rounded-md overflow-hidden border border-white/15 hover:border-primary/80 transition-colors bg-black/40 flex items-center justify-center"
                              title={displayName}
                            >
                              <img
                                src={url}
                                alt={displayName}
                                className="w-full h-full object-cover"
                              />
                            </a>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Documentos e outros arquivos */}
                {project.descricaoArquivos.some((f) => getFileKind(f) !== 'image') && (
                  <div>
                    <p className="text-xs text-white/60 mb-1">Arquivos e documentos</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto bg-black/10 rounded-md p-2">
                      {project.descricaoArquivos
                        .filter((file) => getFileKind(file) !== 'image')
                        .map((file, index) => {
                          const kind = getFileKind(file);
                          const url = resolveFileUrl(file.url);
                          const displayName = file.originalName || file.url;
                          const badge = getFileBadgeLabel(file);
                          const icon =
                            kind === 'pdf'
                              ? '📄'
                              : kind === 'excel'
                                ? '📊'
                                : kind === 'word'
                                  ? '📝'
                                  : kind === 'ppt'
                                    ? '📽️'
                                    : kind === 'text'
                                      ? '📃'
                                      : '📎';
                          return (
                            <div
                              key={`${file.url}-${index}`}
                              className="flex items-center gap-3 text-xs text-white/80"
                            >
                              <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-white/20 text-[10px] text-white/70 shrink-0">
                                {badge}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="truncate">
                                  {icon}{' '}
                                  <span className="align-middle">
                                    {displayName}
                                  </span>
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center px-2 py-0.5 rounded border border-white/25 text-[11px] hover:border-primary hover:text-primary transition-colors"
                                >
                                  Abrir
                                </a>
                                <a
                                  href={url}
                                  download
                                  className="inline-flex items-center px-2 py-0.5 rounded border border-white/15 text-[11px] text-white/80 hover:border-white/40 transition-colors"
                                >
                                  Download
                                </a>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}
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
                {valorInsumosCalculado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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

        <div className="bg-neutral/80 border border-white/10 rounded-xl p-4 space-y-4 sm:p-6">
          <h3 className="text-lg font-semibold border-b border-white/10 pb-2">Equipe</h3>
          
          <div>
            <label className="text-sm text-white/70">Supervisor</label>
            <p className="mt-1 text-white/90">
              {project.supervisor ? (
                <span>
                  {project.supervisor.nome} <span className="text-white/50">
                    ({typeof project.supervisor.cargo === 'string' 
                      ? project.supervisor.cargo 
                      : (project.supervisor.cargo?.nome || 'Sem cargo')}) - {project.supervisor.email}
                  </span>
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
                {project.responsaveis
                  .filter((resp) => resp.usuario)
                  .map((resp) => {
                    const cargoNome = typeof resp.usuario!.cargo === 'string' 
                      ? resp.usuario!.cargo 
                      : (resp.usuario!.cargo?.nome || 'Sem cargo');
                    return (
                      <div key={resp.id || `responsavel-${resp.usuario!.id}`} className="text-sm text-white/90">
                        • {resp.usuario!.nome} <span className="text-white/50">({cargoNome})</span>
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
        <div className="bg-neutral/80 border border-white/10 rounded-xl p-4 sm:p-6">
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
      <div className="bg-neutral/80 border border-white/10 rounded-xl p-4 sm:p-6">
        <div className="flex flex-col gap-3">
          {/* Linha de Sessões – identidade visual violeta (diferente das abas em azul) */}
          {(totalEtapas > 0 || canEditProject) && (project != null) && (() => {
            const hasEtapaSemSessao = (project?.etapas ?? []).some((e) => e.sessaoId == null);
            const sessaoGroupsCount = (hasEtapaSemSessao ? 1 : 0) + (project?.sessoes?.length ?? 0);
            return (
            <div className="flex flex-wrap items-center justify-between gap-3 py-3 px-4 rounded-lg bg-slate-800/60 border border-violet-500/25">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-violet-200/90">Sessão |</span>
                {sessaoGroupsCount > 1 && (
                  <button
                    type="button"
                    onClick={() => setSelectedSessaoId('all')}
                    className={`inline-flex items-center justify-center rounded px-3 py-1.5 text-xs font-medium transition-colors border focus:outline-none focus:ring-2 focus:ring-violet-400/50 ${
                      selectedSessaoId === 'all'
                        ? 'bg-violet-600 text-white border-violet-500'
                        : 'bg-slate-700/80 text-white/80 border-slate-600/80 hover:bg-violet-900/40 hover:border-violet-700/60'
                    }`}
                  >
                    Todas
                  </button>
                )}
                {hasEtapaSemSessao && (
                  <button
                    type="button"
                    onClick={() => setSelectedSessaoId(null)}
                    className={`inline-flex items-center justify-center rounded px-3 py-1.5 text-xs font-medium transition-colors border focus:outline-none focus:ring-2 focus:ring-violet-400/50 ${
                      selectedSessaoId === null
                        ? 'bg-violet-600 text-white border-violet-500'
                        : 'bg-slate-700/80 text-white/80 border-slate-600/80 hover:bg-violet-900/40 hover:border-violet-700/60'
                    }`}
                  >
                    Sem sessão
                  </button>
                )}
                {project?.sessoes?.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSessaoId(s.id)}
                    className={`inline-flex items-center justify-center rounded px-3 py-1.5 text-xs font-medium transition-colors border focus:outline-none focus:ring-2 focus:ring-violet-400/50 ${
                      selectedSessaoId === s.id
                        ? 'bg-violet-600 text-white border-violet-500'
                        : 'bg-slate-700/80 text-white/80 border-slate-600/80 hover:bg-violet-900/40 hover:border-violet-700/60'
                    }`}
                  >
                    {s.nome}
                  </button>
                ))}
              </div>
              {canEditProject && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNovaSessaoNome('');
                      setShowSessaoModal(true);
                    }}
                    className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold bg-slate-700/80 text-white/80 border border-slate-600/80 hover:bg-slate-600/80 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
                  >
                    + Nova sessão
                  </button>
                  {typeof selectedSessaoId === 'number' && project?.sessoes?.some((s) => s.id === selectedSessaoId) && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const sessao = project.sessoes!.find((s) => s.id === selectedSessaoId);
                          if (!sessao) return;
                          setEditingSessao(sessao);
                          setEditSessaoNome(sessao.nome);
                        }}
                        className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold bg-slate-700/80 text-white/80 border border-slate-600/80 hover:bg-slate-600/80 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
                      >
                        Renomear sessão
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const sessao = project.sessoes!.find((s) => s.id === selectedSessaoId);
                          if (!sessao) return;
                          setSessaoToDelete(sessao);
                          setShowDeleteSessaoModal(true);
                        }}
                        className={btn.dangerSm}
                      >
                        Excluir sessão
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            );
          })()}

          {/* Linha de Abas – identidade visual azul (primary), distinta das sessões em violeta */}
          {(totalEtapas > 0 || canEditProject) && (
            <div className="flex flex-wrap items-center justify-between gap-3 py-3 px-4 rounded-lg bg-slate-800/60 border border-primary/25">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-sky-200/90">Aba |</span>
                {abas.map((aba) => (
                  <button
                    key={aba}
                    type="button"
                    onClick={() => setSelectedAba(aba)}
                    className={`inline-flex items-center justify-center rounded px-3 py-1.5 text-xs font-medium transition-colors border focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                      selectedAba === aba
                        ? 'bg-primary text-white border-primary'
                        : 'bg-slate-700/80 text-white/80 border-slate-600/80 hover:bg-primary/20 hover:border-primary/40'
                    }`}
                  >
                    {aba === 'Todas' ? 'Todas' : aba}
                  </button>
                ))}
              </div>
              {canEditProject && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddAba}
                    className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold bg-slate-700/80 text-white/80 border border-slate-600/80 hover:bg-slate-600/80 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
                  >
                    + Nova aba
                  </button>
                  {selectedAba !== 'Todas' && (
                    <>
                      <button
                        type="button"
                        onClick={handleOpenRenameAba}
                        className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold bg-slate-700/80 text-white/80 border border-slate-600/80 hover:bg-slate-600/80 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
                      >
                        Renomear aba
                      </button>
                      <button type="button" onClick={handleOpenDeleteAba} className={btn.dangerSm}>
                        Excluir aba
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Linha de Etapas (abaixo) */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Etapas ({totalEtapas})</h3>
            {canEditProject && (
              <button
                type="button"
                onClick={async () => {
                  setEditingEtapa(null);
                  setEtapaForm({
                    nome: '',
                    descricao: '',
                    sessaoId:
                      selectedSessaoId !== 'all' &&
                      selectedSessaoId !== null &&
                      typeof selectedSessaoId === 'number'
                        ? selectedSessaoId
                        : (project?.sessoes?.length === 1 ? project.sessoes[0].id : undefined),
                    aba:
                      selectedAba !== 'Todas'
                        ? selectedAba
                        : (project?.sessoes?.length === 1 ? 'Geral' : ''),
                    executorId: 0,
                    responsavelId: undefined,
                    integrantesIds: [],
                    dataInicio: '',
                    dataFim: '',
                    valorInsumos: 0,
                    checklist: [{ texto: '', concluido: false, descricao: '', subitens: [] }],
                    status: 'PENDENTE',
                    estoqueItems: [],
                  });
                  await loadAvailableStockItems();
                  setShowEtapaModal(true);
                }}
                className={btn.primary}
              >
                + Adicionar Etapa
              </button>
            )}
          </div>

          {/* Cards de etapas */}
          <section className="space-y-4">
            {totalEtapas === 0 ? (
              <p className="text-white/50 text-center py-8">Nenhuma etapa cadastrada</p>
            ) : etapasFiltradas.length === 0 ? (
              <p className="text-white/50 text-center py-8">Nenhuma etapa nesta aba.</p>
            ) : (
              <div className="space-y-4">
            {etapasFiltradas.map((etapa, etapaIndex) => {
              const latestEntrega = etapa.entregas && etapa.entregas.length > 0 ? etapa.entregas[0] : null;
              // Comparar convertendo ambos para número para evitar problemas de tipo
              const executorId = etapa.executor?.id;
              const isExecutor = user?.id && executorId && Number(user.id) === Number(executorId);
              
              // Verificar se o usuário é supervisor do projeto (supervisor da etapa)
              const isSupervisorProjeto = user?.id && project.supervisor?.id && Number(user.id) === Number(project.supervisor.id);
              
              // Usuário pode atualizar checklist se for GM/DIRETOR OU supervisor do projeto
              const podeMarcarChecklist = isDiretor || isSupervisorProjeto;
              
              // Verificar se há itens do checklist marcados
              const checklistItems = etapa.checklistJson && Array.isArray(etapa.checklistJson) 
                ? etapa.checklistJson 
                : [];
              const itensMarcados = checklistItems.filter((item) => item.concluido).length;
              const temItensMarcados = itensMarcados > 0;
              const totalItens = checklistItems.length;
              const awaitingReview = latestEntrega?.status === 'EM_ANALISE';
              const reviewValue = reviewNotes[String(etapa.id)] ?? '';
              const isReviewing = reviewLoading[String(etapa.id)] ?? false;

              const progressoChecklist =
                totalItens > 0 ? Math.round((itensMarcados / totalItens) * 100) : 0;

              return (
                <div
                  id={`etapa-${etapa.id}`}
                  key={etapa.id}
                  className="bg-slate-950/80 border border-white/10 rounded-xl p-4 sm:p-5 shadow-xl shadow-black/40"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1 flex items-start gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleEtapa(etapa.id)}
                        onKeyDown={(e) => e.key === 'Enter' && toggleEtapa(etapa.id)}
                        aria-expanded={expandedEtapas.has(etapa.id)}
                        aria-label={expandedEtapas.has(etapa.id) ? 'Retrair etapa' : 'Expandir etapa'}
                        className="shrink-0 text-white/70 mt-0.5 inline-flex transition-transform duration-300 ease-out focus:outline-none"
                        style={{ transform: expandedEtapas.has(etapa.id) ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                      >
                        ▼
                      </button>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-white/90">
                          {etapaIndex + 1}. {etapa.nome}
                        </h4>
                        {etapa.descricao && (
                          <p className="text-sm mt-1 text-white/70">
                            <LinkifiedText
                              text={getTruncatedText(
                                etapa.descricao,
                                220,
                                expandedDescricaoEtapas.has(etapa.id),
                              )}
                            />
                            {etapa.descricao.trim().length > 220 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedDescricaoEtapas((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(etapa.id)) {
                                      next.delete(etapa.id);
                                    } else {
                                      next.add(etapa.id);
                                    }
                                    return next;
                                  })
                                }
                                className="ml-1 text-primary text-xs hover:underline"
                              >
                                {expandedDescricaoEtapas.has(etapa.id)
                                  ? 'ver menos'
                                  : 'ver mais'}
                              </button>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-start md:items-end gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                            etapa.status,
                          )}`}
                        >
                          {getStatusLabel(etapa.status)}
                        </span>
                        {canEditProject && (
                          <span className="flex items-center gap-1" title="Ordem da etapa">
                            <button
                              type="button"
                              onClick={() => handleReorderEtapas('up', etapaIndex)}
                              disabled={reorderingEtapas || etapaIndex === 0}
                              className="p-1.5 rounded border border-white/20 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-white/80"
                              aria-label="Subir etapa"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReorderEtapas('down', etapaIndex)}
                              disabled={reorderingEtapas || etapaIndex === project.etapas.length - 1}
                              className="p-1.5 rounded border border-white/20 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-white/80"
                              aria-label="Descer etapa"
                            >
                              ↓
                            </button>
                          </span>
                        )}
                        {isDiretor && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenEtapaMenuId((current) => (current === etapa.id ? null : etapa.id))
                              }
                              className="px-2 py-1 rounded-full text-xs bg-white/10 hover:bg-white/20 text-white flex items-center gap-1"
                              aria-haspopup="menu"
                              aria-expanded={openEtapaMenuId === etapa.id}
                            >
                              ⋯
                            </button>
                            {openEtapaMenuId === etapa.id && (
                              <div
                                className="absolute right-0 mt-1 w-32 rounded-md bg-slate-900 border border-white/10 shadow-lg z-10"
                                role="menu"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleEditEtapa(etapa);
                                    setOpenEtapaMenuId(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs text-white/90 hover:bg-white/10"
                                  role="menuitem"
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleDeleteEtapa(etapa);
                                    setOpenEtapaMenuId(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs text-danger hover:bg-danger/20"
                                  role="menuitem"
                                >
                                  Excluir
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {isExecutor && etapa.status === 'EM_ANALISE' && (
                        <span className="text-xs text-amber-300/80">Aguardando avaliação do supervisor</span>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateRows: expandedEtapas.has(etapa.id) ? '1fr' : '0fr',
                      transition: 'grid-template-rows 0.35s ease-out',
                    }}
                    className="min-h-0"
                  >
                    <div className="overflow-hidden min-h-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-sm text-slate-200/80">
                    {etapa.executor && (
                      <div>
                        <span className="font-medium">Responsável:</span> {etapa.executor.nome}
                      </div>
                    )}
                    {etapa.integrantes && etapa.integrantes.length > 0 && (
                      <div>
                        <span className="font-medium">Integrantes:</span>{' '}
                        {etapa.integrantes
                          .filter((i) => i.usuario)
                          .map((i, idx, arr) => (
                            <span key={i.usuario?.id || `integrante-${idx}`}>
                              {i.usuario?.nome}
                              {idx < arr.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                      </div>
                    )}
                    {etapa.dataInicio && (
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Data Início:</span>
                        <span className="inline-flex items-center gap-1">
                          <span className="text-xs">📅</span>
                          {new Date(etapa.dataInicio).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    )}
                    {etapa.dataFim && (
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Data Fim:</span>
                        <span className="inline-flex items-center gap-1">
                          <span className="text-xs">📅</span>
                          {new Date(etapa.dataFim).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </span>
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

                  {latestEntrega && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-xs text-white/60 block">Última entrega</span>
                          <span className="text-sm text-white/80 block">
                            {new Date(latestEntrega.dataEnvio).toLocaleString('pt-BR')}
                          </span>
                          {latestEntrega.executor && (
                            <span className="mt-1 text-xs text-white/60 block">
                              Enviado por {latestEntrega.executor.nome}
                            </span>
                          )}
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${getEntregaStatusColor(latestEntrega.status)}`}>
                          {getEntregaStatusLabel(latestEntrega.status)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-white/80 whitespace-pre-wrap">{latestEntrega.descricao}</p>
                      {latestEntrega.foiEditada && latestEntrega.editadoPor && latestEntrega.dataEdicao && (
                        <p className="mt-1 text-xs text-white/60">
                          Editado por {latestEntrega.editadoPor.nome}{' '}
                          em {new Date(latestEntrega.dataEdicao).toLocaleString('pt-BR')}
                        </p>
                      )}
                      {latestEntrega.imagemUrl && (
                        <img
                          src={resolveFileUrl(latestEntrega.imagemUrl)}
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
                              className={btn.primary}
                            >
                              {isReviewing ? 'Processando...' : 'Recusar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApproveEtapa(etapa.id)}
                              disabled={isReviewing}
                              className={btn.primary}
                            >
                              {isReviewing ? 'Processando...' : 'Aprovar'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {etapa.checklistJson && Array.isArray(etapa.checklistJson) && etapa.checklistJson.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-white/80 block font-medium">
                          Checklist de Objetos ({etapa.checklistJson.length})
                          {podeMarcarChecklist && (
                            <span className="text-white/50 text-xs ml-2">(Você pode marcar os itens)</span>
                          )}
                        </label>
                      </div>
                      {totalItens > 0 && (
                        <div className="mb-3">
                          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-emerald-400 h-2 rounded-full transition-all"
                              style={{ width: `${progressoChecklist}%` }}
                            />
                          </div>
                          <div className="mt-1 text-[11px] text-white/60 text-right">
                            {itensMarcados} de {totalItens} marcado{itensMarcados !== 1 ? 's' : ''} ({progressoChecklist}
                            %)
                          </div>
                        </div>
                      )}

                      {/* Cabeçalho de colunas (desktop) */}
                      <div className="hidden md:grid md:grid-cols-[auto_1fr_7rem_7rem_8rem] md:items-center gap-2 text-[11px] uppercase tracking-wide text-white/70 bg-slate-900/80 border border-white/15 rounded-md px-3 py-2 mb-1">
                        <div className="w-6" />
                        <div className="pl-1">Item</div>
                        <div className="text-center">Status</div>
                        <div className="text-center">Entrega</div>
                        <div className="text-right pr-1">Ações</div>
                      </div>

                      <div className="space-y-2">
                        {etapa.checklistJson.map((item: ChecklistItem, index: number) => {
                          // Entrega do item principal (subitemIndex null/undefined = entrega do item, não de subitem)
                          const entregaItem = etapa.checklistEntregas?.find(
                            (e) => Number(e.checklistIndex) === index && (e.subitemIndex == null)
                          );
                          // Item marcado como concluído no checklist exibe "Aprovado"; senão usa status da entrega ou "Pendente"
                          const statusItem = item.concluido ? 'APROVADO' : (entregaItem?.status ?? 'PENDENTE');
                          const canApprove = canReview && statusItem === 'EM_ANALISE';
                          const itemLoading = reviewLoading[`${etapa.id}-${index}`] ?? false;
                          const detailsKey = `view-${etapa.id}-${index}`;
                          const isExpanded = expandedChecklistDetails.has(detailsKey);
                          const hasDetails = item.descricao && item.descricao.trim().length > 0;
                          const hasSubitens = item.subitens && item.subitens.length > 0;
                          const itemNumberLabel = `${etapaIndex + 1}.${index + 1}`;
                          
                          return (
                            <div key={`${etapa.id}-checklist-${index}`} className="space-y-1">
                              {/* Item principal — desktop: grid alinhado ao cabeçalho */}
                              <div
                                className={`hidden md:grid md:grid-cols-[auto_1fr_7rem_7rem_8rem] md:items-center md:gap-2 md:p-3 md:rounded-lg md:transition-colors ${
                                  podeMarcarChecklist ? 'hover:bg-white/10' : ''
                                } ${getChecklistItemStyle(statusItem)}`}
                              >
                                <div
                                  className={`w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center transition-all ${
                                    updatingChecklist === etapa.id || !podeMarcarChecklist
                                      ? 'opacity-50 cursor-not-allowed'
                                      : 'cursor-pointer'
                                  } ${getCheckboxStyle(item.concluido || false)}`}
                                  onClick={() => {
                                    if (updatingChecklist !== etapa.id && podeMarcarChecklist) {
                                      handleChecklistUpdate(etapa.id, index, !item.concluido);
                                    } else if (!podeMarcarChecklist) {
                                      toast.warning('Apenas o supervisor do projeto ou GM/DIRETOR podem atualizar o checklist');
                                    }
                                  }}
                                  title={podeMarcarChecklist ? "Status do item" : "Apenas supervisor do projeto ou GM/DIRETOR podem atualizar"}
                                >
                                  {item.concluido && (
                                    <svg className="w-4 h-4 text-white drop-shadow" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </div>
                                <div className="min-w-0 pl-1">
                                  <span className={`text-sm block truncate ${getChecklistTextStyle(item.concluido || false)}`}>
                                    {itemNumberLabel} {item.texto}
                                  </span>
                                </div>
                                <div className="flex justify-center">
                                  <span
                                    className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-semibold border whitespace-nowrap ${getChecklistItemStatusColor(statusItem)}`}
                                  >
                                    {getChecklistItemStatusLabel(statusItem)}
                                  </span>
                                </div>
                                <div className="text-center text-xs text-white/70">
                                  {entregaItem?.dataEnvio
                                    ? new Date(entregaItem.dataEnvio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                    : '—'}
                                </div>
                                <div className="flex flex-wrap items-center justify-end gap-1">
                                  {(hasDetails || hasSubitens) && (
                                    <button
                                      type="button"
                                      onClick={() => toggleChecklistDetails(detailsKey)}
                                      className={`${btn.editSm} shrink-0`}
                                      title={isExpanded ? 'Ocultar detalhes' : 'Ver detalhes e subitens'}
                                    >
                                      {hasSubitens ? `(${item.subitens!.length})` : ''} {isExpanded ? '▲' : '▼'}
                                    </button>
                                  )}
                                  {entregaItem && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedViewEntrega({ etapa, index, entrega: entregaItem });
                                        setShowViewEntregaModal(true);
                                      }}
                                      className={`${btn.primarySoft} shrink-0 whitespace-nowrap`}
                                      title="Ver detalhes da entrega"
                                    >
                                      Ver entrega
                                    </button>
                                  )}
                                  {canApprove && !hasSubitens && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={async (e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          try {
                                            setReviewLoading((prev) => ({ ...prev, [`${etapa.id}-${index}`]: true }));
                                            setError(null);
                                            await api.patch(`/tasks/${etapa.id}/checklist/${index}/review`, {
                                              status: 'APROVADO',
                                              comentario: reviewNotes[`${etapa.id}-${index}`]?.trim() || undefined,
                                            });
                                            setReviewNotes((prev) => ({ ...prev, [`${etapa.id}-${index}`]: '' }));
                                            await refreshProject(false);
                                          } catch (err: any) {
                                            const message = err.response?.data?.message ?? 'Falha ao aprovar objetivo';
                                            setError(message);
                                          } finally {
                                            setReviewLoading((prev) => ({ ...prev, [`${etapa.id}-${index}`]: false }));
                                          }
                                        }}
                                        className={btn.successSm}
                                        disabled={itemLoading}
                                      >
                                        Aprovar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async (e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          try {
                                            setReviewLoading((prev) => ({ ...prev, [`${etapa.id}-${index}`]: true }));
                                            setError(null);
                                            await api.patch(`/tasks/${etapa.id}/checklist/${index}/review`, {
                                              status: 'REPROVADO',
                                              comentario: reviewNotes[`${etapa.id}-${index}`]?.trim() || undefined,
                                            });
                                            await refreshProject(false);
                                          } catch (err: any) {
                                            const message = err.response?.data?.message ?? 'Falha ao recusar objetivo';
                                            setError(message);
                                          } finally {
                                            setReviewLoading((prev) => ({ ...prev, [`${etapa.id}-${index}`]: false }));
                                          }
                                        }}
                                        className={btn.dangerSm}
                                        disabled={itemLoading}
                                      >
                                        Recusar
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Item principal — mobile: layout em bloco */}
                              <div
                                className={`md:hidden flex flex-wrap items-center gap-2 p-3 rounded-lg transition-colors ${
                                  podeMarcarChecklist ? 'hover:bg-white/10' : ''
                                } ${getChecklistItemStyle(statusItem)}`}
                              >
                                <div
                                  className={`w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center transition-all ${
                                    updatingChecklist === etapa.id || !podeMarcarChecklist
                                      ? 'opacity-50 cursor-not-allowed'
                                      : 'cursor-pointer'
                                  } ${getCheckboxStyle(item.concluido || false)}`}
                                  onClick={() => {
                                    if (updatingChecklist !== etapa.id && podeMarcarChecklist) {
                                      handleChecklistUpdate(etapa.id, index, !item.concluido);
                                    } else if (!podeMarcarChecklist) {
                                      toast.warning('Apenas o supervisor do projeto ou GM/DIRETOR podem atualizar o checklist');
                                    }
                                  }}
                                  title={podeMarcarChecklist ? "Status do item" : "Apenas supervisor do projeto ou GM/DIRETOR podem atualizar"}
                                >
                                  {item.concluido && (
                                    <svg className="w-4 h-4 text-white drop-shadow" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className={`text-sm block truncate ${getChecklistTextStyle(item.concluido || false)}`}>
                                    {itemNumberLabel} {item.texto}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:flex-nowrap">
                                  <span
                                    className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-semibold border whitespace-nowrap ${getChecklistItemStatusColor(statusItem)}`}
                                  >
                                    {getChecklistItemStatusLabel(statusItem)}
                                  </span>
                                  {(hasDetails || hasSubitens) && (
                                    <button
                                      type="button"
                                      onClick={() => toggleChecklistDetails(detailsKey)}
                                      className={`${btn.editSm} shrink-0`}
                                      title={isExpanded ? 'Ocultar detalhes' : 'Ver detalhes e subitens'}
                                    >
                                      {hasSubitens ? `(${item.subitens!.length})` : ''} {isExpanded ? '▲' : '▼'}
                                    </button>
                                  )}
                                  {entregaItem && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedViewEntrega({ etapa, index, entrega: entregaItem });
                                        setShowViewEntregaModal(true);
                                      }}
                                      className={`${btn.primarySoft} shrink-0 whitespace-nowrap`}
                                      title="Ver detalhes da entrega"
                                    >
                                      Ver entrega
                                    </button>
                                  )}
                                </div>
                                {canApprove && !hasSubitens && (
                                  <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={async (e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          try {
                                            setReviewLoading((prev) => ({ ...prev, [`${etapa.id}-${index}`]: true }));
                                            setError(null);
                                            await api.patch(`/tasks/${etapa.id}/checklist/${index}/review`, {
                                              status: 'APROVADO',
                                              comentario: reviewNotes[`${etapa.id}-${index}`]?.trim() || undefined,
                                            });
                                            setReviewNotes((prev) => ({ ...prev, [`${etapa.id}-${index}`]: '' }));
                                            await refreshProject(false);
                                          } catch (err: any) {
                                            const message = err.response?.data?.message ?? 'Falha ao aprovar objetivo';
                                            setError(message);
                                            console.error('Erro ao aprovar:', err);
                                          } finally {
                                            setReviewLoading((prev) => ({ ...prev, [`${etapa.id}-${index}`]: false }));
                                          }
                                        }}
                                        className={btn.successSm}
                                        disabled={itemLoading}
                                      >
                                        Aprovar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async (e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          try {
                                            setReviewLoading((prev) => ({ ...prev, [`${etapa.id}-${index}`]: true }));
                                            setError(null);
                                            await api.patch(`/tasks/${etapa.id}/checklist/${index}/review`, {
                                              status: 'REPROVADO',
                                              comentario: reviewNotes[`${etapa.id}-${index}`]?.trim() || undefined,
                                            });
                                            await refreshProject(false);
                                          } catch (err: any) {
                                            const message = err.response?.data?.message ?? 'Falha ao recusar objetivo';
                                            setError(message);
                                            console.error('Erro ao recusar:', err);
                                          } finally {
                                            setReviewLoading((prev) => ({ ...prev, [`${etapa.id}-${index}`]: false }));
                                          }
                                        }}
                                        className={btn.dangerSm}
                                        disabled={itemLoading}
                                      >
                                        Recusar
                                      </button>
                                    </div>
                                    <input
                                      type="text"
                                      value={reviewNotes[`${etapa.id}-${index}`] ?? ''}
                                      onChange={(e) =>
                                        setReviewNotes((prev) => ({ ...prev, [`${etapa.id}-${index}`]: e.target.value }))
                                      }
                                      placeholder="Comentário (opcional)"
                                      disabled={itemLoading}
                                      className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                                    />
                                  </div>
                                )}
                              </div>
                              
                              {/* Detalhes expandidos (descrição + subitens) */}
                              {isExpanded && (
                                <div className="ml-4 pl-4 sm:ml-8 border-l-2 border-sky-500/30 space-y-2 py-2">
                                  {/* Descrição do item */}
                                  {hasDetails && (
                                    <div className="p-3 bg-sky-500/5 rounded-lg border border-sky-500/20">
                                      <p className="text-xs text-sky-300/70 mb-1 font-medium">Descrição:</p>
                                      <p className="text-sm text-white/80 whitespace-pre-wrap">{item.descricao}</p>
                                    </div>
                                  )}
                                  
                                  {/* Subitens: cada subitem tem sua própria entrega (data, status e ações) */}
                                {hasSubitens && (
                                    <div className="space-y-1">
                                      <p className="text-xs text-sky-300/70 font-medium mb-1">Subitens / Subcategorias (cada um com entrega independente):</p>
                                      <div className="grid grid-cols-[auto_1fr_4rem_auto_auto] gap-2 px-2 py-1 text-[10px] text-white/50 border-b border-white/10 mb-1">
                                        <span></span>
                                        <span>Subitem</span>
                                        <span className="text-center">Entrega</span>
                                        <span>Status</span>
                                        <span className="text-right">Ações</span>
                                      </div>
                                      {item.subitens!.map((subitem, subIndex) => {
                                        const subKey = `view-${etapa.id}-${index}-${subIndex}`;
                                        const subExpanded = expandedChecklistDetails.has(subKey);
                                        const subHasDetails = subitem.descricao && subitem.descricao.trim().length > 0;
                                        // Buscar entrega do subitem (comparação robusta: índices podem vir como number ou string do JSON)
                                        const entregaSubitem = etapa.checklistEntregas?.find(
                                          (e) =>
                                            Number(e.checklistIndex) === index &&
                                            e.subitemIndex != null &&
                                            Number(e.subitemIndex) === subIndex
                                        );
                                        // Subitem marcado como concluído exibe "Aprovado"; senão usa status da entrega ou "Pendente"
                                        const statusSubitem = subitem.concluido ? 'APROVADO' : (entregaSubitem?.status ?? 'PENDENTE');
                                        const canApproveSubitem = canReview && statusSubitem === 'EM_ANALISE';
                                        const subLoading = reviewLoading[`sub-${etapa.id}-${index}-${subIndex}`] ?? false;
                                        const subItemNumberLabel = `${etapaIndex + 1}.${index + 1}.${subIndex + 1}`;
                                        
                                        return (
                                          <div key={subIndex} className="space-y-1">
                                            <div
                                              className={`grid grid-cols-[auto_1fr_4rem_auto_auto] gap-2 items-center p-2 rounded-md transition-all ${
                                                subitem.concluido
                                                  ? 'bg-emerald-500/10 border border-emerald-500/20'
                                                  : 'bg-white/5 border border-white/10'
                                              }`}
                                            >
                                              <div
                                                className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer hover:scale-110 transition-transform ${
                                                  subitem.concluido
                                                    ? 'bg-emerald-500/30 border-emerald-400/50'
                                                    : 'border-slate-400/40 hover:border-slate-300'
                                                }`}
                                                title={subitem.concluido ? 'Concluído' : 'Pendente'}
                                              >
                                                {subitem.concluido && (
                                                  <svg className="w-3 h-3 text-emerald-300" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                  </svg>
                                                )}
                                              </div>
                                              <span className={`text-xs min-w-0 truncate ${subitem.concluido ? 'text-emerald-300/70 line-through' : 'text-white/80'}`}>
                                                {subItemNumberLabel} {subitem.texto}
                                              </span>
                                              <span className="text-[10px] text-white/60 text-center">
                                                {entregaSubitem?.dataEnvio
                                                  ? new Date(entregaSubitem.dataEnvio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                                  : '—'}
                                              </span>
                                              <span
                                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getChecklistItemStatusColor(statusSubitem)}`}
                                              >
                                                {getChecklistItemStatusLabel(statusSubitem)}
                                              </span>
                                              <div className="flex flex-wrap items-center justify-end gap-1">
                                              {entregaSubitem && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setSelectedViewEntrega({ etapa, index, entrega: entregaSubitem });
                                                    setShowViewEntregaModal(true);
                                                  }}
                                                  className={`${btn.primarySoft} shrink-0 whitespace-nowrap`}
                                                  title="Ver detalhes da entrega deste subitem"
                                                >
                                                  Ver entrega
                                                </button>
                                              )}
                                              {canApproveSubitem && (
                                                <div className="flex items-center gap-1">
                                                  <button
                                                    type="button"
                                                    onClick={async (e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      try {
                                                        setReviewLoading((prev) => ({ ...prev, [`sub-${etapa.id}-${index}-${subIndex}`]: true }));
                                                        setError(null);
                                                        await api.patch(
                                                          `/tasks/${etapa.id}/checklist/${index}/review`,
                                                          {
                                                            status: 'APROVADO',
                                                            comentario:
                                                              reviewNotes[`sub-${etapa.id}-${index}-${subIndex}`]?.trim() || undefined,
                                                          },
                                                          {
                                                            params: { subitemIndex: subIndex },
                                                          },
                                                        );
                                                        setReviewNotes((prev) => ({
                                                          ...prev,
                                                          [`sub-${etapa.id}-${index}-${subIndex}`]: '',
                                                        }));
                                                        await refreshProject(false);
                                                      } catch (err: any) {
                                                        const message =
                                                          err.response?.data?.message ?? 'Falha ao aprovar subitem';
                                                        setError(message);
                                                        console.error('Erro ao aprovar subitem:', err);
                                                      } finally {
                                                        setReviewLoading((prev) => ({
                                                          ...prev,
                                                          [`sub-${etapa.id}-${index}-${subIndex}`]: false,
                                                        }));
                                                      }
                                                    }}
                                                    className={btn.successSm}
                                                    disabled={subLoading}
                                                  >
                                                    Aprovar
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={async (e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      try {
                                                        setReviewLoading((prev) => ({ ...prev, [`sub-${etapa.id}-${index}-${subIndex}`]: true }));
                                                        setError(null);
                                                        await api.patch(
                                                          `/tasks/${etapa.id}/checklist/${index}/review`,
                                                          {
                                                            status: 'REPROVADO',
                                                            comentario:
                                                              reviewNotes[`sub-${etapa.id}-${index}-${subIndex}`]?.trim() || undefined,
                                                          },
                                                          {
                                                            params: { subitemIndex: subIndex },
                                                          },
                                                        );
                                                        await refreshProject(false);
                                                      } catch (err: any) {
                                                        const message =
                                                          err.response?.data?.message ?? 'Falha ao recusar subitem';
                                                        setError(message);
                                                        console.error('Erro ao recusar subitem:', err);
                                                      } finally {
                                                        setReviewLoading((prev) => ({
                                                          ...prev,
                                                          [`sub-${etapa.id}-${index}-${subIndex}`]: false,
                                                        }));
                                                      }
                                                    }}
                                                    className={btn.dangerSm}
                                                    disabled={subLoading}
                                                  >
                                                    Recusar
                                                  </button>
                                                </div>
                                              )}
                                              {canApproveSubitem && (
                                                <input
                                                  type="text"
                                                  value={reviewNotes[`sub-${etapa.id}-${index}-${subIndex}`] ?? ''}
                                                  onChange={(e) =>
                                                    setReviewNotes((prev) => ({
                                                      ...prev,
                                                      [`sub-${etapa.id}-${index}-${subIndex}`]: e.target.value,
                                                    }))
                                                  }
                                                  placeholder="Comentário (opcional)"
                                                  disabled={subLoading}
                                                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-[10px] text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 min-w-0 max-w-[8rem]"
                                                />
                                              )}
                                              {subHasDetails && (
                                                <button
                                                  type="button"
                                                  onClick={() => toggleChecklistDetails(subKey)}
                                                  className="px-1.5 py-0.5 rounded text-[10px] bg-slate-500/20 hover:bg-slate-500/30 text-slate-300 border border-slate-400/30 transition-colors"
                                                >
                                                  {subExpanded ? '▲' : '▼'}
                                                </button>
                                              )}
                                              </div>
                                            </div>
                                            {/* Descrição do subitem expandida */}
                                            {subExpanded && subHasDetails && (
                                              <div className="ml-6 p-3 bg-sky-500/5 rounded-lg border border-sky-500/20">
                                                <p className="text-xs text-sky-300/70 mb-1 font-medium">Descrição:</p>
                                                <p className="text-sm text-white/80 whitespace-pre-wrap">{subitem.descricao}</p>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {isExecutor && 
                       ['PENDENTE', 'EM_ANDAMENTO', 'REPROVADA'].includes(etapa.status) && 
                       !temItensMarcados && (
                        <div>
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

                  {/* Estoque da Etapa */}
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <label className="text-xs text-white/70 block font-medium mb-2">
                      Estoque
                    </label>
                    
                    {loadingEstoqueCompras[etapa.id] ? (
                      <p className="text-xs text-white/50">Carregando...</p>
                    ) : (
                      <div className="space-y-2">
                        {etapaEstoque[etapa.id] && etapaEstoque[etapa.id].length > 0 ? (
                          <div>
                            <p className="text-xs text-white/60 mb-1">Estoque ({etapaEstoque[etapa.id].length}):</p>
                            <div className="space-y-1">
                              {etapaEstoque[etapa.id].map((item: any) => (
                                <div key={item.id} className="text-xs text-white/80 flex items-center justify-between bg-white/5 p-2 rounded">
                                  <span>{item.item} - Qtd Alocada: {item.quantidade}</span>
                                  <span className="text-primary">
                                    {item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-white/50">Nenhum item de estoque relacionado</p>
                        )}
                      </div>
                    )}
                  </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
          </section>
        </div>
      </div>

      {/* Compras */}
      {/* Compras Relacionadas */}
      <div className="bg-neutral/80 border border-white/10 rounded-xl p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h3 className="text-lg font-semibold border-b border-white/10 pb-2">
            Compras Relacionadas ({project.compras.length})
          </h3>
          {(isDiretor || isSupervisor) && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {project.etapas.length > 1 && (
                <select
                  value={selectedEtapaForCompra?.id || ''}
                  onChange={(e) => {
                    const etapaId = Number(e.target.value);
                    const etapa = project.etapas.find((et) => et.id === etapaId);
                    setSelectedEtapaForCompra(etapa ?? null);
                  }}
                  className="w-full px-3 py-2 rounded-md bg-white/10 border border-white/30 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.75rem center',
                    paddingRight: '2.5rem',
                  }}
                >
                  <option value="" className="bg-neutral text-white">
                    Selecione a etapa
                  </option>
                  {project.etapas.map((etapa) => (
                    <option key={etapa.id} value={etapa.id} className="bg-neutral text-white">
                      {etapa.nome}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => {
                  // Se houver apenas uma etapa, selecionar automaticamente
                  if (project.etapas.length === 1) {
                    setSelectedEtapaForCompra(project.etapas[0]);
                    setCompraForm({
                      item: '',
                      descricao: '',
                      quantidade: 1,
                      cotacoes: [],
                      selectedCotacaoIndex: 0,
                      imagemUrl: '',
                    });
                    setShowCompraModal(true);
                  } else if (selectedEtapaForCompra) {
                    // Se houver múltiplas etapas e uma já foi selecionada
                    setCompraForm({
                      item: '',
                      descricao: '',
                      quantidade: 1,
                      cotacoes: [],
                      selectedCotacaoIndex: 0,
                      imagemUrl: '',
                    });
                    setShowCompraModal(true);
                  } else {
                    setError('Selecione uma etapa antes de solicitar a compra');
                  }
                }}
                disabled={project.etapas.length > 1 && !selectedEtapaForCompra}
                className={btn.primary}
              >
                + Solicitar Compra
              </button>
            </div>
          )}
        </div>

        {project.compras.length > 0 ? (
          <DataTable<Compra>
            data={filteredCompras}
            keyExtractor={(c) => c.id}
            emptyMessage="Nenhuma compra relacionada a este projeto"
            rowClassName={(c) => c.status === 'REPROVADO' ? 'bg-red-500/10' : ''}
            renderMobileCard={(c) => (
              <div className={`border rounded-xl p-4 space-y-3 ${c.status === 'REPROVADO' ? 'bg-red-500/10 border-red-500/30' : 'bg-neutral/60 border-white/10'}`}>
                {/* Cabeçalho: nome do item + status */}
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-white truncate flex-1">{c.item}</p>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded font-medium ${getStatusColor(c.status)}`}>
                    {getStatusLabel(c.status)}
                  </span>
                </div>
                {/* Motivo de rejeição */}
                {c.status === 'REPROVADO' && c.motivoRejeicao && (
                  <p className="text-xs text-red-300">Motivo: {c.motivoRejeicao}</p>
                )}
                {/* Grid: Qtd / Valor Unitário / Total */}
                <div className="grid grid-cols-3 gap-2 bg-white/5 rounded-lg p-3">
                  <div className="text-center">
                    <p className="text-xs text-white/50 mb-0.5">Qtd</p>
                    <p className="text-sm font-bold text-white">{c.quantidade}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-white/50 mb-0.5">Unitário</p>
                    <p className="text-xs font-medium text-white/80">
                      {c.valorUnitario
                        ? c.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '—'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-white/50 mb-0.5">Total</p>
                    <p className="text-xs font-semibold text-white">
                      {c.valorUnitario
                        ? (c.quantidade * c.valorUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : 'Aguardando'}
                    </p>
                  </div>
                </div>
                {(isDiretor || isSupervisor) && (
                  <div className="pt-1 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => handleDeleteCompra(c)}
                      disabled={deletingCompraId === c.id}
                      className={btn.dangerSm}
                    >
                      {deletingCompraId === c.id ? 'Excluindo...' : 'Excluir'}
                    </button>
                  </div>
                )}
              </div>
            )}
            columns={[
              {
                key: 'item',
                label: 'Item',
                render: (c) => (
                  <div>
                    <div>{c.item}</div>
                    {c.status === 'REPROVADO' && c.motivoRejeicao && (
                      <div className="text-xs text-red-300 mt-1">Motivo: {c.motivoRejeicao}</div>
                    )}
                  </div>
                ),
              },
              {
                key: 'quantidade',
                label: 'Quantidade',
                render: (c) => <span>{c.quantidade}</span>,
              },
              {
                key: 'valorUnitario',
                label: 'Valor Unitário',
                render: (c) => (
                  <span>
                    {c.valorUnitario
                      ? c.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                      : 'Aguardando cotação'}
                  </span>
                ),
              },
              {
                key: 'total',
                label: 'Total',
                render: (c) => (
                  <span className="font-semibold">
                    {c.valorUnitario
                      ? (c.quantidade * c.valorUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                      : 'Aguardando cotação'}
                  </span>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (c) => (
                  <span className={`px-2 py-1 rounded text-xs ${getStatusColor(c.status)}`}>
                    {getStatusLabel(c.status)}
                  </span>
                ),
              },
              ...((isDiretor || isSupervisor)
                ? [
                    {
                      key: 'acoes' as const,
                      label: 'Ações' as const,
                      stopRowClick: true,
                      render: (c: Compra) => (
                        <div className="flex items-center gap-1.5 flex-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDeleteCompra(c)}
                            disabled={deletingCompraId === c.id}
                            className={btn.dangerSm}
                          >
                            {deletingCompraId === c.id ? 'Excluindo...' : 'Excluir'}
                          </button>
                        </div>
                      ),
                    },
                  ]
                : []),
            ] satisfies DataTableColumn<Compra>[]}
          />
        ) : (
          <p className="text-white/50 text-sm">Nenhuma compra relacionada a este projeto</p>
        )}
      </div>
      
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
                <FileDropInput
                  accept="image/*"
                  onFilesSelected={(files) => {
                    void handleEntregaImagemChange(files[0]);
                  }}
                  className="w-full text-sm text-white/80 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
                  dropMessage="Solte a imagem aqui"
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
                  className={btn.secondary}
                  disabled={enviandoEntrega}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={btn.primary}
                  disabled={enviandoEntrega}
                >
                  {enviandoEntrega ? 'Enviando...' : 'Enviar para revisão'}
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
                {(() => {
                  const etapaIndex = project?.etapas?.findIndex((e: Etapa) => e.id === selectedViewEntrega.etapa.id) ?? 0;
                  const checklistItem = selectedViewEntrega.etapa.checklistJson?.[selectedViewEntrega.index];
                  const subIdx = selectedViewEntrega.entrega.subitemIndex;
                  const isSubitem = subIdx != null && Number(subIdx) >= 0;
                  const subitemLabel = isSubitem && checklistItem?.subitens?.[Number(subIdx)]
                    ? `${etapaIndex + 1}.${selectedViewEntrega.index + 1}.${Number(subIdx) + 1}. ${checklistItem.subitens[Number(subIdx)].texto}`
                    : null;
                  const mainLabel = checklistItem ? `${etapaIndex + 1}.${selectedViewEntrega.index + 1}. ${checklistItem.texto}` : `Objetivo #${selectedViewEntrega.index + 1}`;
                  return (
                    <>
                      <p className="text-sm text-white/60 mt-1">
                        {selectedViewEntrega.etapa.nome} • {subitemLabel ?? mainLabel}
                      </p>
                      {subitemLabel && (
                        <p className="text-xs text-white/40 mt-1">Subitem do objetivo: {checklistItem?.texto}</p>
                      )}
                    </>
                  );
                })()}
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
              {/* (() => {
                // Usuário pode editar se for executor ou integrante da etapa
                const executorId = selectedViewEntrega.etapa.executor.id;
                const integrantesIds =
                  selectedViewEntrega.etapa.integrantes?.map((i) => i.usuario.id).filter(Boolean) || [];
                const userId = user?.id ? Number(user.id) : null;
                const canEditFromModal =
                  !!userId &&
                  (userId === Number(executorId) ||
                    integrantesIds.some((id: number) => Number(id) === userId));

                return (
                  canEditFromModal && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setShowViewEntregaModal(false);
                          setSelectedChecklistEtapa(selectedViewEntrega.etapa);
                          setSelectedChecklistIndex(selectedViewEntrega.index);
                          setSelectedSubitemIndex(selectedViewEntrega.entrega.subitemIndex ?? null);
                          setObjetivoDescricao(selectedViewEntrega.entrega.descricao || '');
                          setObjetivoImagens([]);
                          setObjetivoDocumentos([]);
                          setObjetivoPreviews([]);
                          setObjetivoError(null);
                          setObjetivoLoading(false);
                          setShowChecklistModal(true);
                        }}
                        className={btn.primarySoft}
                      >
                        Editar entrega
                      </button>
                    </div>
                  )
                );
              })() */}
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
                      {imagens.map((url: string, index: number) => (
                        <img
                          key={index}
                          src={resolveFileUrl(url)}
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
                      {documentos.map((url: string, index: number) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            try {
                              const resolvedUrl = resolveFileUrl(url);
                              if (resolvedUrl.startsWith('data:')) {
                                // Base64 - criar blob e abrir
                                const parts = resolvedUrl.split(',');
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
                                window.open(resolvedUrl, '_blank');
                              }
                            } catch (error) {
                              console.error('Erro ao abrir documento:', error);
                              toast.error('Erro ao abrir documento. Tente novamente.');
                            }
                          }}
                          className={`${btn.primarySoft} w-full gap-2`}
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
                  {(() => {
                    // Status exibido deve refletir o estado atual do objetivo,
                    // considerando tanto a entrega quanto o checklist (item/subitem concluído).
                    const checklistItem =
                      selectedViewEntrega.etapa.checklistJson &&
                      selectedViewEntrega.etapa.checklistJson[selectedViewEntrega.index];

                    let displayStatus: 'PENDENTE' | 'EM_ANALISE' | 'APROVADO' | 'REPROVADO' =
                      (selectedViewEntrega.entrega.status as any) || 'PENDENTE';

                    if (checklistItem) {
                      const subIndex = (selectedViewEntrega.entrega as any).subitemIndex;

                      if (
                        subIndex !== null &&
                        subIndex !== undefined &&
                        Array.isArray(checklistItem.subitens) &&
                        checklistItem.subitens[subIndex] &&
                        checklistItem.subitens[subIndex].concluido
                      ) {
                        displayStatus = 'APROVADO';
                      } else if (checklistItem.concluido) {
                        displayStatus = 'APROVADO';
                      }
                    }

                    return (
                      <span
                        className={`inline-block px-3 py-1.5 rounded-md text-xs font-semibold ${getChecklistItemStatusColor(
                          displayStatus,
                        )}`}
                      >
                        {getChecklistItemStatusLabel(displayStatus)}
                      </span>
                    );
                  })()}
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

              {/* Aprovar/Reprovar no modal quando a entrega está em análise (item ou subitem) */}
              {(() => {
                const statusEntrega = (selectedViewEntrega.entrega.status as string) || 'PENDENTE';
                const emAnalise = statusEntrega === 'EM_ANALISE';
                const subIdx = selectedViewEntrega.entrega.subitemIndex;
                const podeAvaliarNoModal = canReview && emAnalise;
                if (!podeAvaliarNoModal) return null;
                return (
                  <div className="pt-4 border-t border-white/20 space-y-3">
                    <label className="block text-sm font-medium text-white/90">Comentário (opcional)</label>
                    <textarea
                      value={modalReviewComment}
                      onChange={(e) => setModalReviewComment(e.target.value)}
                      rows={2}
                      placeholder="Comentário para aprovação ou reprovação"
                      className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        type="button"
                        disabled={modalReviewLoading}
                        onClick={async () => {
                          setModalReviewLoading(true);
                          try {
                            await api.patch(
                              `/tasks/${selectedViewEntrega.etapa.id}/checklist/${selectedViewEntrega.index}/review`,
                              { status: 'APROVADO', comentario: modalReviewComment.trim() || undefined },
                              subIdx != null ? { params: { subitemIndex: Number(subIdx) } } : {}
                            );
                            setModalReviewComment('');
                            setShowViewEntregaModal(false);
                            setSelectedViewEntrega(null);
                            await refreshProject(false);
                            toast.success('Entrega aprovada.');
                          } catch (err: any) {
                            toast.error(err.response?.data?.message ?? 'Falha ao aprovar.');
                          } finally {
                            setModalReviewLoading(false);
                          }
                        }}
                        className={btn.successSm}
                      >
                        {modalReviewLoading ? '...' : 'Aprovar'}
                      </button>
                      <button
                        type="button"
                        disabled={modalReviewLoading}
                        onClick={async () => {
                          setModalReviewLoading(true);
                          try {
                            await api.patch(
                              `/tasks/${selectedViewEntrega.etapa.id}/checklist/${selectedViewEntrega.index}/review`,
                              { status: 'REPROVADO', comentario: modalReviewComment.trim() || undefined },
                              subIdx != null ? { params: { subitemIndex: Number(subIdx) } } : {}
                            );
                            setModalReviewComment('');
                            setShowViewEntregaModal(false);
                            setSelectedViewEntrega(null);
                            await refreshProject(false);
                            toast.success('Entrega reprovada.');
                          } catch (err: any) {
                            toast.error(err.response?.data?.message ?? 'Falha ao reprovar.');
                          } finally {
                            setModalReviewLoading(false);
                          }
                        }}
                        className={btn.dangerSm}
                      >
                        {modalReviewLoading ? '...' : 'Reprovar'}
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div className="flex justify-end pt-4 border-t border-white/20">
                <button
                  type="button"
                  onClick={() => {
                    setShowViewEntregaModal(false);
                    setSelectedViewEntrega(null);
                  }}
                  className={btn.secondary}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Aba */}
      {showAbaModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-white/20 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Nova aba de etapas</h2>
              <button
                type="button"
                onClick={() => setShowAbaModal(false)}
                className="text-white/50 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleConfirmNovaAba} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Nome da nova aba
                </label>
                <input
                  type="text"
                  value={novaAbaNome}
                  onChange={(e) => setNovaAbaNome(e.target.value)}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Ex: Software, Hardware, Geral 2..."
                  maxLength={60}
                  autoFocus
                />
                <p className="text-xs text-white/60 mt-1">
                  Essa aba será usada para agrupar etapas do mesmo tipo neste projeto.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/20">
                <button
                  type="button"
                  onClick={() => setShowAbaModal(false)}
                  className={btn.secondary}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={btn.primary}
                >
                  Continuar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Renomear Aba */}
      {showRenameAbaModal && selectedAba !== 'Todas' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-white/20 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Renomear aba</h2>
              <button
                type="button"
                onClick={() => setShowRenameAbaModal(false)}
                className="text-white/50 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!project || selectedAba === 'Todas') return;

                const from = selectedAba;
                const to = renameAbaNome.trim();
                if (!to || to.length < 2) {
                  toast.warning('Informe um novo nome de aba com pelo menos 2 caracteres.');
                  return;
                }

                try {
                  setAbaModalLoading(true);
                  setError(null);
                  await api.patch(`/projects/${project.id}/abas/rename`, { from, to });
                  // Atualizar seleção e limpar cache de abas extras
                  setSelectedAba(to);
                  setExtraAbas((prev) =>
                    prev
                      .map((a) => (a === from ? to : a))
                      .filter((a, index, arr) => arr.indexOf(a) === index),
                  );
                  await refreshProject(false);
                  toast.success('Aba renomeada com sucesso.');
                  setShowRenameAbaModal(false);
                } catch (err: any) {
                  const msg = formatApiError(err);
                  setError(msg);
                  toast.error(msg);
                } finally {
                  setAbaModalLoading(false);
                }
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Nome atual
                </label>
                <p className="text-sm text-white/80 bg-white/5 border border-white/20 rounded-md px-4 py-2.5">
                  {selectedAba}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Novo nome da aba
                </label>
                <input
                  type="text"
                  value={renameAbaNome}
                  onChange={(e) => setRenameAbaNome(e.target.value)}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Ex: Software, Hardware, Geral 2..."
                  maxLength={60}
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/20">
                <button
                  type="button"
                  onClick={() => setShowRenameAbaModal(false)}
                  className={btn.secondary}
                  disabled={abaModalLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={btn.primary}
                  disabled={abaModalLoading}
                >
                  {abaModalLoading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Excluir Aba */}
      {showDeleteAbaModal && selectedAba !== 'Todas' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-danger/40 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-danger/40 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-danger">Excluir aba</h2>
              <button
                type="button"
                onClick={() => setShowDeleteAbaModal(false)}
                className="text-white/50 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-white/80">
                Tem certeza que deseja excluir a aba <span className="font-semibold">{selectedAba}</span>?
              </p>
              <p className="text-xs text-white/60">
                As etapas que usam essa aba não serão apagadas. Elas apenas voltarão para a categoria geral (sem aba específica).
              </p>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/20">
                <button
                  type="button"
                  onClick={() => setShowDeleteAbaModal(false)}
                  className={btn.secondary}
                  disabled={abaModalLoading}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!project || selectedAba === 'Todas') return;
                    try {
                      setAbaModalLoading(true);
                      setError(null);
                      await api.patch(`/projects/${project.id}/abas/delete`, {
                        name: selectedAba,
                      });
                      setExtraAbas((prev) => prev.filter((a) => a !== selectedAba));
                      setSelectedAba('Todas');
                      await refreshProject(false);
                      toast.success('Aba excluída com sucesso.');
                      setShowDeleteAbaModal(false);
                    } catch (err: any) {
                      const msg = formatApiError(err);
                      setError(msg);
                      toast.error(msg);
                    } finally {
                      setAbaModalLoading(false);
                    }
                  }}
                  className={btn.danger}
                  disabled={abaModalLoading}
                >
                  {abaModalLoading ? 'Excluindo...' : 'Excluir aba'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Sessão */}
      {showSessaoModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-white/20 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Nova sessão</h2>
              <button type="button" onClick={() => setShowSessaoModal(false)} className="text-white/50 hover:text-white text-2xl">✕</button>
            </div>
            <form onSubmit={handleCreateSessao} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Nome da sessão</label>
                <input
                  type="text"
                  value={novaSessaoNome}
                  onChange={(e) => setNovaSessaoNome(e.target.value)}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Ex: Módulo 1, Fase Inicial..."
                  maxLength={120}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowSessaoModal(false)} className={btn.secondary}>Cancelar</button>
                <button type="submit" disabled={sessaoModalLoading || !novaSessaoNome.trim()} className={btn.primary}>
                  {sessaoModalLoading ? 'Criando...' : 'Criar sessão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Sessão */}
      {editingSessao && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-white/20 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Editar sessão</h2>
              <button type="button" onClick={() => { setEditingSessao(null); setEditSessaoNome(''); }} className="text-white/50 hover:text-white text-2xl">✕</button>
            </div>
            <form onSubmit={handleUpdateSessao} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Nome</label>
                <input
                  type="text"
                  value={editSessaoNome}
                  onChange={(e) => setEditSessaoNome(e.target.value)}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Nome da sessão"
                  maxLength={120}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setEditingSessao(null); setEditSessaoNome(''); }} className={btn.secondary}>Cancelar</button>
                <button type="submit" disabled={sessaoModalLoading || !editSessaoNome.trim()} className={btn.primary}>
                  {sessaoModalLoading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Excluir Sessão */}
      {showDeleteSessaoModal && sessaoToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-semibold text-white mb-2">Excluir sessão</h2>
            <p className="text-white/80 mb-4">
              Tem certeza que deseja excluir a sessão <span className="font-semibold">{sessaoToDelete.nome}</span>?
              As etapas desta sessão ficarão sem sessão (podem ser reatribuídas depois).
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setShowDeleteSessaoModal(false); setSessaoToDelete(null); }} className={btn.secondary}>Cancelar</button>
              <button type="button" onClick={handleDeleteSessao} disabled={sessaoModalLoading} className={btn.danger}>
                {sessaoModalLoading ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
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
                    sessaoId: undefined,
                    aba: '',
                    executorId: 0,
                    responsavelId: undefined,
                    integrantesIds: [],
                    dataInicio: '',
                    dataFim: '',
                    valorInsumos: 0,
                    checklist: [{ texto: '', concluido: false, descricao: '', subitens: [] }],
                    status: 'PENDENTE',
                    estoqueItems: [],
                  });
                  setStockSearchTerm('');
                  setSelectedStockItemId(null);
                  setSelectedStockQuantity(1);
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
                <label className="block text-sm font-medium text-white/90 mb-2">Sessão</label>
                <select
                  value={etapaForm.sessaoId ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEtapaForm({ ...etapaForm, sessaoId: v === '' ? undefined : Number(v) });
                  }}
                  className="w-full bg-neutral border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                >
                  <option value="">Nenhuma</option>
                  {project?.sessoes?.map((s) => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
                <p className="text-xs text-white/50 mt-1">Hierarquia: Sessão → Aba → Etapa</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Aba / Categoria
                </label>
                <select
                  value={etapaForm.aba || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '__nova__') {
                      handleAddAba();
                      return;
                    }
                    setEtapaForm({ ...etapaForm, aba: value });
                  }}
                  className="w-full bg-neutral border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 1rem center',
                    paddingRight: '2.5rem',
                  }}
                >
                  <option value="" className="bg-neutral text-white">
                    {abas.filter((a) => a !== 'Todas').length === 0
                      ? 'Nenhuma aba cadastrada ainda'
                      : 'Selecione uma aba...'}
                  </option>
                  {abas
                    .filter((a) => a !== 'Todas')
                    .map((abaNome) => (
                      <option key={abaNome} value={abaNome} className="bg-neutral text-white">
                        {abaNome}
                      </option>
                    ))}
                  <option value="__nova__" className="bg-neutral text-primary">
                    + Criar nova aba...
                  </option>
                </select>
                <p className="text-xs text-white/50 mt-1">
                  As abas são usadas para organizar etapas do mesmo tipo. Você também pode criar uma nova aba pelo botão acima da lista de etapas.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Executor *</label>
                <select
                  required
                  value={etapaForm.executorId || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEtapaForm({ ...etapaForm, executorId: value ? Number(value) : 0 });
                  }}
                  className="w-full bg-neutral border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 1rem center',
                    paddingRight: '2.5rem'
                  }}
                >
                  <option value="" className="bg-neutral text-white">Selecione um executor...</option>
                  {users
                    .filter((user) => {
                      if (!user) return false;
                      // Filtrar responsáveis do projeto e o supervisor
                      const isResponsavel = project?.responsaveis?.some((resp) => resp.usuario?.id === user.id) || false;
                      const isSupervisor = project?.supervisor?.id === user.id;
                      return isResponsavel || isSupervisor;
                    })
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
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-1">Responsável (aprovação)</label>
                <p className="text-xs text-white/60">
                  Será automaticamente o mesmo usuário definido como <strong>Executor</strong>.
                </p>
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
                  className="w-full bg-neutral border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 1rem center',
                    paddingRight: '2.5rem'
                  }}
                >
                  <option value="" className="bg-neutral text-white">Selecione um integrante...</option>
                  {users
                    .filter((user) => {
                      if (!user) return false;
                      // Filtrar responsáveis do projeto e o supervisor
                      const isResponsavel = project?.responsaveis?.some((resp) => resp.usuario?.id === user.id) || false;
                      const isSupervisor = project?.supervisor?.id === user.id;
                      // Não mostrar o executor nem os já selecionados
                      return (isResponsavel || isSupervisor) && user.id !== etapaForm.executorId && !etapaForm.integrantesIds.includes(user.id);
                    })
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
                <div className="space-y-4">
                  {etapaForm.checklist.map((item, index) => {
                    const formItemKey = `form-${index}`;
                    const isFormExpanded = expandedChecklistDetails.has(formItemKey);
                    
                    return (
                      <div key={`checklist-item-${index}`} className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-3">
                        {/* Linha principal: texto + botões */}
                        <div className="flex gap-2">
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
                            <span className="flex items-center gap-0.5" title="Ordem do item">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => {
                                  const newChecklist = [...etapaForm.checklist];
                                  [newChecklist[index - 1], newChecklist[index]] = [newChecklist[index], newChecklist[index - 1]];
                                  setEtapaForm({ ...etapaForm, checklist: newChecklist });
                                }}
                                className="p-1.5 rounded border border-white/20 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-white/80"
                                aria-label="Subir item"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                disabled={index === etapaForm.checklist.length - 1}
                                onClick={() => {
                                  const newChecklist = [...etapaForm.checklist];
                                  [newChecklist[index], newChecklist[index + 1]] = [newChecklist[index + 1], newChecklist[index]];
                                  setEtapaForm({ ...etapaForm, checklist: newChecklist });
                                }}
                                className="p-1.5 rounded border border-white/20 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-white/80"
                                aria-label="Descer item"
                              >
                                ↓
                              </button>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleChecklistDetails(formItemKey)}
                            className="px-3 py-2 rounded-md bg-slate-500/20 hover:bg-slate-500/30 text-slate-300 border border-slate-400/30 transition-colors text-sm"
                            title={isFormExpanded ? 'Ocultar detalhes' : 'Expandir detalhes'}
                          >
                            {isFormExpanded ? '▲' : '▼'}
                          </button>
                          {etapaForm.checklist.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newChecklist = etapaForm.checklist.filter((_, i) => i !== index);
                                setEtapaForm({ ...etapaForm, checklist: newChecklist });
                              }}
                              className={btn.dangerSm}
                            >
                              Remover
                            </button>
                          )}
                        </div>
                        
                        {/* Detalhes expandidos: descrição + subitens */}
                        {isFormExpanded && (
                          <div className="space-y-3 pl-2 border-l-2 border-white/10">
                            {/* Campo de descrição */}
                            <div>
                              <label className="block text-xs text-white/60 mb-1">Descrição / Detalhes (opcional)</label>
                              <textarea
                                value={item.descricao || ''}
                                onChange={(e) => {
                                  const newChecklist = [...etapaForm.checklist];
                                  newChecklist[index] = { ...newChecklist[index], descricao: e.target.value };
                                  setEtapaForm({ ...etapaForm, checklist: newChecklist });
                                }}
                                rows={2}
                                className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-primary"
                                placeholder="Descreva detalhes adicionais sobre este item..."
                              />
                            </div>
                            
                            {/* Subitens */}
                            <div>
                              <label className="block text-xs text-white/60 mb-2">Subitens / Subcategorias</label>
                              <div className="space-y-2">
                                {(item.subitens || []).map((subitem, subIndex) => {
                                  const subFormKey = `form-${index}-${subIndex}`;
                                  const isSubExpanded = expandedChecklistDetails.has(subFormKey);
                                  
                                  return (
                                    <div key={`subitem-${index}-${subIndex}`} className="bg-white/5 border border-white/10 rounded-md p-2 space-y-2">
                                      <div className="flex gap-2 items-center">
                                        <span className="text-white/40 text-xs">↳</span>
                                        <input
                                          type="text"
                                          value={subitem.texto}
                                          onChange={(e) => {
                                            const newChecklist = [...etapaForm.checklist];
                                            const newSubitens = [...(newChecklist[index].subitens || [])];
                                            newSubitens[subIndex] = { ...newSubitens[subIndex], texto: e.target.value };
                                            newChecklist[index] = { ...newChecklist[index], subitens: newSubitens };
                                            setEtapaForm({ ...etapaForm, checklist: newChecklist });
                                          }}
                                          className="flex-1 bg-white/10 border border-white/20 rounded px-3 py-1.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-primary"
                                          placeholder={`Subitem ${subIndex + 1}`}
                                        />
                                        {(item.subitens?.length ?? 0) > 1 && (
                                          <span className="flex items-center gap-0.5">
                                            <button
                                              type="button"
                                              disabled={subIndex === 0}
                                              onClick={() => {
                                                const newChecklist = [...etapaForm.checklist];
                                                const newSubitens = [...(newChecklist[index].subitens || [])];
                                                [newSubitens[subIndex - 1], newSubitens[subIndex]] = [newSubitens[subIndex], newSubitens[subIndex - 1]];
                                                newChecklist[index] = { ...newChecklist[index], subitens: newSubitens };
                                                setEtapaForm({ ...etapaForm, checklist: newChecklist });
                                              }}
                                              className="p-1 rounded border border-white/20 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white/80 text-xs"
                                              aria-label="Subir subitem"
                                            >↑</button>
                                            <button
                                              type="button"
                                              disabled={subIndex === (item.subitens?.length ?? 0) - 1}
                                              onClick={() => {
                                                const newChecklist = [...etapaForm.checklist];
                                                const newSubitens = [...(newChecklist[index].subitens || [])];
                                                [newSubitens[subIndex], newSubitens[subIndex + 1]] = [newSubitens[subIndex + 1], newSubitens[subIndex]];
                                                newChecklist[index] = { ...newChecklist[index], subitens: newSubitens };
                                                setEtapaForm({ ...etapaForm, checklist: newChecklist });
                                              }}
                                              className="p-1 rounded border border-white/20 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white/80 text-xs"
                                              aria-label="Descer subitem"
                                            >↓</button>
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => toggleChecklistDetails(subFormKey)}
                                          className="px-2 py-1 rounded text-xs bg-slate-500/20 hover:bg-slate-500/30 text-slate-300 border border-slate-400/30 transition-colors"
                                        >
                                          {isSubExpanded ? '▲' : '▼'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const newChecklist = [...etapaForm.checklist];
                                            const newSubitens = (newChecklist[index].subitens || []).filter((_, i) => i !== subIndex);
                                            newChecklist[index] = { ...newChecklist[index], subitens: newSubitens };
                                            setEtapaForm({ ...etapaForm, checklist: newChecklist });
                                          }}
                                          className="px-2 py-1 rounded text-xs bg-danger/20 hover:bg-danger/30 text-danger border border-danger/30 transition-colors"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                      {/* Descrição do subitem */}
                                      {isSubExpanded && (
                                        <div className="ml-4">
                                          <textarea
                                            value={subitem.descricao || ''}
                                            onChange={(e) => {
                                              const newChecklist = [...etapaForm.checklist];
                                              const newSubitens = [...(newChecklist[index].subitens || [])];
                                              newSubitens[subIndex] = { ...newSubitens[subIndex], descricao: e.target.value };
                                              newChecklist[index] = { ...newChecklist[index], subitens: newSubitens };
                                              setEtapaForm({ ...etapaForm, checklist: newChecklist });
                                            }}
                                            rows={2}
                                            className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-primary"
                                            placeholder="Descrição do subitem (opcional)..."
                                          />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newChecklist = [...etapaForm.checklist];
                                    const currentSubitens = newChecklist[index].subitens || [];
                                    newChecklist[index] = {
                                      ...newChecklist[index],
                                      subitens: [...currentSubitens, { texto: '', concluido: false, descricao: '' }],
                                    };
                                    setEtapaForm({ ...etapaForm, checklist: newChecklist });
                                  }}
                                  className="w-full py-1.5 rounded text-xs bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 border-dashed transition-colors"
                                >
                                  + Adicionar Subitem
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setEtapaForm({
                        ...etapaForm,
                        checklist: [...etapaForm.checklist, { texto: '', concluido: false, descricao: '', subitens: [] }],
                      });
                    }}
                    className={`${btn.secondary} w-full`}
                  >
                    + Adicionar Item
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Itens do Estoque</label>
                
                {/* Campo de pesquisa */}
                <input
                  type="text"
                  value={stockSearchTerm}
                  onChange={(e) => setStockSearchTerm(e.target.value)}
                  placeholder="Pesquisar itens do estoque..."
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary mb-3"
                />

                {/* Seleção de item e quantidade */}
                <div className="flex gap-2 mb-3">
                  <select
                    value={selectedStockItemId || ''}
                    onChange={(e) => {
                      const itemId = e.target.value ? Number(e.target.value) : null;
                      setSelectedStockItemId(itemId);
                      if (itemId) {
                        const item = availableStockItems.find((i) => i.id === itemId);
                        if (item) {
                          setSelectedStockQuantity(Math.min(1, item.quantidade || 1));
                        } else {
                          setSelectedStockQuantity(1);
                        }
                      } else {
                        setSelectedStockQuantity(1);
                      }
                    }}
                    className="flex-1 bg-neutral border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 1rem center',
                      paddingRight: '2.5rem'
                    }}
                    disabled={loadingStockItems}
                  >
                    <option value="" className="bg-neutral text-white">
                      {loadingStockItems ? 'Carregando...' : 'Selecione um item...'}
                    </option>
                    {availableStockItems
                      .filter((item) => {
                        // Filtrar por pesquisa
                        if (stockSearchTerm.trim()) {
                          const searchLower = stockSearchTerm.toLowerCase();
                          const itemName = (item.item || '').toLowerCase();
                          const itemDesc = (item.descricao || '').toLowerCase();
                          if (!itemName.includes(searchLower) && !itemDesc.includes(searchLower)) {
                            return false;
                          }
                        }
                        // Filtrar itens já selecionados
                        return !etapaForm.estoqueItems.some((ei) => ei.itemId === item.id);
                      })
                      .map((item) => {
                        // Calcular quantidade já alocada nesta etapa para este item
                        const quantidadeAlocadaNestaEtapa = etapaForm.estoqueItems
                          .filter((ei) => ei.itemId === item.id)
                          .reduce((sum, ei) => sum + ei.quantidade, 0);
                        
                        // Quantidade disponível real = quantidadeDisponivel original - quantidade já alocada nesta etapa
                        const quantidadeDisponivelReal = (item.quantidadeDisponivel ?? item.quantidade) - quantidadeAlocadaNestaEtapa;
                        
                        return (
                          <option key={item.id} value={item.id} className="bg-neutral text-white">
                            {item.item} - Disponível: {quantidadeDisponivelReal} - {item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </option>
                        );
                      })}
                  </select>
                  
                  {selectedStockItemId && (
                    <>
                      <input
                        type="number"
                        min="1"
                        value={selectedStockQuantity}
                        onChange={(e) => {
                          const item = availableStockItems.find((i) => i.id === selectedStockItemId);
                          if (!item) return;
                          
                          // Calcular quantidade já alocada nesta etapa para este item
                          const quantidadeAlocadaNestaEtapa = etapaForm.estoqueItems
                            .filter((ei) => ei.itemId === item.id)
                            .reduce((sum, ei) => sum + ei.quantidade, 0);
                          
                          // Quantidade disponível real = quantidadeDisponivel original - quantidade já alocada nesta etapa
                          const quantidadeDisponivelReal = (item.quantidadeDisponivel ?? item.quantidade) - quantidadeAlocadaNestaEtapa;
                          
                          const newValue = Math.max(1, Number(e.target.value));
                          setSelectedStockQuantity(Math.min(newValue, quantidadeDisponivelReal));
                        }}
                        placeholder="Qtd"
                        className="w-24 bg-white/10 border border-white/30 rounded-md px-3 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                      {availableStockItems.find((i) => i.id === selectedStockItemId) && (() => {
                        const item = availableStockItems.find((i) => i.id === selectedStockItemId);
                        if (!item) return null;
                        
                        // Calcular quantidade já alocada nesta etapa para este item
                        const quantidadeAlocadaNestaEtapa = etapaForm.estoqueItems
                          .filter((ei) => ei.itemId === item.id)
                          .reduce((sum, ei) => sum + ei.quantidade, 0);
                        
                        // Quantidade disponível real = quantidadeDisponivel original - quantidade já alocada nesta etapa
                        const quantidadeDisponivelReal = (item.quantidadeDisponivel ?? item.quantidade) - quantidadeAlocadaNestaEtapa;
                        
                        return (
                          <span className="text-xs text-white/60">
                            Disponível: {quantidadeDisponivelReal}
                          </span>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedStockItemId && selectedStockQuantity > 0) {
                            const item = availableStockItems.find((i) => i.id === selectedStockItemId);
                            if (!item) return;
                            
                            // Calcular quantidade já alocada nesta etapa para este item
                            const quantidadeAlocadaNestaEtapa = etapaForm.estoqueItems
                              .filter((ei) => ei.itemId === selectedStockItemId)
                              .reduce((sum, ei) => sum + ei.quantidade, 0);
                            
                            // Quantidade disponível real = quantidadeDisponivel original - quantidade já alocada nesta etapa
                            const quantidadeDisponivelReal = (item.quantidadeDisponivel ?? item.quantidade) - quantidadeAlocadaNestaEtapa;
                            
                            if (selectedStockQuantity <= quantidadeDisponivelReal) {
                              // Verificar se já existe na lista
                              const existingIndex = etapaForm.estoqueItems.findIndex(
                                (ei) => ei.itemId === selectedStockItemId
                              );
                              
                              if (existingIndex >= 0) {
                                // Atualizar quantidade existente
                                const newItems = [...etapaForm.estoqueItems];
                                newItems[existingIndex].quantidade += selectedStockQuantity;
                                setEtapaForm({
                                  ...etapaForm,
                                  estoqueItems: newItems,
                                });
                              } else {
                                // Adicionar novo item
                                setEtapaForm({
                                  ...etapaForm,
                                  estoqueItems: [
                                    ...etapaForm.estoqueItems,
                                    { itemId: selectedStockItemId, quantidade: selectedStockQuantity },
                                  ],
                                });
                              }
                              setSelectedStockItemId(null);
                              setSelectedStockQuantity(1);
                              setStockSearchTerm('');
                              setError(null);
                            } else {
                              setError(`Quantidade solicitada (${selectedStockQuantity}) excede a disponível (${quantidadeDisponivelReal})`);
                            }
                          }
                        }}
                        className={btn.primaryLg}
                      >
                        Adicionar
                      </button>
                    </>
                  )}
                </div>

                {/* Lista de itens selecionados */}
                {etapaForm.estoqueItems.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {etapaForm.estoqueItems.map((estoqueItem, index) => {
                      const item = availableStockItems.find((i) => i.id === estoqueItem.itemId);
                      if (!item) return null;
                      
                      // Calcular quantidade já alocada nesta etapa para este item (exceto o item atual)
                      const quantidadeAlocadaNestaEtapa = etapaForm.estoqueItems
                        .filter((ei, i) => ei.itemId === estoqueItem.itemId && i !== index)
                        .reduce((sum, ei) => sum + ei.quantidade, 0);
                      
                      // Quantidade disponível = quantidadeDisponivel original + quantidade já alocada nesta etapa (exceto atual)
                      const quantidadeDisponivelReal = (item.quantidadeDisponivel ?? item.quantidade) + quantidadeAlocadaNestaEtapa;
                      
                      return (
                        <div
                          key={`${estoqueItem.itemId}-${index}`}
                          className="flex items-center justify-between bg-white/5 border border-white/10 rounded-md px-3 py-2"
                        >
                          <div className="flex-1">
                            <span className="text-sm text-white/90 font-medium">{item.item}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-white/60">Quantidade:</span>
                              <input
                                type="number"
                                min="1"
                                max={quantidadeDisponivelReal}
                                value={estoqueItem.quantidade}
                                onChange={(e) => {
                                  const newQuantidade = Math.max(1, Number(e.target.value));
                                  const finalQuantidade = Math.min(newQuantidade, quantidadeDisponivelReal);
                                  
                                  const updatedItems = [...etapaForm.estoqueItems];
                                  updatedItems[index] = { ...updatedItems[index], quantidade: finalQuantidade };
                                  setEtapaForm({
                                    ...etapaForm,
                                    estoqueItems: updatedItems,
                                  });
                                }}
                                className="w-20 bg-white/10 border border-white/30 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                              />
                              <span className="text-xs text-white/60">
                                | Valor Unitário: {item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | 
                                Total: {(item.valorUnitario * estoqueItem.quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} |
                                Disponível: {quantidadeDisponivelReal - estoqueItem.quantidade}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEtapaForm({
                                ...etapaForm,
                                estoqueItems: etapaForm.estoqueItems.filter((_, i) => i !== index),
                              });
                            }}
                            className="text-danger hover:text-danger/80 text-sm font-medium transition-colors ml-3"
                          >
                            Remover
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {etapaForm.estoqueItems.length === 0 && (
                  <p className="text-xs text-white/50 mt-2">Nenhum item de estoque selecionado</p>
                )}
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
                      sessaoId: undefined,
                      aba: '',
                      executorId: 0,
                      responsavelId: undefined,
                      integrantesIds: [],
                      dataInicio: '',
                      dataFim: '',
                      valorInsumos: 0,
                      checklist: [{ texto: '', concluido: false, descricao: '', subitens: [] }],
                      status: 'PENDENTE',
                      estoqueItems: [],
                    });
                    setStockSearchTerm('');
                    setSelectedStockItemId(null);
                    setSelectedStockQuantity(1);
                  }}
                  className={btn.secondaryLg}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={btn.primaryLg}
                >
                  {submitting ? (editingEtapa ? 'Salvando...' : 'Criando...') : editingEtapa ? 'Salvar Alterações' : 'Criar Etapa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Criar Compra a partir de Etapa */}
      {showCompraModal && selectedEtapaForCompra && project && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral border-b border-white/20 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Solicitar Compra</h2>
                <p className="text-sm text-white/60 mt-1">Etapa: {selectedEtapaForCompra.nome}</p>
              </div>
              <button
                onClick={() => {
                  setShowCompraModal(false);
                  setSelectedEtapaForCompra(null);
                  setError(null);
                }}
                className="text-white/50 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSubmitting(true);
                setError(null);
                try {
                  const payload: any = {
                    projetoId: project.id,
                    etapaId: selectedEtapaForCompra.id,
                    item: compraForm.item.trim(),
                    quantidade: Number(compraForm.quantidade),
                  };

                  // Se houver cotações, adicionar ao payload
                  if (compraForm.cotacoes && compraForm.cotacoes.length > 0) {
                    const selectedCotacao = compraForm.cotacoes[compraForm.selectedCotacaoIndex ?? 0];
                    if (selectedCotacao) {
                      const totalPorUnidade = selectedCotacao.valorUnitario + selectedCotacao.frete + selectedCotacao.impostos;
                      payload.valorUnitario = Number(totalPorUnidade.toFixed(2));
                      payload.cotacoes = compraForm.cotacoes;
                    }
                  }

                  if (compraForm.descricao && compraForm.descricao.trim().length > 0) {
                    payload.descricao = compraForm.descricao.trim();
                  }

                  await api.post('/stock/purchases', payload);
                  
                  setShowCompraModal(false);
                  setSelectedEtapaForCompra(null);
                  setCompraForm({
                    item: '',
                    descricao: '',
                    quantidade: 1,
                    cotacoes: [{ valorUnitario: 0, frete: 0, impostos: 0 }],
                    selectedCotacaoIndex: 0,
                    imagemUrl: '',
                  });
                  
                  await loadEtapaEstoqueCompras(selectedEtapaForCompra.id);
                  await refreshProject();
                } catch (err: any) {
                  const message = err.response?.data?.message ?? 'Erro ao criar compra';
                  setError(typeof message === 'string' ? message : JSON.stringify(message));
                } finally {
                  setSubmitting(false);
                }
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Item <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={compraForm.item}
                  onChange={(e) => setCompraForm((prev) => ({ ...prev, item: e.target.value }))}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Nome do item"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Motivo da Solicitação</label>
                <textarea
                  value={compraForm.descricao}
                  onChange={(e) => setCompraForm((prev) => ({ ...prev, descricao: e.target.value }))}
                  rows={3}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Descreva o motivo da solicitação..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Quantidade <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={compraForm.quantidade}
                  onChange={(e) => setCompraForm((prev) => ({ ...prev, quantidade: Number(e.target.value) }))}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Cotações <span className="text-white/50 text-xs">(opcional - se não houver, será criada como solicitação)</span>
                </label>
                <div className="space-y-3">
                  {compraForm.cotacoes.map((cotacao, index) => (
                    <div key={index} className="bg-white/5 border border-white/10 rounded-md p-3 space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs text-white/70">Valor Unitário</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={cotacao.valorUnitario}
                            onChange={(e) => {
                              const newCotacoes = [...compraForm.cotacoes];
                              newCotacoes[index] = { ...newCotacoes[index], valorUnitario: Number(e.target.value) };
                              setCompraForm((prev) => ({ ...prev, cotacoes: newCotacoes }));
                            }}
                            className="w-full bg-white/10 border border-white/30 rounded-md px-2 py-1.5 text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-white/70">Frete</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={cotacao.frete}
                            onChange={(e) => {
                              const newCotacoes = [...compraForm.cotacoes];
                              newCotacoes[index] = { ...newCotacoes[index], frete: Number(e.target.value) };
                              setCompraForm((prev) => ({ ...prev, cotacoes: newCotacoes }));
                            }}
                            className="w-full bg-white/10 border border-white/30 rounded-md px-2 py-1.5 text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-white/70">Impostos</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={cotacao.impostos}
                            onChange={(e) => {
                              const newCotacoes = [...compraForm.cotacoes];
                              newCotacoes[index] = { ...newCotacoes[index], impostos: Number(e.target.value) };
                              setCompraForm((prev) => ({ ...prev, cotacoes: newCotacoes }));
                            }}
                            className="w-full bg-white/10 border border-white/30 rounded-md px-2 py-1.5 text-white text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-white/70">Link (opcional)</label>
                        <input
                          type="text"
                          value={cotacao.link || ''}
                          onChange={(e) => {
                            const newCotacoes = [...compraForm.cotacoes];
                            newCotacoes[index] = { ...newCotacoes[index], link: e.target.value };
                            setCompraForm((prev) => ({ ...prev, cotacoes: newCotacoes }));
                          }}
                          className="w-full bg-white/10 border border-white/30 rounded-md px-2 py-1.5 text-white text-sm"
                          placeholder="URL da cotação"
                        />
                      </div>
                      {compraForm.cotacoes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newCotacoes = compraForm.cotacoes.filter((_, i) => i !== index);
                            setCompraForm((prev) => ({ ...prev, cotacoes: newCotacoes, selectedCotacaoIndex: 0 }));
                          }}
                          className="text-xs text-danger hover:text-danger/80"
                        >
                          Remover cotação
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setCompraForm((prev) => ({
                        ...prev,
                        cotacoes: [...prev.cotacoes, { valorUnitario: 0, frete: 0, impostos: 0 }],
                      }));
                    }}
                    className={`${btn.secondary} w-full`}
                  >
                    + Adicionar Cotação
                  </button>
                </div>
              </div>

              {compraForm.cotacoes.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Cotação Selecionada <span className="text-danger">*</span>
                  </label>
                  <select
                    required
                    value={compraForm.selectedCotacaoIndex}
                    onChange={(e) => setCompraForm((prev) => ({ ...prev, selectedCotacaoIndex: Number(e.target.value) }))}
                    className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {compraForm.cotacoes.map((cot, index) => {
                      const total = cot.valorUnitario + cot.frete + cot.impostos;
                      return (
                        <option key={index} value={index} className="bg-neutral text-white">
                          Cotação {index + 1}: R$ {total.toFixed(2)} (Unit: R$ {cot.valorUnitario.toFixed(2)} + Frete: R$ {cot.frete.toFixed(2)} + Impostos: R$ {cot.impostos.toFixed(2)})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {error && (
                <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-md text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-white/20">
                <button
                  type="button"
                  onClick={() => {
                    setShowCompraModal(false);
                    setSelectedEtapaForCompra(null);
                    setError(null);
                  }}
                  className={btn.secondary}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={btn.primary}
                >
                  {submitting ? 'Criando...' : 'Criar Compra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Deleção de Etapa */}
      {showDeleteEtapaModal && etapaToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-neutral border border-white/20 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold text-white mb-4">Confirmar Exclusão</h2>
            <p className="text-white/80 mb-6">
              Tem certeza que deseja deletar a etapa <strong>"{etapaToDelete.nome}"</strong>?
              <br />
              <span className="text-sm text-white/60">Esta ação não pode ser desfeita.</span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteEtapaModal(false);
                  setEtapaToDelete(null);
                }}
                className={btn.secondary}
                disabled={deletingEtapa}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteEtapa}
                disabled={deletingEtapa}
                className={btn.danger}
              >
                {deletingEtapa ? 'Deletando...' : 'Deletar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Projeto */}
      {showEditProjectModal && project && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/10 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">
                Editar Projeto
              </h3>
              <button
                onClick={() => {
                  setShowEditProjectModal(false);
                  setEditProjectError(null);
                }}
                className="text-white/50 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitEditProject} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  Nome do Projeto <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={editProjectForm.nome}
                  onChange={(e) =>
                    setEditProjectForm((prev) => ({ ...prev, nome: e.target.value }))
                  }
                  className="w-full bg-neutral/60 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 border-white/10 focus:ring-primary"
                  required
                  maxLength={120}
                />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">Resumo</label>
                <textarea
                  value={editProjectForm.resumo}
                  onChange={(e) =>
                    setEditProjectForm((prev) => ({ ...prev, resumo: e.target.value }))
                  }
                  className="w-full bg-neutral/60 border border-white/10 rounded-md px-3 py-2 h-20 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">Objetivo</label>
                <textarea
                  value={editProjectForm.objetivo}
                  onChange={(e) =>
                    setEditProjectForm((prev) => ({ ...prev, objetivo: e.target.value }))
                  }
                  className="w-full bg-neutral/60 border border-white/10 rounded-md px-3 py-2 h-20 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">
                  Descrição detalhada do projeto
                </label>
                <textarea
                  value={projectDescricaoTexto}
                  onChange={(e) => setProjectDescricaoTexto(e.target.value)}
                  placeholder="Descreva o projeto, contexto, escopo, observações gerais..."
                  className="w-full bg-neutral/60 border border-white/10 rounded-md px-3 py-2 h-24 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
                <div className="mt-2 space-y-2">
                  <div>
                    <label className="block text-xs text-white/60 mb-1">
                      Arquivos e imagens do projeto
                    </label>
                    <FileDropInput
                      multiple
                      onFilesSelected={async (files) => {
                        if (!files.length) return;
                        try {
                          setProjectDescricaoSaving(true);
                          setProjectDescricaoError(null);
                          const formData = new FormData();
                          files.forEach((file) => formData.append('files', file));
                          const { data } = await api.post<ProjetoArquivo[]>(
                            `/projects/${project.id}/descricao-files`,
                            formData,
                            { headers: { 'Content-Type': 'multipart/form-data' } },
                          );
                          if (Array.isArray(data)) {
                            setProjectDescricaoArquivos(data);
                          }
                        } catch (err: any) {
                          const message = formatApiError(err);
                          setProjectDescricaoError(message);
                          toast.error(message);
                        } finally {
                          setProjectDescricaoSaving(false);
                        }
                      }}
                      className="mt-1 block w-full text-sm text-white/80 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary/80 file:text-white hover:file:bg-primary transition-colors cursor-pointer"
                      dropMessage="Solte arquivos do projeto aqui"
                    />
                  </div>
                  {projectDescricaoArquivos.length > 0 && (
                    <div className="mt-1 space-y-2 max-h-40 overflow-y-auto bg-black/10 rounded-md p-2">
                      {projectDescricaoArquivos.map((file, index) => {
                        const isImage = file.mimeType?.startsWith('image/');
                        const displayName = file.originalName || file.url;
                        return (
                          <div
                            key={`${file.url}-${index}`}
                            className="flex items-center gap-3 text-xs text-white/80"
                          >
                            {isImage && (
                              <a
                                href={resolveFileUrl(file.url)}
                                target="_blank"
                                rel="noreferrer"
                                className="shrink-0 w-12 h-12 rounded-md overflow-hidden border border-white/10 hover:border-primary/80 transition-colors"
                                title="Abrir imagem"
                              >
                                <img
                                  src={resolveFileUrl(file.url)}
                                  alt={displayName}
                                  className="w-full h-full object-cover"
                                />
                              </a>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="truncate">
                                {!isImage && '📎 '}{displayName}
                              </p>
                              <div className="mt-1 flex items-center gap-2">
                                <a
                                  href={resolveFileUrl(file.url)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center px-2 py-0.5 rounded border border-white/20 text-[11px] hover:border-primary hover:text-primary transition-colors"
                                >
                                  Abrir
                                </a>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const { data } = await api.delete<ProjetoArquivo[]>(
                                        `/projects/${project.id}/descricao-files`,
                                        { data: { url: file.url } },
                                      );
                                      if (Array.isArray(data)) {
                                        setProjectDescricaoArquivos(data);
                                      }
                                    } catch (err: any) {
                                      const message = formatApiError(err);
                                      setProjectDescricaoError(message);
                                      toast.error(message);
                                    }
                                  }}
                                  className="inline-flex items-center px-2 py-0.5 rounded border border-danger/60 text-[11px] text-danger hover:bg-danger/10 transition-colors"
                                >
                                  Remover
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {projectDescricaoError && (
                    <p className="text-xs text-danger mt-1">{projectDescricaoError}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">Valor Total (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={
                    typeof editProjectForm.valorTotal === 'number'
                      ? editProjectForm.valorTotal
                      : ''
                  }
                  onChange={(e) => {
                    const value = e.target.value ? Number(e.target.value) : undefined;
                    setEditProjectForm((prev) => ({ ...prev, valorTotal: value }));
                  }}
                  className="w-full bg-neutral/60 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 border-white/10 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">Status</label>
                <select
                  value={editProjectForm.status}
                  onChange={(e) =>
                    setEditProjectForm((prev) => ({
                      ...prev,
                      status: e.target.value as 'EM_ANDAMENTO' | 'FINALIZADO',
                    }))
                  }
                  className="w-full bg-neutral/60 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="EM_ANDAMENTO">Em Andamento</option>
                  <option value="FINALIZADO">Finalizado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Supervisor *</label>
                <select
                  required
                  value={editProjectForm.supervisorId ?? ''}
                  onChange={(e) => {
                    const newSupervisorId = e.target.value ? Number(e.target.value) : undefined;
                    setEditProjectForm((prev) => ({
                      ...prev,
                      supervisorId: newSupervisorId,
                      responsavelIds: prev.responsavelIds.filter((id) => id !== newSupervisorId),
                    }));
                  }}
                  className="w-full bg-neutral border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 1rem center',
                    paddingRight: '2.5rem',
                  }}
                >
                  <option value="" className="bg-neutral text-white">
                    Selecione um supervisor...
                  </option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id} className="bg-neutral text-white">
                      {u.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Responsáveis</label>
                <select
                  value=""
                  onChange={(e) => {
                    const selectedUserId = Number(e.target.value);
                    if (
                      selectedUserId &&
                      !editProjectForm.responsavelIds.includes(selectedUserId)
                    ) {
                      setEditProjectForm((prev) => ({
                        ...prev,
                        responsavelIds: [...prev.responsavelIds, selectedUserId],
                      }));
                    }
                  }}
                  className="w-full bg-neutral border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 1rem center',
                    paddingRight: '2.5rem',
                  }}
                >
                  <option value="" className="bg-neutral text-white">
                    Selecione um responsável...
                  </option>
                  {users
                    .filter(
                      (u) =>
                        !editProjectForm.responsavelIds.includes(u.id) &&
                        u.id !== editProjectForm.supervisorId,
                    )
                    .map((u) => (
                      <option key={u.id} value={u.id} className="bg-neutral text-white">
                        {u.nome}
                      </option>
                    ))}
                </select>
                {editProjectForm.responsavelIds.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {editProjectForm.responsavelIds.map((responsavelId) => {
                      const responsavel = users.find((u) => u.id === responsavelId);
                      if (!responsavel) return null;
                      return (
                        <div
                          key={responsavelId}
                          className="flex items-center justify-between bg-white/5 border border-white/10 rounded-md px-3 py-2"
                        >
                          <span className="text-sm text-white/90">{responsavel.nome}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setEditProjectForm((prev) => ({
                                ...prev,
                                responsavelIds: prev.responsavelIds.filter(
                                  (id) => id !== responsavelId,
                                ),
                              }))
                            }
                            className="text-danger hover:text-danger/80 text-sm font-medium transition-colors"
                          >
                            Remover
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {editProjectForm.responsavelIds.length === 0 && (
                  <p className="text-xs text-white/50 mt-2">
                    Nenhum responsável adicionado ainda
                  </p>
                )}
              </div>

              {editProjectError && (
                <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-md text-sm">
                  {editProjectError}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditProjectModal(false);
                    setEditProjectError(null);
                  }}
                  className={btn.secondaryLg}
                  disabled={editProjectSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={btn.primaryLg}
                  disabled={editProjectSubmitting}
                >
                  {editProjectSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}