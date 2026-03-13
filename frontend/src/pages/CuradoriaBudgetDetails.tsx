import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { btn } from '../utils/buttonStyles';
import { DataTable, DataTableColumn } from '../components/DataTable';
import { formatApiError, toast } from '../utils/toast';
import { Category, Projeto, Supplier } from '../types/stock';
import { FileDropInput } from '../components/FileDropInput';

interface CuradoriaItem {
  id: number;
  nome: string;
  isbn: string;
  quantidade: number;
  valor: number;
  desconto: number;
  valorLiquido: number;
  autor?: string | null;
  editora?: string | null;
  anoPublicacao?: string | null;
  categoria?: { id: number; nome: string } | null;
}

interface CuradoriaOrcamentoDetails {
  id: number;
  nome: string;
  projetoId?: number | null;
  fornecedorId?: number | null;
  fornecedor?: { id: number; nomeFantasia: string; razaoSocial: string; cnpj: string } | null;
  nfUrl?: string | null;
  formaPagamento?: string | null;
  arquivoOrcamentoUrl?: string | null;
  comprovantePagamentoUrl?: string | null;
  status?: 'PENDENTE' | 'COMPRADO_ACAMINHO' | 'ENTREGUE' | 'SOLICITADO' | 'REPROVADO';
  observacao?: string | null;
  projeto?: { id: number; nome: string } | null;
  descontoAplicadoEm: 'ITEM' | 'TOTAL';
  descontoTotal: number;
  totalBruto: number;
  totalDesconto: number;
  totalLiquido: number;
  itens: CuradoriaItem[];
  dataCriacao: string;
}

interface CuradoriaEditBudgetForm {
  nome: string;
  projetoId?: number;
  fornecedorId?: number;
  nfUrl: string;
  formaPagamento: string;
  arquivoOrcamentoUrl: string;
  comprovantePagamentoUrl: string;
  status: 'PENDENTE' | 'COMPRADO_ACAMINHO' | 'ENTREGUE' | 'SOLICITADO' | 'REPROVADO';
  observacao: string;
  descontoAplicadoEm: 'ITEM' | 'TOTAL';
  descontoTotal: number;
}

