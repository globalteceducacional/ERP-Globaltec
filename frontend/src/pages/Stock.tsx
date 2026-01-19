import { useEffect, useState, FormEvent, useMemo } from 'react';
import { api } from '../services/api';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx-js-style';
import { toast, formatApiError } from '../utils/toast';
import { useFormValidation, validators, errorMessages } from '../utils/validation';

// Tipos importados
import type { 
  Cotacao, 
  StockItem, 
  Purchase, 
  Projeto, 
  Supplier, 
  Category, 
  SimpleUser,
  CreateItemForm,
  CreatePurchaseForm,
  StockTab,
  PurchaseSubTab,
  SortDirection,
} from '../types/stock';

// Constantes importadas
import { 
  STATUS_ENTREGA_OPTIONS as statusEntregaOptions,
  FORMAS_PAGAMENTO as formasPagamento,
  INITIAL_COTACAO,
} from '../constants/stock';

// Componentes importados
import { 
  SupplierModal, 
  CategoryModal,
  PurchaseFilters,
} from '../components/stock';

// Helpers importados
import {
  updateCotacao as updateCotacaoHelper,
  addCotacao as addCotacaoHelper,
  removeCotacao as removeCotacaoHelper,
  compressImage,
  getSupplierName as getSupplierNameHelper,
  getCategoryName as getCategoryNameHelper,
} from '../utils/stockHelpers';

// Hooks importados
import { useStockData } from '../hooks/useStockData';
import { usePurchaseFilters } from '../hooks/usePurchaseFilters';

