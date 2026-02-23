import { useEffect, useState, FormEvent, useRef, ChangeEvent, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../store/auth';
import { ChecklistItemEntrega, ChecklistItem, ChecklistSubItem } from '../types';
import { btn } from '../utils/buttonStyles';
import { DataTable, DataTableColumn } from '../components/DataTable';
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

interface Etapa {
  id: number;
  nome: string;
  descricao?: string | null;
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'EM_ANALISE' | 'APROVADA' | 'REPROVADA';
  dataInicio?: string | null;
  dataFim?: string | null;
  valorInsumos?: number;
  checklistJson?: ChecklistItem[] | null;
  executor: Usuario;
  responsavel?: Usuario | null;
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
  /** IDs das etapas expandidas (conteúdo visível). Inicializado com todas ao carregar o projeto. */
  const [expandedEtapas, setExpandedEtapas] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (project?.etapas?.length) {
      setExpandedEtapas(new Set(project.etapas.map((e) => e.id)));
    }
  }, [project?.id, project?.etapas?.length]);

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

      if (etapaForm.responsavelId != null && etapaForm.responsavelId > 0) {
        payload.responsavelId = etapaForm.responsavelId;
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
      executorId: etapa.executor?.id || 0,
      responsavelId: etapa.responsavel?.id || undefined,
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
        <div className="min-w-0 flex-1 text-right">
          <h2 className="text-xl font-bold truncate sm:text-2xl">{project.nome}</h2>
          <span className={`inline-block mt-1 px-2 py-1 rounded text-xs ${projectStatusColor}`}>
            {projectStatusLabel}
          </span>
        </div>
      </div>

      {/* Informações Gerais */}
      <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-neutral/80 border border-white/10 rounded-xl p-4 space-y-4 sm:p-6">
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
      <div className="bg-neutral/80 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold border-b border-white/10 pb-2">
          Etapas ({totalEtapas})
        </h3>
          {isDiretor && (
            <button
              onClick={async () => {
                setEditingEtapa(null);
                setEtapaForm({
                  nome: '',
                  descricao: '',
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
                // Carregar itens de estoque disponíveis
                await loadAvailableStockItems();
                setShowEtapaModal(true);
              }}
              className={btn.primary}
            >
              + Adicionar Etapa
            </button>
          )}
        </div>
        {project.etapas.length === 0 ? (
          <p className="text-white/50 text-center py-8">Nenhuma etapa cadastrada</p>
        ) : (
          <div className="space-y-4">
            {project.etapas.map((etapa, etapaIndex) => {
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

              return (
                <div key={etapa.id} className="bg-neutral/60 border border-white/10 rounded-lg p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div
                      className="flex-1 flex items-start gap-2 cursor-pointer min-w-0"
                      onClick={() => toggleEtapa(etapa.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && toggleEtapa(etapa.id)}
                      aria-expanded={expandedEtapas.has(etapa.id)}
                      aria-label={expandedEtapas.has(etapa.id) ? 'Retrair etapa' : 'Expandir etapa'}
                    >
                      <span
                        className="shrink-0 text-white/70 mt-0.5 inline-flex transition-transform duration-300 ease-out"
                        style={{ transform: expandedEtapas.has(etapa.id) ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                        aria-hidden
                      >
                        ▼
                      </span>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-white/90">{etapa.nome}</h4>
                        {etapa.descricao && (
                          <p className={`text-sm mt-1 ${expandedEtapas.has(etapa.id) ? 'text-white/70' : 'text-white/50 line-clamp-1'}`}>
                            {etapa.descricao}
                          </p>
                        )}
                      </div>
                    </div>
                      <div className="flex flex-col items-start md:items-end gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {canEditProject && (
                          <span className="flex items-center gap-0.5 mr-1" title="Ordem da etapa">
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
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(etapa.status)}`}>
                          {getStatusLabel(etapa.status)}
                        </span>
                        {isDiretor && (
                          <>
                            <button onClick={() => handleEditEtapa(etapa)} className={btn.editSm}>
                              Editar
                            </button>
                            <button 
                              onClick={() => handleDeleteEtapa(etapa)} 
                              className={btn.dangerSm}
                            >
                              Deletar
                            </button>
                          </>
                        )}
                      </div>
                      {isExecutor && etapa.status === 'EM_ANALISE' && (
                        <span className="text-xs text-white/60">Aguardando avaliação do supervisor</span>
                      )}
                      {isExecutor && 
                       ['PENDENTE', 'EM_ANDAMENTO', 'REPROVADA'].includes(etapa.status) && 
                       !temItensMarcados && 
                       totalItens > 0 && (
                        <span>
                        </span>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-sm text-white/70">
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
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-xs text-white/70 block font-medium">
                          Checklist de Objetos ({etapa.checklistJson.length})
                          {podeMarcarChecklist && (
                            <span className="text-white/50 text-xs ml-2">(Você pode marcar os itens)</span>
                          )}
                        </label>
                        {podeMarcarChecklist && totalItens > 0 && (
                          <span className="text-xs text-white/60">
                            {itensMarcados} de {totalItens} marcado{itensMarcados !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

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
                          // Entrega do item principal (ignorar entregas de subitens)
                          const entregaItem = etapa.checklistEntregas?.find(
                            (e) => e.checklistIndex === index && (e.subitemIndex === null || e.subitemIndex === undefined)
                          );
                          // Item marcado como concluído no checklist exibe "Aprovado"; senão usa status da entrega ou "Pendente"
                          const statusItem = item.concluido ? 'APROVADO' : (entregaItem?.status ?? 'PENDENTE');
                          const canApprove = canReview && statusItem === 'EM_ANALISE';
                          const itemLoading = reviewLoading[`${etapa.id}-${index}`] ?? false;
                          const detailsKey = `view-${etapa.id}-${index}`;
                          const isExpanded = expandedChecklistDetails.has(detailsKey);
                          const hasDetails = item.descricao && item.descricao.trim().length > 0;
                          const hasSubitens = item.subitens && item.subitens.length > 0;
                          
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
                                    {item.texto}
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
                                    {item.texto}
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
                                  
                                  {/* Subitens */}
                                {hasSubitens && (
                                    <div className="space-y-1">
                                      <p className="text-xs text-sky-300/70 font-medium">Subitens / Subcategorias:</p>
                                      {item.subitens!.map((subitem, subIndex) => {
                                        const subKey = `view-${etapa.id}-${index}-${subIndex}`;
                                        const subExpanded = expandedChecklistDetails.has(subKey);
                                        const subHasDetails = subitem.descricao && subitem.descricao.trim().length > 0;
                                        // Buscar entrega do subitem
                                        const entregaSubitem = etapa.checklistEntregas?.find(
                                          (e) => e.checklistIndex === index && e.subitemIndex === subIndex
                                        );
                                        // Subitem marcado como concluído exibe "Aprovado"; senão usa status da entrega ou "Pendente"
                                        const statusSubitem = subitem.concluido ? 'APROVADO' : (entregaSubitem?.status ?? 'PENDENTE');
                                        const canApproveSubitem = canReview && statusSubitem === 'EM_ANALISE';
                                        const subLoading = reviewLoading[`sub-${etapa.id}-${index}-${subIndex}`] ?? false;
                                        
                                        return (
                                          <div key={subIndex} className="space-y-1">
                                            <div
                                              className={`flex items-center gap-2 p-2 rounded-md transition-all ${
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
                                              <span className={`flex-1 text-xs ${subitem.concluido ? 'text-emerald-300/70 line-through' : 'text-white/80'}`}>
                                                {subitem.texto}
                                              </span>
                                              <span
                                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getChecklistItemStatusColor(statusSubitem)}`}
                                              >
                                                {getChecklistItemStatusLabel(statusSubitem)}
                                              </span>
                                              {entregaSubitem && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setSelectedViewEntrega({ etapa, index, entrega: entregaSubitem });
                                                    setShowViewEntregaModal(true);
                                                  }}
                                                  className={btn.primarySoft}
                                                  title="Ver detalhes da entrega"
                                                >
                                                  Ver
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
                                                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-[10px] text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
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
                      {imagens.map((url: string, index: number) => (
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
                      {documentos.map((url: string, index: number) => (
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
                  className={btn.secondary}
                >
                  Fechar
                </button>
              </div>
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
                <label className="block text-sm font-medium text-white/90 mb-2">Responsável (aprovação)</label>
                <p className="text-xs text-white/60 mb-1">Quem pode aprovar/reprovar itens desta etapa pela tela Meu trabalho (não precisa ter acesso à aba Projetos)</p>
                <select
                  value={etapaForm.responsavelId ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEtapaForm({ ...etapaForm, responsavelId: value ? Number(value) : undefined });
                  }}
                  className="w-full bg-neutral border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 1rem center',
                    paddingRight: '2.5rem'
                  }}
                >
                  <option value="" className="bg-neutral text-white">Nenhum</option>
                  {users
                    .filter((u) => u && u.id !== etapaForm.executorId)
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
    </div>
  );
}