interface CuradoriaEditItemForm {
  nome: string;
  isbn: string;
  categoriaId?: number;
  quantidade: number;
  valor: number;
  desconto: number;
  autor: string;
  editora: string;
  anoPublicacao: string;
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

export default function CuradoriaBudgetDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orcamento, setOrcamento] = useState<CuradoriaOrcamentoDetails | null>(null);
  const [projects, setProjects] = useState<Projeto[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showEditBudgetModal, setShowEditBudgetModal] = useState(false);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [savingEditBudget, setSavingEditBudget] = useState(false);
  const [savingEditItem, setSavingEditItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [editBudgetDiscountType, setEditBudgetDiscountType] = useState<TotalDiscountInputType>('VALOR');
  const [editBudgetForm, setEditBudgetForm] = useState<CuradoriaEditBudgetForm>({
    nome: '',
    projetoId: undefined,
    fornecedorId: undefined,
    nfUrl: '',
    formaPagamento: '',
    arquivoOrcamentoUrl: '',
    comprovantePagamentoUrl: '',
    status: 'PENDENTE',
    observacao: '',
    descontoAplicadoEm: 'ITEM',
    descontoTotal: 0,
  });
  const [editItemForm, setEditItemForm] = useState<CuradoriaEditItemForm>({
    nome: '',
    isbn: '',
    categoriaId: undefined,
    quantidade: 1,
    valor: 0,
    desconto: 0,
    autor: '',
    editora: '',
    anoPublicacao: '',
  });
  const fieldClass =
    'w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary';
  const fileFieldClass =
    'w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30';
  const labelClass = 'block text-sm font-medium text-white/90 mb-2';

  function normalizeTextSpacing(value: string): string {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .replace(/\s*([,;:.!?])\s*/g, '$1 ')
      .replace(/\s*-\s*/g, ' - ')
      .trim();
  }

  function normalizeIsbn(value: string): string {
    return String(value ?? '')
      .toUpperCase()
      .replace(/[^0-9X]/g, '');
  }

  async function loadBudget(budgetId: string) {
    const { data } = await api.get<CuradoriaOrcamentoDetails>(`/curadoria/orcamentos/${budgetId}`);
    setOrcamento(data);
    return data;
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
        if (typeof reader.result !== 'string') {
          reject(new Error('Falha ao ler arquivo.'));
          return;
        }
        const base64Part = reader.result.split(',')[1] ?? '';
        resolve(`data:${file.type || 'application/octet-stream'};name=${encodeURIComponent(file.name)};base64,${base64Part}`);
      };
      reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
      reader.readAsDataURL(file);
    });
  }

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const [budgetData, projectsRes, categoriesRes, suppliersRes] = await Promise.all([
          loadBudget(id),
          api.get<Projeto[]>('/projects/options'),
          api.get<Category[]>('/categories/all?tipo=LIVRO').catch(() => ({ data: [] as Category[] })),
          api.get<Supplier[]>('/suppliers').catch(() => ({ data: [] as Supplier[] })),
        ]);
        setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : []);
        setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
        setSuppliers(Array.isArray(suppliersRes.data) ? suppliersRes.data : []);
        setEditBudgetForm({
          nome: budgetData.nome ?? '',
          projetoId: budgetData.projeto?.id ?? undefined,
          fornecedorId: budgetData.fornecedor?.id ?? undefined,
          nfUrl: budgetData.nfUrl ?? '',
          formaPagamento: budgetData.formaPagamento ?? '',
          arquivoOrcamentoUrl: budgetData.arquivoOrcamentoUrl ?? '',
          comprovantePagamentoUrl: budgetData.comprovantePagamentoUrl ?? '',
          status: budgetData.status ?? 'PENDENTE',
          observacao: budgetData.observacao ?? '',
          descontoAplicadoEm: budgetData.descontoAplicadoEm ?? 'ITEM',
          descontoTotal: Number(budgetData.descontoTotal ?? 0),
        });
      } catch (err: any) {
        const message = formatApiError(err);
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const columns = useMemo<DataTableColumn<CuradoriaItem>[]>(
    () => [
      { key: 'nome', label: 'Livro', render: (item) => <span className="font-medium">{item.nome}</span> },
      { key: 'isbn', label: 'ISBN', render: (item) => <span className="font-mono text-xs">{item.isbn}</span> },
      {
        key: 'categoria',
        label: 'Categoria',
        render: (item) => <span>{item.categoria?.nome ?? 'Sem categoria'}</span>,
      },
      { key: 'qtd', label: 'Qtd', align: 'right', render: (item) => <span>{item.quantidade}</span> },
      { key: 'valor', label: 'Valor', align: 'right', render: (item) => <span>R$ {item.valor.toFixed(2)}</span> },
      {
        key: 'desconto',
        label: 'Desconto',
        align: 'right',
        render: (item) => <span>R$ {item.desconto.toFixed(2)}</span>,
      },
      {
        key: 'liquido',
        label: 'Líquido',
        align: 'right',
        render: (item) => <span className="text-emerald-300">R$ {item.valorLiquido.toFixed(2)}</span>,
      },
      {
        key: 'acoes',
        label: 'Ações',
        align: 'right',
        stopRowClick: true,
        render: (item) => (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className={btn.editSm}
              onClick={() => {
                setIsCreatingItem(false);
                setEditingItemId(item.id);
                setEditItemForm({
                  nome: normalizeTextSpacing(item.nome),
                  isbn: normalizeIsbn(item.isbn),
                  categoriaId: item.categoria?.id,
                  quantidade: item.quantidade,
                  valor: item.valor,
                  desconto: item.desconto,
                  autor: normalizeTextSpacing(item.autor ?? ''),
                  editora: normalizeTextSpacing(item.editora ?? ''),
                  anoPublicacao: item.anoPublicacao ?? '',
                });
                setShowEditItemModal(true);
              }}
            >
              Editar
            </button>
            <button
              type="button"
              className={btn.dangerSm}
              onClick={async () => {
                if (!orcamento) return;
                const confirmed = window.confirm(
                  `Remover o item "${item.nome}" deste orçamento?`,
                );
                if (!confirmed) return;
                try {
                  await api.delete(`/curadoria/orcamentos/${orcamento.id}/itens/${item.id}`);
                  await loadBudget(String(orcamento.id));
                  toast.success('Item removido com sucesso.');
                } catch (err: any) {
                  toast.error(formatApiError(err));
                }
              }}
            >
              Remover
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  async function handleEditBudget(event: FormEvent) {
    event.preventDefault();
    if (!orcamento || !id) return;
    if (!editBudgetForm.nome.trim()) {
      toast.error('Informe o nome do orçamento.');
      return;
    }

    try {
      const descontoTotalCalculado =
        editBudgetForm.descontoAplicadoEm === 'TOTAL'
          ? editBudgetDiscountType === 'PERCENTUAL'
            ? (Number(orcamento.totalBruto || 0) * Number(editBudgetForm.descontoTotal || 0)) / 100
            : Number(editBudgetForm.descontoTotal || 0)
          : 0;
      setSavingEditBudget(true);
      await api.patch(`/curadoria/orcamentos/${orcamento.id}`, {
        nome: editBudgetForm.nome.trim(),
        projetoId: editBudgetForm.projetoId || undefined,
        fornecedorId: editBudgetForm.fornecedorId || undefined,
        nfUrl: editBudgetForm.nfUrl.trim() || undefined,
        formaPagamento: editBudgetForm.formaPagamento.trim() || undefined,
        arquivoOrcamentoUrl: editBudgetForm.arquivoOrcamentoUrl.trim() || undefined,
        comprovantePagamentoUrl: editBudgetForm.comprovantePagamentoUrl.trim() || undefined,
        status: editBudgetForm.status,
        observacao: editBudgetForm.observacao.trim() || undefined,
        descontoAplicadoEm: editBudgetForm.descontoAplicadoEm,
        descontoTotal:
          editBudgetForm.descontoAplicadoEm === 'TOTAL'
            ? Number(descontoTotalCalculado.toFixed(2))
            : 0,
      });
      const updated = await loadBudget(id);
      setEditBudgetForm({
        nome: updated.nome ?? '',
        projetoId: updated.projeto?.id ?? undefined,
        fornecedorId: updated.fornecedor?.id ?? undefined,
        nfUrl: updated.nfUrl ?? '',
        formaPagamento: updated.formaPagamento ?? '',
        arquivoOrcamentoUrl: updated.arquivoOrcamentoUrl ?? '',
        comprovantePagamentoUrl: updated.comprovantePagamentoUrl ?? '',
        status: updated.status ?? 'PENDENTE',
        observacao: updated.observacao ?? '',
        descontoAplicadoEm: updated.descontoAplicadoEm ?? 'ITEM',
        descontoTotal: Number(updated.descontoTotal ?? 0),
      });
      setShowEditBudgetModal(false);
      toast.success('Orçamento atualizado com sucesso.');
    } catch (err: any) {
      toast.error(formatApiError(err));
    } finally {
      setSavingEditBudget(false);
    }
  }

  async function handleEditItem(event: FormEvent) {
    event.preventDefault();
    if (!orcamento || !id) return;

    if (!editItemForm.isbn.trim()) {
      toast.error('Informe o ISBN do item.');
      return;
    }
    if (!editItemForm.categoriaId) {
      toast.error('Selecione a categoria.');
      return;
    }
    if (Number(editItemForm.quantidade) <= 0 || Number(editItemForm.valor) < 0 || Number(editItemForm.desconto) < 0) {
      toast.error('Quantidade, valor e desconto devem ser válidos.');
      return;
    }

    try {
      setSavingEditItem(true);
      const payload = {
        nome: normalizeTextSpacing(editItemForm.nome),
        isbn: normalizeIsbn(editItemForm.isbn),
        categoriaId: Number(editItemForm.categoriaId),
        quantidade: Number(editItemForm.quantidade),
        valor: Number(editItemForm.valor),
        desconto: Number(editItemForm.desconto),
        autor: normalizeTextSpacing(editItemForm.autor) || undefined,
        editora: normalizeTextSpacing(editItemForm.editora) || undefined,
        anoPublicacao: editItemForm.anoPublicacao.trim() || undefined,
      };

      if (isCreatingItem) {
        await api.post(`/curadoria/orcamentos/${orcamento.id}/itens`, payload);
      } else if (editingItemId) {
        await api.patch(`/curadoria/orcamentos/${orcamento.id}/itens/${editingItemId}`, payload);
      } else {
        throw new Error('Item inválido para edição.');
      }
      await loadBudget(id);
      setShowEditItemModal(false);
      setEditingItemId(null);
      setIsCreatingItem(false);
      toast.success(isCreatingItem ? 'Item adicionado com sucesso.' : 'Item atualizado com sucesso.');
    } catch (err: any) {
      toast.error(formatApiError(err));
    } finally {
      setSavingEditItem(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className={btn.secondary} onClick={() => navigate('/curadoria')}>
          Voltar para orçamentos
        </button>
        {orcamento && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={btn.primarySm}
              onClick={() => {
                setIsCreatingItem(true);
                setEditingItemId(null);
                setEditItemForm({
                  nome: '',
                  isbn: '',
                  categoriaId: undefined,
                  quantidade: 1,
                  valor: 0,
                  desconto: 0,
                  autor: '',
                  editora: '',
                  anoPublicacao: '',
                });
                setShowEditItemModal(true);
              }}
            >
              Adicionar item
            </button>
            <button
              type="button"
              className={btn.edit}
              onClick={() => {
                setEditBudgetForm({
                  nome: orcamento.nome ?? '',
                  projetoId: orcamento.projeto?.id ?? undefined,
                  fornecedorId: orcamento.fornecedor?.id ?? undefined,
                  nfUrl: orcamento.nfUrl ?? '',
                  formaPagamento: orcamento.formaPagamento ?? '',
                  arquivoOrcamentoUrl: orcamento.arquivoOrcamentoUrl ?? '',
                  comprovantePagamentoUrl: orcamento.comprovantePagamentoUrl ?? '',
                  status: orcamento.status ?? 'PENDENTE',
                  observacao: orcamento.observacao ?? '',
                  descontoAplicadoEm: orcamento.descontoAplicadoEm ?? 'ITEM',
                  descontoTotal: Number(orcamento.descontoTotal ?? 0),
                });
                setEditBudgetDiscountType('VALOR');
                setShowEditBudgetModal(true);
              }}
            >
              Editar orçamento
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-danger/15 border border-danger/40 text-danger px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {orcamento && (
        <div className="bg-neutral/70 border border-white/10 rounded-xl p-4 space-y-2">
          <h2 className="text-xl font-semibold">{orcamento.nome}</h2>
          <p className="text-sm text-white/70">
            Projeto: {orcamento.projeto?.nome ?? 'Sem projeto'} | Criado em{' '}
            {new Date(orcamento.dataCriacao).toLocaleString('pt-BR')}
          </p>
          <p className="text-sm text-white/70">
            Status: {(orcamento.status ?? 'PENDENTE').replaceAll('_', ' ')} | Fornecedor:{' '}
            {orcamento.fornecedor?.nomeFantasia ?? orcamento.fornecedor?.razaoSocial ?? 'Não informado'}
          </p>
          {(orcamento.nfUrl || orcamento.formaPagamento) && (
            <p className="text-sm text-white/70">
              NF: {orcamento.nfUrl ? 'Arquivo anexado' : '-'} | Pagamento: {orcamento.formaPagamento || '-'}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {orcamento.arquivoOrcamentoUrl && (
              <a href={orcamento.arquivoOrcamentoUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                Arquivo original: {getDataUrlFileName(orcamento.arquivoOrcamentoUrl)}
              </a>
            )}
            {orcamento.nfUrl && (
              <a href={orcamento.nfUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                Abrir NF: {getDataUrlFileName(orcamento.nfUrl)}
              </a>
            )}
            {orcamento.comprovantePagamentoUrl && (
              <a href={orcamento.comprovantePagamentoUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                Abrir comprovante de pagamento
              </a>
            )}
          </div>
          {orcamento.observacao && <p className="text-sm text-white/80">{orcamento.observacao}</p>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="bg-black/20 border border-white/10 rounded-lg p-3">
              <p className="text-xs text-white/60">Total bruto</p>
              <p className="font-semibold">R$ {orcamento.totalBruto.toFixed(2)}</p>
            </div>
            <div className="bg-black/20 border border-white/10 rounded-lg p-3">
              <p className="text-xs text-white/60">Desconto</p>
              <p className="font-semibold text-amber-300">R$ {orcamento.totalDesconto.toFixed(2)}</p>
            </div>
            <div className="bg-black/20 border border-white/10 rounded-lg p-3">
              <p className="text-xs text-white/60">Total líquido</p>
              <p className="font-semibold text-emerald-300">R$ {orcamento.totalLiquido.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      <DataTable<CuradoriaItem>
        data={orcamento?.itens ?? []}
        columns={columns}
        loading={loading}
        keyExtractor={(item) => item.id}
        emptyMessage="Nenhum item neste orçamento."
        renderMobileCard={(item) => (
          <div className="bg-neutral/60 border border-white/10 rounded-xl p-4 space-y-2">
            <p className="font-semibold">{item.nome}</p>
            <p className="text-xs text-white/60">ISBN: {item.isbn}</p>
            <p className="text-xs text-white/60">Categoria: {item.categoria?.nome ?? 'Sem categoria'}</p>
            <p className="text-xs text-white/70">
              Qtd: {item.quantidade} | Valor un.: R$ {item.valor.toFixed(2)} | Desconto un.: R$ {item.desconto.toFixed(2)}
            </p>
            <p className="text-xs text-white/70">
              Total item: R$ {(item.valor * item.quantidade).toFixed(2)} | Total líquido item: R$ {(item.valorLiquido * item.quantidade).toFixed(2)}
            </p>
          </div>
        )}
      />

      {showEditBudgetModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-neutral border border-white/10 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Editar orçamento</h3>
              <button
                type="button"
                onClick={() => setShowEditBudgetModal(false)}
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
                    value={editBudgetForm.nome}
                    onChange={(event) =>
                      setEditBudgetForm((prev) => ({ ...prev, nome: event.target.value }))
                    }
                    className={fieldClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Projeto</label>
                  <select
                    value={editBudgetForm.projetoId ?? ''}
                    onChange={(event) =>
                      setEditBudgetForm((prev) => ({
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
                    value={editBudgetForm.fornecedorId ?? ''}
                    onChange={(event) =>
                      setEditBudgetForm((prev) => ({
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
                    value={editBudgetForm.status}
                    onChange={(event) =>
                      setEditBudgetForm((prev) => ({
                        ...prev,
                        status: event.target.value as CuradoriaEditBudgetForm['status'],
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
                  value={editBudgetForm.formaPagamento}
                  onChange={(event) =>
                    setEditBudgetForm((prev) => ({ ...prev, formaPagamento: event.target.value }))
                  }
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
                        .then((value) =>
                          setEditBudgetForm((prev) => ({ ...prev, nfUrl: value })),
                        )
                        .catch(() => toast.error('Não foi possível ler o arquivo da NF.'));
                    }}
                    className={fileFieldClass}
                    dropMessage="Solte o arquivo NF aqui"
                  />
                  {editBudgetForm.nfUrl && (
                    <a href={editBudgetForm.nfUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                      NF atual: {getDataUrlFileName(editBudgetForm.nfUrl)}
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
                        .then((value) =>
                          setEditBudgetForm((prev) => ({ ...prev, arquivoOrcamentoUrl: value })),
                        )
                        .catch(() => toast.error('Não foi possível ler o arquivo do orçamento.'));
                    }}
                    className={fileFieldClass}
                    dropMessage="Solte o orçamento original aqui"
                  />
                  {editBudgetForm.arquivoOrcamentoUrl && (
                    <a href={editBudgetForm.arquivoOrcamentoUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                      Arquivo atual: {getDataUrlFileName(editBudgetForm.arquivoOrcamentoUrl)}
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
                        .then((value) =>
                          setEditBudgetForm((prev) => ({ ...prev, comprovantePagamentoUrl: value })),
                        )
                        .catch(() => toast.error('Não foi possível ler a imagem de pagamento.'));
                    }}
                    className={fileFieldClass}
                    dropMessage="Solte o comprovante aqui"
                  />
                  {editBudgetForm.comprovantePagamentoUrl && (
                    <a href={editBudgetForm.comprovantePagamentoUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                      Abrir comprovante atual
                    </a>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={editBudgetForm.descontoAplicadoEm}
                  onChange={(event) =>
                    setEditBudgetForm((prev) => ({
                      ...prev,
                      descontoAplicadoEm: event.target.value as 'ITEM' | 'TOTAL',
                    }))
                  }
                  className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="ITEM">Desconto por item</option>
                  <option value="TOTAL">Desconto no total</option>
                </select>
                {editBudgetForm.descontoAplicadoEm === 'TOTAL' && (
                  <div className="bg-black/20 border border-primary/30 rounded-md p-3 space-y-2">
                    <p className="text-xs text-white/80 font-medium">Tipo de desconto no total</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <select
                        value={editBudgetDiscountType}
                        onChange={(event) => setEditBudgetDiscountType(event.target.value as TotalDiscountInputType)}
                        className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="VALOR">Valor (R$)</option>
                        <option value="PERCENTUAL">Porcentagem (%)</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editBudgetForm.descontoTotal}
                        onChange={(event) =>
                          setEditBudgetForm((prev) => ({
                            ...prev,
                            descontoTotal: Number(event.target.value) || 0,
                          }))
                        }
                        placeholder={editBudgetDiscountType === 'VALOR' ? 'Ex.: 250,00' : 'Ex.: 10'}
                        className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <p className="text-[11px] text-white/70">
                      {editBudgetDiscountType === 'VALOR'
                        ? 'Desconto fixo em reais aplicado no total do orçamento.'
                        : `Aplicar ${Number(editBudgetForm.descontoTotal || 0).toFixed(2)}% sobre total bruto de R$ ${Number(orcamento?.totalBruto || 0).toFixed(2)}.`}
                    </p>
                  </div>
                )}
              </div>
              <textarea
                value={editBudgetForm.observacao}
                onChange={(event) =>
                  setEditBudgetForm((prev) => ({ ...prev, observacao: event.target.value }))
                }
                placeholder="Observações"
                className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 h-20 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowEditBudgetModal(false)}
                  className={btn.secondaryLg}
                  disabled={savingEditBudget}
                >
                  Cancelar
                </button>
                <button type="submit" className={btn.primaryLg} disabled={savingEditBudget}>
                  {savingEditBudget ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditItemModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-neutral border border-white/10 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Editar item do orçamento</h3>
              <button
                type="button"
                onClick={() => {
                  setShowEditItemModal(false);
                  setEditingItemId(null);
                }}
                className="text-white/50 hover:text-white"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditItem} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-white/70">Nome do livro (opcional)</label>
                  <input
                    type="text"
                    value={editItemForm.nome}
                    onChange={(event) =>
                      setEditItemForm((prev) => ({ ...prev, nome: event.target.value }))
                    }
                    placeholder="Ex.: O Alquimista"
                    className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/70">ISBN (obrigatório)</label>
                  <input
                    type="text"
                    value={editItemForm.isbn}
                    onChange={(event) =>
                      setEditItemForm((prev) => ({ ...prev, isbn: event.target.value }))
                    }
                    placeholder="Ex.: 9788532530783"
                    className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-white/70">Categoria</label>
                  <select
                    value={editItemForm.categoriaId ?? ''}
                    onChange={(event) =>
                      setEditItemForm((prev) => ({
                        ...prev,
                        categoriaId: event.target.value ? Number(event.target.value) : undefined,
                      }))
                    }
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
                <div className="space-y-1">
                  <label className="text-xs text-white/70">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={editItemForm.quantidade}
                    onChange={(event) =>
                      setEditItemForm((prev) => ({
                        ...prev,
                        quantidade: Number(event.target.value) || 1,
                      }))
                    }
                    placeholder="Ex.: 10"
                    className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/70">Valor unitário (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editItemForm.valor}
                    onChange={(event) =>
                      setEditItemForm((prev) => ({
                        ...prev,
                        valor: Number(event.target.value) || 0,
                      }))
                    }
                    placeholder="Ex.: 39,90"
                    className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/70">Desconto (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editItemForm.desconto}
                    onChange={(event) =>
                      setEditItemForm((prev) => ({
                        ...prev,
                        desconto: Number(event.target.value) || 0,
                      }))
                    }
                    placeholder="Ex.: 5,00"
                    className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-white/70">Autor (opcional)</label>
                  <input
                    type="text"
                    value={editItemForm.autor}
                    onChange={(event) =>
                      setEditItemForm((prev) => ({ ...prev, autor: event.target.value }))
                    }
                    placeholder="Ex.: Machado de Assis"
                    className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/70">Editora (opcional)</label>
                  <input
                    type="text"
                    value={editItemForm.editora}
                    onChange={(event) =>
                      setEditItemForm((prev) => ({ ...prev, editora: event.target.value }))
                    }
                    placeholder="Ex.: Companhia das Letras"
                    className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/70">Ano/Data publicação (opcional)</label>
                  <input
                    type="text"
                    value={editItemForm.anoPublicacao}
                    onChange={(event) =>
                      setEditItemForm((prev) => ({ ...prev, anoPublicacao: event.target.value }))
                    }
                    placeholder="Ex.: 2023 ou 2023-08-15"
                    className="w-full bg-neutral/70 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditItemModal(false);
                    setEditingItemId(null);
                  }}
                  className={btn.secondaryLg}
                  disabled={savingEditItem}
                >
                  Cancelar
                </button>
                <button type="submit" className={btn.primaryLg} disabled={savingEditItem}>
                  {savingEditItem ? 'Salvando...' : 'Salvar item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

