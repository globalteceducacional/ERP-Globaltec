import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, DataTableColumn } from '../components/DataTable';
import { api } from '../services/api';
import { useAuthStore } from '../store/auth';
import { Category, Projeto, Supplier } from '../types/stock';
import { btn } from '../utils/buttonStyles';
import { formatApiError, toast } from '../utils/toast';
import { ExcelDownloadButton } from '../components/ExcelDownloadButton';
import { FileDropInput } from '../components/FileDropInput';
import { buildCuradoriaTemplateWorkbook } from '../utils/curadoriaExcelTemplate';
import * as XLSX from 'xlsx-js-style';

interface CuradoriaBudget {
  id: number;
  nome: string;
  projetoId?: number | null;
  fornecedorId?: number | null;
  observacao?: string | null;
  status?: 'PENDENTE' | 'COMPRADO_ACAMINHO' | 'ENTREGUE' | 'SOLICITADO' | 'REPROVADO';
  nfUrl?: string | null;
  formaPagamento?: string | null;
  arquivoOrcamentoUrl?: string | null;
  comprovantePagamentoUrl?: string | null;
  projeto?: { id: number; nome: string } | null;
  fornecedor?: { id: number; nomeFantasia: string; razaoSocial: string; cnpj: string } | null;
  descontoAplicadoEm?: 'ITEM' | 'TOTAL';
  descontoTotal?: number;
  totalItens: number;
  totalBruto: number;
  totalDesconto: number;
  totalLiquido: number;
  dataCriacao: string;
}

interface CuradoriaItemForm {
  nome: string;
  isbn: string;
  categoriaId?: number;
  quantidade?: number;
  valor?: number;
  desconto?: number;
  autor?: string;
  editora?: string;
  anoPublicacao?: string;
}

interface CuradoriaCreateForm {
  nome: string;
  projetoId?: number;
  fornecedorId?: number;
  nfUrl: string;
  formaPagamento: string;
  status: 'PENDENTE' | 'COMPRADO_ACAMINHO' | 'ENTREGUE' | 'SOLICITADO' | 'REPROVADO';
  arquivoOrcamentoUrl: string;
  comprovantePagamentoUrl: string;
  observacao: string;
  descontoAplicadoEm: 'ITEM' | 'TOTAL';
  descontoTotal: number;
  itens: CuradoriaItemForm[];
}

interface CuradoriaEditForm {
  nome: string;
  projetoId?: number;
  fornecedorId?: number;
  nfUrl: string;
  formaPagamento: string;
  status: 'PENDENTE' | 'COMPRADO_ACAMINHO' | 'ENTREGUE' | 'SOLICITADO' | 'REPROVADO';
  arquivoOrcamentoUrl: string;
  comprovantePagamentoUrl: string;
  observacao: string;
  descontoAplicadoEm: 'ITEM' | 'TOTAL';
  descontoTotal: number;
}

type TotalDiscountInputType = 'VALOR' | 'PERCENTUAL';

const CURADORIA_STATUS_OPTIONS: Array<{
  value: 'PENDENTE' | 'COMPRADO_ACAMINHO' | 'ENTREGUE' | 'SOLICITADO' | 'REPROVADO';
  label: string;
}> = [
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'COMPRADO_ACAMINHO', label: 'Comprado / A caminho' },
  { value: 'ENTREGUE', label: 'Entregue' },
  { value: 'SOLICITADO', label: 'Solicitado' },
  { value: 'REPROVADO', label: 'Reprovado' },
];

interface IsbnBookData {
  isbn: string;
  titulo: string | null;
  autores: string[];
  editora: string | null;
  anoPublicacao: string | null;
  categorias: string[];
}

interface CuradoriaImportResult {
  id: number;
  nome: string;
  totalItens: number;
  imported: number;
  skipped: number;
  missingTitleIsbns?: string[];
  message?: string;
}

const createEmptyItem = (): CuradoriaItemForm => ({
  nome: '',
  isbn: '',
  categoriaId: undefined,
  quantidade: 1,
  valor: undefined,
  desconto: undefined,
  autor: '',
  editora: '',
  anoPublicacao: '',
});