export default function Stock() {
  // Hook para gerenciar dados do estoque
  const {
    items,
    purchases,
    projects,
    suppliers,
    categories,
    users,
    loading: dataLoading,
    error: dataError,
    load: loadData,
    loadUsers: loadUsersData,
    setItems,
    setPurchases,
    setSuppliers,
    setCategories,
    loadEtapas: loadEtapasFromHook,
    loadAlocacoes,
  } = useStockData();

  const [etapas, setEtapas] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<StockItem | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [showEditPurchaseModal, setShowEditPurchaseModal] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState<Purchase | null>(null);
  const [showDeletePurchaseModal, setShowDeletePurchaseModal] = useState(false);
  const [deletingPurchase, setDeletingPurchase] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [purchaseToUpdateStatus, setPurchaseToUpdateStatus] = useState<Purchase | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [newStatusEntrega, setNewStatusEntrega] = useState<string>('');
  const [newPrevisaoEntrega, setNewPrevisaoEntrega] = useState<string>('');
  const [newDataEntrega, setNewDataEntrega] = useState<string>('');
  const [newEnderecoEntrega, setNewEnderecoEntrega] = useState<string>('');
  const [newRecebidoPor, setNewRecebidoPor] = useState<string>('');
  const [newObservacao, setNewObservacao] = useState<string>('');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<number | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPurchases, setSelectedPurchases] = useState<number[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [activeTab, setActiveTab] = useState<StockTab>('estoque');
  
  // Hook para filtros de compras
  const purchaseFiltersHook = usePurchaseFilters(
    purchases,
    activeTab,
    selectedProjectFilter,
    searchTerm
  );

  // Extrair valores do hook para compatibilidade com código existente
  const {
    subTab: purchaseSubTab,
    setSubTab: setPurchaseSubTab,
    filters: purchaseFiltersState,
    setFilters: setPurchaseFilters,
    showFilters: showPurchaseFilters,
    setShowFilters: setShowPurchaseFilters,
    clearFilters: clearPurchaseFilters,
    hasActiveFilters,
    sortColumn,
    sortDirection,
    handleSort,
    filteredPurchases,
    sortedPurchases,
    purchaseCounts,
  } = purchaseFiltersHook;

  // Aliases para compatibilidade
  const purchaseSearchTerm = purchaseFiltersState.searchTerm;
  const purchaseCategoryFilter = purchaseFiltersState.categoryFilter;
  const purchaseDateCompraInicio = purchaseFiltersState.dateCompraInicio;
  const purchaseDateCompraFim = purchaseFiltersState.dateCompraFim;
  const purchaseDateEntregaInicio = purchaseFiltersState.dateEntregaInicio;
  const purchaseDateEntregaFim = purchaseFiltersState.dateEntregaFim;
  const purchaseDateSolicitacaoInicio = purchaseFiltersState.dateSolicitacaoInicio;
  const purchaseDateSolicitacaoFim = purchaseFiltersState.dateSolicitacaoFim;
  
  // Funções setter para compatibilidade
  const setPurchaseSearchTerm = (value: string) => setPurchaseFilters({ ...purchaseFiltersState, searchTerm: value });
  const setPurchaseCategoryFilter = (value: number | 'all') => setPurchaseFilters({ ...purchaseFiltersState, categoryFilter: value });
  const setPurchaseDateCompraInicio = (value: string) => setPurchaseFilters({ ...purchaseFiltersState, dateCompraInicio: value });
  const setPurchaseDateCompraFim = (value: string) => setPurchaseFilters({ ...purchaseFiltersState, dateCompraFim: value });
  const setPurchaseDateEntregaInicio = (value: string) => setPurchaseFilters({ ...purchaseFiltersState, dateEntregaInicio: value });
  const setPurchaseDateEntregaFim = (value: string) => setPurchaseFilters({ ...purchaseFiltersState, dateEntregaFim: value });
  const setPurchaseDateSolicitacaoInicio = (value: string) => setPurchaseFilters({ ...purchaseFiltersState, dateSolicitacaoInicio: value });
  const setPurchaseDateSolicitacaoFim = (value: string) => setPurchaseFilters({ ...purchaseFiltersState, dateSolicitacaoFim: value });
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [purchaseToReject, setPurchaseToReject] = useState<Purchase | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [purchaseToApprove, setPurchaseToApprove] = useState<Purchase | null>(null);
  const [showViewRequestModal, setShowViewRequestModal] = useState(false);
  const [purchaseToView, setPurchaseToView] = useState<Purchase | null>(null);
  const [approveCotacoes, setApproveCotacoes] = useState<Cotacao[]>([{ valorUnitario: 0, frete: 0, impostos: 0, desconto: 0, link: '', fornecedorId: undefined, formaPagamento: '' }]);
  const [selectedCotacaoIndex, setSelectedCotacaoIndex] = useState<number>(0);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showAlocacaoModal, setShowAlocacaoModal] = useState(false);
  const [itemParaAlocar, setItemParaAlocar] = useState<StockItem | null>(null);
  const [alocacoes, setAlocacoes] = useState<any[]>([]);
  const [alocacaoForm, setAlocacaoForm] = useState({
    projetoId: undefined as number | undefined,
    etapaId: undefined as number | undefined,
    usuarioId: undefined as number | undefined,
    quantidade: 1,
  });
  const [currentCotacaoIndex, setCurrentCotacaoIndex] = useState<number | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showItemDetailsModal, setShowItemDetailsModal] = useState(false);
  const [itemToView, setItemToView] = useState<StockItem | null>(null);
  const [showPurchaseDetailsModal, setShowPurchaseDetailsModal] = useState(false);
  const [purchaseToViewDetails, setPurchaseToViewDetails] = useState<Purchase | null>(null);
  const [itemForm, setItemForm] = useState<CreateItemForm>({
    item: '',
    codigo: '',
    categoriaId: undefined,
    descricao: '',
    quantidade: 1,
    valorUnitario: 0,
    unidadeMedida: 'UN',
    localizacao: '',
    imagemUrl: '',
  });
  const [purchaseForm, setPurchaseForm] = useState<CreatePurchaseForm>({
    item: '',
    descricao: '',
    quantidade: 1,
    imagemUrl: '',
    nfUrl: '',
    comprovantePagamentoUrl: '',
    cotacoes: [{ valorUnitario: 0, frete: 0, impostos: 0, desconto: 0, link: '', fornecedorId: undefined, formaPagamento: '' }],
    projetoId: 0,
    selectedCotacaoIndex: 0,
    dataCompra: '',
    categoriaId: undefined,
    observacao: '',
  });

  // Regras de validação para item de estoque
  const itemValidationRules = useMemo(() => ({
    item: [
      { validator: validators.required, message: errorMessages.required },
      { validator: validators.minLength(2), message: errorMessages.minLength(2) },
    ],
    quantidade: [
      { validator: validators.required, message: errorMessages.required },
      { validator: validators.positive, message: errorMessages.positive },
    ],
    valorUnitario: [
      { validator: (v: number) => v >= 0, message: 'O valor deve ser maior ou igual a zero' },
    ],
  }), []);

  // Regras de validação para compra
  const purchaseValidationRules = useMemo(() => ({
    item: [
      { validator: validators.required, message: errorMessages.required },
      { validator: validators.minLength(2), message: errorMessages.minLength(2) },
    ],
    quantidade: [
      { validator: validators.required, message: errorMessages.required },
      { validator: validators.positive, message: errorMessages.positive },
    ],
  }), []);

  // Validação de formulários
  const itemValidation = useFormValidation<CreateItemForm>(itemValidationRules);
  const purchaseValidation = useFormValidation<CreatePurchaseForm>(purchaseValidationRules);

  // Funções auxiliares usando helpers
  const getSupplierName = (fornecedorId?: number) => getSupplierNameHelper(fornecedorId, suppliers);
  const getCategoryName = (categoriaId?: number) => getCategoryNameHelper(categoriaId, categories);

  // Função para carregar etapas (wrapper do hook)
  async function loadEtapas(projetoId: number) {
    const etapasData = await loadEtapasFromHook(projetoId);
    setEtapas(etapasData);
    return etapasData;
  }

  // Função para abrir modal de categoria
  function openCategoryModal() {
    setShowCategoryModal(true);
  }

  // Callback quando categoria é criada
  function handleCategoryCreated(newCategory: Category) {
    // Atualizar lista de categorias
    setCategories([...categories, newCategory]);
    // Selecionar a categoria recém-criada no formulário de compra
    setPurchaseForm({ ...purchaseForm, categoriaId: newCategory.id });
  }

  // Função para abrir modal de fornecedor
  function openSupplierModal(cotacaoIndex: number) {
    setCurrentCotacaoIndex(cotacaoIndex);
    setShowSupplierModal(true);
  }

  // Callback quando fornecedor é criado
  function handleSupplierCreated(newSupplier: Supplier) {
    // Atualizar lista de fornecedores
    setSuppliers([...suppliers, newSupplier]);
    
    // Selecionar o fornecedor recém-criado na cotação atual
    if (currentCotacaoIndex !== null) {
      // Verificar se está no modal de aprovação ou no formulário de compra
      if (showViewRequestModal && approveCotacoes.length > currentCotacaoIndex) {
        const newCotacoes = [...approveCotacoes];
        newCotacoes[currentCotacaoIndex].fornecedorId = newSupplier.id;
        setApproveCotacoes(newCotacoes);
      } else if (purchaseForm.cotacoes.length > currentCotacaoIndex) {
        updateCotacao(purchaseForm, setPurchaseForm, currentCotacaoIndex, 'fornecedorId', newSupplier.id);
      }
    }
    setCurrentCotacaoIndex(null);
  }

  // Resetar sub-aba quando mudar de aba
  useEffect(() => {
    if (activeTab !== 'compras') {
      setPurchaseSubTab('pendente');
    }
  }, [activeTab, setPurchaseSubTab]);

  // Função load para compatibilidade (usa o hook)
  const load = loadData;

  // Filtrar items baseado nos filtros
  const filteredItems = items.filter((item) => {
    // Filtro por busca
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      const itemName = item.item?.toLowerCase() || '';
      const itemDesc = item.descricao?.toLowerCase() || '';
      if (!itemName.includes(searchLower) && !itemDesc.includes(searchLower)) {
        return false;
      }
    }
    
    return true;
  });

  // A ordenação do hook não inclui a lógica especial de 'cotacoes', então vamos usar sortedPurchases do hook
  // mas aplicar ordenação adicional se necessário para 'cotacoes'
  const finalSortedPurchases = useMemo(() => {
    if (sortColumn === 'cotacoes') {
      return [...filteredPurchases].sort((a, b) => {
        const cotacoesA = a.cotacoesJson && Array.isArray(a.cotacoesJson) ? a.cotacoesJson : [];
        const cotacoesB = b.cotacoesJson && Array.isArray(b.cotacoesJson) ? b.cotacoesJson : [];
        const totalA = cotacoesA.reduce((sum: number, cot: any) => {
          const total = (cot.valorUnitario || 0) + (cot.frete || 0) + (cot.impostos || 0) - (cot.desconto || 0);
          return sum + (total * (a.quantidade || 1));
        }, 0);
        const totalB = cotacoesB.reduce((sum: number, cot: any) => {
          const total = (cot.valorUnitario || 0) + (cot.frete || 0) + (cot.impostos || 0) - (cot.desconto || 0);
          return sum + (total * (b.quantidade || 1));
        }, 0);
        if (totalA < totalB) return sortDirection === 'asc' ? -1 : 1;
        if (totalA > totalB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortedPurchases;
  }, [filteredPurchases, sortedPurchases, sortColumn, sortDirection]);

  // Função auxiliar para renderizar header ordenável
  const renderSortableHeader = (column: string, label: string) => {
    const isSorted = sortColumn === column;
    return (
      <th 
        className="px-4 py-3 text-left cursor-pointer hover:bg-white/10 transition-colors select-none"
        onClick={() => handleSort(column)}
      >
        <div className="flex items-center gap-1.5">
          <span>{label}</span>
          <div className="flex flex-col items-center justify-center">
            {isSorted ? (
              sortDirection === 'asc' ? (
                <svg 
                  className="w-3 h-3 text-primary"
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                >
                  <path d="M5 12l5-5 5 5H5z" />
                </svg>
              ) : (
                <svg 
                  className="w-3 h-3 text-primary"
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                >
                  <path d="M5 8l5 5 5-5H5z" />
                </svg>
              )
            ) : (
              <div className="flex flex-col -space-y-0.5">
                <svg 
                  className="w-2.5 h-2.5 text-white/30"
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                >
                  <path d="M5 12l5-5 5 5H5z" />
                </svg>
                <svg 
                  className="w-2.5 h-2.5 text-white/30"
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                >
                  <path d="M5 8l5 5 5-5H5z" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </th>
    );
  };

  function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      SOLICITADO: 'Solicitado',
      REPROVADO: 'Reprovado',
      PENDENTE: 'Pendente',
      COMPRADO_ACAMINHO: 'Comprado/A Caminho',
      ENTREGUE: 'Entregue',
    };
    return labels[status] || status;
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'SOLICITADO':
        return 'bg-amber-500/20 text-amber-300 border border-amber-500/40';
      case 'REPROVADO':
        return 'bg-red-500/20 text-red-300 border border-red-500/40';
      case 'PENDENTE':
        return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40';
      case 'COMPRADO_ACAMINHO':
        return 'bg-blue-500/20 text-blue-300 border border-blue-500/40';
      case 'ENTREGUE':
        return 'bg-green-500/20 text-green-300 border border-green-500/40';
      default:
        return 'bg-gray-500/20 text-gray-300 border border-gray-500/40';
    }
  }

  function getStatusEntregaLabel(status: string): string {
    const labels: Record<string, string> = {
      NAO_ENTREGUE: 'Não Entregue',
      PARCIAL: 'Parcial',
      ENTREGUE: 'Entregue',
      CANCELADO: 'Cancelado',
    };
    return labels[status] || status;
  }

  function getStatusEntregaColor(status: string): string {
    switch (status) {
      case 'NAO_ENTREGUE':
        return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40';
      case 'PARCIAL':
        return 'bg-orange-500/20 text-orange-300 border border-orange-500/40';
      case 'ENTREGUE':
        return 'bg-green-500/20 text-green-300 border border-green-500/40';
      case 'CANCELADO':
        return 'bg-red-500/20 text-red-300 border border-red-500/40';
      default:
        return 'bg-gray-500/20 text-gray-300 border border-gray-500/40';
    }
  }

  function calculateTotal(cotacao: Cotacao, quantidade: number): number {
    return (cotacao.valorUnitario + cotacao.frete + cotacao.impostos - (cotacao.desconto || 0)) * quantidade;
  }

  // Usar helpers importados
  const updateCotacao = updateCotacaoHelper;
  const addCotacao = addCotacaoHelper;
  const removeCotacao = removeCotacaoHelper;

  function togglePurchaseSelection(purchaseId: number) {
    setSelectedPurchases((prev) =>
      prev.includes(purchaseId)
        ? prev.filter((id) => id !== purchaseId)
        : [...prev, purchaseId]
    );
  }

  function toggleAllPurchases() {
    if (selectedPurchases.length === finalSortedPurchases.length && finalSortedPurchases.length > 0) {
      setSelectedPurchases([]);
    } else {
      setSelectedPurchases(finalSortedPurchases.map((p) => p.id));
    }
  }

  function getSelectedPurchasesData() {
    return purchases.filter((p) => selectedPurchases.includes(p.id));
  }

  function calculateReportTotals() {
    const selected = getSelectedPurchasesData();
    const totalValor = selected.reduce((sum, p) => sum + (p.valorUnitario * (p.quantidade || 0)), 0);
    const totalQuantidade = selected.reduce((sum, p) => sum + (p.quantidade || 0), 0);
    const totalItens = selected.length;
    
    return {
      totalValor,
      totalQuantidade,
      totalItens,
      purchases: selected,
    };
  }

  function exportToExcel() {
    try {
      const reportData = calculateReportTotals();
      
      // Criar workbook
      const wb = XLSX.utils.book_new();
      
      // Preparar dados da tabela principal
      const headers = [
        'Projeto', 'Item', 'Categoria', 'Quantidade', 'Valor Unitário', 'Valor Total', 'Status', 
        'Solicitado Por', 'Cargo', 'Data Compra', 'Forma Pagamento', 'Previsão Entrega', 
        'Data Entrega', 'Status Entrega', 'Recebido Por', 'Fornecedor', 'Descrição', 'Observações'
      ];
      
      const tableData: any[][] = [headers];
      
      // Agrupar por projeto
      const projetoGroups: Record<number, Purchase[]> = {};
      reportData.purchases.forEach((purchase) => {
        const projetoId = purchase.projetoId || 0;
        if (!projetoGroups[projetoId]) {
          projetoGroups[projetoId] = [];
        }
        projetoGroups[projetoId].push(purchase);
      });
      
      // Preencher dados
      Object.entries(projetoGroups).forEach(([projetoId, projetoPurchases]) => {
        const projeto = projects.find((p) => p.id === Number(projetoId));
        
        projetoPurchases.forEach((purchase) => {
          const cotacoes = purchase.cotacoesJson && Array.isArray(purchase.cotacoesJson) ? purchase.cotacoesJson : [];
          const cotacaoSelecionada = cotacoes.length > 0 ? cotacoes[0] : null;
          const valorTotal = purchase.valorUnitario * (purchase.quantidade || 0);
          
          tableData.push([
            projeto ? projeto.nome : 'Sem Projeto',
            purchase.item,
            (purchase as any).categoriaId ? getCategoryName((purchase as any).categoriaId) : '-',
            purchase.quantidade || 0,
            purchase.valorUnitario, // Valor numérico para formatação
            valorTotal, // Valor numérico para formatação
            getStatusLabel(purchase.status),
            purchase.solicitadoPor?.nome || '-',
            purchase.solicitadoPor?.cargo?.nome || '-',
            purchase.dataCompra ? new Date(purchase.dataCompra) : null,
            purchase.formaPagamento || '-',
            purchase.status === 'COMPRADO_ACAMINHO' && purchase.previsaoEntrega 
              ? new Date(purchase.previsaoEntrega) 
              : null,
            purchase.dataEntrega ? new Date(purchase.dataEntrega) : null,
            purchase.statusEntrega ? getStatusLabel(purchase.statusEntrega) : '-',
            purchase.recebidoPor || '-',
            cotacaoSelecionada?.fornecedorId ? getSupplierName(cotacaoSelecionada.fornecedorId) : '-',
            purchase.descricao || '-',
            purchase.observacao || '-',
          ]);
        });
      });
      
      // Criar worksheet
      const ws = XLSX.utils.aoa_to_sheet(tableData);
      
      // Definir range da tabela
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      
      // Estilo do cabeçalho (azul escuro com texto branco)
      const headerStyle: any = {
        fill: {
          fgColor: { rgb: '1E3A8A' } // Azul escuro
        },
        font: {
          color: { rgb: 'FFFFFF' }, // Branco
          bold: true,
          sz: 11
        },
        alignment: {
          horizontal: 'center',
          vertical: 'center',
          wrapText: true
        },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };
      
      // Aplicar estilo ao cabeçalho
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!ws[cellAddress]) {
          ws[cellAddress] = { t: 's', v: '' };
        }
        ws[cellAddress].s = headerStyle;
      }
      
      // Estilo das linhas de dados (alternando cores)
      for (let row = 1; row <= range.e.r; row++) {
        const isEven = row % 2 === 0;
        const rowStyle: any = {
          fill: {
            fgColor: { rgb: isEven ? 'E8F4F8' : 'FFFFFF' } // Azul claro alternado com branco
          },
          font: {
            color: { rgb: '000000' },
            sz: 10
          },
          alignment: {
            vertical: 'center',
            wrapText: true
          },
          border: {
            top: { style: 'thin', color: { rgb: 'D0D0D0' } },
            bottom: { style: 'thin', color: { rgb: 'D0D0D0' } },
            left: { style: 'thin', color: { rgb: 'D0D0D0' } },
            right: { style: 'thin', color: { rgb: 'D0D0D0' } }
          }
        };
        
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (!ws[cellAddress]) continue;
          
          // Formatação especial para colunas numéricas
          if (col === 3) { // Quantidade
            ws[cellAddress].s = {
              ...rowStyle,
              numFmt: '#,##0'
            };
          } else if (col === 4 || col === 5) { // Valor Unitário e Valor Total
            ws[cellAddress].s = {
              ...rowStyle,
              numFmt: '"R$" #,##0.00'
            };
          } else if (col === 9 || col === 11 || col === 12) { // Datas
            if (ws[cellAddress].v && ws[cellAddress].v instanceof Date) {
              ws[cellAddress].s = {
                ...rowStyle,
                numFmt: 'dd/mm/yyyy'
              };
            } else {
              ws[cellAddress].s = rowStyle;
            }
          } else {
            ws[cellAddress].s = rowStyle;
          }
        }
      }
      
      // Ajustar largura das colunas
      ws['!cols'] = [
        { wch: 20 }, // Projeto
        { wch: 30 }, // Item
        { wch: 20 }, // Categoria
        { wch: 12 }, // Quantidade
        { wch: 15 }, // Valor Unitário
        { wch: 15 }, // Valor Total
        { wch: 18 }, // Status
        { wch: 20 }, // Solicitado Por
        { wch: 15 }, // Cargo
        { wch: 12 }, // Data Compra
        { wch: 15 }, // Forma Pagamento
        { wch: 15 }, // Previsão Entrega
        { wch: 12 }, // Data Entrega
        { wch: 15 }, // Status Entrega
        { wch: 18 }, // Recebido Por
        { wch: 25 }, // Fornecedor
        { wch: 40 }, // Descrição
        { wch: 40 }, // Observações
      ];
      
      // Adicionar filtros automáticos na primeira linha
      const filterRange = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: range.e.r, c: range.e.c } });
      ws['!autofilter'] = { ref: filterRange };
      
      // Congelar primeira linha (cabeçalho) - será aplicado pelo Excel ao abrir
      ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' };
      
      // Adicionar ao workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Compras');
      
      // Gerar arquivo
      const fileName = `relatorio-compras-${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast.success('Relatório Excel gerado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao gerar Excel:', error);
      toast.error('Erro ao gerar relatório Excel: ' + (error.message || 'Erro desconhecido'));
    }
  }


  // Função para comprimir imagem e garantir que fique dentro do limite
  async function processImageUrl(imageUrl: string, maxLength: number = 50000): Promise<string> {
    try {
    // Se for uma URL (não base64), apenas truncar se necessário
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      if (imageUrl.length > maxLength) {
        console.warn(`URL muito longa (${imageUrl.length} chars), truncando para ${maxLength}`);
        return imageUrl.substring(0, maxLength);
      }
      return imageUrl;
    }

    // Se for base64 (data:image/...)
    if (imageUrl.startsWith('data:image/')) {
      // Se já está dentro do limite, retornar como está
      if (imageUrl.length <= maxLength) {
        return imageUrl;
      }

      // Tentar comprimir a imagem
        return new Promise((resolve, reject) => {
        const img = new Image();
          
        img.onload = () => {
            try {
          // Criar canvas e redimensionar/comprimir
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
                console.error('Não foi possível criar contexto do canvas');
                // Tentar retornar a imagem original mesmo que esteja grande
                // Melhor ter uma imagem grande do que nenhuma
                if (imageUrl.length <= maxLength * 3) {
                  resolve(imageUrl);
                } else {
                  reject(new Error('Não foi possível processar a imagem. Canvas não disponível.'));
                }
            return;
          }

          // Calcular tamanho máximo mantendo proporção
          let width = img.width;
          let height = img.height;
              
              // Garantir que as dimensões são válidas
              if (width <= 0 || height <= 0 || !isFinite(width) || !isFinite(height)) {
                console.error('Dimensões inválidas da imagem:', width, height);
                reject(new Error('Dimensões inválidas da imagem'));
                return;
              }

          const maxDimension = 800; // Tamanho máximo para comprimir
          let quality = 0.8;

          // Redimensionar se necessário
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
              
              // Configurar suavização para melhor qualidade
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              
          ctx.drawImage(img, 0, 0, width, height);

          // Tentar comprimir até ficar dentro do limite
          let compressed = canvas.toDataURL('image/jpeg', quality);
          let attempts = 0;
              const maxAttempts = 15;

          // Primeiro, tentar reduzir qualidade
          while (compressed.length > maxLength && attempts < maxAttempts && quality > 0.1) {
                quality -= 0.05;
            compressed = canvas.toDataURL('image/jpeg', quality);
            attempts++;
          }

          // Se ainda estiver muito grande, reduzir o tamanho da imagem
          if (compressed.length > maxLength) {
                let scale = 0.7; // Começar reduzindo para 70%
            attempts = 0;
            
                while (compressed.length > maxLength && attempts < 15 && scale > 0.2) {
                  const currentWidth = Math.floor(width * scale);
                  const currentHeight = Math.floor(height * scale);
              
              // Garantir tamanho mínimo
                  if (currentWidth < 100 || currentHeight < 100) {
                break;
              }
              
              canvas.width = currentWidth;
              canvas.height = currentHeight;
              ctx.drawImage(img, 0, 0, currentWidth, currentHeight);
                  compressed = canvas.toDataURL('image/jpeg', 0.5);
              scale -= 0.1;
              attempts++;
            }
          }

              // Se ainda estiver muito grande, reduzir ainda mais
          if (compressed.length > maxLength) {
                const finalWidth = Math.max(200, Math.floor(width * 0.4));
                const finalHeight = Math.max(200, Math.floor(height * 0.4));
            canvas.width = finalWidth;
            canvas.height = finalHeight;
            ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
                compressed = canvas.toDataURL('image/jpeg', 0.4);
              }
            
              // Se ainda assim exceder muito, retornar a versão comprimida mesmo assim
              // Melhor ter uma imagem comprimida do que nenhuma
            if (compressed.length > maxLength) {
                console.warn(`Imagem comprimida ainda excede o limite (${compressed.length} > ${maxLength} chars), mas será aceita.`);
                resolve(compressed);
              return;
          }

          resolve(compressed);
            } catch (error) {
              console.error('Erro ao processar imagem:', error);
              // Em caso de erro, tentar retornar a imagem original se estiver dentro de um limite razoável
              if (imageUrl.length <= maxLength * 2) {
                resolve(imageUrl);
              } else {
                reject(error);
              }
            }
          };
          
          img.onerror = (error) => {
            console.error('Erro ao carregar imagem:', error);
            reject(new Error('Não foi possível carregar a imagem. Verifique se o arquivo é uma imagem válida.'));
        };
          
        img.src = imageUrl;
      });
    }

    // Se não for nem URL nem base64, retornar como está (truncado se necessário)
    return imageUrl.length > maxLength ? imageUrl.substring(0, maxLength) : imageUrl;
    } catch (error) {
      console.error('Erro geral ao processar imagem:', error);
      throw error;
    }
  }

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>, setForm: (f: any) => void, form: any) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    // Validar tipo de arquivo (imagens ou PDF)
    const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!isValidType) {
      setError('Por favor, selecione um arquivo de imagem ou PDF válido.');
      event.target.value = ''; // Limpar o input
      return;
    }

    // Limitar tamanho do arquivo (5MB)
      const maxFileSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxFileSize) {
      setError('Arquivo muito grande. Por favor, escolha um arquivo menor que 5MB.');
      event.target.value = ''; // Limpar o input
        return;
      }

    // Limpar erros anteriores
    setError(null);

      const reader = new FileReader();
    
      reader.onloadend = async () => {
      try {
        const base64 = reader.result as string;
        if (!base64) {
          setError('Erro ao ler o arquivo. Por favor, tente novamente.');
          return;
        }

        // Se for PDF, apenas adicionar ao formulário sem processar
        if (file.type === 'application/pdf') {
          setForm({ ...form, imagemUrl: base64 });
          setError(null);
          return;
        }

        // Processar e comprimir a imagem
        const processed = await processImageUrl(base64);
        if (processed && processed.length > 0) {
          setForm({ ...form, imagemUrl: processed });
          setError(null); // Limpar erros em caso de sucesso
        } else {
          setError('Erro ao processar imagem. Por favor, tente novamente com outra imagem.');
        }
      } catch (err: any) {
        console.error('Erro ao processar imagem:', err);
        setError(err.message || 'Erro ao processar imagem. Por favor, tente novamente.');
        }
      };
    
    reader.onerror = () => {
      setError('Erro ao ler o arquivo. Por favor, tente novamente.');
      event.target.value = ''; // Limpar o input
    };
    
      reader.readAsDataURL(file);
  }

  async function handleDeleteItem() {
    if (!itemToDelete) return;
    
    setDeleting(true);
    setError(null);

    try {
      await api.delete(`/stock/items/${itemToDelete.id}`);
      setShowDeleteModal(false);
      setItemToDelete(null);
      load();
      toast.success('Item de estoque removido com sucesso!');
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  }

  async function handleUpdateItem(event: FormEvent) {
    event.preventDefault();
    if (!editingItem) return;
    
    setError(null);
    setSubmitting(true);

    try {
      const payload: any = {};
      
      // Adicionar campos apenas se tiverem valor válido
      if (itemForm.item && itemForm.item.trim().length > 0) {
        payload.item = itemForm.item.trim();
      }
      
      if (itemForm.descricao && itemForm.descricao.trim().length > 0) {
        payload.descricao = itemForm.descricao.trim();
      }
      
      if (itemForm.quantidade && itemForm.quantidade > 0) {
        payload.quantidade = Number(itemForm.quantidade);
      }
      
      if (itemForm.valorUnitario !== undefined) {
        payload.valorUnitario = Number(itemForm.valorUnitario);
      }
      
      if (itemForm.imagemUrl && itemForm.imagemUrl.trim().length > 0) {
        const processedImageUrl = await processImageUrl(itemForm.imagemUrl.trim());
        if (processedImageUrl && processedImageUrl.length > 0) {
          payload.imagemUrl = processedImageUrl;
        }
      }
      
      if (itemForm.categoriaId !== undefined) {
        payload.categoriaId = itemForm.categoriaId ? Number(itemForm.categoriaId) : null;
      }
      
      await api.patch(`/stock/items/${editingItem.id}`, payload);
      
      setShowEditModal(false);
      setEditingItem(null);
      setItemForm({
        item: '',
        codigo: '',
        categoriaId: undefined,
        descricao: '',
        quantidade: 1,
        valorUnitario: 0,
        unidadeMedida: 'UN',
        localizacao: '',
        imagemUrl: '',
      });
      load();
      toast.success('Item de estoque atualizado com sucesso!');
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateItem(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // Preparar payload
      const payload: any = {
        item: itemForm.item.trim(),
        quantidade: Number(itemForm.quantidade),
        valorUnitario: Number(itemForm.valorUnitario) || 0,
      };

      // Adicionar campos opcionais apenas se tiverem valor válido
      if (itemForm.descricao && itemForm.descricao.trim().length > 0) {
        payload.descricao = itemForm.descricao.trim();
      }
      
      if (itemForm.imagemUrl && itemForm.imagemUrl.trim().length > 0) {
        const processedImageUrl = await processImageUrl(itemForm.imagemUrl.trim());
        if (processedImageUrl && processedImageUrl.length > 0) {
          payload.imagemUrl = processedImageUrl;
        }
      }
      
      if (itemForm.categoriaId) {
        payload.categoriaId = Number(itemForm.categoriaId);
      }

      await api.post('/stock/items', payload);
      
      setShowItemModal(false);
      setItemForm({
        item: '',
        codigo: '',
        categoriaId: undefined,
        descricao: '',
        quantidade: 1,
        valorUnitario: 0,
        unidadeMedida: 'UN',
        localizacao: '',
        imagemUrl: '',
      });
      load();
      itemValidation.reset();
      toast.success('Item de estoque criado com sucesso!');
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  // Funções de Alocação
  async function openAlocacaoModal(item: StockItem) {
    setItemParaAlocar(item);
    setAlocacaoForm({
      projetoId: undefined,
      etapaId: undefined,
      usuarioId: undefined,
      quantidade: 1,
    });
    try {
      const response = await api.get(`/stock/alocacoes?estoqueId=${item.id}`);
      setAlocacoes(response.data || []);
    } catch (err: any) {
      console.error('Erro ao carregar alocações:', err);
      setAlocacoes([]);
    }
    setShowAlocacaoModal(true);
  }

  async function handleCreateAlocacao() {
    if (!itemParaAlocar) return;
    
    // Verificar se há itens disponíveis
    const quantidadeDisponivel = (itemParaAlocar.quantidade || 0) - alocacoes.reduce((sum, a) => sum + (a.quantidade || 0), 0);
    if (quantidadeDisponivel <= 0) {
      setError('Não há mais itens no estoque para alocar');
      return;
    }
    
    if (alocacaoForm.quantidade > quantidadeDisponivel) {
      setError(`Quantidade solicitada (${alocacaoForm.quantidade}) excede a quantidade disponível (${quantidadeDisponivel})`);
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      await api.post('/stock/alocacoes', {
        estoqueId: itemParaAlocar.id,
        projetoId: alocacaoForm.projetoId,
        etapaId: alocacaoForm.etapaId,
        usuarioId: alocacaoForm.usuarioId,
        quantidade: alocacaoForm.quantidade,
      });
      
      toast.success('Alocação criada com sucesso!');
      await openAlocacaoModal(itemParaAlocar); // Recarregar alocações
      setAlocacaoForm({
        projetoId: undefined,
        etapaId: undefined,
        usuarioId: undefined,
        quantidade: 1,
      });
      load(); // Recarregar lista de itens
    } catch (err: any) {
      let errorMessage = formatApiError(err);
      
      // Tratar erros específicos de quantidade
      if (errorMessage.includes('excede a quantidade disponível') || 
          errorMessage.includes('não há mais itens') ||
          errorMessage.includes('quantidade disponível')) {
        errorMessage = 'Não há mais itens no estoque para alocar';
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteAlocacao(alocacaoId: number) {
    if (!confirm('Tem certeza que deseja remover esta alocação?')) return;
    
    setSubmitting(true);
    setError(null);
    
    try {
      await api.delete(`/stock/alocacoes/${alocacaoId}`);
      toast.success('Alocação removida com sucesso!');
      if (itemParaAlocar) {
        await openAlocacaoModal(itemParaAlocar); // Recarregar alocações
      }
      load(); // Recarregar lista de itens
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreatePurchase(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    // Validar todos os campos
    if (!purchaseValidation.validateAll(purchaseForm)) {
      setSubmitting(false);
      return;
    }

    try {
      console.log('=== INÍCIO: Criar Compra ===');
      console.log('Form completo:', purchaseForm);
      
      const selectedCotacao = purchaseForm.cotacoes[purchaseForm.selectedCotacaoIndex ?? 0];
      if (!selectedCotacao) {
        setError('Selecione uma cotação');
        setSubmitting(false);
        return;
      }

      console.log('Cotação selecionada:', selectedCotacao);

      const totalPorUnidade = selectedCotacao.valorUnitario + selectedCotacao.frete + selectedCotacao.impostos - (selectedCotacao.desconto || 0);
      console.log('Total por unidade calculado:', totalPorUnidade);

      // Preparar payload removendo campos undefined/vazios
      const payload: any = {
        item: purchaseForm.item.trim(),
        quantidade: Number(purchaseForm.quantidade),
        valorUnitario: Number(totalPorUnidade.toFixed(2)),
      };

      // Adicionar projetoId apenas se foi selecionado
      if (purchaseForm.projetoId) {
        payload.projetoId = Number(purchaseForm.projetoId);
      }

      console.log('Payload base criado:', payload);

      // Adicionar campos opcionais apenas se tiverem valor válido (não vazio)
      if (purchaseForm.descricao && purchaseForm.descricao.trim().length > 0) {
        payload.descricao = purchaseForm.descricao.trim();
        console.log('✓ descricao adicionada:', payload.descricao);
      } else {
        console.log('✗ descricao omitida (vazia ou undefined)');
      }
      
      if (purchaseForm.imagemUrl && purchaseForm.imagemUrl.trim().length > 0) {
        // Processar imagem para garantir que fique dentro do limite
        const processedImageUrl = await processImageUrl(purchaseForm.imagemUrl.trim());
        if (processedImageUrl && processedImageUrl.length > 0) {
          payload.imagemUrl = processedImageUrl;
          console.log('✓ imagemUrl processada e adicionada:', payload.imagemUrl.substring(0, 50) + '...', `(${payload.imagemUrl.length} chars)`);
        } else {
          console.log('✗ imagemUrl omitida após processamento (vazia ou inválida)');
        }
      } else {
        console.log('✗ imagemUrl omitida (vazia ou undefined)');
      }
      
      if (purchaseForm.nfUrl && purchaseForm.nfUrl.trim().length > 0) {
        // Processar NF para garantir que fique dentro do limite
        const processedNfUrl = await processImageUrl(purchaseForm.nfUrl.trim());
        if (processedNfUrl && processedNfUrl.length > 0) {
          payload.nfUrl = processedNfUrl;
          console.log('✓ nfUrl processada e adicionada:', payload.nfUrl.substring(0, 50) + '...', `(${payload.nfUrl.length} chars)`);
      } else {
          console.log('✗ nfUrl omitida após processamento (vazia ou inválida)');
        }
      } else {
        console.log('✗ nfUrl omitida (vazia ou undefined)');
      }
      
      if (purchaseForm.comprovantePagamentoUrl && purchaseForm.comprovantePagamentoUrl.trim().length > 0) {
        // Processar comprovante para garantir que fique dentro do limite
        const processedComprovanteUrl = await processImageUrl(purchaseForm.comprovantePagamentoUrl.trim());
        if (processedComprovanteUrl && processedComprovanteUrl.length > 0) {
          payload.comprovantePagamentoUrl = processedComprovanteUrl;
          console.log('✓ comprovantePagamentoUrl processada e adicionada:', payload.comprovantePagamentoUrl.substring(0, 50) + '...', `(${payload.comprovantePagamentoUrl.length} chars)`);
      } else {
          console.log('✗ comprovantePagamentoUrl omitida após processamento (vazia ou inválida)');
        }
      } else {
        console.log('✗ comprovantePagamentoUrl omitida (vazia ou undefined)');
      }
      
      if (purchaseForm.dataCompra && purchaseForm.dataCompra.trim().length > 0) {
        payload.dataCompra = purchaseForm.dataCompra.trim();
        console.log('✓ dataCompra adicionada:', payload.dataCompra);
      } else {
        console.log('✗ dataCompra omitida (vazia ou undefined)');
      }

      if (purchaseForm.categoriaId) {
        payload.categoriaId = Number(purchaseForm.categoriaId);
        console.log('✓ categoriaId adicionada:', payload.categoriaId);
      } else {
        console.log('✗ categoriaId omitida (não selecionada)');
      }
      
      // Sempre enviar cotações (array com pelo menos uma cotação)
      if (purchaseForm.cotacoes.length > 0) {
        const cotacoesFiltradas = purchaseForm.cotacoes
          .map((cot: Cotacao, index: number) => {
            const valorUnitario = Number(cot.valorUnitario) || 0;
            const frete = Number(cot.frete) || 0;
            const impostos = Number(cot.impostos) || 0;
            const desconto = Number(cot.desconto) || 0;
            
            console.log(`Cotação ${index + 1} raw:`, { valorUnitario: cot.valorUnitario, frete: cot.frete, impostos: cot.impostos, desconto: cot.desconto });
            
            // Só incluir se todos os valores forem válidos (maiores que 0)
            if (valorUnitario > 0 && frete >= 0 && impostos >= 0) {
              const cotacao: any = {
                valorUnitario,
                frete,
                impostos,
              };
              if (desconto > 0) {
                cotacao.desconto = desconto;
              }
              if (cot.link && cot.link.trim().length > 0) {
                cotacao.link = cot.link.trim();
              }
              if (cot.fornecedorId) {
                cotacao.fornecedorId = Number(cot.fornecedorId);
              }
              if (cot.formaPagamento && cot.formaPagamento.trim().length > 0) {
                cotacao.formaPagamento = cot.formaPagamento.trim();
              }
              console.log(`✓ Cotação ${index + 1} válida:`, cotacao);
              return cotacao;
            }
            console.log(`✗ Cotação ${index + 1} inválida (valorUnitario: ${valorUnitario})`);
            return null;
          })
          .filter((cot) => cot !== null); // Remove cotações inválidas
        
        if (cotacoesFiltradas.length > 0) {
          payload.cotacoes = cotacoesFiltradas;
          console.log('✓ cotações adicionadas:', cotacoesFiltradas.length, 'cotação(ões)');
        } else {
          console.log('✗ Nenhuma cotação válida encontrada');
        }
      } else {
        console.log('✗ Sem cotações no formulário');
      }

      // Limpar propriedades undefined/null do payload final
      const cleanPayload = Object.keys(payload).reduce((acc: Record<string, any>, key) => {
        if (payload[key] !== undefined && payload[key] !== null) {
          acc[key] = payload[key];
        } else {
          console.log(`⚠ Removido campo ${key} com valor ${payload[key]}`);
        }
        return acc;
      }, {});

      console.log('=== PAYLOAD FINAL (LIMPO) ===');
      console.log(JSON.stringify(cleanPayload, null, 2));
      console.log('Campos incluídos:', Object.keys(cleanPayload));
      console.log('Tipos dos campos:', {
        projetoId: typeof cleanPayload.projetoId,
        item: typeof cleanPayload.item,
        quantidade: typeof cleanPayload.quantidade,
        valorUnitario: typeof cleanPayload.valorUnitario,
        descricao: cleanPayload.descricao ? typeof cleanPayload.descricao : 'NÃO INCLUÍDO',
        imagemUrl: cleanPayload.imagemUrl ? typeof cleanPayload.imagemUrl : 'NÃO INCLUÍDO',
        cotacoes: cleanPayload.cotacoes ? typeof cleanPayload.cotacoes + ' (length: ' + cleanPayload.cotacoes.length + ')' : 'NÃO INCLUÍDO',
      });

      const response = await api.post('/stock/purchases', cleanPayload);
      console.log('=== SUCESSO ===');
      console.log('Resposta do servidor:', response.data);

      setShowPurchaseModal(false);
      setPurchaseForm({
        item: '',
        descricao: '',
        quantidade: 1,
        imagemUrl: '',
        nfUrl: '',
        comprovantePagamentoUrl: '',
        cotacoes: [{ valorUnitario: 0, frete: 0, impostos: 0, desconto: 0, link: '', fornecedorId: undefined, formaPagamento: '' }],
        projetoId: 0,
        selectedCotacaoIndex: 0,
        dataCompra: '',
        categoriaId: undefined,
        observacao: '',
      });
      load();
      toast.success('Compra criada com sucesso!');
    } catch (err: any) {
      console.error('=== ERRO AO CRIAR COMPRA ===');
      console.error('Erro completo:', err);
      console.error('Status:', err.response?.status);
      console.error('Status Text:', err.response?.statusText);
      console.error('Headers:', err.response?.headers);
      console.error('Data completa:', err.response?.data);
      
      if (err.response?.data) {
        console.error('Mensagem de erro:', err.response.data.message);
        console.error('Erros de validação:', err.response.data.message);
        if (Array.isArray(err.response.data.message)) {
          console.error('Array de erros:', err.response.data.message);
          err.response.data.message.forEach((msg: any, index: number) => {
            console.error(`  Erro ${index + 1}:`, msg);
          });
        }
      }
      
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
      console.log('=== FIM: Criar Compra ===');
    }
  }

  async function handleDeletePurchase() {
    if (!purchaseToDelete) return;
    
    setDeletingPurchase(true);
    setError(null);

    try {
      await api.delete(`/stock/purchases/${purchaseToDelete.id}`);
      setShowDeletePurchaseModal(false);
      setPurchaseToDelete(null);
      load();
      toast.success('Compra removida com sucesso!');
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setDeletingPurchase(false);
    }
  }

  async function handleUpdatePurchaseStatus() {
    if (!purchaseToUpdateStatus || !newStatus) return;
    
    setSubmitting(true);
    setError(null);

    try {
      const payload: { 
        status: string; 
        statusEntrega?: string;
        previsaoEntrega?: string;
        dataEntrega?: string;
        enderecoEntrega?: string;
        recebidoPor?: string;
        observacao?: string;
      } = {
        status: newStatus,
      };
      
      // Incluir statusEntrega e previsaoEntrega se o status for COMPRADO_ACAMINHO
      if (newStatus === 'COMPRADO_ACAMINHO') {
        if (newStatusEntrega) payload.statusEntrega = newStatusEntrega;
        if (newPrevisaoEntrega) payload.previsaoEntrega = newPrevisaoEntrega;
      }
      
      // Incluir campos de entrega se o status for ENTREGUE (sem statusEntrega)
      if (newStatus === 'ENTREGUE') {
        if (newDataEntrega) payload.dataEntrega = newDataEntrega;
        if (newEnderecoEntrega) payload.enderecoEntrega = newEnderecoEntrega;
        if (newRecebidoPor) payload.recebidoPor = newRecebidoPor;
      }
      
      // Observação pode ser adicionada em qualquer status
      if (newObservacao) payload.observacao = newObservacao;
      
      await api.patch(`/stock/purchases/${purchaseToUpdateStatus.id}/status`, payload);
      setShowStatusModal(false);
      setPurchaseToUpdateStatus(null);
      setNewStatus('');
      setNewStatusEntrega('');
      setNewPrevisaoEntrega('');
      setNewDataEntrega('');
      setNewEnderecoEntrega('');
      setNewRecebidoPor('');
      setNewObservacao('');
      load();
      toast.success('Status da compra atualizado com sucesso!');
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
        setSubmitting(false);
    }
  }

  async function handleUpdatePurchase(event: FormEvent) {
    event.preventDefault();
    if (!editingPurchase) return;
    
    setError(null);
    setSubmitting(true);

    try {
      const payload: any = {};
      
      if (purchaseForm.item && purchaseForm.item.trim().length > 0) {
        payload.item = purchaseForm.item.trim();
      }
      
      if (purchaseForm.descricao && purchaseForm.descricao.trim().length > 0) {
        payload.descricao = purchaseForm.descricao.trim();
      }
      
      if (purchaseForm.quantidade && purchaseForm.quantidade > 0) {
        payload.quantidade = Number(purchaseForm.quantidade);
      }
      
      // Recalcular valorUnitario baseado na cotação selecionada
      if (purchaseForm.cotacoes.length > 0) {
        const selectedCotacao = purchaseForm.cotacoes[purchaseForm.selectedCotacaoIndex ?? 0];
        if (selectedCotacao) {
          const valorUnitario = Number(selectedCotacao.valorUnitario) || 0;
          const frete = Number(selectedCotacao.frete) || 0;
          const impostos = Number(selectedCotacao.impostos) || 0;
          const desconto = Number(selectedCotacao.desconto) || 0;
          const totalPorUnidade = valorUnitario + frete + impostos - desconto;
          
          // Só atualizar valorUnitario se o total for maior que zero
          // Caso contrário, manter o valor existente
          if (totalPorUnidade > 0) {
            payload.valorUnitario = Number(totalPorUnidade.toFixed(2));
          }
        }
      }
      
      if (purchaseForm.imagemUrl && purchaseForm.imagemUrl.trim().length > 0) {
        const processedImageUrl = await processImageUrl(purchaseForm.imagemUrl.trim());
        if (processedImageUrl && processedImageUrl.length > 0) {
          payload.imagemUrl = processedImageUrl;
        }
      }
      
      if (purchaseForm.nfUrl && purchaseForm.nfUrl.trim().length > 0) {
        const processedNfUrl = await processImageUrl(purchaseForm.nfUrl.trim());
        if (processedNfUrl && processedNfUrl.length > 0) {
          payload.nfUrl = processedNfUrl;
        }
      }
      
      if (purchaseForm.comprovantePagamentoUrl && purchaseForm.comprovantePagamentoUrl.trim().length > 0) {
        const processedComprovanteUrl = await processImageUrl(purchaseForm.comprovantePagamentoUrl.trim());
        if (processedComprovanteUrl && processedComprovanteUrl.length > 0) {
          payload.comprovantePagamentoUrl = processedComprovanteUrl;
        }
      }
      
      if (purchaseForm.dataCompra && purchaseForm.dataCompra.trim().length > 0) {
        payload.dataCompra = purchaseForm.dataCompra.trim();
      }

      // Sempre incluir categoriaId (pode ser null para limpar)
      if (purchaseForm.categoriaId) {
        payload.categoriaId = Number(purchaseForm.categoriaId);
      } else {
        payload.categoriaId = null;
      }
      
      // Incluir observacao
      if (purchaseForm.observacao !== undefined) {
        payload.observacao = purchaseForm.observacao?.trim() || null;
      }
      
      if (purchaseForm.cotacoes.length > 0) {
        const cotacoesFiltradas = purchaseForm.cotacoes
          .map((cot: Cotacao) => {
            const valorUnitario = Number(cot.valorUnitario) || 0;
            const frete = Number(cot.frete) || 0;
            const impostos = Number(cot.impostos) || 0;
            const desconto = Number(cot.desconto) || 0;
            
            // Aceitar todas as cotações válidas (valores >= 0)
            // Mesmo cotações com valores zerados são válidas
            if (valorUnitario >= 0 && frete >= 0 && impostos >= 0 && 
                !isNaN(valorUnitario) && !isNaN(frete) && !isNaN(impostos)) {
              const cotacao: any = {
                valorUnitario,
                frete,
                impostos,
              };
              if (desconto > 0) {
                cotacao.desconto = desconto;
              }
              if (cot.link && cot.link.trim().length > 0) {
                cotacao.link = cot.link.trim();
              }
              if (cot.fornecedorId) {
                cotacao.fornecedorId = Number(cot.fornecedorId);
              }
              if (cot.formaPagamento && cot.formaPagamento.trim().length > 0) {
                cotacao.formaPagamento = cot.formaPagamento.trim();
              }
              return cotacao;
            }
            return null;
          })
          .filter((cot) => cot !== null);
        
        // Sempre enviar cotações se houver pelo menos uma válida
        if (cotacoesFiltradas.length > 0) {
          payload.cotacoes = cotacoesFiltradas;
        }
      }

      // Garantir que há pelo menos um campo no payload
      if (Object.keys(payload).length === 0) {
        setError('É necessário alterar pelo menos um campo');
        setSubmitting(false);
        return;
      }

      console.log('Atualizando compra ID:', editingPurchase.id);
      console.log('Payload enviado:', payload);

      await api.patch(`/stock/purchases/${editingPurchase.id}`, payload);

      setShowEditPurchaseModal(false);
      setEditingPurchase(null);
      setPurchaseForm({
        item: '',
        descricao: '',
        quantidade: 1,
        imagemUrl: '',
        nfUrl: '',
        comprovantePagamentoUrl: '',
        cotacoes: [{ valorUnitario: 0, frete: 0, impostos: 0, desconto: 0, link: '', fornecedorId: undefined, formaPagamento: '' }],
        projetoId: 0,
        selectedCotacaoIndex: 0,
        dataCompra: '',
        categoriaId: undefined,
        observacao: '',
      });
      load();
    } catch (err: any) {
      let errorMessage = 'Erro ao atualizar compra';
      
      if (err.response) {
        // Erro de resposta do servidor
        if (err.response.status === 404) {
          errorMessage = 'Compra não encontrada';
        } else if (err.response.status === 400) {
          errorMessage = 'Dados inválidos. Verifique os campos preenchidos.';
        } else if (err.response.data?.message) {
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
        } else if (err.response.statusText) {
          errorMessage = `${err.response.statusText}. Status: ${err.response.status}`;
        }
      } else if (err.request) {
        // Requisição foi feita mas não houve resposta
        errorMessage = 'Não foi possível conectar ao servidor. Verifique sua conexão.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      console.error('Erro ao atualizar compra:', err);
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {error && <p className="text-danger bg-danger/20 border border-danger/50 px-4 py-3 rounded-md">{error}</p>}

      {/* Abas */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('estoque')}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors ${
              activeTab === 'estoque'
                ? 'bg-primary text-white border-b-2 border-primary'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            Estoque
          </button>
          <button
            onClick={() => setActiveTab('compras')}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors ${
              activeTab === 'compras'
                ? 'bg-primary text-white border-b-2 border-primary'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            Compras
          </button>
          <button
            onClick={() => setActiveTab('solicitacoes')}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors relative ${
              activeTab === 'solicitacoes'
                ? 'bg-primary text-white border-b-2 border-primary'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            Solicitações
            {purchases.filter((p) => p.status === 'SOLICITADO').length > 0 && (
              <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {purchases.filter((p) => p.status === 'SOLICITADO').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-white/70 mb-2">
              Buscar
            </label>
            <input
              type="text"
              placeholder="Buscar por nome ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 rounded-md bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-white/70 mb-2">
              Filtrar por Projeto
            </label>
            <select
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full px-4 py-2 rounded-md bg-neutral border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 1rem center',
                paddingRight: '2.5rem'
              }}
            >
              <option value="all" className="bg-neutral text-white">Todos os Projetos</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id} className="bg-neutral text-white">
                  {project.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Conteúdo da aba Estoque */}
      {activeTab === 'estoque' && (
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Estoque</h3>
          <button
            onClick={() => setShowItemModal(true)}
            className="px-4 py-2 rounded-md bg-primary hover:bg-primary/80 text-sm font-semibold"
          >
            Adicionar Item
          </button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5 text-white/70">
              <tr>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-left">Quantidade Total</th>
                <th className="px-4 py-3 text-left">Alocada</th>
                <th className="px-4 py-3 text-left">Disponível</th>
                <th className="px-4 py-3 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-white/50">
                    {items.length === 0 ? 'Nenhum item no estoque' : 'Nenhum item encontrado com os filtros aplicados'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const quantidadeAlocada = item.quantidadeAlocada ?? 0;
                  const quantidadeDisponivel = item.quantidadeDisponivel ?? item.quantidade ?? 0;
                  
                  return (
                    <tr 
                      key={item.id} 
                      className="border-t border-white/5 hover:bg-white/5 cursor-pointer"
                      onClick={(e) => {
                        // Não abrir modal se clicar em botões ou inputs
                        const target = e.target as HTMLElement;
                        if (target.closest('button') || target.closest('input')) {
                          return;
                        }
                        setItemToView(item);
                        setShowItemDetailsModal(true);
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          {item.imagemUrl && (
                            (item.imagemUrl.startsWith('data:image/') || item.imagemUrl.startsWith('http://') || item.imagemUrl.startsWith('https://')) ? (
                              <img 
                                src={item.imagemUrl} 
                                alt={item.item || 'Item'} 
                                className="w-10 h-10 object-cover rounded"
                                onError={(e) => {
                                  // Se a imagem falhar ao carregar, ocultar ou mostrar placeholder
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : null
                          )}
                          <div>
                            <div className="font-medium">{item.item || 'Sem nome'}</div>
                            {item.descricao && <div className="text-xs text-white/60">{item.descricao}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{item.quantidade || 0}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          quantidadeAlocada > 0 
                            ? 'bg-yellow-500/20 text-yellow-400' 
                            : 'bg-white/10 text-white/50'
                        }`}>
                          {quantidadeAlocada}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          quantidadeDisponivel > 0 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {quantidadeDisponivel}
                        </span>
                      </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openAlocacaoModal(item)}
                          className="px-3 py-1.5 text-sm rounded-md bg-purple-600 hover:bg-purple-700 text-white"
                          title="Gerenciar alocações"
                        >
                          Alocar
                        </button>
                        <button
                          onClick={async () => {
                            setEditingItem(item);
                            
                            // Carregar etapas se houver projetoId
                            let etapasData: any[] = [];
                            if (item.projetoId) {
                              try {
                                // Buscar etapas através do endpoint do projeto que já retorna as etapas
                                const projetoResponse = await api.get(`/projects/${item.projetoId}`);
                                etapasData = projetoResponse.data?.etapas || [];
                                setEtapas(etapasData);
                              } catch (err) {
                                console.error('Erro ao carregar etapas:', err);
                                setEtapas([]);
                              }
                            } else {
                              setEtapas([]);
                            }
                            
                            setItemForm({
                              item: item.item || '',
                              codigo: (item as any).codigo || '',
                              categoriaId: (item as any).categoriaId || undefined,
                              descricao: item.descricao || '',
                              quantidade: item.quantidade || 1,
                              valorUnitario: item.valorUnitario || 0,
                              unidadeMedida: (item as any).unidadeMedida || 'UN',
                              localizacao: (item as any).localizacao || '',
                              imagemUrl: item.imagemUrl || '',
                            });
                            setShowEditModal(true);
                          }}
                          className="px-3 py-1.5 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => {
                            setItemToDelete(item);
                            setShowDeleteModal(true);
                          }}
                          className="px-3 py-1.5 text-sm rounded-md bg-red-600 hover:bg-red-700 text-white"
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {/* Conteúdo da aba Compras */}
      {activeTab === 'compras' && (
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Compras</h3>
            <div className="flex items-center gap-2">
              {selectedPurchases.length > 0 && (
                <button
                  onClick={() => setShowReportModal(true)}
                  className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-sm font-semibold"
                >
                  Gerar Relatório ({selectedPurchases.length})
                </button>
              )}
          <button
            onClick={() => setShowPurchaseModal(true)}
            className="px-4 py-2 rounded-md bg-primary hover:bg-primary/80 text-sm font-semibold"
          >
            Nova Compra
          </button>
            </div>
        </div>
        
        {/* Sub-abas de Compras */}
        <div className="flex gap-2 mb-4 border-b border-white/10">
          <button
            onClick={() => setPurchaseSubTab('pendente')}
            className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${
              purchaseSubTab === 'pendente'
                ? 'text-primary border-primary'
                : 'text-white/70 border-transparent hover:text-white hover:border-white/30'
            }`}
          >
            Pendente
            {purchaseCounts.pendente > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                purchaseSubTab === 'pendente'
                  ? 'bg-primary/20 text-primary'
                  : 'bg-white/10 text-white/70'
              }`}>
                {purchaseCounts.pendente}
              </span>
            )}
          </button>
          <button
            onClick={() => setPurchaseSubTab('a-caminho')}
            className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${
              purchaseSubTab === 'a-caminho'
                ? 'text-primary border-primary'
                : 'text-white/70 border-transparent hover:text-white hover:border-white/30'
            }`}
          >
            A Caminho
            {purchaseCounts['a-caminho'] > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                purchaseSubTab === 'a-caminho'
                  ? 'bg-primary/20 text-primary'
                  : 'bg-white/10 text-white/70'
              }`}>
                {purchaseCounts['a-caminho']}
              </span>
            )}
          </button>
          <button
            onClick={() => setPurchaseSubTab('entregue')}
            className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${
              purchaseSubTab === 'entregue'
                ? 'text-primary border-primary'
                : 'text-white/70 border-transparent hover:text-white hover:border-white/30'
            }`}
          >
            Entregue
            {purchaseCounts.entregue > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                purchaseSubTab === 'entregue'
                  ? 'bg-primary/20 text-primary'
                  : 'bg-white/10 text-white/70'
              }`}>
                {purchaseCounts.entregue}
              </span>
            )}
          </button>
        </div>
        
        {/* Filtros de Compras */}
        <PurchaseFilters
          filters={purchaseFiltersState}
          setFilters={setPurchaseFilters}
          showFilters={showPurchaseFilters}
          setShowFilters={setShowPurchaseFilters}
          clearFilters={clearPurchaseFilters}
          hasActiveFilters={hasActiveFilters}
          categories={categories}
        />
        
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5 text-white/70">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={finalSortedPurchases.length > 0 && selectedPurchases.length === finalSortedPurchases.length}
                    onChange={toggleAllPurchases}
                    className="w-4 h-4 rounded border-white/30 bg-white/10 text-primary focus:ring-primary"
                  />
                </th>
                {renderSortableHeader('item', 'Item')}
                {renderSortableHeader('quantidade', 'Qtd')}
                {renderSortableHeader('cotacoes', 'Cotações')}
                {renderSortableHeader('categoria', 'Categoria')}
                {renderSortableHeader('solicitadoPor', 'Solicitado Por')}
                {renderSortableHeader('status', 'Status')}
                {renderSortableHeader('dataEntrega', 'Entrega')}
                <th className="px-4 py-3 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {finalSortedPurchases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-white/50">
                    {purchases.length === 0 ? 'Nenhuma compra cadastrada' : 'Nenhuma compra encontrada com os filtros aplicados'}
                  </td>
                </tr>
              ) : (
                finalSortedPurchases.map((purchase) => {
                  const cotacoes = purchase.cotacoesJson && Array.isArray(purchase.cotacoesJson) ? purchase.cotacoesJson : [];
                  const isSelected = selectedPurchases.includes(purchase.id);
                  return (
                  <tr 
                    key={purchase.id} 
                    className={`border-t border-white/5 hover:bg-white/5 cursor-pointer ${isSelected ? 'bg-primary/10' : ''}`}
                    onClick={(e) => {
                      // Não abrir modal se clicar em botões, inputs ou checkbox
                      const target = e.target as HTMLElement;
                      if (target.closest('button') || target.closest('input') || target.closest('a')) {
                        return;
                      }
                      setPurchaseToViewDetails(purchase);
                      setShowPurchaseDetailsModal(true);
                    }}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePurchaseSelection(purchase.id)}
                        className="w-4 h-4 rounded border-white/30 bg-white/10 text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-3">
                        {purchase.imagemUrl && (
                          (purchase.imagemUrl.startsWith('data:image/') || purchase.imagemUrl.startsWith('http://') || purchase.imagemUrl.startsWith('https://')) ? (
                            <img
                              src={purchase.imagemUrl}
                              alt={purchase.item || 'Item'}
                              className="w-10 h-10 object-cover rounded"
                              onError={(e) => {
                                // Se a imagem falhar ao carregar, ocultar ou mostrar placeholder
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : null
                        )}
                        <div>
                          <div className="font-medium">{purchase.item || 'Sem nome'}</div>
                          {purchase.descricao && <div className="text-xs text-white/60">{purchase.descricao}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{purchase.quantidade || 0}</td>
                    <td className="px-4 py-3">
                      {cotacoes.length > 0 ? (
                        <div className="space-y-1">
                          {cotacoes.map((cotacao: Cotacao, index: number) => {
                            const total = (cotacao.valorUnitario || 0) + (cotacao.frete || 0) + (cotacao.impostos || 0) - (cotacao.desconto || 0);
                            const totalComQuantidade = total * (purchase.quantidade || 1);
                            return (
                              <div key={index} className="text-sm">
                                <span className="text-white/70">Cotação {index + 1}: </span>
                                {cotacao.link ? (
                                  <a
                                    href={cotacao.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-primary hover:text-primary/80 underline cursor-pointer"
                                  >
                                    {totalComQuantidade.toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })}
                                  </a>
                                ) : (
                                  <span className="font-semibold text-primary">
                                    {totalComQuantidade.toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-white/50 text-sm">Sem cotações</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-white/80">
                        {getCategoryName((purchase as any).categoriaId)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-white/80">
                        {purchase.solicitadoPor?.nome || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(purchase.status)}`}>
                        {getStatusLabel(purchase.status)}
                      </span>
                        {purchase.status === 'COMPRADO_ACAMINHO' && purchase.statusEntrega && (
                          <span className={`px-2 py-1 rounded text-xs ${getStatusEntregaColor(purchase.statusEntrega)}`}>
                            {getStatusEntregaLabel(purchase.statusEntrega)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 text-xs">
                        {purchase.status === 'COMPRADO_ACAMINHO' && purchase.previsaoEntrega && (
                          <span className="text-blue-300">
                            📅 Previsão: {new Date(purchase.previsaoEntrega).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                        {purchase.status === 'ENTREGUE' ? (
                          <>
                            {purchase.dataEntrega && (
                              <span className="text-white/90">
                                📅 {new Date(purchase.dataEntrega).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                            {purchase.enderecoEntrega && (
                              <span className="text-white/80 truncate max-w-[150px]" title={purchase.enderecoEntrega}>
                                📍 {purchase.enderecoEntrega}
                              </span>
                            )}
                            {purchase.recebidoPor && (
                              <span className="text-white/70">👤 {purchase.recebidoPor}</span>
                            )}
                            {purchase.observacao && (
                              <span className="text-white/60 truncate max-w-[150px]" title={purchase.observacao}>
                                📝 {purchase.observacao}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            {purchase.dataEntrega ? (
                              <span className="text-white/90">
                                📅 {new Date(purchase.dataEntrega).toLocaleDateString('pt-BR')}
                              </span>
                            ) : purchase.dataCompra ? (
                              <span className="text-white/50">
                                📅 Compra: {new Date(purchase.dataCompra).toLocaleDateString('pt-BR')}
                              </span>
                            ) : (
                              <span className="text-white/50">-</span>
                            )}
                            {purchase.recebidoPor && (
                              <span className="text-white/70">👤 {purchase.recebidoPor}</span>
                            )}
                            {purchase.observacao && (
                              <span className="text-white/60 truncate max-w-[150px]" title={purchase.observacao}>
                                📝 {purchase.observacao}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setPurchaseToUpdateStatus(purchase);
                            setNewStatus(purchase.status);
                            
                            // Inicializar campos baseado no status atual
                            if (purchase.status === 'COMPRADO_ACAMINHO') {
                              setNewStatusEntrega(purchase.statusEntrega || 'NAO_ENTREGUE');
                              setNewPrevisaoEntrega(purchase.previsaoEntrega ? new Date(purchase.previsaoEntrega).toISOString().split('T')[0] : '');
                              setNewDataEntrega('');
                              setNewEnderecoEntrega('');
                              setNewRecebidoPor('');
                            } else if (purchase.status === 'ENTREGUE') {
                              setNewStatusEntrega('');
                              setNewDataEntrega(purchase.dataEntrega ? new Date(purchase.dataEntrega).toISOString().split('T')[0] : '');
                              setNewEnderecoEntrega(purchase.enderecoEntrega || '');
                              setNewRecebidoPor(purchase.recebidoPor || '');
                            } else {
                              setNewStatusEntrega('');
                              setNewDataEntrega('');
                              setNewEnderecoEntrega('');
                              setNewRecebidoPor('');
                            }
                            
                            setNewObservacao(purchase.observacao || '');
                            setShowStatusModal(true);
                          }}
                          className="px-3 py-1.5 text-sm rounded-md bg-green-600 hover:bg-green-700 text-white"
                          title="Alterar Status"
                        >
                          Status
                        </button>
                        <button
                          onClick={() => {
                            setEditingPurchase(purchase);
                            setPurchaseForm({
                              item: purchase.item || '',
                              descricao: purchase.descricao || '',
                              quantidade: purchase.quantidade || 1,
                              imagemUrl: purchase.imagemUrl || '',
                              nfUrl: purchase.nfUrl || '',
                              comprovantePagamentoUrl: purchase.comprovantePagamentoUrl || '',
                              cotacoes: purchase.cotacoesJson && Array.isArray(purchase.cotacoesJson) 
                                ? purchase.cotacoesJson.map((cot: any) => ({ 
                                    valorUnitario: cot.valorUnitario || 0, 
                                    frete: cot.frete || 0, 
                                    impostos: cot.impostos || 0, 
                                    desconto: cot.desconto || 0,
                                    link: cot.link || '', 
                                    fornecedorId: cot.fornecedorId,
                                    formaPagamento: cot.formaPagamento || ''
                                  }))
                                : [{ valorUnitario: 0, frete: 0, impostos: 0, desconto: 0, link: '', fornecedorId: undefined, formaPagamento: '' }],
                              projetoId: purchase.projetoId,
                              selectedCotacaoIndex: 0,
                              dataCompra: purchase.dataCompra ? new Date(purchase.dataCompra).toISOString().split('T')[0] : '',
                              categoriaId: (purchase as any).categoriaId || undefined,
                              observacao: purchase.observacao || '',
                            });
                            setShowEditPurchaseModal(true);
                          }}
                          className="px-3 py-1.5 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white"
                          title="Editar Compra"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => {
                            setPurchaseToDelete(purchase);
                            setShowDeletePurchaseModal(true);
                          }}
                          className="px-3 py-1.5 text-sm rounded-md bg-red-600 hover:bg-red-700 text-white"
                          title="Remover Compra"
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {/* Conteúdo da aba Solicitações */}
      {activeTab === 'solicitacoes' && (
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Solicitações de Compra</h3>
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5 text-white/70">
              <tr>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-left">Quantidade</th>
                <th className="px-4 py-3 text-left">Solicitado Por</th>
                <th className="px-4 py-3 text-left">Projeto</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {purchases.filter((p) => p.status === 'SOLICITADO').length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-white/50">
                    Nenhuma solicitação pendente
                  </td>
                </tr>
              ) : (
                purchases
                  .filter((p) => p.status === 'SOLICITADO')
                  .map((purchase) => {
                    const solicitadoPor = (purchase as any).solicitadoPor;
                    const cargoNome = solicitadoPor?.cargo 
                      ? (typeof solicitadoPor.cargo === 'string' 
                          ? solicitadoPor.cargo 
                          : solicitadoPor.cargo.nome || 'Sem cargo')
                      : 'N/A';
                    return (
                      <tr key={purchase.id} className="border-t border-white/5 hover:bg-white/5 bg-yellow-500/10">
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-3">
                            {purchase.imagemUrl && (
                              (purchase.imagemUrl.startsWith('data:image/') || purchase.imagemUrl.startsWith('http://') || purchase.imagemUrl.startsWith('https://')) ? (
                                <img
                                  src={purchase.imagemUrl}
                                  alt={purchase.item || 'Item'}
                                  className="w-10 h-10 object-cover rounded"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : null
                            )}
                            <div>
                              <div className="font-medium">{purchase.item || 'Sem nome'}</div>
                              {purchase.descricao && <div className="text-xs text-white/60">Motivo: {purchase.descricao}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">{purchase.quantidade || 0}</td>
                        <td className="px-4 py-3">
                          {solicitadoPor ? (
                            <span>
                              {solicitadoPor.nome} <span className="text-white/50">({cargoNome})</span>
                            </span>
                          ) : (
                            'N/A'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {(purchase as any).projeto?.nome || 'Sem projeto'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                            SOLICITADO
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setPurchaseToView(purchase);
                                setShowViewRequestModal(true);
                              }}
                              className="px-3 py-1.5 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              Ver Detalhes
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {/* Modal Adicionar Item ao Estoque */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral border-b border-white/20 px-8 py-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Adicionar Item ao Estoque</h2>
              <button
                onClick={() => {
                  setShowItemModal(false);
                  setError(null);
                }}
                className="text-white/50 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateItem} className="p-8 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Nome do Item *</label>
                <input
                  type="text"
                  required
                  value={itemForm.item}
                  onChange={(e) => setItemForm({ ...itemForm, item: e.target.value })}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="Ex: Parafuso M6x20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">Código/SKU</label>
                  <input
                    type="text"
                    value={itemForm.codigo || ''}
                    onChange={(e) => setItemForm({ ...itemForm, codigo: e.target.value })}
                    className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="Ex: PRF-M6-20"
                />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Descrição</label>
                <textarea
                  value={itemForm.descricao}
                  onChange={(e) => setItemForm({ ...itemForm, descricao: e.target.value })}
                  rows={3}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Descrição detalhada do item..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">Categoria</label>
                <select
                    value={itemForm.categoriaId || ''}
                    onChange={(e) => setItemForm({ ...itemForm, categoriaId: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 1rem center',
                      paddingRight: '2.5rem'
                    }}
                >
                  <option value="" className="bg-neutral text-white">Selecione uma categoria (opcional)</option>
                  {categories.filter(c => c.ativo).map((cat) => (
                    <option key={cat.id} value={cat.id} className="bg-neutral text-white">
                      {cat.nome}
                    </option>
                  ))}
                </select>
              </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">Unidade de Medida *</label>
                  <select
                    value={itemForm.unidadeMedida || 'UN'}
                    onChange={(e) => setItemForm({ ...itemForm, unidadeMedida: e.target.value })}
                    className="w-full bg-neutral border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 1rem center',
                      paddingRight: '2.5rem'
                    }}
                  >
                    <option value="UN" className="bg-neutral text-white">UN (Unidade)</option>
                    <option value="KG" className="bg-neutral text-white">KG (Quilograma)</option>
                    <option value="M" className="bg-neutral text-white">M (Metro)</option>
                    <option value="M2" className="bg-neutral text-white">M² (Metro Quadrado)</option>
                    <option value="M3" className="bg-neutral text-white">M³ (Metro Cúbico)</option>
                    <option value="L" className="bg-neutral text-white">L (Litro)</option>
                    <option value="CX" className="bg-neutral text-white">CX (Caixa)</option>
                    <option value="PC" className="bg-neutral text-white">PC (Peça)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">Localização</label>
                            <input
                    type="text"
                    value={itemForm.localizacao || ''}
                    onChange={(e) => setItemForm({ ...itemForm, localizacao: e.target.value })}
                    className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="Ex: Prateleira A-3"
                  />
                        </div>
                      </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">Quantidade *</label>
                          <input
                            type="number"
                    required
                    min="1"
                    value={itemForm.quantidade}
                    onChange={(e) => setItemForm({ ...itemForm, quantidade: Number(e.target.value) })}
                    className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </div>

                        <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">Valor Unitário (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                    value={itemForm.valorUnitario}
                    onChange={(e) => setItemForm({ ...itemForm, valorUnitario: Number(e.target.value) })}
                    className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="0.00"
                          />
                        </div>

              </div>

                        <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Imagem</label>
                          <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, setItemForm, itemForm)}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
                />
                {itemForm.imagemUrl && (
                  <img src={itemForm.imagemUrl} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded border border-white/20" />
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
                    setShowItemModal(false);
                    setError(null);
                  }}
                  className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-primary hover:bg-primary/80 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Salvando...' : 'Adicionar Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Gerenciar Alocações */}
      {showAlocacaoModal && itemParaAlocar && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-neutral border border-white/20 rounded-lg sm:rounded-xl shadow-2xl max-w-2xl w-full my-auto max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral border-b border-white/20 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-10">
              <h2 className="text-lg sm:text-xl font-bold text-white">Gerenciar Alocações - {itemParaAlocar.item}</h2>
              <button
                onClick={() => {
                  setShowAlocacaoModal(false);
                  setItemParaAlocar(null);
                  setAlocacoes([]);
                  setError(null);
                }}
                className="text-white/50 hover:text-white transition-colors text-lg sm:text-xl"
              >
                ✕
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-md">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-white/70">Total:</span>
                    <span className="ml-2 font-semibold text-white">{itemParaAlocar.quantidade || 0}</span>
                  </div>
                  <div>
                    <span className="text-white/70">Alocada:</span>
                    <span className="ml-2 font-semibold text-yellow-400">
                      {alocacoes.reduce((sum, a) => sum + (a.quantidade || 0), 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/70">Disponível:</span>
                    <span className="ml-2 font-semibold text-green-400">
                      {(itemParaAlocar.quantidade || 0) - alocacoes.reduce((sum, a) => sum + (a.quantidade || 0), 0)}
                    </span>
                  </div>
                </div>
              </div>

              <h3 className="text-base font-semibold text-white mb-3">Nova Alocação</h3>
              <div className="space-y-3 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">Projeto</label>
                    <select
                      value={alocacaoForm.projetoId || ''}
                      onChange={async (e) => {
                        const projetoId = e.target.value ? Number(e.target.value) : undefined;
                        setAlocacaoForm({ ...alocacaoForm, projetoId, etapaId: undefined, usuarioId: undefined });
                        if (projetoId) {
                          try {
                            const response = await api.get(`/projects/${projetoId}`);
                            setEtapas(response.data.etapas || []);
                          } catch (err) {
                            setEtapas([]);
                          }
                        } else {
                          setEtapas([]);
                        }
                      }}
                      className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 0.75rem center',
                        paddingRight: '2rem'
                      }}
                    >
                      <option value="" className="bg-neutral text-white">Selecione (opcional)</option>
                      {projects.map((proj) => (
                        <option key={proj.id} value={proj.id} className="bg-neutral text-white">
                          {proj.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">Etapa</label>
                    <select
                      value={alocacaoForm.etapaId || ''}
                      onChange={(e) => setAlocacaoForm({ ...alocacaoForm, etapaId: e.target.value ? Number(e.target.value) : undefined, usuarioId: undefined })}
                      className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 0.75rem center',
                        paddingRight: '2rem'
                      }}
                      disabled={!alocacaoForm.projetoId}
                    >
                      <option value="" className="bg-neutral text-white">Selecione (opcional)</option>
                      {etapas.filter(e => e.projetoId === alocacaoForm.projetoId).map((etapa) => (
                        <option key={etapa.id} value={etapa.id} className="bg-neutral text-white">
                          {etapa.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">Usuário</label>
                    <select
                      value={alocacaoForm.usuarioId || ''}
                      onChange={(e) => setAlocacaoForm({ ...alocacaoForm, usuarioId: e.target.value ? Number(e.target.value) : undefined, projetoId: undefined, etapaId: undefined })}
                      className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 0.75rem center',
                        paddingRight: '2rem'
                      }}
                    >
                      <option value="" className="bg-neutral text-white">Selecione (opcional)</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id} className="bg-neutral text-white">
                          {user.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">Quantidade *</label>
                    <input
                      type="number"
                      min="1"
                      max={(itemParaAlocar.quantidade || 0) - alocacoes.reduce((sum, a) => sum + (a.quantidade || 0), 0)}
                      value={alocacaoForm.quantidade}
                      onChange={(e) => setAlocacaoForm({ ...alocacaoForm, quantidade: Number(e.target.value) || 1 })}
                      className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={handleCreateAlocacao}
                disabled={
                  submitting || 
                  alocacaoForm.quantidade < 1 || 
                  (!alocacaoForm.projetoId && !alocacaoForm.usuarioId) ||
                  ((itemParaAlocar?.quantidade || 0) - alocacoes.reduce((sum, a) => sum + (a.quantidade || 0), 0)) <= 0
                }
                className="w-full sm:w-auto px-4 py-2 rounded-md bg-primary hover:bg-primary/80 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm mb-4"
              >
                {submitting ? 'Criando...' : 'Criar Alocação'}
              </button>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-3 py-2 rounded-md mb-3 text-xs">
                  {error}
                </div>
              )}

              <h3 className="text-base font-semibold text-white mb-3 mt-6">Alocações Existentes</h3>
              {alocacoes.length === 0 ? (
                <p className="text-white/50 text-sm">Nenhuma alocação cadastrada</p>
              ) : (
                <div className="space-y-2">
                  {alocacoes.map((alocacao) => (
                    <div key={alocacao.id} className="bg-white/5 p-3 rounded-md border border-white/10 flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-sm text-white">
                          <span className="font-semibold">Quantidade: {alocacao.quantidade}</span>
                        </div>
                        <div className="text-xs text-white/70 mt-1">
                          {alocacao.projeto && `Projeto: ${alocacao.projeto.nome}`}
                          {alocacao.projeto && alocacao.etapa && ' • '}
                          {alocacao.etapa && `Etapa: ${alocacao.etapa.nome}`}
                          {alocacao.usuario && (
                            <>
                              {alocacao.projeto || alocacao.etapa ? ' • ' : ''}
                              Usuário: {alocacao.usuario.nome}
                            </>
                          )}
                          {!alocacao.projeto && !alocacao.etapa && !alocacao.usuario && 'Sem projeto/etapa/usuário'}
                        </div>
                        <div className="text-xs text-white/50 mt-1">
                          {new Date(alocacao.dataAlocacao).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteAlocacao(alocacao.id)}
                        disabled={submitting}
                        className="px-3 py-1.5 text-xs rounded-md bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Item */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral border-b border-white/20 px-8 py-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Editar Item</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingItem(null);
                  setError(null);
                  setItemForm({
                    item: '',
                    descricao: '',
                    quantidade: 1,
                    valorUnitario: 0,
                    imagemUrl: '',
                  });
                }}
                className="text-white/50 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateItem} className="p-8 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Nome do Item *</label>
                <input
                  type="text"
                  required
                  value={itemForm.item}
                  onChange={(e) => setItemForm({ ...itemForm, item: e.target.value })}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="Ex: Parafuso M6x20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">Código/SKU</label>
                  <input
                    type="text"
                    value={itemForm.codigo || ''}
                    onChange={(e) => setItemForm({ ...itemForm, codigo: e.target.value })}
                    className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="Ex: PRF-M6-20"
                />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Descrição</label>
                <textarea
                  value={itemForm.descricao}
                  onChange={(e) => setItemForm({ ...itemForm, descricao: e.target.value })}
                  rows={3}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Descrição detalhada do item..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">Categoria</label>
                  <select
                    value={itemForm.categoriaId || ''}
                    onChange={(e) => setItemForm({ ...itemForm, categoriaId: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 1rem center',
                      paddingRight: '2.5rem'
                    }}
                  >
                    <option value="" className="bg-neutral text-white">Selecione uma categoria (opcional)</option>
                    {categories.filter(c => c.ativo).map((cat) => (
                      <option key={cat.id} value={cat.id} className="bg-neutral text-white">
                        {cat.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">Unidade de Medida *</label>
                  <select
                    value={itemForm.unidadeMedida || 'UN'}
                    onChange={(e) => setItemForm({ ...itemForm, unidadeMedida: e.target.value })}
                    className="w-full bg-neutral border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 1rem center',
                      paddingRight: '2.5rem'
                    }}
                  >
                    <option value="UN" className="bg-neutral text-white">UN (Unidade)</option>
                    <option value="KG" className="bg-neutral text-white">KG (Quilograma)</option>
                    <option value="M" className="bg-neutral text-white">M (Metro)</option>
                    <option value="M2" className="bg-neutral text-white">M² (Metro Quadrado)</option>
                    <option value="M3" className="bg-neutral text-white">M³ (Metro Cúbico)</option>
                    <option value="L" className="bg-neutral text-white">L (Litro)</option>
                    <option value="CX" className="bg-neutral text-white">CX (Caixa)</option>
                    <option value="PC" className="bg-neutral text-white">PC (Peça)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">Localização</label>
                  <input
                    type="text"
                    value={itemForm.localizacao || ''}
                    onChange={(e) => setItemForm({ ...itemForm, localizacao: e.target.value })}
                    className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="Ex: Prateleira A-3"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">Quantidade *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={itemForm.quantidade}
                    onChange={(e) => setItemForm({ ...itemForm, quantidade: Number(e.target.value) })}
                    className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">Valor Unitário (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={itemForm.valorUnitario}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setItemForm({ ...itemForm, valorUnitario: value });
                      itemValidation.handleChange('valorUnitario', value);
                    }}
                    onBlur={() => itemValidation.handleBlur('valorUnitario')}
                    className={`w-full bg-white/10 border rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 ${
                      itemValidation.hasError('valorUnitario')
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-white/30 focus:ring-primary focus:border-primary'
                    }`}
                    placeholder="0.00"
                  />
                  {itemValidation.hasError('valorUnitario') && (
                    <p className="text-red-500 text-xs mt-1">{itemValidation.getFieldError('valorUnitario')}</p>
                  )}
                </div>

              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Imagem</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, setItemForm, itemForm)}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
                />
                {itemForm.imagemUrl && (
                  <img src={itemForm.imagemUrl} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded border border-white/20" />
                )}
                {editingItem.imagemUrl && !itemForm.imagemUrl && (
                  <div className="mt-2">
                    <p className="text-sm text-white/60 mb-2">Imagem atual:</p>
                    <img src={editingItem.imagemUrl} alt="Atual" className="w-32 h-32 object-cover rounded border border-white/20" />
                  </div>
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
                    setShowEditModal(false);
                    setEditingItem(null);
                    setError(null);
                    setItemForm({
                      item: '',
                      codigo: '',
                      categoria: '',
                      descricao: '',
                      quantidade: 1,
                      valorUnitario: 0,
                      unidadeMedida: 'UN',
                      localizacao: '',
                      imagemUrl: '',
                    });
                  }}
                  className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-primary hover:bg-primary/80 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão */}
      {showDeleteModal && itemToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-md w-full">
            <div className="px-8 py-6 border-b border-white/20">
              <h2 className="text-2xl font-bold text-white">Confirmar Exclusão</h2>
            </div>
            <div className="p-8">
              <p className="text-white/90 mb-2">
                Tem certeza que deseja remover o item:
              </p>
              <p className="text-xl font-semibold text-white mb-6">
                "{itemToDelete.item}"
              </p>
              <p className="text-sm text-white/70 mb-6">
                Esta ação não pode ser desfeita.
              </p>
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-md mb-4 text-sm">
                  {error}
                </div>
              )}
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setItemToDelete(null);
                    setError(null);
                  }}
                  className="px-6 py-2.5 rounded-md bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
                  disabled={deleting}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteItem}
                  className="px-6 py-2.5 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={deleting}
                >
                  {deleting ? 'Removendo...' : 'Confirmar Remoção'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Compra */}
      {showPurchaseModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-neutral border border-white/20 rounded-lg sm:rounded-xl shadow-2xl max-w-4xl w-full my-auto max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral border-b border-white/20 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-10">
              <h2 className="text-lg sm:text-xl font-bold">Nova Compra</h2>
              <button
                onClick={() => {
                  setShowPurchaseModal(false);
                  setError(null);
                }}
                className="text-white/50 hover:text-white transition-colors text-xl sm:text-2xl"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreatePurchase} className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Projeto</label>
                <select
                  value={purchaseForm.projetoId || ''}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, projetoId: e.target.value ? Number(e.target.value) : 0 })}
                  className="w-full bg-neutral border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 1rem center',
                    paddingRight: '2.5rem'
                  }}
                >
                  <option value="" className="bg-neutral text-white">Sem projeto (opcional)</option>
                  {projects.map((projeto) => (
                    <option key={projeto.id} value={projeto.id} className="bg-neutral text-white">
                      {projeto.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Nome do Item *</label>
                <input
                  type="text"
                  required
                  value={purchaseForm.item}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, item: e.target.value })}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Motivo da Solicitação</label>
                <textarea
                  value={purchaseForm.descricao}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, descricao: e.target.value })}
                  rows={3}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Descreva o motivo da solicitação..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Imagem</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, setPurchaseForm, purchaseForm)}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
                />
                {purchaseForm.imagemUrl && (
                  <img src={purchaseForm.imagemUrl} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded border border-white/20" />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Nota Fiscal (NF)</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf';
                    if (!isValidType) {
                      setError('Por favor, selecione um arquivo de imagem ou PDF válido.');
                      return;
                    }
                    
                    const maxFileSize = 5 * 1024 * 1024;
                    if (file.size > maxFileSize) {
                      setError('Arquivo muito grande. Por favor, escolha um arquivo menor que 5MB.');
                      return;
                    }
                    
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                      const base64 = reader.result as string;
                      if (base64) {
                        if (file.type === 'application/pdf') {
                          setPurchaseForm({ ...purchaseForm, nfUrl: base64 });
                        } else {
                          const processed = await processImageUrl(base64);
                          if (processed && processed.length > 0) {
                            setPurchaseForm({ ...purchaseForm, nfUrl: processed });
                          }
                        }
                      }
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
                />
                {purchaseForm.nfUrl && (
                  <div className="mt-2">
                    {purchaseForm.nfUrl.startsWith('data:image/') ? (
                      <img src={purchaseForm.nfUrl} alt="Preview NF" className="w-32 h-32 object-cover rounded border border-white/20" />
                    ) : (
                      <p className="text-sm text-white/70">Arquivo selecionado</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Comprovante de Pagamento</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf';
                    if (!isValidType) {
                      setError('Por favor, selecione um arquivo de imagem ou PDF válido.');
                      return;
                    }
                    
                    const maxFileSize = 5 * 1024 * 1024;
                    if (file.size > maxFileSize) {
                      setError('Arquivo muito grande. Por favor, escolha um arquivo menor que 5MB.');
                      return;
                    }
                    
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                      const base64 = reader.result as string;
                      if (base64) {
                        if (file.type === 'application/pdf') {
                          setPurchaseForm({ ...purchaseForm, comprovantePagamentoUrl: base64 });
                        } else {
                          const processed = await processImageUrl(base64);
                          if (processed && processed.length > 0) {
                            setPurchaseForm({ ...purchaseForm, comprovantePagamentoUrl: processed });
                          }
                        }
                      }
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
                />
                {purchaseForm.comprovantePagamentoUrl && (
                  <div className="mt-2">
                    {purchaseForm.comprovantePagamentoUrl.startsWith('data:image/') ? (
                      <img src={purchaseForm.comprovantePagamentoUrl} alt="Preview Comprovante" className="w-32 h-32 object-cover rounded border border-white/20" />
                    ) : (
                      <p className="text-sm text-white/70">Arquivo selecionado</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Quantidade *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={purchaseForm.quantidade}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, quantidade: Number(e.target.value) })}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Data de Compra</label>
                <input
                  type="date"
                  value={purchaseForm.dataCompra || ''}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, dataCompra: e.target.value })}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-white/90">Categoria</label>
                  <button
                    type="button"
                    onClick={openCategoryModal}
                    className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                  >
                    <span>+</span> Nova Categoria
                  </button>
                </div>
                <select
                  value={purchaseForm.categoriaId || ''}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, categoriaId: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full bg-neutral border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 1rem center',
                    paddingRight: '2.5rem'
                  }}
                >
                  <option value="" className="bg-neutral text-white">Selecione uma categoria (opcional)</option>
                  {categories.filter(c => c.ativo).map((cat) => (
                    <option key={cat.id} value={cat.id} className="bg-neutral text-white">
                      {cat.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-white/10 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Cotações</h3>
                  <button
                    type="button"
                    onClick={() => addCotacao(purchaseForm, setPurchaseForm)}
                    className="px-3 py-1 rounded-md bg-primary/20 hover:bg-primary/30 text-sm"
                  >
                    + Adicionar Cotação
                  </button>
                </div>

                <div className="space-y-4">
                  {purchaseForm.cotacoes.map((cotacao: Cotacao, index: number) => (
                    <div key={index} className="bg-white/10 border border-white/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-sm text-white">Cotação {index + 1}</span>
                        <div className="flex items-center gap-4">
                          {purchaseForm.cotacoes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeCotacao(purchaseForm, setPurchaseForm, index)}
                              className="text-danger hover:text-danger/80 text-sm font-medium"
                            >
                              Remover
                            </button>
                          )}
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name="selectedCotacaoPurchase"
                              checked={purchaseForm.selectedCotacaoIndex === index}
                              onChange={() => setPurchaseForm({ ...purchaseForm, selectedCotacaoIndex: index })}
                              className="w-4 h-4 text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-white/90">Usar esta cotação</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-white/90 mb-2">Valor Unitário (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cotacao.valorUnitario}
                            onChange={(e) =>
                              updateCotacao(purchaseForm, setPurchaseForm, index, 'valorUnitario', Number(e.target.value))
                            }
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/90 mb-2">Frete (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cotacao.frete}
                            onChange={(e) =>
                              updateCotacao(purchaseForm, setPurchaseForm, index, 'frete', Number(e.target.value))
                            }
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/90 mb-2">Impostos (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cotacao.impostos}
                            onChange={(e) =>
                              updateCotacao(purchaseForm, setPurchaseForm, index, 'impostos', Number(e.target.value))
                            }
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/90 mb-2">Desconto (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cotacao.desconto || 0}
                            onChange={(e) =>
                              updateCotacao(purchaseForm, setPurchaseForm, index, 'desconto', Number(e.target.value))
                            }
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/90 mb-2">Link</label>
                          <input
                            type="url"
                            value={cotacao.link || ''}
                            onChange={(e) => updateCotacao(purchaseForm, setPurchaseForm, index, 'link', e.target.value)}
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                            placeholder="https://..."
                          />
                        </div>
                        <div className="col-span-2">
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-medium text-white/90">Fornecedor</label>
                            <button
                              type="button"
                              onClick={() => openSupplierModal(index)}
                              className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                            >
                              <span>+</span> Adicionar Fornecedor
                            </button>
                          </div>
                          <select
                            value={cotacao.fornecedorId || ''}
                            onChange={(e) => {
                              const value = e.target.value ? Number(e.target.value) : undefined;
                              if (value !== undefined) {
                                updateCotacao(purchaseForm, setPurchaseForm, index, 'fornecedorId', value);
                              } else {
                                const newCotacoes = [...purchaseForm.cotacoes];
                                newCotacoes[index] = { ...newCotacoes[index], fornecedorId: undefined };
                                setPurchaseForm({ ...purchaseForm, cotacoes: newCotacoes });
                              }
                            }}
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                            style={{
                              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 0.75rem center',
                              paddingRight: '2rem'
                            }}
                          >
                            <option value="" className="bg-neutral text-white">Selecione um fornecedor (opcional)</option>
                            {suppliers.filter(s => s.ativo).map((supplier) => (
                              <option key={supplier.id} value={supplier.id} className="bg-neutral text-white">
                                {supplier.nomeFantasia}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-white/90 mb-2">Forma de Pagamento</label>
                          <select
                            value={cotacao.formaPagamento || ''}
                            onChange={(e) => updateCotacao(purchaseForm, setPurchaseForm, index, 'formaPagamento', e.target.value)}
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                            style={{
                              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 0.75rem center',
                              paddingRight: '2rem'
                            }}
                          >
                            <option value="" className="bg-neutral text-white">Selecione (opcional)</option>
                            {formasPagamento.map((forma) => (
                              <option key={forma} value={forma} className="bg-neutral text-white">
                                {forma}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-white/10">
                        {cotacao.fornecedorId && (
                          <div className="text-sm text-white/70 mb-2">
                            Fornecedor: <span className="font-semibold text-white">{getSupplierName(cotacao.fornecedorId)}</span>
                          </div>
                        )}
                        {cotacao.formaPagamento && (
                          <div className="text-sm text-white/70 mb-2">
                            Pagamento: <span className="font-semibold text-white">{cotacao.formaPagamento}</span>
                          </div>
                        )}
                        <div className="text-sm text-white/70">
                          Total por unidade:{' '}
                          {cotacao.link ? (
                            <a
                              href={cotacao.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-white hover:text-primary underline cursor-pointer"
                            >
                              {(cotacao.valorUnitario + cotacao.frete + cotacao.impostos - (cotacao.desconto || 0)).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </a>
                          ) : (
                            <span className="font-semibold text-white">
                              {(cotacao.valorUnitario + cotacao.frete + cotacao.impostos - (cotacao.desconto || 0)).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-white/70">
                          Total ({purchaseForm.quantidade} unidades):{' '}
                          {cotacao.link ? (
                            <a
                              href={cotacao.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-primary hover:text-primary/80 underline cursor-pointer"
                            >
                              {calculateTotal(cotacao, purchaseForm.quantidade).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </a>
                          ) : (
                            <span className="font-semibold text-primary">
                              {calculateTotal(cotacao, purchaseForm.quantidade).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
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
                    setShowPurchaseModal(false);
                    setError(null);
                  }}
                  className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-primary hover:bg-primary/80 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Salvando...' : 'Criar Compra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Compra */}
      {showEditPurchaseModal && editingPurchase && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-neutral border border-white/20 rounded-lg sm:rounded-xl shadow-2xl max-w-4xl w-full my-auto max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral border-b border-white/20 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-10">
              <h2 className="text-lg sm:text-xl font-bold">Editar Compra</h2>
              <button
                onClick={() => {
                  setShowEditPurchaseModal(false);
                  setEditingPurchase(null);
                  setError(null);
                  setPurchaseForm({
                    item: '',
                    descricao: '',
                    quantidade: 1,
                    imagemUrl: '',
                    nfUrl: '',
                    comprovantePagamentoUrl: '',
                    cotacoes: [{ valorUnitario: 0, frete: 0, impostos: 0, desconto: 0, link: '', fornecedorId: undefined, formaPagamento: '' }],
                    projetoId: 0,
                    selectedCotacaoIndex: 0,
                    dataCompra: '',
                    categoriaId: undefined,
                    observacao: '',
                  });
                }}
                className="text-white/50 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdatePurchase} className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Nome do Item *</label>
                <input
                  type="text"
                  required
                  value={purchaseForm.item}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, item: e.target.value })}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Motivo da Solicitação</label>
                <textarea
                  value={purchaseForm.descricao}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, descricao: e.target.value })}
                  rows={3}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Descreva o motivo da solicitação..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Imagem</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, setPurchaseForm, purchaseForm)}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
                />
                {purchaseForm.imagemUrl && (
                  <img src={purchaseForm.imagemUrl} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded border border-white/20" />
                )}
                {editingPurchase.imagemUrl && !purchaseForm.imagemUrl && (
                  <div className="mt-2">
                    <p className="text-sm text-white/60 mb-2">Imagem atual:</p>
                    <img src={editingPurchase.imagemUrl} alt="Atual" className="w-32 h-32 object-cover rounded border border-white/20" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Nota Fiscal (NF)</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf';
                    if (!isValidType) {
                      setError('Por favor, selecione um arquivo de imagem ou PDF válido.');
                      return;
                    }
                    const maxFileSize = 5 * 1024 * 1024;
                    if (file.size > maxFileSize) {
                      setError('Arquivo muito grande. Por favor, escolha um arquivo menor que 5MB.');
                      return;
                    }
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                      const base64 = reader.result as string;
                      if (base64) {
                        if (file.type === 'application/pdf') {
                          setPurchaseForm({ ...purchaseForm, nfUrl: base64 });
                        } else {
                          const processed = await processImageUrl(base64);
                          if (processed && processed.length > 0) {
                            setPurchaseForm({ ...purchaseForm, nfUrl: processed });
                          }
                        }
                      }
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
                />
                {purchaseForm.nfUrl && (
                  <div className="mt-2">
                    {purchaseForm.nfUrl.startsWith('data:image/') ? (
                      <img src={purchaseForm.nfUrl} alt="Preview NF" className="w-32 h-32 object-cover rounded border border-white/20" />
                    ) : (
                      <p className="text-sm text-white/70">Arquivo selecionado</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Comprovante de Pagamento</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf';
                    if (!isValidType) {
                      setError('Por favor, selecione um arquivo de imagem ou PDF válido.');
                      return;
                    }
                    const maxFileSize = 5 * 1024 * 1024;
                    if (file.size > maxFileSize) {
                      setError('Arquivo muito grande. Por favor, escolha um arquivo menor que 5MB.');
                      return;
                    }
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                      const base64 = reader.result as string;
                      if (base64) {
                        if (file.type === 'application/pdf') {
                          setPurchaseForm({ ...purchaseForm, comprovantePagamentoUrl: base64 });
                        } else {
                          const processed = await processImageUrl(base64);
                          if (processed && processed.length > 0) {
                            setPurchaseForm({ ...purchaseForm, comprovantePagamentoUrl: processed });
                          }
                        }
                      }
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
                />
                {purchaseForm.comprovantePagamentoUrl && (
                  <div className="mt-2">
                    {purchaseForm.comprovantePagamentoUrl.startsWith('data:image/') ? (
                      <img src={purchaseForm.comprovantePagamentoUrl} alt="Preview Comprovante" className="w-32 h-32 object-cover rounded border border-white/20" />
                    ) : (
                      <p className="text-sm text-white/70">Arquivo selecionado</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Quantidade *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={purchaseForm.quantidade}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, quantidade: Number(e.target.value) })}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Data de Compra</label>
                <input
                  type="date"
                  value={purchaseForm.dataCompra || ''}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, dataCompra: e.target.value })}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-white/90">Categoria</label>
                  <button
                    type="button"
                    onClick={openCategoryModal}
                    className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                  >
                    <span>+</span> Nova Categoria
                  </button>
                </div>
                <select
                  value={purchaseForm.categoriaId || ''}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, categoriaId: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full bg-neutral border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 1rem center',
                    paddingRight: '2.5rem'
                  }}
                >
                  <option value="" className="bg-neutral text-white">Selecione uma categoria (opcional)</option>
                  {categories.filter(c => c.ativo).map((cat) => (
                    <option key={cat.id} value={cat.id} className="bg-neutral text-white">
                      {cat.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-white/10 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Cotações</h3>
                  <button
                    type="button"
                    onClick={() => addCotacao(purchaseForm, setPurchaseForm)}
                    className="px-3 py-1 rounded-md bg-primary/20 hover:bg-primary/30 text-sm"
                  >
                    + Adicionar Cotação
                  </button>
                </div>

                <div className="space-y-4">
                  {purchaseForm.cotacoes.map((cotacao: Cotacao, index: number) => (
                    <div key={index} className="bg-white/10 border border-white/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-sm text-white">Cotação {index + 1}</span>
                        <div className="flex items-center gap-4">
                          {purchaseForm.cotacoes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeCotacao(purchaseForm, setPurchaseForm, index)}
                              className="text-danger hover:text-danger/80 text-sm font-medium"
                            >
                              Remover
                            </button>
                          )}
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name="selectedCotacaoEditPurchase"
                              checked={purchaseForm.selectedCotacaoIndex === index}
                              onChange={() => setPurchaseForm({ ...purchaseForm, selectedCotacaoIndex: index })}
                              className="w-4 h-4 text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-white/90">Usar esta cotação</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-white/90 mb-2">Valor Unitário (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cotacao.valorUnitario}
                            onChange={(e) =>
                              updateCotacao(purchaseForm, setPurchaseForm, index, 'valorUnitario', Number(e.target.value))
                            }
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/90 mb-2">Frete (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cotacao.frete}
                            onChange={(e) =>
                              updateCotacao(purchaseForm, setPurchaseForm, index, 'frete', Number(e.target.value))
                            }
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/90 mb-2">Impostos (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cotacao.impostos}
                            onChange={(e) =>
                              updateCotacao(purchaseForm, setPurchaseForm, index, 'impostos', Number(e.target.value))
                            }
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/90 mb-2">Desconto (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cotacao.desconto || 0}
                            onChange={(e) =>
                              updateCotacao(purchaseForm, setPurchaseForm, index, 'desconto', Number(e.target.value))
                            }
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/90 mb-2">Link</label>
                          <input
                            type="url"
                            value={cotacao.link || ''}
                            onChange={(e) => updateCotacao(purchaseForm, setPurchaseForm, index, 'link', e.target.value)}
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                            placeholder="https://..."
                          />
                        </div>
                        <div className="col-span-2">
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-medium text-white/90">Fornecedor</label>
                            <button
                              type="button"
                              onClick={() => openSupplierModal(index)}
                              className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                            >
                              <span>+</span> Adicionar Fornecedor
                            </button>
                          </div>
                          <select
                            value={cotacao.fornecedorId || ''}
                            onChange={(e) => {
                              const value = e.target.value ? Number(e.target.value) : undefined;
                              if (value !== undefined) {
                                updateCotacao(purchaseForm, setPurchaseForm, index, 'fornecedorId', value);
                              } else {
                                const newCotacoes = [...purchaseForm.cotacoes];
                                newCotacoes[index] = { ...newCotacoes[index], fornecedorId: undefined };
                                setPurchaseForm({ ...purchaseForm, cotacoes: newCotacoes });
                              }
                            }}
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                            style={{
                              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 0.75rem center',
                              paddingRight: '2rem'
                            }}
                          >
                            <option value="" className="bg-neutral text-white">Selecione um fornecedor (opcional)</option>
                            {suppliers.filter(s => s.ativo).map((supplier) => (
                              <option key={supplier.id} value={supplier.id} className="bg-neutral text-white">
                                {supplier.nomeFantasia}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-white/90 mb-2">Forma de Pagamento</label>
                          <select
                            value={cotacao.formaPagamento || ''}
                            onChange={(e) => updateCotacao(purchaseForm, setPurchaseForm, index, 'formaPagamento', e.target.value)}
                            className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                            style={{
                              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 0.75rem center',
                              paddingRight: '2rem'
                            }}
                          >
                            <option value="" className="bg-neutral text-white">Selecione (opcional)</option>
                            {formasPagamento.map((forma) => (
                              <option key={forma} value={forma} className="bg-neutral text-white">
                                {forma}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-white/10">
                        {cotacao.fornecedorId && (
                          <div className="text-sm text-white/70 mb-2">
                            Fornecedor: <span className="font-semibold text-white">{getSupplierName(cotacao.fornecedorId)}</span>
                          </div>
                        )}
                        {cotacao.formaPagamento && (
                          <div className="text-sm text-white/70 mb-2">
                            Pagamento: <span className="font-semibold text-white">{cotacao.formaPagamento}</span>
                          </div>
                        )}
                        <div className="text-sm text-white/70">
                          Total por unidade:{' '}
                          {cotacao.link ? (
                            <a
                              href={cotacao.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-white hover:text-primary underline cursor-pointer"
                            >
                              {(cotacao.valorUnitario + cotacao.frete + cotacao.impostos - (cotacao.desconto || 0)).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </a>
                          ) : (
                            <span className="font-semibold text-white">
                              {(cotacao.valorUnitario + cotacao.frete + cotacao.impostos - (cotacao.desconto || 0)).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-white/70">
                          Total ({purchaseForm.quantidade} unidades):{' '}
                          {cotacao.link ? (
                            <a
                              href={cotacao.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-primary hover:text-primary/80 underline cursor-pointer"
                            >
                              {calculateTotal(cotacao, purchaseForm.quantidade).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </a>
                          ) : (
                            <span className="font-semibold text-primary">
                              {calculateTotal(cotacao, purchaseForm.quantidade).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Informações de quem solicitou (somente leitura) */}
              {editingPurchase?.solicitadoPor && (
                <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                  <span className="text-sm text-white/70">Solicitado por: </span>
                  <span className="text-sm font-semibold text-white">{editingPurchase.solicitadoPor.nome}</span>
                </div>
              )}

              {/* Campo de Observação */}
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Observação</label>
                <textarea
                  value={purchaseForm.observacao || ''}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, observacao: e.target.value })}
                  className="w-full bg-neutral border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                  placeholder="Observações gerais sobre esta compra..."
                  rows={3}
                  maxLength={1000}
                />
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
                    setShowEditPurchaseModal(false);
                    setEditingPurchase(null);
                    setError(null);
                    setPurchaseForm({
                      item: '',
                      descricao: '',
                      quantidade: 1,
                      imagemUrl: '',
                      nfUrl: '',
                      comprovantePagamentoUrl: '',
                      cotacoes: [{ valorUnitario: 0, frete: 0, impostos: 0, desconto: 0, link: '', fornecedorId: undefined, formaPagamento: '' }],
                      projetoId: 0,
                      selectedCotacaoIndex: 0,
                      dataCompra: '',
                      categoriaId: undefined,
                      observacao: '',
                    });
                  }}
                  className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-primary hover:bg-primary/80 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão de Compra */}
      {showDeletePurchaseModal && purchaseToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-neutral border border-white/20 rounded-lg sm:rounded-xl shadow-2xl max-w-md w-full my-auto">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/20">
              <h2 className="text-lg sm:text-xl font-bold text-white">Confirmar Exclusão</h2>
    </div>
            <div className="p-4 sm:p-6">
              <p className="text-white/90 mb-2 text-sm sm:text-base">
                Tem certeza que deseja remover a compra:
              </p>
              <p className="text-lg sm:text-xl font-semibold text-white mb-4 break-words">
                "{purchaseToDelete.item}"
              </p>
              <p className="text-xs sm:text-sm text-white/70 mb-4">
                Esta ação não pode ser desfeita.
              </p>
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-3 sm:px-4 py-2 sm:py-3 rounded-md mb-3 text-xs sm:text-sm">
                  {error}
                </div>
              )}
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-4 sm:space-x-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeletePurchaseModal(false);
                    setPurchaseToDelete(null);
                    setError(null);
                  }}
                  className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 rounded-md bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors text-sm sm:text-base"
                  disabled={deletingPurchase}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeletePurchase}
                  className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                  disabled={deletingPurchase}
                >
                  {deletingPurchase ? 'Removendo...' : 'Confirmar Remoção'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Alterar Status */}
      {showStatusModal && purchaseToUpdateStatus && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 overflow-y-auto">
          <div className="bg-neutral border border-white/20 rounded-lg shadow-2xl max-w-sm sm:max-w-md w-full my-auto max-h-[98vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral border-b border-white/20 px-3 sm:px-4 py-2.5 flex items-center justify-between z-10">
              <h2 className="text-base sm:text-lg font-bold text-white">Alterar Status</h2>
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setPurchaseToUpdateStatus(null);
                  setNewStatus('');
                  setNewStatusEntrega('');
                  setNewDataEntrega('');
                  setNewEnderecoEntrega('');
                  setNewRecebidoPor('');
                  setNewObservacao('');
                  setError(null);
                }}
                className="text-white/50 hover:text-white transition-colors text-lg sm:text-xl"
              >
                ✕
              </button>
            </div>
            <div className="p-3 sm:p-4">
              <p className="text-white/90 mb-2.5 text-xs sm:text-sm">
                Item: <span className="font-semibold break-words">{purchaseToUpdateStatus.item}</span>
              </p>
              <div className="mb-3">
                <label className="block text-xs font-medium text-white/90 mb-1">Novo Status *</label>
                <select
                  value={newStatus}
                  onChange={(e) => {
                    setNewStatus(e.target.value);
                    // Se mudar para COMPRADO_ACAMINHO, inicializar statusEntrega e previsaoEntrega e limpar outros campos
                    if (e.target.value === 'COMPRADO_ACAMINHO') {
                      setNewStatusEntrega(purchaseToUpdateStatus?.statusEntrega || 'NAO_ENTREGUE');
                      setNewPrevisaoEntrega(purchaseToUpdateStatus?.previsaoEntrega ? new Date(purchaseToUpdateStatus.previsaoEntrega).toISOString().split('T')[0] : '');
                      setNewDataEntrega('');
                      setNewEnderecoEntrega('');
                      setNewRecebidoPor('');
                    } 
                    // Se mudar para ENTREGUE, inicializar campos de entrega (sem statusEntrega)
                    else if (e.target.value === 'ENTREGUE') {
                      setNewStatusEntrega('');
                      setNewPrevisaoEntrega('');
                      setNewDataEntrega(purchaseToUpdateStatus?.dataEntrega ? new Date(purchaseToUpdateStatus.dataEntrega).toISOString().split('T')[0] : '');
                      setNewEnderecoEntrega(purchaseToUpdateStatus?.enderecoEntrega || '');
                      setNewRecebidoPor(purchaseToUpdateStatus?.recebidoPor || '');
                    } 
                    // Se mudar para outro status, limpar todos os campos
                    else {
                      setNewStatusEntrega('');
                      setNewPrevisaoEntrega('');
                      setNewDataEntrega('');
                      setNewEnderecoEntrega('');
                      setNewRecebidoPor('');
                    }
                  }}
                  className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.75rem center',
                    paddingRight: '2rem'
                  }}
                >
                  <option value="PENDENTE" className="bg-neutral text-white">Pendente</option>
                  <option value="COMPRADO_ACAMINHO" className="bg-neutral text-white">Comprado/A Caminho</option>
                  <option value="ENTREGUE" className="bg-neutral text-white">Entregue</option>
                </select>
              </div>

              {/* Status de Entrega - aparece quando status é COMPRADO_ACAMINHO (apenas o status, sem outros campos) */}
              {newStatus === 'COMPRADO_ACAMINHO' && (
                <div className="space-y-2.5 mb-3 p-2.5 sm:p-3 bg-blue-500/10 border border-blue-500/30 rounded-md">
                  <h4 className="text-xs font-semibold text-blue-300 mb-1.5">Status de Entrega</h4>
                  
                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">Status de Entrega</label>
                    <select
                      value={newStatusEntrega}
                      onChange={(e) => setNewStatusEntrega(e.target.value)}
                      className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 0.75rem center',
                        paddingRight: '2rem'
                      }}
                    >
                      {statusEntregaOptions.filter(option => option.value !== 'ENTREGUE').map((option) => (
                        <option key={option.value} value={option.value} className="bg-neutral text-white">
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">Previsão de Entrega</label>
                    <input
                      type="date"
                      value={newPrevisaoEntrega}
                      onChange={(e) => setNewPrevisaoEntrega(e.target.value)}
                      className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
              )}

              {/* Campos de Entrega completos - aparecem apenas quando status é ENTREGUE */}
              {newStatus === 'ENTREGUE' && (
                <div className="space-y-2.5 mb-3 p-2.5 sm:p-3 bg-green-500/10 border border-green-500/30 rounded-md">
                  <h4 className="text-xs font-semibold text-green-300 mb-1.5">Informações de Entrega</h4>
                  
                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">Data da Entrega</label>
                    <input
                      type="date"
                      value={newDataEntrega}
                      onChange={(e) => setNewDataEntrega(e.target.value)}
                      className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">Endereço de Entrega</label>
                    <input
                      type="text"
                      value={newEnderecoEntrega}
                      onChange={(e) => setNewEnderecoEntrega(e.target.value)}
                      className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder="Endereço onde foi entregue"
                      maxLength={500}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">Recebido por</label>
                    <input
                      type="text"
                      value={newRecebidoPor}
                      onChange={(e) => setNewRecebidoPor(e.target.value)}
                      className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder="Nome de quem recebeu"
                      maxLength={100}
                    />
                  </div>
                </div>
              )}

              {/* Campo de Observação - aparece sempre */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-white/90 mb-1">Observação</label>
                <textarea
                  value={newObservacao}
                  onChange={(e) => setNewObservacao(e.target.value)}
                  className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                  placeholder="Observações gerais..."
                  rows={2}
                  maxLength={1000}
                />
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-3 py-2 rounded-md mb-2.5 text-xs">
                  {error}
                </div>
              )}
              <div className="flex flex-col sm:flex-row justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowStatusModal(false);
                    setPurchaseToUpdateStatus(null);
                    setNewStatus('');
                    setNewStatusEntrega('');
                    setNewPrevisaoEntrega('');
                    setNewDataEntrega('');
                    setNewEnderecoEntrega('');
                    setNewRecebidoPor('');
                    setNewObservacao('');
                    setError(null);
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors text-sm"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleUpdatePurchaseStatus}
                  className="w-full sm:w-auto px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  disabled={submitting || !newStatus}
                >
                  {submitting ? 'Atualizando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Relatório de Compras */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral border-b border-white/20 px-8 py-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Relatório de Compras</h2>
              <button
                onClick={() => {
                  setShowReportModal(false);
                }}
                className="text-white/50 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="p-8">
              {(() => {
                const reportData = calculateReportTotals();
                const projetoGroups: Record<number, Purchase[]> = {};
                reportData.purchases.forEach((purchase) => {
                  const projetoId = purchase.projetoId || 0;
                  if (!projetoGroups[projetoId]) {
                    projetoGroups[projetoId] = [];
                  }
                  projetoGroups[projetoId].push(purchase);
                });

                return (
                  <div className="space-y-6">
                    {/* Resumo Geral */}
                    <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                      <h3 className="text-xl font-semibold text-white mb-4">Resumo Geral</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-white/5 rounded-lg p-4">
                          <div className="text-sm text-white/70 mb-1">Total de Itens</div>
                          <div className="text-2xl font-bold text-white">{reportData.totalItens}</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-4">
                          <div className="text-sm text-white/70 mb-1">Quantidade Total</div>
                          <div className="text-2xl font-bold text-white">{reportData.totalQuantidade}</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-4">
                          <div className="text-sm text-white/70 mb-1">Valor Total</div>
                          <div className="text-2xl font-bold text-primary">
                            {reportData.totalValor.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </div>
                        </div>
                      </div>
                      
                      {/* Estatísticas por Status */}
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-white/90 mb-2">Distribuição por Status</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {['PENDENTE', 'COMPRADO_ACAMINHO', 'ENTREGUE', 'SOLICITADO'].map((status) => {
                            const count = reportData.purchases.filter(p => p.status === status).length;
                            if (count === 0) return null;
                            return (
                              <div key={status} className="bg-white/5 rounded p-2">
                                <div className="text-xs text-white/70">{getStatusLabel(status)}</div>
                                <div className="text-lg font-bold text-white">{count}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Estatísticas por Categoria */}
                      {reportData.purchases.some(p => (p as any).categoriaId) && (
                        <div className="mt-4">
                          <h4 className="text-sm font-semibold text-white/90 mb-2">Distribuição por Categoria</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {Array.from(new Set(reportData.purchases
                              .filter(p => (p as any).categoriaId)
                              .map(p => (p as any).categoriaId)))
                              .map((catId) => {
                                const count = reportData.purchases.filter(p => (p as any).categoriaId === catId).length;
                                const catTotal = reportData.purchases
                                  .filter(p => (p as any).categoriaId === catId)
                                  .reduce((sum, p) => sum + (p.valorUnitario * (p.quantidade || 0)), 0);
                                return (
                                  <div key={catId} className="bg-white/5 rounded p-2">
                                    <div className="text-xs text-white/70">{getCategoryName(catId)}</div>
                                    <div className="text-sm font-bold text-white">{count} item(s)</div>
                                    <div className="text-xs text-primary">
                                      {catTotal.toLocaleString('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                      
                      {/* Estatísticas por Fornecedor */}
                      {reportData.purchases.some(p => {
                        const cotacoes = p.cotacoesJson && Array.isArray(p.cotacoesJson) ? p.cotacoesJson : [];
                        return cotacoes.some((c: any) => c.fornecedorId);
                      }) && (
                        <div className="mt-4">
                          <h4 className="text-sm font-semibold text-white/90 mb-2">Fornecedores Utilizados</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {Array.from(new Set(
                              reportData.purchases
                                .flatMap(p => {
                                  const cotacoes = p.cotacoesJson && Array.isArray(p.cotacoesJson) ? p.cotacoesJson : [];
                                  return cotacoes
                                    .map((c: any) => c.fornecedorId)
                                    .filter((id: any) => id);
                                })
                            )).map((fornecedorId) => {
                              const count = reportData.purchases.filter(p => {
                                const cotacoes = p.cotacoesJson && Array.isArray(p.cotacoesJson) ? p.cotacoesJson : [];
                                return cotacoes.some((c: any) => c.fornecedorId === fornecedorId);
                              }).length;
                              const fornecedorTotal = reportData.purchases
                                .filter(p => {
                                  const cotacoes = p.cotacoesJson && Array.isArray(p.cotacoesJson) ? p.cotacoesJson : [];
                                  return cotacoes.some((c: any) => c.fornecedorId === fornecedorId);
                                })
                                .reduce((sum, p) => sum + (p.valorUnitario * (p.quantidade || 0)), 0);
                              return (
                                <div key={fornecedorId} className="bg-white/5 rounded p-2">
                                  <div className="text-xs text-white/70">{getSupplierName(fornecedorId)}</div>
                                  <div className="text-sm font-bold text-white">{count} item(s)</div>
                                  <div className="text-xs text-primary">
                                    {fornecedorTotal.toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Detalhamento por Projeto */}
                    {Object.keys(projetoGroups).length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-white">Detalhamento por Projeto</h3>
                        {Object.entries(projetoGroups).map(([projetoId, projetoPurchases]) => {
                          const projeto = projects.find((p) => p.id === Number(projetoId));
                          const projetoTotal = projetoPurchases.reduce(
                            (sum, p) => sum + (p.valorUnitario * (p.quantidade || 0)),
                            0
                          );
                          const projetoQuantidade = projetoPurchases.reduce(
                            (sum, p) => sum + (p.quantidade || 0),
                            0
                          );

                          return (
                            <div key={projetoId} className="bg-white/5 rounded-lg p-6 border border-white/10">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-lg font-semibold text-white">
                                  {projeto ? projeto.nome : 'Sem Projeto'}
                                </h4>
                                <div className="text-right">
                                  <div className="text-sm text-white/70">Total do Projeto</div>
                                  <div className="text-xl font-bold text-primary">
                                    {projetoTotal.toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })}
                                  </div>
                                  <div className="text-sm text-white/70 mt-1">
                                    {projetoQuantidade} unidade(s)
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-2">
                                {projetoPurchases.map((purchase) => {
                                  const valorTotal = purchase.valorUnitario * (purchase.quantidade || 0);
                                  const cotacoes = purchase.cotacoesJson && Array.isArray(purchase.cotacoesJson) ? purchase.cotacoesJson : [];
                                  const cotacaoSelecionada = cotacoes.length > 0 ? cotacoes[0] : null;
                                  
                                  return (
                                    <div
                                      key={purchase.id}
                                      className="bg-white/5 rounded-lg p-4 border border-white/5"
                                    >
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-2">
                                            <div className="font-medium text-white">{purchase.item}</div>
                                            {(purchase as any).categoriaId && (
                                              <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400">
                                                {getCategoryName((purchase as any).categoriaId)}
                                              </span>
                                            )}
                                            <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(purchase.status)}`}>
                                              {getStatusLabel(purchase.status)}
                                            </span>
                                          </div>
                                          
                                          {purchase.descricao && (
                                            <div className="text-sm text-white/60 mb-2">
                                              <span className="font-medium">Motivo:</span> {purchase.descricao}
                                            </div>
                                          )}
                                          
                                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-white/70">
                                            <div>
                                              <span className="font-medium">Quantidade:</span>{' '}
                                              <span className="text-white">{purchase.quantidade}</span>
                                            </div>
                                            <div>
                                              <span className="font-medium">Valor Unitário:</span>{' '}
                                              <span className="text-white">
                                                {purchase.valorUnitario.toLocaleString('pt-BR', {
                                                  style: 'currency',
                                                  currency: 'BRL',
                                                })}
                                              </span>
                                            </div>
                                            
                                            {purchase.solicitadoPor && (
                                              <div>
                                                <span className="font-medium">Solicitado por:</span>{' '}
                                                <span className="text-white">
                                                  {purchase.solicitadoPor.nome}
                                                  {purchase.solicitadoPor.cargo && ` (${purchase.solicitadoPor.cargo.nome})`}
                                                </span>
                                              </div>
                                            )}
                                            
                                            {purchase.dataCompra && (
                                              <div>
                                                <span className="font-medium">Data Compra:</span>{' '}
                                                <span className="text-white">
                                                  {new Date(purchase.dataCompra).toLocaleDateString('pt-BR')}
                                                </span>
                                              </div>
                                            )}
                                            
                                            {purchase.formaPagamento && (
                                              <div>
                                                <span className="font-medium">Forma Pagamento:</span>{' '}
                                                <span className="text-white">{purchase.formaPagamento}</span>
                                              </div>
                                            )}
                                            
                                            {purchase.status === 'COMPRADO_ACAMINHO' && purchase.previsaoEntrega && (
                                              <div>
                                                <span className="font-medium">Previsão Entrega:</span>{' '}
                                                <span className="text-white">
                                                  {new Date(purchase.previsaoEntrega).toLocaleDateString('pt-BR')}
                                                </span>
                                              </div>
                                            )}
                                            
                                            {purchase.dataEntrega && (
                                              <div>
                                                <span className="font-medium">Data Entrega:</span>{' '}
                                                <span className="text-white">
                                                  {new Date(purchase.dataEntrega).toLocaleDateString('pt-BR')}
                                                </span>
                                              </div>
                                            )}
                                            
                                            {purchase.statusEntrega && (
                                              <div>
                                                <span className="font-medium">Status Entrega:</span>{' '}
                                                <span className="text-white">{getStatusLabel(purchase.statusEntrega)}</span>
                                              </div>
                                            )}
                                            
                                            {cotacaoSelecionada?.fornecedorId && (
                                              <div>
                                                <span className="font-medium">Fornecedor:</span>{' '}
                                                <span className="text-white">
                                                  {getSupplierName(cotacaoSelecionada.fornecedorId)}
                                                </span>
                                              </div>
                                            )}
                                            
                                            {purchase.recebidoPor && (
                                              <div>
                                                <span className="font-medium">Recebido por:</span>{' '}
                                                <span className="text-white">{purchase.recebidoPor}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <div className="text-right ml-4">
                                          <div className="text-sm text-white/70">Total</div>
                                          <div className="text-lg font-bold text-primary">
                                            {valorTotal.toLocaleString('pt-BR', {
                                              style: 'currency',
                                              currency: 'BRL',
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Botões de Ação */}
                    <div className="flex justify-end gap-4 pt-4 border-t border-white/20">
                      <button
                        type="button"
                        onClick={() => {
                          setShowReportModal(false);
                          setSelectedPurchases([]);
                        }}
                        className="px-6 py-2.5 rounded-md bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
                      >
                        Fechar
                      </button>
                      <button
                        type="button"
                        onClick={exportToExcel}
                        className="px-6 py-2.5 rounded-md bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Exportar Excel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const reportData = calculateReportTotals();
                          const doc = new jsPDF();
                          
                          // Configurações
                          const pageWidth = doc.internal.pageSize.getWidth();
                          const pageHeight = doc.internal.pageSize.getHeight();
                          const margin = 20;
                          let yPosition = margin;
                          
                          // Função para adicionar nova página se necessário
                          const checkPageBreak = (requiredHeight: number) => {
                            if (yPosition + requiredHeight > pageHeight - margin - 60) {
                              doc.addPage();
                              yPosition = margin;
                            }
                          };
                          
                          // Título
                          doc.setFontSize(20);
                          doc.setTextColor(0, 0, 0);
                          doc.setFont('helvetica', 'bold');
                          doc.text('RELATÓRIO DE COMPRAS', pageWidth / 2, yPosition, { align: 'center' });
                          yPosition += 8;
                          
                          // Data e informações
                          doc.setFontSize(10);
                          doc.setFont('helvetica', 'normal');
                          doc.setTextColor(100, 100, 100);
                          doc.text(`Data de Geração: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, yPosition, { align: 'center' });
                          yPosition += 5;
                          doc.text(`Total de Itens Selecionados: ${reportData.totalItens}`, pageWidth / 2, yPosition, { align: 'center' });
                          yPosition += 12;
                          
                          // Linha separadora
                          doc.setDrawColor(200, 200, 200);
                          doc.line(margin, yPosition, pageWidth - margin, yPosition);
                          yPosition += 10;
                          
                          // Resumo Geral
                          doc.setFontSize(16);
                          doc.setTextColor(0, 0, 0);
                          doc.setFont('helvetica', 'bold');
                          doc.text('RESUMO GERAL', margin, yPosition);
                          yPosition += 10;
                          
                          doc.setFontSize(11);
                          doc.setFont('helvetica', 'normal');
                          doc.setTextColor(0, 0, 0);
                          doc.text(`Total de Itens: ${reportData.totalItens}`, margin, yPosition);
                          yPosition += 7;
                          doc.text(`Quantidade Total: ${reportData.totalQuantidade}`, margin, yPosition);
                          yPosition += 7;
                          doc.setFontSize(12);
                          doc.setTextColor(0, 100, 0);
                          doc.setFont('helvetica', 'bold');
                          doc.text(
                            `Valor Total: ${reportData.totalValor.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}`,
                            margin,
                            yPosition
                          );
                          yPosition += 12;
                          
                          // Distribuição por Status
                          doc.setFontSize(10);
                          doc.setFont('helvetica', 'bold');
                          doc.setTextColor(0, 0, 0);
                          doc.text('Distribuição por Status:', margin, yPosition);
                          yPosition += 7;
                          doc.setFont('helvetica', 'normal');
                          doc.setFontSize(9);
                          doc.setTextColor(60, 60, 60);
                          
                          const statusCounts: Record<string, number> = {};
                          reportData.purchases.forEach((p) => {
                            statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
                          });
                          
                          Object.entries(statusCounts).forEach(([status, count]) => {
                            checkPageBreak(6);
                            doc.text(`   ${getStatusLabel(status)}: ${count} item(s)`, margin + 5, yPosition);
                            yPosition += 5;
                          });
                          
                          // Distribuição por Categoria (se houver)
                          const purchasesComCategoria = reportData.purchases.filter(p => (p as any).categoriaId);
                          if (purchasesComCategoria.length > 0) {
                            yPosition += 5;
                            checkPageBreak(15);
                            doc.setFontSize(10);
                            doc.setFont('helvetica', 'bold');
                            doc.setTextColor(0, 0, 0);
                            doc.text('Distribuição por Categoria:', margin, yPosition);
                            yPosition += 7;
                            doc.setFont('helvetica', 'normal');
                            doc.setFontSize(9);
                            doc.setTextColor(60, 60, 60);
                            
                            const categoriaCounts: Record<number, { count: number; total: number }> = {};
                            purchasesComCategoria.forEach((p) => {
                              const catId = (p as any).categoriaId;
                              if (!categoriaCounts[catId]) {
                                categoriaCounts[catId] = { count: 0, total: 0 };
                              }
                              categoriaCounts[catId].count++;
                              categoriaCounts[catId].total += p.valorUnitario * (p.quantidade || 0);
                            });
                            
                            Object.entries(categoriaCounts).forEach(([catId, data]) => {
                              checkPageBreak(6);
                              const catName = getCategoryName(Number(catId));
                              doc.text(
                                `   ${catName}: ${data.count} item(s) - ${data.total.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}`,
                                margin + 5,
                                yPosition
                              );
                              yPosition += 5;
                            });
                          }
                          
                          // Resumo de Fornecedores (se houver)
                          const purchasesComFornecedor = reportData.purchases.filter(p => {
                            const cotacoes = p.cotacoesJson && Array.isArray(p.cotacoesJson) ? p.cotacoesJson : [];
                            return cotacoes.some((c: any) => c.fornecedorId);
                          });
                          
                          if (purchasesComFornecedor.length > 0) {
                            yPosition += 5;
                            checkPageBreak(15);
                            doc.setFontSize(10);
                            doc.setFont('helvetica', 'bold');
                            doc.setTextColor(0, 0, 0);
                            doc.text('Fornecedores Utilizados:', margin, yPosition);
                            yPosition += 7;
                            doc.setFont('helvetica', 'normal');
                            doc.setFontSize(9);
                            doc.setTextColor(60, 60, 60);
                            
                            const fornecedorCounts: Record<number, { count: number; total: number }> = {};
                            purchasesComFornecedor.forEach((p) => {
                              const cotacoes = p.cotacoesJson && Array.isArray(p.cotacoesJson) ? p.cotacoesJson : [];
                              cotacoes.forEach((cot: any) => {
                                if (cot.fornecedorId) {
                                  if (!fornecedorCounts[cot.fornecedorId]) {
                                    fornecedorCounts[cot.fornecedorId] = { count: 0, total: 0 };
                                  }
                                  fornecedorCounts[cot.fornecedorId].count++;
                                  fornecedorCounts[cot.fornecedorId].total += p.valorUnitario * (p.quantidade || 0);
                                }
                              });
                            });
                            
                            Object.entries(fornecedorCounts).forEach(([fornecedorId, data]) => {
                              checkPageBreak(6);
                              const fornecedorName = getSupplierName(Number(fornecedorId));
                              doc.text(
                                `   ${fornecedorName}: ${data.count} item(s) - ${data.total.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}`,
                                margin + 5,
                                yPosition
                              );
                              yPosition += 5;
                            });
                          }
                          
                          yPosition += 10;
                          
                          // Agrupar por projeto
                          const projetoGroups: Record<number, Purchase[]> = {};
                          reportData.purchases.forEach((purchase) => {
                            const projetoId = purchase.projetoId || 0;
                            if (!projetoGroups[projetoId]) {
                              projetoGroups[projetoId] = [];
                            }
                            projetoGroups[projetoId].push(purchase);
                          });
                          
                          // Detalhamento por Projeto
                          Object.entries(projetoGroups).forEach(([projetoId, projetoPurchases]) => {
                            checkPageBreak(40);
                            
                            const projeto = projects.find((p) => p.id === Number(projetoId));
                            const projetoTotal = projetoPurchases.reduce(
                              (sum, p) => sum + (p.valorUnitario * (p.quantidade || 0)),
                              0
                            );
                            const projetoQuantidade = projetoPurchases.reduce(
                              (sum, p) => sum + (p.quantidade || 0),
                              0
                            );
                            
                            // Título do Projeto
                            doc.setFontSize(14);
                            doc.setTextColor(0, 0, 0);
                            doc.text(
                              projeto ? projeto.nome : 'Sem Projeto',
                              margin,
                              yPosition
                            );
                            yPosition += 8;
                            
                            doc.setFontSize(10);
                            doc.setTextColor(100, 100, 100);
                            doc.text(
                              `Total: ${projetoTotal.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })} | Quantidade: ${projetoQuantidade} unidade(s)`,
                              margin,
                              yPosition
                            );
                            yPosition += 10;
                            
                            // Lista de compras do projeto
                            projetoPurchases.forEach((purchase, idx) => {
                              checkPageBreak(50);
                              
                              const valorTotal = purchase.valorUnitario * (purchase.quantidade || 0);
                              const cotacoes = purchase.cotacoesJson && Array.isArray(purchase.cotacoesJson) ? purchase.cotacoesJson : [];
                              const cotacaoSelecionada = cotacoes.length > 0 ? cotacoes[0] : null;
                              
                              doc.setFontSize(11);
                              doc.setTextColor(0, 0, 0);
                              doc.setFont('helvetica', 'bold');
                              doc.text(`${idx + 1}. ${purchase.item}`, margin + 5, yPosition);
                              yPosition += 6;
                              
                              // Categoria
                              if ((purchase as any).categoriaId) {
                                doc.setFontSize(9);
                                doc.setTextColor(0, 100, 200);
                                doc.setFont('helvetica', 'normal');
                                const catId = (purchase as any).categoriaId;
                                doc.text(`   Categoria: ${getCategoryName(catId)}`, margin + 5, yPosition);
                                yPosition += 5;
                              }
                              
                              doc.setFontSize(9);
                              doc.setTextColor(80, 80, 80);
                              doc.setFont('helvetica', 'normal');
                              
                              // Descrição
                              if (purchase.descricao) {
                                const descLines = doc.splitTextToSize(
                                  `   Motivo da Solicitação: ${purchase.descricao}`,
                                  pageWidth - margin * 2 - 10
                                );
                                descLines.forEach((line: string) => {
                                  checkPageBreak(6);
                                  doc.text(line, margin + 5, yPosition);
                                  yPosition += 5;
                                });
                              }
                              
                              // Informações básicas
                              const basicInfo = [
                                `   Quantidade: ${purchase.quantidade}`,
                                `   Valor Unitário: ${purchase.valorUnitario.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}`,
                                `   Valor Total: ${valorTotal.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}`,
                                `   Status: ${getStatusLabel(purchase.status)}`,
                              ];
                              
                              basicInfo.forEach((info) => {
                                checkPageBreak(5);
                                doc.text(info, margin + 5, yPosition);
                                yPosition += 5;
                              });
                              
                              // Solicitado por
                              if (purchase.solicitadoPor) {
                                checkPageBreak(5);
                                const solicitadoText = `   Solicitado por: ${purchase.solicitadoPor.nome}${purchase.solicitadoPor.cargo ? ` (${purchase.solicitadoPor.cargo.nome})` : ''}`;
                                doc.text(solicitadoText, margin + 5, yPosition);
                                yPosition += 5;
                              }
                              
                              // Data de compra
                              if (purchase.dataCompra) {
                                checkPageBreak(5);
                                doc.text(
                                  `   Data de Compra: ${new Date(purchase.dataCompra).toLocaleDateString('pt-BR')}`,
                                  margin + 5,
                                  yPosition
                                );
                                yPosition += 5;
                              }
                              
                              // Forma de pagamento
                              if (purchase.formaPagamento) {
                                checkPageBreak(5);
                                doc.text(`   Forma de Pagamento: ${purchase.formaPagamento}`, margin + 5, yPosition);
                                yPosition += 5;
                              }
                              
                              // Previsão de entrega
                              if (purchase.status === 'COMPRADO_ACAMINHO' && purchase.previsaoEntrega) {
                                checkPageBreak(5);
                                doc.setTextColor(0, 150, 0);
                                doc.text(
                                  `   Previsão de Entrega: ${new Date(purchase.previsaoEntrega).toLocaleDateString('pt-BR')}`,
                                  margin + 5,
                                  yPosition
                                );
                                doc.setTextColor(80, 80, 80);
                                yPosition += 5;
                              }
                              
                              // Data de entrega
                              if (purchase.dataEntrega) {
                                checkPageBreak(5);
                                doc.text(
                                  `   Data de Entrega: ${new Date(purchase.dataEntrega).toLocaleDateString('pt-BR')}`,
                                  margin + 5,
                                  yPosition
                                );
                                yPosition += 5;
                              }
                              
                              // Status de entrega
                              if (purchase.statusEntrega) {
                                checkPageBreak(5);
                                doc.text(`   Status de Entrega: ${getStatusLabel(purchase.statusEntrega)}`, margin + 5, yPosition);
                                yPosition += 5;
                              }
                              
                              // Recebido por
                              if (purchase.recebidoPor) {
                                checkPageBreak(5);
                                doc.text(`   Recebido por: ${purchase.recebidoPor}`, margin + 5, yPosition);
                                yPosition += 5;
                              }
                              
                              // Endereço de entrega
                              if (purchase.enderecoEntrega) {
                                checkPageBreak(5);
                                const enderecoLines = doc.splitTextToSize(
                                  `   Endereço de Entrega: ${purchase.enderecoEntrega}`,
                                  pageWidth - margin * 2 - 10
                                );
                                enderecoLines.forEach((line: string) => {
                                  checkPageBreak(5);
                                  doc.text(line, margin + 5, yPosition);
                                  yPosition += 5;
                                });
                              }
                              
                              // Fornecedor selecionado
                              if (cotacaoSelecionada?.fornecedorId) {
                                checkPageBreak(5);
                                doc.text(
                                  `   Fornecedor: ${getSupplierName(cotacaoSelecionada.fornecedorId)}`,
                                  margin + 5,
                                  yPosition
                                );
                                yPosition += 5;
                              }
                              
                              // Cotações
                              if (cotacoes.length > 0) {
                                checkPageBreak(8);
                                doc.setFontSize(9);
                                doc.setTextColor(60, 60, 60);
                                doc.setFont('helvetica', 'bold');
                                doc.text('   Cotações:', margin + 5, yPosition);
                                yPosition += 6;
                                doc.setFont('helvetica', 'normal');
                                
                                cotacoes.forEach((cotacao, cotIdx) => {
                                  checkPageBreak(8);
                                  const cotacaoTotal = cotacao.valorUnitario + cotacao.frete + cotacao.impostos - (cotacao.desconto || 0);
                                  const cotacaoTotalComQuantidade = cotacaoTotal * (purchase.quantidade || 0);
                                  
                                  let cotacaoText = `     Cotação ${cotIdx + 1}:`;
                                  if (cotacao.fornecedorId) {
                                    cotacaoText += ` Fornecedor: ${getSupplierName(cotacao.fornecedorId)}`;
                                  }
                                  cotacaoText += ` Valor Unitário: ${cotacao.valorUnitario.toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })}`;
                                  if (cotacao.frete > 0) {
                                    cotacaoText += ` | Frete: ${cotacao.frete.toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })}`;
                                  }
                                  if (cotacao.impostos > 0) {
                                    cotacaoText += ` | Impostos: ${cotacao.impostos.toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })}`;
                                  }
                                  if (cotacao.desconto && cotacao.desconto > 0) {
                                    cotacaoText += ` | Desconto: ${cotacao.desconto.toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })}`;
                                  }
                                  cotacaoText += ` | Total/unidade: ${cotacaoTotal.toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })}`;
                                  if (cotacao.formaPagamento) {
                                    cotacaoText += ` | Pagamento: ${cotacao.formaPagamento}`;
                                  }
                                  
                                  const cotacaoLines = doc.splitTextToSize(cotacaoText, pageWidth - margin * 2 - 15);
                                  cotacaoLines.forEach((line: string) => {
                                    checkPageBreak(5);
                                    doc.text(line, margin + 5, yPosition);
                                    yPosition += 5;
                                  });
                                });
                              }
                              
                              // Observações
                              if (purchase.observacao) {
                                checkPageBreak(6);
                                doc.setFontSize(9);
                                doc.setTextColor(100, 100, 100);
                                const obsLines = doc.splitTextToSize(
                                  `   Observações: ${purchase.observacao}`,
                                  pageWidth - margin * 2 - 10
                                );
                                obsLines.forEach((line: string) => {
                                  checkPageBreak(5);
                                  doc.text(line, margin + 5, yPosition);
                                  yPosition += 5;
                                });
                              }
                              
                              yPosition += 5;
                              
                              // Linha separadora
                              doc.setDrawColor(220, 220, 220);
                              doc.line(margin + 5, yPosition, pageWidth - margin - 5, yPosition);
                              yPosition += 5;
                            });
                            
                            yPosition += 5;
                          });
                          
                          // Campo de Assinatura
                          checkPageBreak(50);
                          yPosition += 10;
                          
                          // Linha de separação
                          doc.setDrawColor(200, 200, 200);
                          doc.line(margin, yPosition, pageWidth - margin, yPosition);
                          yPosition += 15;
                          
                          // Título da seção de assinatura
                          doc.setFontSize(12);
                          doc.setTextColor(0, 0, 0);
                          doc.text('ASSINATURA DO ADMINISTRADOR', margin, yPosition);
                          yPosition += 15;
                          
                          // Campo de assinatura
                          doc.setDrawColor(100, 100, 100);
                          doc.setLineWidth(0.5);
                          const signatureWidth = pageWidth - margin * 2;
                          const signatureHeight = 30;
                          doc.rect(margin, yPosition, signatureWidth, signatureHeight);
                          
                          // Texto abaixo do campo
                          yPosition += signatureHeight + 8;
                          doc.setFontSize(9);
                          doc.setTextColor(120, 120, 120);
                          doc.text('Nome e Assinatura do Administrador', margin, yPosition);
                          
                          // Rodapé
                          const totalPages = doc.getNumberOfPages();
                          for (let i = 1; i <= totalPages; i++) {
                            doc.setPage(i);
                            doc.setFontSize(8);
                            doc.setTextColor(150, 150, 150);
                            doc.text(
                              `Página ${i} de ${totalPages}`,
                              pageWidth / 2,
                              pageHeight - 10,
                              { align: 'center' }
                            );
                          }
                          
                          // Salvar PDF
                          doc.save(`relatorio-compras-${new Date().toISOString().split('T')[0]}.pdf`);
                        }}
                        className="px-6 py-2.5 rounded-md bg-primary hover:bg-primary/80 text-white font-semibold transition-colors"
                      >
                        Exportar PDF
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver Detalhes da Solicitação */}
      {showViewRequestModal && purchaseToView && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral border-b border-white/20 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Detalhes da Solicitação</h2>
              <button
                onClick={() => {
                  setShowViewRequestModal(false);
                  setPurchaseToView(null);
                  setError(null);
                  setApproveCotacoes([{ valorUnitario: 0, frete: 0, impostos: 0, desconto: 0, link: '', fornecedorId: undefined, formaPagamento: '' }]);
                  setSelectedCotacaoIndex(0);
                }}
                className="text-white/50 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Informações Básicas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Item</label>
                  <p className="text-white/90 font-semibold">{purchaseToView.item}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Quantidade</label>
                  <p className="text-white/90">{purchaseToView.quantidade}</p>
                </div>
                {purchaseToView.descricao && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-white/70 mb-1">Motivo da Solicitação</label>
                    <p className="text-white/90">{purchaseToView.descricao}</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Solicitado Por</label>
                  <p className="text-white/90">
                    {(purchaseToView as any).solicitadoPor?.nome || 'N/A'}
                    {(purchaseToView as any).solicitadoPor?.cargo && (
                      <span className="text-white/60 ml-2">({(purchaseToView as any).solicitadoPor.cargo.nome})</span>
                    )}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Projeto</label>
                  <p className="text-white/90">{(purchaseToView as any).projeto?.nome || 'Sem projeto'}</p>
                </div>
                {(purchaseToView as any).etapa && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-white/70 mb-1">Etapa</label>
                    <p className="text-white/90">{(purchaseToView as any).etapa.nome}</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Status</label>
                  <span className={`px-2 py-1 rounded text-xs ${getStatusColor(purchaseToView.status)}`}>
                    {getStatusLabel(purchaseToView.status)}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Data de Solicitação</label>
                  <p className="text-white/90">
                    {new Date((purchaseToView as any).dataSolicitacao || new Date()).toLocaleString('pt-BR')}
                  </p>
                </div>
                {(purchaseToView as any).dataCompra && (
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-1">Data de Compra</label>
                    <p className="text-white/90">
                      {new Date((purchaseToView as any).dataCompra).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                )}
              </div>

              {/* Informações de Entrega - Exibir quando status for COMPRADO_ACAMINHO */}
              {purchaseToView.status === 'COMPRADO_ACAMINHO' && (
                <div className="bg-blue-500/10 p-4 rounded-md border border-blue-500/30">
                  <h3 className="text-lg font-semibold text-blue-300 mb-3">Status de Entrega</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {purchaseToView.statusEntrega && (
                      <div>
                        <label className="block text-sm font-medium text-white/70 mb-1">Status de Entrega</label>
                        <span className={`px-2 py-1 rounded text-xs ${getStatusEntregaColor(purchaseToView.statusEntrega)}`}>
                          {getStatusEntregaLabel(purchaseToView.statusEntrega)}
                        </span>
                      </div>
                    )}
                    {(purchaseToView as any).previsaoEntrega && (
                      <div>
                        <label className="block text-sm font-medium text-white/70 mb-1">Previsão de Entrega</label>
                        <p className="text-white/90">
                          {new Date((purchaseToView as any).previsaoEntrega).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    )}
                    {(purchaseToView as any).observacao && (
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-white/70 mb-1">Observação</label>
                        <p className="text-white/90 whitespace-pre-wrap">{(purchaseToView as any).observacao}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Informações de Entrega - Exibir quando status for ENTREGUE */}
              {purchaseToView.status === 'ENTREGUE' && (
                <div className="bg-white/5 p-4 rounded-md border border-white/10">
                  <h3 className="text-lg font-semibold text-white/90 mb-3">Informações de Entrega</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {(purchaseToView as any).dataEntrega && (
                      <div>
                        <label className="block text-sm font-medium text-white/70 mb-1">Data da Entrega</label>
                        <p className="text-white/90">
                          {new Date((purchaseToView as any).dataEntrega).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    )}
                    {(purchaseToView as any).enderecoEntrega && (
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-white/70 mb-1">Endereço de Entrega</label>
                        <p className="text-white/90">{(purchaseToView as any).enderecoEntrega}</p>
                      </div>
                    )}
                    {(purchaseToView as any).recebidoPor && (
                      <div>
                        <label className="block text-sm font-medium text-white/70 mb-1">Recebido por</label>
                        <p className="text-white/90">{(purchaseToView as any).recebidoPor}</p>
                      </div>
                    )}
                    {(purchaseToView as any).observacao && (
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-white/70 mb-1">Observação</label>
                        <p className="text-white/90 whitespace-pre-wrap">{(purchaseToView as any).observacao}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Imagem se houver */}
              {(purchaseToView as any).imagemUrl && (
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Imagem</label>
                  <img
                    src={(purchaseToView as any).imagemUrl}
                    alt={purchaseToView.item}
                    className="max-w-full h-auto rounded-md border border-white/20"
                  />
                </div>
              )}

              {/* Cotações existentes se houver */}
              {purchaseToView.cotacoesJson && Array.isArray(purchaseToView.cotacoesJson) && purchaseToView.cotacoesJson.length > 0 ? (
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Cotações Existentes</label>
                  <div className="space-y-2">
                    {purchaseToView.cotacoesJson.map((cotacao: any, index: number) => (
                      <div key={index} className="bg-white/5 p-3 rounded-md border border-white/10">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-white/70">Valor Unitário: </span>
                            <span className="text-white/90">
                              {cotacao.valorUnitario?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="text-white/70">Frete: </span>
                            <span className="text-white/90">
                              {cotacao.frete?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="text-white/70">Impostos: </span>
                            <span className="text-white/90">
                              {cotacao.impostos?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="text-white/70">Total: </span>
                            <span className="text-primary font-semibold">
                              {((cotacao.valorUnitario || 0) + (cotacao.frete || 0) + (cotacao.impostos || 0) - (cotacao.desconto || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                          {cotacao.link && (
                            <div className="col-span-2">
                              <span className="text-white/70">Link: </span>
                              <a
                                href={cotacao.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {cotacao.link}
                              </a>
                            </div>
                          )}
                          {cotacao.fornecedorId && (
                            <div className="col-span-2">
                              <span className="text-white/70">Fornecedor: </span>
                              <span className="text-white/90 font-semibold">{getSupplierName(cotacao.fornecedorId)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Adicionar Cotações para Aprovar</label>
                  <p className="text-xs text-white/60 mb-3">Esta solicitação não possui cotações. Adicione pelo menos uma cotação para poder aprovar.</p>
                  <div className="space-y-3">
                    {approveCotacoes.map((cotacao: Cotacao, index: number) => (
                      <div key={index} className="bg-white/5 p-4 rounded-md border border-white/10">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-white/90">Cotação {index + 1}</span>
                          {approveCotacoes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newCotacoes = approveCotacoes.filter((_, i) => i !== index);
                                setApproveCotacoes(newCotacoes);
                                if (selectedCotacaoIndex >= newCotacoes.length) {
                                  setSelectedCotacaoIndex(newCotacoes.length - 1);
                                }
                              }}
                              className="text-red-400 hover:text-red-300 text-sm"
                            >
                              Remover
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-white/70 mb-1">Valor Unitário *</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={cotacao.valorUnitario}
                              onChange={(e) => {
                                const newCotacoes = [...approveCotacoes];
                                newCotacoes[index].valorUnitario = parseFloat(e.target.value) || 0;
                                setApproveCotacoes(newCotacoes);
                              }}
                              className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-white/70 mb-1">Frete</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={cotacao.frete}
                              onChange={(e) => {
                                const newCotacoes = [...approveCotacoes];
                                newCotacoes[index].frete = parseFloat(e.target.value) || 0;
                                setApproveCotacoes(newCotacoes);
                              }}
                              className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-white/70 mb-1">Impostos</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={cotacao.impostos}
                              onChange={(e) => {
                                const newCotacoes = [...approveCotacoes];
                                newCotacoes[index].impostos = parseFloat(e.target.value) || 0;
                                setApproveCotacoes(newCotacoes);
                              }}
                              className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-white/70 mb-1">Desconto</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={cotacao.desconto || 0}
                              onChange={(e) => {
                                const newCotacoes = [...approveCotacoes];
                                newCotacoes[index].desconto = parseFloat(e.target.value) || 0;
                                setApproveCotacoes(newCotacoes);
                              }}
                              className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-white/70 mb-1">Link (opcional)</label>
                            <input
                              type="text"
                              value={cotacao.link || ''}
                              onChange={(e) => {
                                const newCotacoes = [...approveCotacoes];
                                newCotacoes[index].link = e.target.value;
                                setApproveCotacoes(newCotacoes);
                              }}
                              className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                              placeholder="URL da cotação"
                            />
                          </div>
                          <div className="col-span-2">
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs text-white/70">Fornecedor (opcional)</label>
                              <button
                                type="button"
                                onClick={() => {
                                  setCurrentCotacaoIndex(index);
                                  openSupplierModal(index);
                                }}
                                className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                              >
                                <span>+</span> Adicionar Fornecedor
                              </button>
                        </div>
                            <select
                              value={cotacao.fornecedorId || ''}
                              onChange={(e) => {
                                const newCotacoes = [...approveCotacoes];
                                newCotacoes[index].fornecedorId = e.target.value ? Number(e.target.value) : undefined;
                                setApproveCotacoes(newCotacoes);
                              }}
                              className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                              style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 0.75rem center',
                                paddingRight: '2rem'
                              }}
                            >
                              <option value="" className="bg-neutral text-white">Selecione um fornecedor</option>
                              {suppliers.filter(s => s.ativo).map((supplier) => (
                                <option key={supplier.id} value={supplier.id} className="bg-neutral text-white">
                                  {supplier.nomeFantasia}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs text-white/70 mb-1">Forma de Pagamento (opcional)</label>
                            <select
                              value={cotacao.formaPagamento || ''}
                              onChange={(e) => {
                                const newCotacoes = [...approveCotacoes];
                                newCotacoes[index].formaPagamento = e.target.value;
                                setApproveCotacoes(newCotacoes);
                              }}
                              className="w-full bg-white/10 border border-white/30 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                              style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 0.75rem center',
                                paddingRight: '2rem'
                              }}
                            >
                              <option value="" className="bg-neutral text-white">Selecione</option>
                              {formasPagamento.map((forma) => (
                                <option key={forma} value={forma} className="bg-neutral text-white">
                                  {forma}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        {cotacao.fornecedorId && (
                          <div className="mt-2 text-xs text-white/70">
                            Fornecedor: <span className="font-semibold text-white">{getSupplierName(cotacao.fornecedorId)}</span>
                          </div>
                        )}
                        {cotacao.formaPagamento && (
                          <div className="mt-2 text-xs text-white/70">
                            Pagamento: <span className="font-semibold text-white">{cotacao.formaPagamento}</span>
                          </div>
                        )}
                        <div className="mt-2">
                          <span className="text-xs text-white/70">Total: </span>
                          <span className="text-primary font-semibold text-sm">
                            {((cotacao.valorUnitario || 0) + (cotacao.frete || 0) + (cotacao.impostos || 0) - (cotacao.desconto || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setApproveCotacoes([...approveCotacoes, { valorUnitario: 0, frete: 0, impostos: 0, desconto: 0, link: '', fornecedorId: undefined, formaPagamento: '' }])}
                      className="w-full py-2 px-4 bg-white/10 hover:bg-white/20 border border-white/30 rounded-md text-white text-sm transition-colors"
                    >
                      + Adicionar Outra Cotação
                    </button>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-white/70 mb-2">Selecionar Cotação para Aprovar</label>
                    <select
                      value={selectedCotacaoIndex}
                      onChange={(e) => setSelectedCotacaoIndex(parseInt(e.target.value))}
                      className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 1rem center',
                        paddingRight: '2.5rem'
                      }}
                    >
                      {approveCotacoes.map((_, index) => (
                        <option key={index} value={index} className="bg-neutral text-white">
                          Cotação {index + 1} - Total: {((approveCotacoes[index].valorUnitario || 0) + (approveCotacoes[index].frete || 0) + (approveCotacoes[index].impostos || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Observação - Sempre exibir */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Observação</label>
                <p className="text-white/90 whitespace-pre-wrap">{(purchaseToView as any).observacao || 'Nenhuma observação'}</p>
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-md text-sm">
                  {error}
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex justify-end space-x-4 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowViewRequestModal(false);
                    setPurchaseToView(null);
                    setError(null);
                  }}
                  className="px-6 py-2.5 rounded-md bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    // Se não houver cotações na solicitação, usar as cotações adicionadas no modal
                    const cotacoesToSend = (purchaseToView.cotacoesJson && Array.isArray(purchaseToView.cotacoesJson) && purchaseToView.cotacoesJson.length > 0)
                      ? purchaseToView.cotacoesJson
                      : approveCotacoes.filter(c => c.valorUnitario > 0);
                    
                    if (cotacoesToSend.length === 0) {
                      setError('Adicione pelo menos uma cotação com valor unitário para aprovar a solicitação');
                      return;
                    }

                    setSubmitting(true);
                    setError(null);
                    try {
                      await api.post(`/stock/purchases/${purchaseToView.id}/approve`, {
                        cotacoes: cotacoesToSend,
                        selectedCotacaoIndex: selectedCotacaoIndex,
                      });
                      await load();
                      setError(null);
                      setShowViewRequestModal(false);
                      setPurchaseToView(null);
                      setApproveCotacoes([{ valorUnitario: 0, frete: 0, impostos: 0, desconto: 0, link: '', fornecedorId: undefined, formaPagamento: '' }]);
                      setSelectedCotacaoIndex(0);
                      toast.success('Solicitação de compra aprovada com sucesso!');
                    } catch (err: any) {
                      const errorMessage = formatApiError(err);
                      setError(errorMessage);
                      toast.error(errorMessage);
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className="px-6 py-2.5 rounded-md bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={submitting}
                >
                  {submitting ? 'Aprovando...' : 'Aprovar Solicitação'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowViewRequestModal(false);
                    setPurchaseToReject(purchaseToView);
                    setRejectReason('');
                    setShowRejectModal(true);
                  }}
                  className="px-6 py-2.5 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
                >
                  Reprovar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reprovar Solicitação */}
      {showRejectModal && purchaseToReject && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-md w-full">
            <div className="sticky top-0 bg-neutral border-b border-white/20 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Reprovar Solicitação</h2>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setPurchaseToReject(null);
                  setRejectReason('');
                  setError(null);
                }}
                className="text-white/50 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <p className="text-white/90 mb-4">
                Item: <span className="font-semibold">{purchaseToReject.item}</span>
              </p>
              <div className="mb-6">
                <label className="block text-sm font-medium text-white/90 mb-2">Motivo da Rejeição *</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Descreva o motivo da rejeição..."
                  required
                />
              </div>
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-md mb-4 text-sm">
                  {error}
                </div>
              )}
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectModal(false);
                    setPurchaseToReject(null);
                    setRejectReason('');
                    setError(null);
                  }}
                  className="px-6 py-2.5 rounded-md bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!rejectReason.trim()) {
                      setError('Por favor, informe o motivo da rejeição');
                      return;
                    }
                    setSubmitting(true);
                    setError(null);
                    try {
                      await api.post(`/stock/purchases/${purchaseToReject.id}/reject`, {
                        motivoRejeicao: rejectReason.trim(),
                      });
                      await load();
                      setShowRejectModal(false);
                      setPurchaseToReject(null);
                      setRejectReason('');
                      setError(null);
                      toast.success('Solicitação de compra reprovada.');
                      // Redirecionar para o projeto se houver
                      if (purchaseToReject.projetoId) {
                        window.location.href = `/projects/${purchaseToReject.projetoId}`;
                      }
                    } catch (err: any) {
                      const errorMessage = formatApiError(err);
                      setError(errorMessage);
                      toast.error(errorMessage);
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className="px-6 py-2.5 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={submitting || !rejectReason.trim()}
                >
                  {submitting ? 'Reprovando...' : 'Confirmar Reprovação'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar Fornecedor */}
      <SupplierModal
        isOpen={showSupplierModal}
        onClose={() => {
          setShowSupplierModal(false);
          setCurrentCotacaoIndex(null);
        }}
        onSupplierCreated={handleSupplierCreated}
      />

      {/* Modal Criar Categoria */}
      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onCategoryCreated={handleCategoryCreated}
      />

      {/* Modal Detalhes do Item de Estoque */}
      {showItemDetailsModal && itemToView && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral border-b border-white/20 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Detalhes do Item</h2>
              <button
                onClick={() => {
                  setShowItemDetailsModal(false);
                  setItemToView(null);
                }}
                className="text-white/50 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Imagem */}
              {itemToView.imagemUrl && (
                <div className="flex justify-center">
                  <img
                    src={itemToView.imagemUrl}
                    alt={itemToView.item || 'Item'}
                    className="max-w-full max-h-64 object-contain rounded-lg border border-white/10"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Informações Básicas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1">Item</label>
                  <p className="text-white/90 font-semibold">{itemToView.item || '—'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1">Quantidade Total</label>
                  <p className="text-white/90 font-semibold">{itemToView.quantidade || 0}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1">Quantidade Alocada</label>
                  <p className="text-white/90 font-semibold">{itemToView.quantidadeAlocada || 0}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1">Quantidade Disponível</label>
                  <p className="text-white/90 font-semibold">{itemToView.quantidadeDisponivel || itemToView.quantidade || 0}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1">Valor Unitário</label>
                  <p className="text-white/90 font-semibold">
                    {itemToView.valorUnitario.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1">Valor Total</label>
                  <p className="text-white/90 font-semibold">
                    {((itemToView.valorUnitario || 0) * (itemToView.quantidade || 0)).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1">Status</label>
                  <p className="text-white/90 font-semibold">{itemToView.status || '—'}</p>
                </div>
                {(itemToView as any).codigo && (
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1">Código</label>
                    <p className="text-white/90 font-semibold">{(itemToView as any).codigo}</p>
                  </div>
                )}
                {(itemToView as any).unidadeMedida && (
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1">Unidade de Medida</label>
                    <p className="text-white/90 font-semibold">{(itemToView as any).unidadeMedida}</p>
                  </div>
                )}
                {(itemToView as any).localizacao && (
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1">Localização</label>
                    <p className="text-white/90 font-semibold">{(itemToView as any).localizacao}</p>
                  </div>
                )}
                {(itemToView as any).categoriaId && (
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1">Categoria</label>
                    <p className="text-white/90 font-semibold">{getCategoryName((itemToView as any).categoriaId)}</p>
                  </div>
                )}
              </div>

              {/* Descrição */}
              {itemToView.descricao && (
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1">Descrição</label>
                  <p className="text-white/90 whitespace-pre-wrap">{itemToView.descricao}</p>
                </div>
              )}

              {/* Cotações */}
              {itemToView.cotacoesJson && Array.isArray(itemToView.cotacoesJson) && itemToView.cotacoesJson.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Cotações</label>
                  <div className="space-y-2">
                    {itemToView.cotacoesJson.map((cotacao: Cotacao, index: number) => {
                      const total = (cotacao.valorUnitario || 0) + (cotacao.frete || 0) + (cotacao.impostos || 0) - (cotacao.desconto || 0);
                      const totalComQuantidade = total * (itemToView.quantidade || 1);
                      return (
                        <div key={index} className="bg-white/5 border border-white/10 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-white/90">Cotação {index + 1}</span>
                            <span className="text-sm font-bold text-primary">
                              {totalComQuantidade.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-white/70">
                            <div>Valor Unitário: {cotacao.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                            <div>Frete: {cotacao.frete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                            <div>Impostos: {cotacao.impostos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                            {cotacao.desconto && <div>Desconto: {cotacao.desconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>}
                            {cotacao.formaPagamento && <div>Forma de Pagamento: {cotacao.formaPagamento}</div>}
                            {cotacao.fornecedorId && (
                              <div>Fornecedor: {getSupplierName(cotacao.fornecedorId)}</div>
                            )}
                          </div>
                          {cotacao.link && (
                            <div className="mt-2">
                              <a
                                href={cotacao.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:text-primary/80 underline"
                              >
                                Ver link da cotação
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Botão Fechar */}
              <div className="flex justify-end pt-4 border-t border-white/10">
                <button
                  onClick={() => {
                    setShowItemDetailsModal(false);
                    setItemToView(null);
                  }}
                  className="px-6 py-2.5 rounded-md bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes da Compra */}
      {showPurchaseDetailsModal && purchaseToViewDetails && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral border-b border-white/20 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Detalhes da Compra</h2>
              <button
                onClick={() => {
                  setShowPurchaseDetailsModal(false);
                  setPurchaseToViewDetails(null);
                }}
                className="text-white/50 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Imagem */}
              {purchaseToViewDetails.imagemUrl && (
                <div className="flex justify-center">
                  <img
                    src={purchaseToViewDetails.imagemUrl}
                    alt={purchaseToViewDetails.item || 'Item'}
                    className="max-w-full max-h-64 object-contain rounded-lg border border-white/10"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Informações Básicas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1">Item</label>
                  <p className="text-white/90 font-semibold">{purchaseToViewDetails.item || '—'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1">Quantidade</label>
                  <p className="text-white/90 font-semibold">{purchaseToViewDetails.quantidade || 0}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1">Status</label>
                  <span className={`px-2 py-1 rounded text-xs ${getStatusColor(purchaseToViewDetails.status)}`}>
                    {getStatusLabel(purchaseToViewDetails.status)}
                  </span>
                </div>
                {purchaseToViewDetails.statusEntrega && (
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1">Status de Entrega</label>
                    <span className={`px-2 py-1 rounded text-xs ${getStatusEntregaColor(purchaseToViewDetails.statusEntrega)}`}>
                      {getStatusEntregaLabel(purchaseToViewDetails.statusEntrega)}
                    </span>
                  </div>
                )}
                {purchaseToViewDetails.solicitadoPor && (
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1">Solicitado Por</label>
                    <p className="text-white/90 font-semibold">{purchaseToViewDetails.solicitadoPor.nome}</p>
                  </div>
                )}
                {(purchaseToViewDetails as any).projeto && (
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1">Projeto</label>
                    <p className="text-white/90 font-semibold">{(purchaseToViewDetails as any).projeto.nome}</p>
                  </div>
                )}
                {(purchaseToViewDetails as any).categoriaId && (
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1">Categoria</label>
                    <p className="text-white/90 font-semibold">{getCategoryName((purchaseToViewDetails as any).categoriaId)}</p>
                  </div>
                )}
                {purchaseToViewDetails.dataSolicitacao && (
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1">Data de Solicitação</label>
                    <p className="text-white/90 font-semibold">
                      {new Date(purchaseToViewDetails.dataSolicitacao).toLocaleString('pt-BR')}
                    </p>
                  </div>
                )}
                {purchaseToViewDetails.dataCompra && (
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1">Data de Compra</label>
                    <p className="text-white/90 font-semibold">
                      {new Date(purchaseToViewDetails.dataCompra).toLocaleString('pt-BR')}
                    </p>
                  </div>
                )}
                {purchaseToViewDetails.previsaoEntrega && (
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1">Previsão de Entrega</label>
                    <p className="text-white/90 font-semibold">
                      {new Date(purchaseToViewDetails.previsaoEntrega).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                )}
                {purchaseToViewDetails.dataEntrega && (
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1">Data de Entrega</label>
                    <p className="text-white/90 font-semibold">
                      {new Date(purchaseToViewDetails.dataEntrega).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                )}
                {purchaseToViewDetails.enderecoEntrega && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-white/60 mb-1">Endereço de Entrega</label>
                    <p className="text-white/90 font-semibold">{purchaseToViewDetails.enderecoEntrega}</p>
                  </div>
                )}
                {purchaseToViewDetails.recebidoPor && (
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1">Recebido Por</label>
                    <p className="text-white/90 font-semibold">{purchaseToViewDetails.recebidoPor}</p>
                  </div>
                )}
                {purchaseToViewDetails.formaPagamento && (
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1">Forma de Pagamento</label>
                    <p className="text-white/90 font-semibold">{purchaseToViewDetails.formaPagamento}</p>
                  </div>
                )}
                {purchaseToViewDetails.valorUnitario && (
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1">Valor Unitário</label>
                    <p className="text-white/90 font-semibold">
                      {purchaseToViewDetails.valorUnitario.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </p>
                  </div>
                )}
                {purchaseToViewDetails.valorUnitario && (
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1">Valor Total</label>
                    <p className="text-white/90 font-semibold">
                      {((purchaseToViewDetails.valorUnitario || 0) * (purchaseToViewDetails.quantidade || 0)).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </p>
                  </div>
                )}
              </div>

              {/* Descrição */}
              {purchaseToViewDetails.descricao && (
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1">Descrição / Motivo</label>
                  <p className="text-white/90 whitespace-pre-wrap">{purchaseToViewDetails.descricao}</p>
                </div>
              )}

              {/* Observação */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1">Observação</label>
                <p className="text-white/90 whitespace-pre-wrap">{purchaseToViewDetails.observacao || 'Nenhuma observação'}</p>
              </div>

              {/* Cotações */}
              {purchaseToViewDetails.cotacoesJson && Array.isArray(purchaseToViewDetails.cotacoesJson) && purchaseToViewDetails.cotacoesJson.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Cotações</label>
                  <div className="space-y-2">
                    {purchaseToViewDetails.cotacoesJson.map((cotacao: Cotacao, index: number) => {
                      const total = (cotacao.valorUnitario || 0) + (cotacao.frete || 0) + (cotacao.impostos || 0) - (cotacao.desconto || 0);
                      const totalComQuantidade = total * (purchaseToViewDetails.quantidade || 1);
                      return (
                        <div key={index} className="bg-white/5 border border-white/10 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-white/90">Cotação {index + 1}</span>
                            <span className="text-sm font-bold text-primary">
                              {totalComQuantidade.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-white/70">
                            <div>Valor Unitário: {cotacao.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                            <div>Frete: {cotacao.frete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                            <div>Impostos: {cotacao.impostos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                            {cotacao.desconto && <div>Desconto: {cotacao.desconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>}
                            {cotacao.formaPagamento && <div>Forma de Pagamento: {cotacao.formaPagamento}</div>}
                            {cotacao.fornecedorId && (
                              <div>Fornecedor: {getSupplierName(cotacao.fornecedorId)}</div>
                            )}
                          </div>
                          {cotacao.link && (
                            <div className="mt-2">
                              <a
                                href={cotacao.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:text-primary/80 underline"
                              >
                                Ver link da cotação
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Documentos */}
              {(purchaseToViewDetails.nfUrl || purchaseToViewDetails.comprovantePagamentoUrl) && (
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Documentos</label>
                  <div className="space-y-2">
                    {purchaseToViewDetails.nfUrl && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white/70">Nota Fiscal:</span>
                        <a
                          href={purchaseToViewDetails.nfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:text-primary/80 underline"
                        >
                          Ver Nota Fiscal
                        </a>
                      </div>
                    )}
                    {purchaseToViewDetails.comprovantePagamentoUrl && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white/70">Comprovante de Pagamento:</span>
                        <a
                          href={purchaseToViewDetails.comprovantePagamentoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:text-primary/80 underline"
                        >
                          Ver Comprovante
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Botão Fechar */}
              <div className="flex justify-end pt-4 border-t border-white/10">
                <button
                  onClick={() => {
                    setShowPurchaseDetailsModal(false);
                    setPurchaseToViewDetails(null);
                  }}
                  className="px-6 py-2.5 rounded-md bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
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