export default function Curadoria() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [budgets, setBudgets] = useState<CuradoriaBudget[]>([]);
  const [projects, setProjects] = useState<Projeto[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState<CuradoriaBudget | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deletingBudgetId, setDeletingBudgetId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingBudgetId, setEditingBudgetId] = useState<number | null>(null);
  const [editingBudgetTotalBruto, setEditingBudgetTotalBruto] = useState(0);
  const [editingBudgetSaving, setEditingBudgetSaving] = useState(false);
  const [isbnLoadingByIndex, setIsbnLoadingByIndex] = useState<Record<number, boolean>>({});

  const [createForm, setCreateForm] = useState<CuradoriaCreateForm>({
    nome: '',
    projetoId: undefined,
    fornecedorId: undefined,
    nfUrl: '',
    formaPagamento: '',
    status: 'PENDENTE',
    arquivoOrcamentoUrl: '',
    comprovantePagamentoUrl: '',
    observacao: '',
    descontoAplicadoEm: 'ITEM',
    descontoTotal: 0,
    itens: [createEmptyItem()],
  });

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importName, setImportName] = useState('');
  const [importProjectId, setImportProjectId] = useState<number | undefined>(undefined);
  const [importCategoryId, setImportCategoryId] = useState<number | undefined>(undefined);
  const [overwriteCurrent, setOverwriteCurrent] = useState(true);
  const [importDiscountMode, setImportDiscountMode] = useState<'ITEM' | 'TOTAL'>('ITEM');
  const [importDiscountTotal, setImportDiscountTotal] = useState(0);
  const [createDiscountTotalType, setCreateDiscountTotalType] = useState<TotalDiscountInputType>('VALOR');
  const [editDiscountTotalType, setEditDiscountTotalType] = useState<TotalDiscountInputType>('VALOR');
  const [importDiscountTotalType, setImportDiscountTotalType] = useState<TotalDiscountInputType>('VALOR');
  const [importEstimatedTotalBruto, setImportEstimatedTotalBruto] = useState(0);
  const [importEstimatedBooks, setImportEstimatedBooks] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const importProgressStartedAtRef = useRef<number | null>(null);
  const [editForm, setEditForm] = useState<CuradoriaEditForm>({
    nome: '',
    projetoId: undefined,
    fornecedorId: undefined,
    nfUrl: '',
    formaPagamento: '',
    status: 'PENDENTE',
    arquivoOrcamentoUrl: '',
    comprovantePagamentoUrl: '',
    observacao: '',
    descontoAplicadoEm: 'ITEM',
    descontoTotal: 0,
  });

  const permissionKeys = useMemo(() => {
    if (!user || !user.cargo || typeof user.cargo === 'string') {
      return new Set<string>();
    }
    const permissions = Array.isArray(user.cargo.permissions) ? user.cargo.permissions : [];
    return new Set<string>(
      permissions.map((permission) => permission.chave ?? `${permission.modulo}:${permission.acao}`),
    );
  }, [user]);

  const cargoNome = typeof user?.cargo === 'string' ? user.cargo : user?.cargo?.nome;
  const isDiretor = cargoNome === 'DIRETOR' || cargoNome === 'GM';
  const canEdit = isDiretor || permissionKeys.has('compras:solicitar') || permissionKeys.has('compras:aprovar');
  const canView = canEdit || permissionKeys.has('trabalhos:visualizar');
  const fieldClass =
    'w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary';
  const fileFieldClass =
    'w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30';
  const labelClass = 'block text-sm font-medium text-white/90 mb-2';

  async function loadData() {
    if (!canView) {
      setError('Seu perfil não possui acesso à Curadoria.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [budgetsRes, projectsRes, categoriesRes, suppliersRes] = await Promise.all([
        api.get<CuradoriaBudget[]>('/curadoria/orcamentos'),
        api.get<Projeto[]>('/projects/options'),
        api.get<Category[]>('/categories/all?tipo=LIVRO').catch(() => ({ data: [] as Category[] })),
        api.get<Supplier[]>('/suppliers').catch(() => ({ data: [] as Supplier[] })),
      ]);
      setBudgets(Array.isArray(budgetsRes.data) ? budgetsRes.data : []);
      setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : []);
      setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
      setSuppliers(Array.isArray(suppliersRes.data) ? suppliersRes.data : []);
    } catch (err: any) {
      const message = formatApiError(err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [canView]);

  useEffect(() => {
    if (!importing) {
      importProgressStartedAtRef.current = null;
      setImportProgress(0);
      return;
    }

    importProgressStartedAtRef.current = Date.now();
    setImportProgress((current) => (current > 0 && current < 95 ? current : 8));

    const estimatedMs = Math.max(8000, Math.min(90000, Math.max(1, importEstimatedBooks) * 900));
    const intervalId = window.setInterval(() => {
      const startedAt = importProgressStartedAtRef.current ?? Date.now();
      const elapsedMs = Date.now() - startedAt;
      const progressByTime = Math.min(95, Math.floor((elapsedMs / estimatedMs) * 100));
      const nextProgress = Math.max(8, progressByTime);
      setImportProgress((current) => (nextProgress > current ? nextProgress : current));
    }, 300);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [importing, importEstimatedBooks]);

  const filteredBudgets = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return budgets;
    return budgets.filter(
      (budget) =>
        budget.nome.toLowerCase().includes(term) ||
        budget.observacao?.toLowerCase().includes(term) ||
        budget.projeto?.nome?.toLowerCase().includes(term) ||
        budget.fornecedor?.nomeFantasia?.toLowerCase().includes(term) ||
        budget.fornecedor?.razaoSocial?.toLowerCase().includes(term),
    );
  }, [budgets, search]);

  function updateItem(index: number, field: keyof CuradoriaItemForm, value: string | number | undefined) {
    setCreateForm((prev) => ({
      ...prev,
      itens: prev.itens.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }));
  }

  function addItem() {
    setCreateForm((prev) => ({ ...prev, itens: [...prev.itens, createEmptyItem()] }));
  }

  function normalizeHeader(header: string): string {
    return String(header ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '');
  }

  function parseNumber(raw: unknown): number {
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
    if (typeof raw !== 'string') return 0;
    const value = raw.trim();
    if (!value) return 0;
    const normalized = value
      .replace(/\s+/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async function estimateImportMetrics(file: File): Promise<{ totalBruto: number; totalLivros: number }> {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) return { totalBruto: 0, totalLivros: 0 };

      const sheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
        raw: false,
      });

      let total = 0;
      let validRows = 0;
      rows.forEach((row) => {
        const normalizedRow = Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
          acc[normalizeHeader(key)] = value;
          return acc;
        }, {});

        const nome = String(normalizedRow.nome ?? '').trim();
        const isbn = String(normalizedRow.isbn ?? '').trim();
        const valor = parseNumber(normalizedRow.valor);
        const quantidade = Math.max(1, Math.floor(parseNumber(normalizedRow.quantidade)));
        if (!nome || !isbn || valor < 0) return;
        validRows += 1;
        total += valor * quantidade;
      });

      return { totalBruto: Number(total.toFixed(2)), totalLivros: validRows };
    } catch {
      return { totalBruto: 0, totalLivros: 0 };
    }
  }

  async function handleImportFileChange(file: File | null) {
    setImportFile(file);
    if (!file) {
      setImportEstimatedTotalBruto(0);
      setImportEstimatedBooks(0);
      return;
    }
    const estimated = await estimateImportMetrics(file);
    setImportEstimatedTotalBruto(estimated.totalBruto);
    setImportEstimatedBooks(estimated.totalLivros);
  }

  function getDataUrlFileName(dataUrl?: string | null): string {
    if (!dataUrl) return 'arquivo';
    const match = dataUrl.match(/name=([^;]+)/i);
    if (match?.[1]) return decodeURIComponent(match[1]);
    return 'arquivo';
  }

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const base64Part = reader.result.split(',')[1] ?? '';
          resolve(`data:${file.type || 'application/octet-stream'};name=${encodeURIComponent(file.name)};base64,${base64Part}`);
          return;
        }
        reject(new Error('Falha ao converter arquivo.'));
      };
      reader.onerror = () => reject(new Error('Falha ao converter arquivo.'));
      reader.readAsDataURL(file);
    });
  }

  function removeItem(index: number) {
    setCreateForm((prev) => {
      if (prev.itens.length <= 1) return prev;
      return { ...prev, itens: prev.itens.filter((_, itemIndex) => itemIndex !== index) };
    });
  }

  async function fetchIsbn(index: number) {
    const isbnRaw = createForm.itens[index]?.isbn ?? '';
    const isbn = isbnRaw.toUpperCase().replace(/[^0-9X]/g, '');
    if (!(isbn.length === 10 || isbn.length === 13)) return;

    try {
      setIsbnLoadingByIndex((prev) => ({ ...prev, [index]: true }));
      const { data } = await api.get<IsbnBookData>(`/curadoria/books/isbn/${isbn}`);

      setCreateForm((prev) => {
        const next = [...prev.itens];
        const item = next[index];
        if (!item) return prev;
        const matchingCategory = categories.find((category) =>
          data.categorias.some(
            (bookCategory) =>
              bookCategory.toLowerCase().includes(category.nome.toLowerCase()) ||
              category.nome.toLowerCase().includes(bookCategory.toLowerCase()),
          ),
        );
        next[index] = {
          ...item,
          isbn: data.isbn || item.isbn,
          nome: data.titulo || item.nome,
          autor: data.autores?.join(', ') || item.autor,
          editora: data.editora || item.editora,
          anoPublicacao: data.anoPublicacao || item.anoPublicacao,
          categoriaId: item.categoriaId || matchingCategory?.id,
        };
        return { ...prev, itens: next };
      });
      toast.success('Dados do ISBN carregados.');
    } catch (err: any) {
      toast.error(formatApiError(err));
    } finally {
      setIsbnLoadingByIndex((prev) => ({ ...prev, [index]: false }));
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!canEdit) {
      toast.error('Seu perfil não pode criar orçamentos de curadoria.');
      return;
    }

    if (!createForm.nome.trim()) {
      toast.error('Informe o nome do orçamento.');
      return;
    }

    const invalidItem = createForm.itens.some(
      (item) =>
        !item.isbn.trim() ||
        !item.categoriaId ||
        item.quantidade == null ||
        Number(item.quantidade) <= 0 ||
        item.valor == null ||
        Number(item.valor) < 0 ||
        (createForm.descontoAplicadoEm === 'ITEM' && Number(item.desconto ?? 0) < 0),
    );
    if (invalidItem) {
      toast.error('Preencha os itens com ISBN, categoria, quantidade, valor e desconto válido.');
      return;
    }

    try {
      const totalBrutoEstimado = createForm.itens.reduce(
        (acc, item) => acc + Number(item.valor || 0) * Number(item.quantidade || 1),
        0,
      );
      const descontoTotalCalculado =
        createForm.descontoAplicadoEm === 'TOTAL'
          ? createDiscountTotalType === 'PERCENTUAL'
            ? (totalBrutoEstimado * Number(createForm.descontoTotal || 0)) / 100
            : Number(createForm.descontoTotal || 0)
          : 0;

      setCreating(true);
      await api.post('/curadoria/orcamentos', {
        nome: createForm.nome.trim(),
        projetoId: createForm.projetoId || undefined,
        fornecedorId: createForm.fornecedorId || undefined,
        nfUrl: createForm.nfUrl.trim() || undefined,
        formaPagamento: createForm.formaPagamento.trim() || undefined,
        status: createForm.status,
        arquivoOrcamentoUrl: createForm.arquivoOrcamentoUrl.trim() || undefined,
        comprovantePagamentoUrl: createForm.comprovantePagamentoUrl.trim() || undefined,
        observacao: createForm.observacao.trim() || undefined,
        descontoAplicadoEm: createForm.descontoAplicadoEm,
        descontoTotal: createForm.descontoAplicadoEm === 'TOTAL' ? Number(descontoTotalCalculado.toFixed(2)) : undefined,
        itens: createForm.itens.map((item) => ({
          nome: item.nome.trim(),
          isbn: item.isbn.trim(),
          categoriaId: Number(item.categoriaId),
          quantidade: Number(item.quantidade || 1),
          valor: Number(item.valor || 0),
          desconto: Number(item.desconto || 0),
          autor: item.autor?.trim() || undefined,
          editora: item.editora?.trim() || undefined,
          anoPublicacao: item.anoPublicacao?.trim() || undefined,
        })),
      });
      toast.success('Orçamento criado com sucesso.');
      setShowCreateModal(false);
      setCreateForm({
        nome: '',
        projetoId: undefined,
        fornecedorId: undefined,
        nfUrl: '',
        formaPagamento: '',
        status: 'PENDENTE',
        arquivoOrcamentoUrl: '',
        comprovantePagamentoUrl: '',
        observacao: '',
        descontoAplicadoEm: 'ITEM',
        descontoTotal: 0,
        itens: [createEmptyItem()],
      });
      setCreateDiscountTotalType('VALOR');
      await loadData();
    } catch (err: any) {
      toast.error(formatApiError(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleImportXlsx(event: FormEvent) {
    event.preventDefault();
    if (!canEdit) {
      toast.error('Seu perfil não pode importar orçamentos.');
      return;
    }
    if (!importFile) {
      toast.error('Selecione um arquivo XLSX.');
      return;
    }
    try {
      const descontoTotalCalculado =
        importDiscountMode === 'TOTAL'
          ? importDiscountTotalType === 'PERCENTUAL'
            ? (importEstimatedTotalBruto * Number(importDiscountTotal || 0)) / 100
            : Number(importDiscountTotal || 0)
          : 0;

      setImporting(true);
      const formData = new FormData();
      formData.append('file', importFile);
      if (importName.trim()) formData.append('nome', importName.trim());
      if (importProjectId) formData.append('projetoId', String(importProjectId));
      if (importCategoryId) formData.append('categoriaId', String(importCategoryId));
      formData.append('overwriteCurrent', String(overwriteCurrent));
      formData.append('descontoAplicadoEm', importDiscountMode);
      if (importDiscountMode === 'TOTAL') {
        formData.append('descontoTotal', String(Number(descontoTotalCalculado.toFixed(2)) || 0));
      }

      const { data } = await api.post<CuradoriaImportResult>('/curadoria/orcamentos/import-xlsx', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportProgress(100);
      toast.success('Orçamento importado com sucesso.');
      if (Array.isArray(data?.missingTitleIsbns) && data.missingTitleIsbns.length > 0) {
        const warningLines = [
          'ATENCAO: Os ISBNs abaixo nao retornaram titulo automaticamente durante a importacao.',
          'Revise esses itens e complete o titulo manualmente, se necessario.',
          '',
          ...data.missingTitleIsbns.map((isbn, index) => `${index + 1}. ${isbn}`),
        ];
        const reportBlob = new Blob([warningLines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const reportUrl = URL.createObjectURL(reportBlob);
        const link = document.createElement('a');
        link.href = reportUrl;
        link.download = `aviso-isbns-sem-titulo-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(reportUrl);
        toast.error(
          `Alguns ISBNs nao retornaram titulo (${data.missingTitleIsbns.length}). Baixamos um arquivo de aviso para revisao.`,
        );
      }
      setShowImportModal(false);
      setImportFile(null);
      setImportName('');
      setImportProjectId(undefined);
      setImportCategoryId(undefined);
      setOverwriteCurrent(true);
      setImportDiscountMode('ITEM');
      setImportDiscountTotal(0);
      setImportDiscountTotalType('VALOR');
      setImportEstimatedTotalBruto(0);
      setImportEstimatedBooks(0);
      await loadData();
    } catch (err: any) {
      toast.error(formatApiError(err));
    } finally {
      setImporting(false);
    }
  }

  function openEditBudgetModal(budget: CuradoriaBudget) {
    setEditingBudgetId(budget.id);
    setEditingBudgetTotalBruto(Number(budget.totalBruto || 0));
    setEditForm({
      nome: budget.nome ?? '',
      projetoId: budget.projeto?.id ?? undefined,
      fornecedorId: budget.fornecedor?.id ?? undefined,
      nfUrl: budget.nfUrl ?? '',
      formaPagamento: budget.formaPagamento ?? '',
      status: budget.status ?? 'PENDENTE',
      arquivoOrcamentoUrl: budget.arquivoOrcamentoUrl ?? '',
      comprovantePagamentoUrl: budget.comprovantePagamentoUrl ?? '',
      observacao: budget.observacao ?? '',
      descontoAplicadoEm: budget.descontoAplicadoEm ?? 'ITEM',
      descontoTotal: Number(budget.descontoTotal ?? 0),
    });
    setEditDiscountTotalType('VALOR');
    setShowEditModal(true);
  }

  async function handleEditBudget(event: FormEvent) {
    event.preventDefault();
    if (!editingBudgetId) return;
    if (!editForm.nome.trim()) {
      toast.error('Informe o nome do orçamento.');
      return;
    }
    if (editForm.descontoAplicadoEm === 'TOTAL' && editForm.descontoTotal < 0) {
      toast.error('Desconto total inválido.');
      return;
    }

    try {
      const descontoTotalCalculado =
        editForm.descontoAplicadoEm === 'TOTAL'
          ? editDiscountTotalType === 'PERCENTUAL'
            ? (editingBudgetTotalBruto * Number(editForm.descontoTotal || 0)) / 100
            : Number(editForm.descontoTotal || 0)
          : 0;
      setEditingBudgetSaving(true);
      await api.patch(`/curadoria/orcamentos/${editingBudgetId}`, {
        nome: editForm.nome.trim(),
        projetoId: editForm.projetoId || undefined,
        fornecedorId: editForm.fornecedorId || undefined,
        nfUrl: editForm.nfUrl.trim() || undefined,
        formaPagamento: editForm.formaPagamento.trim() || undefined,
        status: editForm.status,
        arquivoOrcamentoUrl: editForm.arquivoOrcamentoUrl.trim() || undefined,
        comprovantePagamentoUrl: editForm.comprovantePagamentoUrl.trim() || undefined,
        observacao: editForm.observacao.trim() || undefined,
        descontoAplicadoEm: editForm.descontoAplicadoEm,
        descontoTotal:
          editForm.descontoAplicadoEm === 'TOTAL'
            ? Number(descontoTotalCalculado.toFixed(2))
            : 0,
      });
      toast.success('Orçamento atualizado com sucesso.');
      setShowEditModal(false);
      setEditingBudgetId(null);
      await loadData();
    } catch (err: any) {
      toast.error(formatApiError(err));
    } finally {
      setEditingBudgetSaving(false);
    }
  }

  async function handleDeleteBudget(budget: CuradoriaBudget) {
    if (!canEdit) {
      toast.error('Seu perfil não pode excluir orçamentos.');
      return;
    }
    setBudgetToDelete(budget);
    setDeleteConfirmName('');
    setDeleteError(null);
    setShowDeleteModal(true);
  }

  async function handleConfirmDeleteBudget() {
    if (!budgetToDelete) return;
    if (deleteConfirmName.trim() !== budgetToDelete.nome.trim()) {
      setDeleteError('O nome digitado não confere com o orçamento selecionado.');
      return;
    }

    try {
      setDeletingBudgetId(budgetToDelete.id);
      setDeleteError(null);
      await api.delete(`/curadoria/orcamentos/${budgetToDelete.id}`);
      toast.success('Orçamento excluído com sucesso.');
      setShowDeleteModal(false);
      setBudgetToDelete(null);
      setDeleteConfirmName('');
      await loadData();
    } catch (err: any) {
      const message = formatApiError(err);
      setDeleteError(message);
      toast.error(message);
    } finally {
      setDeletingBudgetId(null);
    }
  }

  const columns: DataTableColumn<CuradoriaBudget>[] = [
    { key: 'nome', label: 'Orçamento', render: (budget) => <span className="font-medium">{budget.nome}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (budget) => <span className="text-xs text-white/80">{(budget.status ?? 'PENDENTE').replaceAll('_', ' ')}</span>,
    },
    {
      key: 'projeto',
      label: 'Projeto',
      render: (budget) => <span>{budget.projeto?.nome ?? 'Sem projeto'}</span>,
    },
    {
      key: 'fornecedor',
      label: 'Fornecedor',
      render: (budget) => <span>{budget.fornecedor?.nomeFantasia ?? budget.fornecedor?.razaoSocial ?? '-'}</span>,
    },
    { key: 'itens', label: 'Itens', align: 'right', render: (budget) => <span>{budget.totalItens}</span> },
    {
      key: 'total',
      label: 'Total líquido',
      align: 'right',
      render: (budget) => <span className="text-emerald-300">R$ {budget.totalLiquido.toFixed(2)}</span>,
    },
    {
      key: 'criado',
      label: 'Criado em',
      render: (budget) => (
        <span className="text-xs text-white/70">{new Date(budget.dataCriacao).toLocaleDateString('pt-BR')}</span>
      ),
    },
    {
      key: 'acoes',
      label: 'Ações',
      align: 'right',
      stopRowClick: true,
      render: (budget) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => openEditBudgetModal(budget)}
            className={btn.editSm}
            disabled={!canEdit}
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => void handleDeleteBudget(budget)}
            className={btn.dangerSm}
            disabled={!canEdit}
          >
            Excluir
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Curadoria de Livros</h2>
          <p className="text-sm text-white/60">Orçamentos de livros, separados do módulo de Compras.</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button type="button" className={btn.secondary} onClick={() => setShowImportModal(true)}>
              Importar XLSX
            </button>
            <button type="button" className={btn.primary} onClick={() => setShowCreateModal(true)}>
              Novo orçamento
            </button>
          </div>
        )}
      </div>

      <input
        type="text"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar orçamento por nome, observação ou projeto..."
        className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
      />

      {error && <div className="bg-danger/15 border border-danger/40 text-danger px-4 py-3 rounded-md">{error}</div>}

      <DataTable<CuradoriaBudget>
        data={filteredBudgets}
        columns={columns}
        keyExtractor={(budget) => budget.id}
        loading={loading}
        emptyMessage="Nenhum orçamento de curadoria encontrado."
        onRowClick={(budget) => navigate(`/curadoria/${budget.id}`)}
        renderMobileCard={(budget) => (
          <div className="bg-neutral/60 border border-white/10 rounded-xl p-4 space-y-2">
            <p className="font-semibold">{budget.nome}</p>
            <p className="text-xs text-white/70">Status: {(budget.status ?? 'PENDENTE').replaceAll('_', ' ')}</p>
            <p className="text-xs text-white/60">Projeto: {budget.projeto?.nome ?? 'Sem projeto'}</p>
            <p className="text-xs text-white/60">
              Fornecedor: {budget.fornecedor?.nomeFantasia ?? budget.fornecedor?.razaoSocial ?? 'Não informado'}
            </p>
            <p className="text-xs text-white/60">
              Itens: {budget.totalItens} | Líquido: R$ {budget.totalLiquido.toFixed(2)}
            </p>
            {budget.arquivoOrcamentoUrl && (
              <a
                href={budget.arquivoOrcamentoUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="text-xs text-primary hover:underline inline-block"
              >
                Arquivo original: {getDataUrlFileName(budget.arquivoOrcamentoUrl)}
              </a>
            )}
            <div className="flex items-center gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                className={btn.primarySoft}
                onClick={(event) => {
                  event.stopPropagation();
                  navigate(`/curadoria/${budget.id}`);
                }}
              >
                Detalhes
              </button>
              <button
                type="button"
                className={btn.editSm}
                disabled={!canEdit}
                onClick={(event) => {
                  event.stopPropagation();
                  openEditBudgetModal(budget);
                }}
              >
                Editar
              </button>
              <button
                type="button"
                className={btn.dangerSm}
                disabled={!canEdit}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleDeleteBudget(budget);
                }}
              >
                Excluir
              </button>
            </div>
          </div>
        )}
      />

      {showDeleteModal && budgetToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-md w-full">
            <div className="px-8 py-6 border-b border-white/20">
              <h2 className="text-2xl font-bold text-white">Confirmar Exclusão</h2>
            </div>
            <div className="p-8">
              <p className="text-white/90 mb-2">Tem certeza que deseja remover o orçamento:</p>
              <p className="text-xl font-semibold text-white mb-6">"{budgetToDelete.nome}"</p>
              <p className="text-sm text-white/70 mb-4">
                Esta ação não pode ser desfeita. Para confirmar, digite o nome do orçamento:
              </p>
              <div className="mb-6">
                <input
                  type="text"
                  value={deleteConfirmName}
                  onChange={(event) => setDeleteConfirmName(event.target.value)}
                  placeholder="Digite o nome do orçamento"
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  autoFocus
                />
              </div>
              {deleteError && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-md mb-4 text-sm">
                  {deleteError}
                </div>
              )}
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setBudgetToDelete(null);
                    setDeleteConfirmName('');
                    setDeleteError(null);
                  }}
                  className={btn.secondaryLg}
                  disabled={deletingBudgetId === budgetToDelete.id}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmDeleteBudget()}
                  className={btn.dangerLg}
                  disabled={
                    deletingBudgetId === budgetToDelete.id ||
                    deleteConfirmName.trim() !== budgetToDelete.nome.trim()
                  }
                >
                  {deletingBudgetId === budgetToDelete.id ? 'Removendo...' : 'Confirmar Remoção'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-neutral border border-white/10 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Editar orçamento de curadoria</h3>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingBudgetId(null);
                }}
                className="text-white/50 hover:text-white"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditBudget} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Nome do orçamento</label>
                  <input
                    type="text"
                    value={editForm.nome}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, nome: event.target.value }))}
                    className={fieldClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Projeto</label>
                  <select
                    value={editForm.projetoId ?? ''}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        projetoId: event.target.value ? Number(event.target.value) : undefined,
                      }))
                    }
                    className={fieldClass}
                  >
                    <option value="">Sem projeto</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Fornecedor</label>
                  <select
                    value={editForm.fornecedorId ?? ''}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        fornecedorId: event.target.value ? Number(event.target.value) : undefined,
                      }))
                    }
                    className={fieldClass}
                  >
                    <option value="">Fornecedor (opcional)</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.nomeFantasia || supplier.razaoSocial}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select
                    value={editForm.status}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        status: event.target.value as CuradoriaEditForm['status'],
                      }))
                    }
                    className={fieldClass}
                  >
                    {CURADORIA_STATUS_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="bg-neutral text-white"
                      style={{ color: '#111827', backgroundColor: '#f3f4f6' }}
                    >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Forma de pagamento</label>
                <input
                  type="text"
                  value={editForm.formaPagamento}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, formaPagamento: event.target.value }))}
                  placeholder="Pix, Boleto, Cartão..."
                  className={fieldClass}
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className={labelClass}>Nota Fiscal (NF)</label>
                  <FileDropInput
                    onFilesSelected={(files) => {
                      const file = files[0];
                      if (!file) return;
                      void fileToDataUrl(file)
                        .then((value) => setEditForm((prev) => ({ ...prev, nfUrl: value })))
                        .catch(() => toast.error('Não foi possível ler o arquivo da NF.'));
                    }}
                    className={fileFieldClass}
                    dropMessage="Solte o arquivo NF aqui"
                  />
                  {editForm.nfUrl && (
                    <a href={editForm.nfUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                      Abrir NF atual: {getDataUrlFileName(editForm.nfUrl)}
                    </a>
                  )}
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Arquivo do orçamento original</label>
                  <FileDropInput
                    onFilesSelected={(files) => {
                      const file = files[0];
                      if (!file) return;
                      void fileToDataUrl(file)
                        .then((value) => setEditForm((prev) => ({ ...prev, arquivoOrcamentoUrl: value })))
                        .catch(() => toast.error('Não foi possível ler o arquivo do orçamento.'));
                    }}
                    className={fileFieldClass}
                    dropMessage="Solte o orçamento original aqui"
                  />
                  {editForm.arquivoOrcamentoUrl && (
                    <a href={editForm.arquivoOrcamentoUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                      Abrir arquivo atual: {getDataUrlFileName(editForm.arquivoOrcamentoUrl)}
                    </a>
                  )}
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Comprovante de pagamento</label>
                  <FileDropInput
                    accept="image/*"
                    onFilesSelected={(files) => {
                      const file = files[0];
                      if (!file) return;
                      void fileToDataUrl(file)
                        .then((value) => setEditForm((prev) => ({ ...prev, comprovantePagamentoUrl: value })))
                        .catch(() => toast.error('Não foi possível ler a imagem de pagamento.'));
                    }}
                    className={fileFieldClass}
                    dropMessage="Solte o comprovante aqui"
                  />
                  {editForm.comprovantePagamentoUrl && (
                    <a href={editForm.comprovantePagamentoUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                      Abrir comprovante atual
                    </a>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={editForm.descontoAplicadoEm}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      descontoAplicadoEm: event.target.value as 'ITEM' | 'TOTAL',
                    }))
                  }
                  className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="ITEM">Desconto por item</option>
                  <option value="TOTAL">Desconto no total</option>
                </select>
                {editForm.descontoAplicadoEm === 'TOTAL' && (
                  <div className="bg-black/20 border border-primary/30 rounded-md p-3 space-y-2">
                    <p className="text-xs text-white/80 font-medium">Tipo de desconto no total</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <select
                        value={editDiscountTotalType}
                        onChange={(event) => setEditDiscountTotalType(event.target.value as TotalDiscountInputType)}
                        className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="VALOR">Valor (R$)</option>
                        <option value="PERCENTUAL">Porcentagem (%)</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.descontoTotal}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            descontoTotal: Number(event.target.value) || 0,
                          }))
                        }
                        placeholder={editDiscountTotalType === 'VALOR' ? 'Ex.: 250,00' : 'Ex.: 10'}
                        className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <p className="text-[11px] text-white/70">
                      {editDiscountTotalType === 'VALOR'
                        ? 'Desconto fixo em reais para esse orçamento.'
                        : `Aplicar ${Number(editForm.descontoTotal || 0).toFixed(2)}% sobre o total bruto atual de R$ ${Number(editingBudgetTotalBruto || 0).toFixed(2)}.`}
                    </p>
                  </div>
                )}
              </div>

              <textarea
                value={editForm.observacao}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, observacao: event.target.value }))
                }
                placeholder="Observações do orçamento"
                className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 h-20 focus:outline-none focus:ring-2 focus:ring-primary"
              />

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  className={btn.secondaryLg}
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingBudgetId(null);
                  }}
                  disabled={editingBudgetSaving}
                >
                  Cancelar
                </button>
                <button type="submit" className={btn.primaryLg} disabled={editingBudgetSaving}>
                  {editingBudgetSaving ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-neutral border border-white/10 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Novo orçamento de curadoria</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-white/50 hover:text-white">
                ✕
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Nome do orçamento</label>
                  <input
                    type="text"
                    value={createForm.nome}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, nome: event.target.value }))}
                    className={fieldClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Projeto</label>
                  <select
                    value={createForm.projetoId ?? ''}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        projetoId: event.target.value ? Number(event.target.value) : undefined,
                      }))
                    }
                    className={fieldClass}
                  >
                    <option value="">Sem projeto</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Fornecedor</label>
                  <select
                    value={createForm.fornecedorId ?? ''}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        fornecedorId: event.target.value ? Number(event.target.value) : undefined,
                      }))
                    }
                    className={fieldClass}
                  >
                    <option value="">Fornecedor (opcional)</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.nomeFantasia || supplier.razaoSocial}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select
                    value={createForm.status}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        status: event.target.value as CuradoriaCreateForm['status'],
                      }))
                    }
                    className={fieldClass}
                  >
                    {CURADORIA_STATUS_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="bg-neutral text-white"
                      style={{ color: '#111827', backgroundColor: '#f3f4f6' }}
                    >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Forma de pagamento</label>
                <input
                  type="text"
                  value={createForm.formaPagamento}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, formaPagamento: event.target.value }))}
                  placeholder="Pix, Boleto, Cartão..."
                  className={fieldClass}
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className={labelClass}>Nota Fiscal (NF)</label>
                  <FileDropInput
                    onFilesSelected={(files) => {
                      const file = files[0];
                      if (!file) return;
                      void fileToDataUrl(file)
                        .then((value) => setCreateForm((prev) => ({ ...prev, nfUrl: value })))
                        .catch(() => toast.error('Não foi possível ler o arquivo da NF.'));
                    }}
                    className={fileFieldClass}
                    dropMessage="Solte o arquivo NF aqui"
                  />
                  {createForm.nfUrl && (
                    <a href={createForm.nfUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                      NF selecionada: {getDataUrlFileName(createForm.nfUrl)}
                    </a>
                  )}
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Arquivo do orçamento original</label>
                  <FileDropInput
                    onFilesSelected={(files) => {
                      const file = files[0];
                      if (!file) return;
                      void fileToDataUrl(file)
                        .then((value) => setCreateForm((prev) => ({ ...prev, arquivoOrcamentoUrl: value })))
                        .catch(() => toast.error('Não foi possível ler o arquivo do orçamento.'));
                    }}
                    className={fileFieldClass}
                    dropMessage="Solte o orçamento original aqui"
                  />
                  {createForm.arquivoOrcamentoUrl && (
                    <a href={createForm.arquivoOrcamentoUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                      Arquivo selecionado: {getDataUrlFileName(createForm.arquivoOrcamentoUrl)}
                    </a>
                  )}
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Comprovante de pagamento</label>
                  <FileDropInput
                    accept="image/*"
                    onFilesSelected={(files) => {
                      const file = files[0];
                      if (!file) return;
                      void fileToDataUrl(file)
                        .then((value) => setCreateForm((prev) => ({ ...prev, comprovantePagamentoUrl: value })))
                        .catch(() => toast.error('Não foi possível ler a imagem de pagamento.'));
                    }}
                    className={fileFieldClass}
                    dropMessage="Solte o comprovante aqui"
                  />
                  {createForm.comprovantePagamentoUrl && (
                    <a href={createForm.comprovantePagamentoUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                      Abrir comprovante selecionado
                    </a>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={createForm.descontoAplicadoEm}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      descontoAplicadoEm: event.target.value as 'ITEM' | 'TOTAL',
                    }))
                  }
                  className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="ITEM">Desconto por item</option>
                  <option value="TOTAL">Desconto no total</option>
                </select>
                {createForm.descontoAplicadoEm === 'TOTAL' && (
                  <div className="bg-black/20 border border-primary/30 rounded-md p-3 space-y-2">
                    <p className="text-xs text-white/80 font-medium">Como deseja aplicar o desconto total?</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <select
                        value={createDiscountTotalType}
                        onChange={(event) => setCreateDiscountTotalType(event.target.value as TotalDiscountInputType)}
                        className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="VALOR">Valor (R$)</option>
                        <option value="PERCENTUAL">Porcentagem (%)</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={createDiscountTotalType === 'VALOR' ? 'Ex.: 250,00' : 'Ex.: 10'}
                        value={createForm.descontoTotal}
                        onChange={(event) =>
                          setCreateForm((prev) => ({ ...prev, descontoTotal: Number(event.target.value) || 0 }))
                        }
                        className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <p className="text-[11px] text-white/70">
                      {createDiscountTotalType === 'VALOR'
                        ? 'Desconto fixo em reais aplicado ao total do orçamento.'
                        : 'Desconto percentual aplicado sobre o total bruto dos itens.'}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Itens do orçamento</p>
                  <button type="button" className={btn.secondary} onClick={addItem}>
                    Adicionar item
                  </button>
                </div>
                {createForm.itens.map((item, index) => (
                  <div key={`item-${index}`} className="bg-black/20 border border-white/10 rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-white/60">Item {index + 1}</p>
                      <button type="button" className={btn.dangerSm} onClick={() => removeItem(index)} disabled={createForm.itens.length <= 1}>
                        Remover
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Título do livro (opcional)"
                        value={item.nome}
                        onChange={(event) => updateItem(index, 'nome', event.target.value)}
                        className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="ISBN (obrigatório)"
                          value={item.isbn}
                          onChange={(event) => updateItem(index, 'isbn', event.target.value)}
                          onBlur={() => {
                            void fetchIsbn(index);
                          }}
                          className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                          required
                        />
                        <button
                          type="button"
                          className={btn.secondary}
                          onClick={() => {
                            void fetchIsbn(index);
                          }}
                          disabled={isbnLoadingByIndex[index]}
                        >
                          {isbnLoadingByIndex[index] ? '...' : 'Buscar'}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-white/60 mb-1">Categoria</label>
                        <select
                          value={item.categoriaId ?? ''}
                          onChange={(event) => updateItem(index, 'categoriaId', event.target.value ? Number(event.target.value) : undefined)}
                          className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                          required
                        >
                          <option value="">Selecione</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-white/60 mb-1">Valor (R$)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Ex.: 129,90"
                          value={item.valor ?? ''}
                          onChange={(event) =>
                            updateItem(
                              index,
                              'valor',
                              event.target.value === '' ? undefined : Number(event.target.value),
                            )
                          }
                          className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-white/60 mb-1">Quantidade</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="Ex.: 3"
                          value={item.quantidade ?? ''}
                          onChange={(event) =>
                            updateItem(
                              index,
                              'quantidade',
                              event.target.value === '' ? undefined : Number(event.target.value),
                            )
                          }
                          className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-white/60 mb-1">
                          {createForm.descontoAplicadoEm === 'TOTAL'
                            ? 'Desconto por item (desativado)'
                            : 'Desconto (R$)'}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Ex.: 10,00"
                          value={item.desconto ?? ''}
                          onChange={(event) =>
                            updateItem(
                              index,
                              'desconto',
                              event.target.value === '' ? undefined : Number(event.target.value),
                            )
                          }
                          className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                          disabled={createForm.descontoAplicadoEm === 'TOTAL'}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <textarea
                value={createForm.observacao}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, observacao: event.target.value }))}
                placeholder="Observações do orçamento"
                className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 h-20 focus:outline-none focus:ring-2 focus:ring-primary"
              />

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button type="button" className={btn.secondaryLg} onClick={() => setShowCreateModal(false)} disabled={creating}>
                  Cancelar
                </button>
                <button type="submit" className={btn.primaryLg} disabled={creating}>
                  {creating ? 'Salvando...' : 'Salvar orçamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral border border-white/10 rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Importar orçamento (.xlsx)</h3>
              <button type="button" onClick={() => setShowImportModal(false)} className="text-white/50 hover:text-white">
                ✕
              </button>
            </div>
            <form onSubmit={handleImportXlsx} className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 bg-black/20 border border-white/10 rounded-md p-3">
                <p className="text-xs text-white/70">
                  Baixe o modelo para importar orcamentos de livros.
                </p>
                <ExcelDownloadButton
                  buildWorkbook={buildCuradoriaTemplateWorkbook}
                  fileName="modelo-curadoria-livros.xlsx"
                  label="Baixar modelo XLSX"
                  className={btn.secondary}
                />
              </div>
              <input
                type="text"
                value={importName}
                onChange={(event) => setImportName(event.target.value)}
                placeholder="Nome do orçamento (opcional)"
                className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <FileDropInput
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onFilesSelected={(files) => {
                  void handleImportFileChange(files[0] ?? null);
                }}
                className="w-full text-sm text-white/80 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary/80 file:text-white hover:file:bg-primary"
                dropMessage="Solte a planilha XLSX aqui"
              />
              {importFile && (
                <p className="text-xs text-white/70">
                  Arquivo selecionado: <span className="text-white">{importFile.name}</span>
                </p>
              )}
              <div className="bg-black/20 border border-white/10 rounded-md px-3 py-2 text-xs text-white/70">
                Colunas esperadas:{' '}
                <span className="text-white">
                  isbn(obrigatório), nome(opcional), editora(opcional), categoria, quantidade, valor, desconto (R$),
                  desconto_percentual (%)
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={importProjectId ?? ''}
                  onChange={(event) => setImportProjectId(event.target.value ? Number(event.target.value) : undefined)}
                  className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Sem projeto</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.nome}
                    </option>
                  ))}
                </select>
                <select
                  value={importCategoryId ?? ''}
                  onChange={(event) => setImportCategoryId(event.target.value ? Number(event.target.value) : undefined)}
                  className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Categoria padrão (opcional)</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={importDiscountMode}
                  onChange={(event) => setImportDiscountMode(event.target.value as 'ITEM' | 'TOTAL')}
                  className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="ITEM">Desconto por item</option>
                  <option value="TOTAL">Desconto no total</option>
                </select>
                {importDiscountMode === 'TOTAL' && (
                  <div className="bg-black/20 border border-primary/30 rounded-md p-3 space-y-2">
                    <p className="text-xs text-white/80 font-medium">Tipo de desconto no total</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <select
                        value={importDiscountTotalType}
                        onChange={(event) => setImportDiscountTotalType(event.target.value as TotalDiscountInputType)}
                        className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="VALOR">Valor (R$)</option>
                        <option value="PERCENTUAL">Porcentagem (%)</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={importDiscountTotal}
                        onChange={(event) => setImportDiscountTotal(Number(event.target.value) || 0)}
                        placeholder={importDiscountTotalType === 'VALOR' ? 'Ex.: 250,00' : 'Ex.: 10'}
                        className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <p className="text-[11px] text-white/70">
                      {importDiscountTotalType === 'VALOR'
                        ? 'Aplicar desconto fixo em reais ao total importado.'
                        : `Aplicar ${Number(importDiscountTotal || 0).toFixed(2)}% sobre total bruto estimado de R$ ${importEstimatedTotalBruto.toFixed(2)}.`}
                    </p>
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={overwriteCurrent}
                  onChange={(event) => setOverwriteCurrent(event.target.checked)}
                  className="rounded border-white/20 bg-neutral/80"
                />
                Sobrescrever orçamentos atuais do projeto selecionado
              </label>

              {importing && (
                <div className="rounded-md border border-amber-400/40 bg-amber-500/10 p-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-amber-300" />
                    <p className="text-sm font-medium text-amber-200">Importando planilha e consultando ISBNs...</p>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-amber-900/40">
                    <div
                      className="h-full rounded-full bg-amber-300 transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-amber-100/80">Progresso estimado: {importProgress}%</p>
                  <p className="mt-1 text-xs text-amber-100/90">
                    Esse processo pode demorar porque o sistema busca dados de cada livro por ISBN para preencher informações
                    automaticamente.
                    {importEstimatedBooks > 0 ? ` Livros identificados na planilha: ${importEstimatedBooks}.` : ''}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button type="button" className={btn.secondaryLg} onClick={() => setShowImportModal(false)} disabled={importing}>
                  Cancelar
                </button>
                <button type="submit" className={btn.primaryLg} disabled={importing}>
                  {importing ? 'Importando...' : 'Importar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

