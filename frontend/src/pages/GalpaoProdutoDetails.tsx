import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../store/auth';
import { toast, formatApiError } from '../utils/toast';
import { btn } from '../utils/buttonStyles';
import { DataTable, DataTableColumn } from '../components/DataTable';
import { CollapsibleFilters } from '../components/filters/CollapsibleFilters';
import { AppSelect } from '../components/ui/AppSelect';
import { AppModal } from '../components/ui/AppModal';
import type { Category } from '../types/stock';
import type {
  LivroDisponivel,
  LivroReservado,
  LivroDisponivelPorFornecedor,
  OutrosItemAvaria,
  OutrosItemAlocado,
  OutrosItemDisponivel,
} from '../types/galpao';
import type { GalpaoProduto } from '../types/galpao';

type TabKey = 'livros' | 'outros' | 'projeto';

export default function GalpaoProdutoDetails({
  produtoIdOverride,
  showBackButton = true,
  initialFiltersOpen = true,
  showLivroValorTotal = true,
  forcedTab,
  showSubTabs = true,
}: {
  produtoIdOverride?: number | null;
  showBackButton?: boolean;
  initialFiltersOpen?: boolean;
  showLivroValorTotal?: boolean;
  forcedTab?: TabKey;
  showSubTabs?: boolean;
}) {
  const { id } = useParams();

  const produtoId = useMemo(() => {
    if (produtoIdOverride != null) {
      const n = Number(produtoIdOverride);
      return Number.isFinite(n) ? n : null;
    }
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id, produtoIdOverride]);

  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [produto, setProduto] = useState<GalpaoProduto | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>(forcedTab ?? 'livros');
  const isForcedTab = forcedTab != null;
  const [showLivrosEntry, setShowLivrosEntry] = useState(initialFiltersOpen);
  const [showLivrosFilters, setShowLivrosFilters] = useState(initialFiltersOpen);
  const [showOutrosFilters, setShowOutrosFilters] = useState(initialFiltersOpen);
  const shouldShowProdutoName = !isForcedTab || forcedTab === 'projeto';
  const showLivroValorTotalColumn = showLivroValorTotal && !isForcedTab;
  const headerTitle =
    forcedTab === 'livros'
      ? 'Estoque de livros'
      : forcedTab === 'outros'
        ? 'Estoque de itens'
        : 'Produto do galpão';

  useEffect(() => {
    if (forcedTab) {
      setActiveTab(forcedTab);
    }
  }, [forcedTab]);

  // Filtro usado na aba "Projeto" (apenas para itens/Outros)
  const [projetoFilter, setProjetoFilter] = useState<string>('all');

  const permissionKeys = useMemo(() => {
    if (!user?.cargo || typeof user.cargo === 'string') return new Set<string>();
    const permissions = Array.isArray(user.cargo.permissions) ? user.cargo.permissions : [];
    return new Set(permissions.map((p) => p.chave ?? `${p.modulo}:${p.acao}`));
  }, [user]);
  const canEdit = permissionKeys.has('estoque:movimentar');

  useEffect(() => {
    async function loadProdutosOptions() {
      setProdutosOptionsLoading(true);
      try {
        const { data } = await api.get<GalpaoProduto[]>('/galpao/produtos');
        setProdutosOptions(Array.isArray(data) ? data : []);
      } catch {
        setProdutosOptions([]);
      } finally {
        setProdutosOptionsLoading(false);
      }
    }

    if (canEdit) {
      void loadProdutosOptions();
    } else {
      setProdutosOptions([]);
    }
  }, [canEdit]);

  // Para a aba "Estoque de itens", o galpão pode permitir alocar/avariar
  // para um "produto do galpão" diferente do selecionado na tela.
  const [outrosProdutoIdQuery, setOutrosProdutoIdQuery] = useState<number | null>(produtoId);
  useEffect(() => {
    setOutrosProdutoIdQuery(produtoId);
  }, [produtoId]);

  const [produtosOptions, setProdutosOptions] = useState<GalpaoProduto[]>([]);
  const [produtosOptionsLoading, setProdutosOptionsLoading] = useState(false);

  // Modais de movimentação para "outros itens"
  const [outrosAllocateModalOpen, setOutrosAllocateModalOpen] = useState(false);
  const [outrosAllocateItem, setOutrosAllocateItem] = useState<OutrosItemDisponivel | null>(null);
  const [outrosAllocateProdutoId, setOutrosAllocateProdutoId] = useState<number | null>(null);
  const [outrosAllocateQuantidade, setOutrosAllocateQuantidade] = useState<number>(1);
  const [outrosAllocateLoading, setOutrosAllocateLoading] = useState(false);

  const [outrosAvariaModalOpen, setOutrosAvariaModalOpen] = useState(false);
  const [outrosAvariaItem, setOutrosAvariaItem] = useState<OutrosItemDisponivel | null>(null);
  const [outrosAvariaProdutoId, setOutrosAvariaProdutoId] = useState<number | null>(null);
  const [outrosAvariaQuantidade, setOutrosAvariaQuantidade] = useState<number>(1);
  const [outrosAvariaJustificativa, setOutrosAvariaJustificativa] = useState('');
  const [outrosAvariaLoading, setOutrosAvariaLoading] = useState(false);

  const [outrosAvariasLoading, setOutrosAvariasLoading] = useState(false);
  const [outrosAvarias, setOutrosAvarias] = useState<OutrosItemAvaria[]>([]);

  // Livros (compartilhados)
  const [categoriesLivros, setCategoriesLivros] = useState<Category[]>([]);
  const [livrosSearch, setLivrosSearch] = useState('');
  const [livrosCategoriaId, setLivrosCategoriaId] = useState<number | 'all'>('all');

  const [livrosDisponiveis, setLivrosDisponiveis] = useState<LivroDisponivel[]>([]);
  const [livrosReservados, setLivrosReservados] = useState<LivroReservado[]>([]);
  const [livrosLoading, setLivrosLoading] = useState(false);
  const [livrosBaixaLoading, setLivrosBaixaLoading] = useState(false);

  const [livrosAllocateQty, setLivrosAllocateQty] = useState<Record<string, number>>({});
  const [livrosBaixaQty, setLivrosBaixaQty] = useState<Record<string, number>>({});

  const [livrosAlocarModalOpen, setLivrosAlocarModalOpen] = useState(false);
  const [livroToAlocarModal, setLivroToAlocarModal] = useState<LivroDisponivel | null>(null);
  const [livroAlocarModalFornecedorId, setLivroAlocarModalFornecedorId] = useState<number | null>(null);
  const [livroAlocarModalFornecedorOptions, setLivroAlocarModalFornecedorOptions] = useState<
    Array<{ value: number; label: string; quantidadeDisponivel: number }>
  >([]);
  const [livroAlocarModalFornecedorLoading, setLivroAlocarModalFornecedorLoading] = useState(false);
  const [livroAlocarModalQuantidade, setLivroAlocarModalQuantidade] = useState(1);
  const [livrosAlocando, setLivrosAlocando] = useState(false);

  // Entrada de livros
  const [bookEntryForm, setBookEntryForm] = useState({
    isbn: '',
    categoriaId: undefined as number | undefined,
    nome: '',
    quantidade: 1,
    valor: 1,
    desconto: 0,
    autor: '',
    editora: '',
    anoPublicacao: '',
  });
  const [bookEntrySubmitting, setBookEntrySubmitting] = useState(false);

  // Outros itens
  const [categoriesItens, setCategoriesItens] = useState<Category[]>([]);
  const [outrosSearch, setOutrosSearch] = useState('');

  // Aplica filtros automaticamente ao mudar os campos de busca/filtro,
  // evitando a necessidade de um botão "Aplicar filtros".
  useEffect(() => {
    if (activeTab !== 'livros') return;
    const timeoutId = window.setTimeout(() => {
      void loadLivros();
    }, 300);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, livrosSearch, livrosCategoriaId, produtoId]);

  useEffect(() => {
    if (activeTab !== 'outros') return;
    const timeoutId = window.setTimeout(() => {
      void loadOutros();
    }, 300);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, outrosSearch, produtoId]);

  const [outrosDisponiveis, setOutrosDisponiveis] = useState<OutrosItemDisponivel[]>([]);
  const [outrosAlocados, setOutrosAlocados] = useState<OutrosItemAlocado[]>([]);
  const [outrosLoading, setOutrosLoading] = useState(false);

  const [outrosBaixaQty, setOutrosBaixaQty] = useState<Record<number, number>>({});
  const [outrosEntrySubmitting, setOutrosEntrySubmitting] = useState(false);

  const [otherEntryForm, setOtherEntryForm] = useState({
    item: '',
    descricao: '',
    categoriaId: undefined as number | undefined,
    quantidade: 1,
    valorUnitario: 0,
  });

  const livroKey = (row: { isbn: string; categoriaId: number | null | undefined }) =>
    `${row.isbn}::${row.categoriaId ?? 'null'}`;

  const livroReservaKey = (row: LivroReservado) =>
    `${row.isbn}::${row.categoriaId ?? 'null'}::${row.fornecedorId ?? 'null'}`;

  async function loadProdutos() {
    if (!produtoId) return;
    setLoading(true);
    try {
      const { data } = await api.get<GalpaoProduto[]>('/galpao/produtos');
      const found = Array.isArray(data) ? data.find((p) => p.id === produtoId) : undefined;
      setProduto(found ?? null);
    } catch (err: any) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadLivros() {
    setLivrosLoading(true);
    try {
      const params: Record<string, any> = {};
      if (livrosSearch.trim()) params.search = livrosSearch.trim();
      if (livrosCategoriaId !== 'all') params.categoriaId = livrosCategoriaId;

      const dispRes = await api.get<LivroDisponivel[]>('/galpao/livros-disponiveis', { params });
      let reservResData: LivroReservado[] = [];
      if (produtoId != null) {
        const reservRes = await api.get<LivroReservado[]>(`/galpao/produtos/${produtoId}/livros-reservados`);
        reservResData = Array.isArray(reservRes.data) ? reservRes.data : [];
      }

      setLivrosDisponiveis(Array.isArray(dispRes.data) ? dispRes.data : []);
      setLivrosReservados(reservResData);

      // Reseta o valor de baixa baseado nas reservas atuais (se não existir produto, vira vazio).
      setLivrosBaixaQty(() => {
        const next: Record<string, number> = {};
        reservResData.forEach((r) => {
          const k = livroReservaKey(r);
          next[k] = r.quantidade;
        });
        return next;
      });
    } catch (err: any) {
      toast.error(formatApiError(err));
    } finally {
      setLivrosLoading(false);
    }
  }

  async function loadOutros(targetProdutoId: number | null = outrosProdutoIdQuery) {
    setOutrosLoading(true);
    try {
      const params: Record<string, any> = {};
      if (outrosSearch.trim()) params.search = outrosSearch.trim();

      const dispRes = await api.get<OutrosItemDisponivel[]>('/galpao/outros-itens-disponiveis', { params });
      let reservResData: OutrosItemAlocado[] = [];
      if (targetProdutoId != null) {
        const reservRes = await api.get<OutrosItemAlocado[]>(`/galpao/produtos/${targetProdutoId}/outros-itens-alocados`);
        reservResData = Array.isArray(reservRes.data) ? reservRes.data : [];
      }

      setOutrosDisponiveis(Array.isArray(dispRes.data) ? dispRes.data : []);
      setOutrosAlocados(reservResData);

      setOutrosBaixaQty(() => {
        const next: Record<number, number> = {};
        reservResData.forEach((r) => {
          next[r.id] = r.quantidade;
        });
        return next;
      });
    } catch (err: any) {
      toast.error(formatApiError(err));
    } finally {
      setOutrosLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const [livrosRes, itensRes] = await Promise.all([
        api.get<Category[]>('/categories/all?tipo=LIVRO'),
        api.get<Category[]>('/categories?tipo=ITEM'),
      ]);
      setCategoriesLivros(Array.isArray(livrosRes.data) ? livrosRes.data : []);
      setCategoriesItens(Array.isArray(itensRes.data) ? itensRes.data : []);
    } catch {
      // Se falhar, mantém arrays vazios
      setCategoriesLivros([]);
      setCategoriesItens([]);
    }
  }

  useEffect(() => {
    setProjetoFilter('all');
    if (produtoId != null) {
      void loadProdutos();
    } else {
      setProduto(null);
    }
    void loadCategories();
    // Carregar tudo uma vez para o usuário não ver "telas vazias"
    void loadLivros();
    void loadOutros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtoId]);

  async function handleAddBookEntry(event: FormEvent) {
    event.preventDefault();
    if (!produtoId) return;
    if (!canEdit) return;
    if (!bookEntryForm.isbn.trim()) {
      toast.error('Informe o ISBN.');
      return;
    }
    if (bookEntryForm.quantidade < 1) {
      toast.error('Quantidade inválida.');
      return;
    }
    if (bookEntryForm.valor <= 0) {
      toast.error('Informe o valor unitário (deve ser maior que 0).');
      return;
    }

    setBookEntrySubmitting(true);
    try {
      await api.post(`/galpao/produtos/${produtoId}/livros/entrada`, {
        isbn: bookEntryForm.isbn,
        categoriaId: bookEntryForm.categoriaId ?? undefined,
        nome: bookEntryForm.nome?.trim() || undefined,
        quantidade: bookEntryForm.quantidade,
        valor: bookEntryForm.valor,
        desconto: bookEntryForm.desconto > 0 ? bookEntryForm.desconto : undefined,
        autor: bookEntryForm.autor?.trim() || undefined,
        editora: bookEntryForm.editora?.trim() || undefined,
        anoPublicacao: bookEntryForm.anoPublicacao?.trim() || undefined,
      });
      toast.success('Entrada de livros registrada com sucesso!');
      setBookEntryForm({
        isbn: '',
        categoriaId: undefined,
        nome: '',
        quantidade: 1,
        valor: 1,
        desconto: 0,
        autor: '',
        editora: '',
        anoPublicacao: '',
      });
      await loadLivros();
    } catch (err: any) {
      toast.error(formatApiError(err));
    } finally {
      setBookEntrySubmitting(false);
    }
  }

  async function handleAllocateBook(row: LivroDisponivel, fornecedorId: number, quantidade: number) {
    if (!produtoId) return;
    if (!canEdit) return;
    if (quantidade < 1) {
      toast.error('Quantidade inválida.');
      return false;
    }

    if (fornecedorId == null) {
      toast.error('Selecione o fornecedor.');
      return false;
    }

    setLivrosAlocando(true);
    try {
      await api.post(`/galpao/produtos/${produtoId}/livros/alocar`, {
        isbn: row.isbn,
        categoriaId: row.categoriaId ?? undefined,
        quantidade,
        fornecedorId,
      });
      toast.success('Livro alocado com sucesso!');
      await loadLivros();
      return true;
    } catch (err: any) {
      toast.error(formatApiError(err));
      return false;
    } finally {
      setLivrosAlocando(false);
    }
  }

  async function loadLivroAlocarFornecedorOptions(livro: LivroDisponivel) {
    setLivroAlocarModalFornecedorLoading(true);
    try {
      const params: Record<string, string | number> = {
        isbn: livro.isbn,
      };
      if (livro.categoriaId != null) params.categoriaId = livro.categoriaId;

      const { data } = await api.get<LivroDisponivelPorFornecedor[]>(
        '/galpao/livros-disponiveis-por-fornecedor',
        { params },
      );

      const options = Array.isArray(data) ? data : [];

      setLivroAlocarModalFornecedorOptions(
        options.map((s) => ({
          value: s.fornecedorId,
          label: `${s.fornecedorNome} (disponível: ${s.quantidadeDisponivel})`,
          quantidadeDisponivel: s.quantidadeDisponivel,
        })),
      );

      setLivroAlocarModalFornecedorId(options.length === 1 ? options[0].fornecedorId : null);
    } catch (err: any) {
      toast.error(formatApiError(err));
      setLivroAlocarModalFornecedorOptions([]);
      setLivroAlocarModalFornecedorId(null);
    } finally {
      setLivroAlocarModalFornecedorLoading(false);
    }
  }

  async function handleBaixaBook(row: LivroReservado) {
    if (!produtoId) return;
    if (!canEdit) return;
    setLivrosBaixaLoading(true);
    try {
      const k = livroReservaKey(row);
      const qty = livrosBaixaQty[k] ?? row.quantidade;
      if (qty < 1) {
        toast.error('Quantidade inválida.');
        return;
      }
      if (qty > row.quantidade) {
        toast.error('Quantidade excede a reservada.');
        return;
      }

      await api.post(`/galpao/produtos/${produtoId}/livros/baixa`, {
        isbn: row.isbn,
        categoriaId: row.categoriaId ?? undefined,
        quantidade: qty,
        fornecedorId: row.fornecedorId ?? undefined,
      });
      toast.success('Baixa do livro registrada com sucesso!');
      setLivrosBaixaQty((prev) => ({ ...prev, [k]: row.quantidade }));
      await loadLivros();
    } catch (err: any) {
      toast.error(formatApiError(err));
    } finally {
      setLivrosBaixaLoading(false);
    }
  }

  async function handleAddOtherEntry(event: FormEvent) {
    event.preventDefault();
    if (!produtoId) return;
    if (!canEdit) return;
    if (!otherEntryForm.item.trim()) {
      toast.error('Informe o item.');
      return;
    }
    if (otherEntryForm.quantidade < 1) {
      toast.error('Quantidade inválida.');
      return;
    }
    if (otherEntryForm.valorUnitario < 0) {
      toast.error('Valor inválido.');
      return;
    }

    setOutrosEntrySubmitting(true);
    try {
      await api.post(`/galpao/produtos/${produtoId}/outros-itens/entrada`, {
        item: otherEntryForm.item.trim(),
        descricao: otherEntryForm.descricao?.trim() || undefined,
        categoriaId: otherEntryForm.categoriaId ?? undefined,
        quantidade: otherEntryForm.quantidade,
        valorUnitario: otherEntryForm.valorUnitario,
      });

      toast.success('Entrada do item registrada com sucesso!');
      setOtherEntryForm({
        item: '',
        descricao: '',
        categoriaId: undefined,
        quantidade: 1,
        valorUnitario: 0,
      });
      await loadOutros();
    } catch (err: any) {
      toast.error(formatApiError(err));
    } finally {
      setOutrosEntrySubmitting(false);
    }
  }

  async function handleDeleteOutroItemCadastro(row: OutrosItemDisponivel) {
    if (!canEdit) return;
    const ok = window.confirm(`Excluir o cadastro do item "${row.item}" do estoque?`);
    if (!ok) return;
    try {
      await api.delete(`/galpao/outros-itens/${row.id}`);
      toast.success('Cadastro de item removido do estoque.');
      await loadOutros(outrosProdutoIdQuery);
    } catch (err: any) {
      toast.error(formatApiError(err));
    }
  }

  async function handleAllocateOther(row: OutrosItemDisponivel, targetProdutoId: number, quantidade: number) {
    if (!canEdit) return;
    if (!targetProdutoId) return;
    if (quantidade < 1) {
      toast.error('Quantidade inválida.');
      return;
    }
    if (quantidade > row.quantidadeDisponivel) {
      toast.error('Quantidade excede o disponível.');
      return;
    }

    setOutrosAllocateLoading(true);
    try {
      await api.post(`/galpao/produtos/${targetProdutoId}/outros-itens/alocar`, {
        estoqueId: row.id,
        quantidade,
      });
      toast.success('Item alocado com sucesso!');
      setOutrosProdutoIdQuery(targetProdutoId);
      await loadOutros(targetProdutoId);
      return true;
    } catch (err: any) {
      toast.error(formatApiError(err));
      return false;
    } finally {
      setOutrosAllocateLoading(false);
    }
  }

  async function handleBaixaOther(row: OutrosItemAlocado) {
    if (!outrosProdutoIdQuery) return;
    if (!canEdit) return;
    const qty = outrosBaixaQty[row.id] ?? row.quantidade;
    if (qty < 1) {
      toast.error('Quantidade inválida.');
      return;
    }
    if (qty > row.quantidade) {
      toast.error('Quantidade excede a reservada.');
      return;
    }

    try {
      await api.post(`/galpao/produtos/${outrosProdutoIdQuery}/outros-itens/baixa`, {
        estoqueAlocacaoId: row.id,
        quantidade: qty,
      });
      toast.success('Baixa do item registrada com sucesso!');
      await loadOutros();
    } catch (err: any) {
      toast.error(formatApiError(err));
    }
  }

  async function loadOutrosAvarias(estoqueId: number) {
    setOutrosAvariasLoading(true);
    try {
      const { data } = await api.get<OutrosItemAvaria[]>(`/galpao/outros-itens/${estoqueId}/avarias`);
      setOutrosAvarias(Array.isArray(data) ? data : []);
    } catch {
      setOutrosAvarias([]);
    } finally {
      setOutrosAvariasLoading(false);
    }
  }

  useEffect(() => {
    if (!outrosAvariaModalOpen || !outrosAvariaItem) return;
    void loadOutrosAvarias(outrosAvariaItem.id);
  }, [outrosAvariaModalOpen, outrosAvariaItem]);

  const livroDisponivelColumns: DataTableColumn<LivroDisponivel>[] = [
    { key: 'isbn', label: 'ISBN', render: (r) => <span className="font-mono text-xs">{r.isbn}</span> },
    { key: 'nome', label: 'Título', render: (r) => <span className="font-medium">{r.nome}</span> },
    { key: 'categoria', label: 'Gênero', render: (r) => <span>{r.categoriaNome ?? '-'}</span> },
    { key: 'autor', label: 'Autor', render: (r) => <span className="text-xs text-white/80">{r.autor ?? '-'}</span> },
    {
      key: 'qtd',
      label: 'Qtd disponível',
      align: 'right',
      tdClassName: 'text-right',
      render: (r) => <span className="font-semibold">{r.quantidadeDisponivel}</span>,
    },
    ...(showLivroValorTotalColumn
      ? [
          {
            key: 'valor',
            label: 'Valor total',
            align: 'right' as const,
            tdClassName: 'text-right',
            render: (r) => (
              <span className="text-xs text-emerald-300">
                {r.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            ),
          } satisfies DataTableColumn<LivroDisponivel>,
        ]
      : []),
    {
      key: 'acoes',
      label: 'Ações',
      stopRowClick: true,
      align: 'right',
      render: (r) => {
        return (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className={btn.primarySm}
              onClick={() => {
                setLivroToAlocarModal(r);
                setLivroAlocarModalQuantidade(1);
                setLivroAlocarModalFornecedorId(null);
                setLivroAlocarModalFornecedorOptions([]);
                setLivrosAlocarModalOpen(true);
                void loadLivroAlocarFornecedorOptions(r);
              }}
              disabled={!canEdit || livrosLoading || produtoId == null}
            >
              Alocar
            </button>
          </div>
        );
      },
    },
  ];

  const livroReservadoColumns: DataTableColumn<LivroReservado>[] = [
    { key: 'isbn', label: 'ISBN', render: (r) => <span className="font-mono text-xs">{r.isbn}</span> },
    { key: 'nome', label: 'Título', render: (r) => <span className="font-medium">{r.nome}</span> },
    { key: 'categoria', label: 'Gênero', render: (r) => <span>{r.categoriaNome ?? '-'}</span> },
    {
      key: 'fornecedor',
      label: 'Fornecedor',
      render: (r) => <span className="text-xs text-white/80">{r.fornecedorNome ?? '-'}</span>,
    },
    { key: 'qtd', label: 'Qtd reservada', align: 'right', tdClassName: 'text-right', render: (r) => <span className="font-semibold">{r.quantidade}</span> },
    {
      key: 'acoes',
      label: 'Ações',
      stopRowClick: true,
      align: 'right',
      render: (r) => {
        const k = livroReservaKey(r);
        const qty = livrosBaixaQty[k] ?? r.quantidade;
        return (
          <div className="flex items-center justify-end gap-2">
            <input
              type="number"
              min={1}
              max={r.quantidade}
              value={qty}
              onChange={(e) => {
                const n = Number(e.target.value);
                setLivrosBaixaQty((prev) => ({ ...prev, [k]: Number.isFinite(n) ? n : r.quantidade }));
              }}
              className="w-20 bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              disabled={!canEdit || livrosBaixaLoading || produtoId == null || r.fornecedorId == null}
            />
            <button
              type="button"
              className={btn.dangerSm}
              onClick={() => void handleBaixaBook(r)}
              disabled={!canEdit || livrosBaixaLoading || produtoId == null || r.fornecedorId == null}
            >
              Baixar
            </button>
          </div>
        );
      },
    },
  ];

  const outrosDisponiveisColumns: DataTableColumn<OutrosItemDisponivel>[] = [
    { key: 'item', label: 'Item', render: (r) => <span className="font-medium">{r.item}</span> },
    { key: 'categoria', label: 'Categoria', render: (r) => <span className="text-xs text-white/70">{r.categoria?.nome ?? '-'}</span> },
    { key: 'qtd', label: 'Qtd disponível', align: 'right', tdClassName: 'text-right', render: (r) => <span className="font-semibold">{r.quantidadeDisponivel}</span> },
    {
      key: 'acoes',
      label: 'Ações',
      stopRowClick: true,
      align: 'right',
      render: (r) => {
        return (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className={btn.primarySm}
              onClick={() => {
                setOutrosAllocateItem(r);
                setOutrosAllocateModalOpen(true);
                const defaultProdutoId = outrosProdutoIdQuery ?? produtosOptions[0]?.id ?? null;
                setOutrosAllocateProdutoId(defaultProdutoId);
                setOutrosAllocateQuantidade(1);
              }}
              disabled={!canEdit}
            >
              Alocar
            </button>
            <button
              type="button"
              className={btn.warningSm}
              onClick={() => {
                setOutrosAvariaItem(r);
                setOutrosAvariaModalOpen(true);
                const defaultProdutoId = outrosProdutoIdQuery ?? produtosOptions[0]?.id ?? null;
                setOutrosAvariaProdutoId(defaultProdutoId);
                setOutrosAvariaQuantidade(1);
                setOutrosAvariaJustificativa('');
              }}
              disabled={!canEdit}
            >
              Avarias
            </button>
            <button
              type="button"
              className={btn.dangerSm}
              onClick={() => void handleDeleteOutroItemCadastro(r)}
              disabled={!canEdit}
            >
              Excluir
            </button>
          </div>
        );
      },
    },
  ];

  const outrosAlocadosColumns: DataTableColumn<OutrosItemAlocado>[] = [
    { key: 'item', label: 'Item', render: (r) => <span className="font-medium">{r.estoque.item}</span> },
    { key: 'categoria', label: 'Categoria', render: (r) => <span className="text-xs text-white/70">{r.estoque.categoria?.nome ?? '-'}</span> },
    { key: 'qtd', label: 'Qtd reservada', align: 'right', tdClassName: 'text-right', render: (r) => <span className="font-semibold">{r.quantidade}</span> },
    {
      key: 'acoes',
      label: 'Ações',
      stopRowClick: true,
      align: 'right',
      render: (r) => {
        const qty = outrosBaixaQty[r.id] ?? r.quantidade;
        return (
          <div className="flex items-center justify-end gap-2">
            <input
              type="number"
              min={1}
              max={r.quantidade}
              value={qty}
              onChange={(e) => {
                const n = Number(e.target.value);
                setOutrosBaixaQty((prev) => ({ ...prev, [r.id]: Number.isFinite(n) ? n : r.quantidade }));
              }}
              className="w-20 bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              disabled={!canEdit || outrosProdutoIdQuery == null}
            />
            <button
              type="button"
              className={btn.dangerSm}
              onClick={() => void handleBaixaOther(r)}
              disabled={!canEdit || outrosLoading || outrosProdutoIdQuery == null}
            >
              Baixar
            </button>
          </div>
        );
      },
    },
  ];

  if (loading) {
    return <div className="py-8 text-center text-white/60">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          {showBackButton && (
            <button type="button" className={btn.secondary} onClick={() => navigate('/galpao')}>
              ← Voltar
            </button>
          )}
          <h2 className="text-xl font-semibold mt-2">{headerTitle}</h2>
          {shouldShowProdutoName && (
            <p className="text-sm text-white/60">{produto?.nome ?? (produtoId != null ? `#${produtoId}` : '')}</p>
          )}
        </div>

        {showSubTabs && !isForcedTab && (
          <div className="inline-flex rounded-lg bg-black/40 border border-white/10 p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('livros')}
              className={`px-4 py-2 text-sm rounded-md transition ${
                activeTab === 'livros'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              Estoque de livros
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('outros')}
              className={`px-4 py-2 text-sm rounded-md transition ${
                activeTab === 'outros'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              Estoque de itens
            </button>
          </div>
        )}
      </div>

      {activeTab === 'livros' && (
        <div className="space-y-6">
          {canEdit && produtoId != null && (
            <CollapsibleFilters
              show={showLivrosEntry}
              setShow={setShowLivrosEntry}
              hasActiveFilters={false}
              title="Entrada de livros"
            >
              <form onSubmit={(e) => void handleAddBookEntry(e)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">ISBN</label>
                    <input
                      className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      value={bookEntryForm.isbn}
                      onChange={(e) => setBookEntryForm((prev) => ({ ...prev, isbn: e.target.value }))}
                      placeholder="978... (opcional nome pode ser preenchido depois)"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">Gênero literário (opcional)</label>
                    <AppSelect
                      value={bookEntryForm.categoriaId ?? ''}
                      onChange={(value) => {
                        const n = value ? Number(value) : undefined;
                        setBookEntryForm((prev) => ({ ...prev, categoriaId: n }));
                      }}
                      placeholder="Sem gênero"
                      options={categoriesLivros.map((c) => ({ value: c.id, label: c.nome }))}
                      selectClassName="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">Quantidade</label>
                    <input
                      type="number"
                      min={1}
                      value={bookEntryForm.quantidade}
                      onChange={(e) => setBookEntryForm((prev) => ({ ...prev, quantidade: Number(e.target.value) || 1 }))}
                      className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">Valor unitário (R$)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={bookEntryForm.valor}
                      onChange={(e) => setBookEntryForm((prev) => ({ ...prev, valor: Number(e.target.value) || 0 }))}
                      className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">Desconto unitário (opcional)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={bookEntryForm.desconto}
                      onChange={(e) => setBookEntryForm((prev) => ({ ...prev, desconto: Number(e.target.value) || 0 }))}
                      className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">Nome (opcional)</label>
                    <input
                      value={bookEntryForm.nome}
                      onChange={(e) => setBookEntryForm((prev) => ({ ...prev, nome: e.target.value }))}
                      className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder="Se vazio, usa ISBN"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">Autor (opcional)</label>
                    <input
                      value={bookEntryForm.autor}
                      onChange={(e) => setBookEntryForm((prev) => ({ ...prev, autor: e.target.value }))}
                      className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder="Autor"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">Editora (opcional)</label>
                    <input
                      value={bookEntryForm.editora}
                      onChange={(e) => setBookEntryForm((prev) => ({ ...prev, editora: e.target.value }))}
                      className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder="Editora"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">Ano (opcional)</label>
                    <input
                      value={bookEntryForm.anoPublicacao}
                      onChange={(e) => setBookEntryForm((prev) => ({ ...prev, anoPublicacao: e.target.value }))}
                      className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder="2024"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
                  <button type="button" className={btn.secondaryLg} disabled={bookEntrySubmitting} onClick={() => setBookEntryForm((prev) => ({ ...prev, isbn: '', nome: '', autor: '', editora: '', anoPublicacao: '', categoriaId: undefined, quantidade: 1, valor: 1, desconto: 0 }))}>
                    Limpar
                  </button>
                  <button type="submit" className={btn.primaryLg} disabled={bookEntrySubmitting}>
                    {bookEntrySubmitting ? 'Registrando...' : 'Registrar entrada'}
                  </button>
                </div>
              </form>
            </CollapsibleFilters>
          )}

          <CollapsibleFilters
            show={showLivrosFilters}
            setShow={setShowLivrosFilters}
            hasActiveFilters={livrosSearch.trim().length > 0 || livrosCategoriaId !== 'all'}
            title="Busca e filtros"
            badgeText="Ativo"
            onClear={() => {
              setLivrosSearch('');
              setLivrosCategoriaId('all');
              void loadLivros();
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-white/90 mb-1">Buscar</label>
                <input
                  value={livrosSearch}
                  onChange={(e) => setLivrosSearch(e.target.value)}
                  placeholder="ISBN, título, gênero, autor..."
                  className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/90 mb-1">Gênero</label>
                <AppSelect
                  value={livrosCategoriaId === 'all' ? '' : livrosCategoriaId}
                  onChange={(value) => setLivrosCategoriaId(value ? Number(value) : 'all')}
                  placeholder="Todos"
                  options={categoriesLivros.map((c) => ({ value: c.id, label: c.nome }))}
                  selectClassName="w-full"
                />
              </div>
            </div>
          </CollapsibleFilters>

          <div className="space-y-4">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <h3 className="text-lg font-semibold">Livros disponíveis</h3>
            </div>
            <DataTable<LivroDisponivel>
              data={livrosDisponiveis}
              columns={livroDisponivelColumns}
              keyExtractor={(r) => livroKey(r)}
              loading={livrosLoading}
              emptyMessage="Nenhum livro disponível para alocar."
              paginate
              initialPageSize={20}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <h3 className="text-lg font-semibold">Livros reservados</h3>
            </div>
            <DataTable<LivroReservado>
              data={livrosReservados}
              columns={livroReservadoColumns}
              keyExtractor={(r) => livroReservaKey(r)}
              loading={livrosLoading}
              emptyMessage="Nenhum livro reservado para baixa."
              paginate
              initialPageSize={20}
            />
          </div>
        </div>
      )}

      {activeTab === 'projeto' && (
        <div className="space-y-6">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Itens alocados por projeto</h3>
              <p className="text-sm text-white/60">
                Visualize e dê baixa nos itens alocados, filtrando por projeto.
              </p>
            </div>

            <div className="w-full sm:w-72">
              <AppSelect
                label="Projeto"
                value={projetoFilter}
                onChange={(value) => setProjetoFilter(value)}
                placeholder="Todos"
                options={[
                  { value: 'all', label: 'Todos' },
                  ...Array.from(
                    new Set(
                      (outrosAlocados ?? [])
                        .map((a) => a.projetoId)
                        .filter((id): id is number => typeof id === 'number'),
                    ),
                  )
                    .sort((a, b) => a - b)
                    .map((id) => ({ value: id, label: `#${id}` })),
                ]}
                selectClassName="w-full"
              />
            </div>
          </div>

          {(() => {
            const projetoIdNumber =
              projetoFilter === 'all' ? null : Number(projetoFilter);

            const data =
              projetoIdNumber == null
                ? outrosAlocados
                : outrosAlocados.filter((r) => r.projetoId === projetoIdNumber);

            const outrosAlocadosPorProjetoColumns: DataTableColumn<OutrosItemAlocado>[] = [
              {
                key: 'item',
                label: 'Item',
                render: (r) => <span className="font-medium">{r.estoque.item}</span>,
              },
              {
                key: 'categoria',
                label: 'Categoria',
                render: (r) => (
                  <span className="text-xs text-white/70">{r.estoque.categoria?.nome ?? '-'}</span>
                ),
              },
              {
                key: 'qtd',
                label: 'Qtd reservada',
                align: 'right',
                tdClassName: 'text-right',
                render: (r) => <span className="font-semibold">{r.quantidade}</span>,
              },
              {
                key: 'projeto',
                label: 'Projeto',
                render: (r) => <span className="text-sm">{r.projetoId ?? '-'}</span>,
              },
              {
                key: 'etapa',
                label: 'Etapa',
                render: (r) => <span className="text-sm">{r.etapaId ?? '-'}</span>,
              },
              {
                key: 'acoes',
                label: 'Ações',
                stopRowClick: true,
                align: 'right',
                render: (r) => {
                  const qty = outrosBaixaQty[r.id] ?? r.quantidade;
                  return (
                    <div className="flex items-center justify-end gap-2">
                      <input
                        type="number"
                        min={1}
                        max={r.quantidade}
                        value={qty}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setOutrosBaixaQty((prev) => ({
                            ...prev,
                            [r.id]: Number.isFinite(n) ? n : r.quantidade,
                          }));
                        }}
                        className="w-20 bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        disabled={!canEdit}
                      />
                      <button
                        type="button"
                        className={btn.dangerSm}
                        onClick={() => void handleBaixaOther(r)}
                        disabled={!canEdit || outrosLoading}
                      >
                        Baixar
                      </button>
                    </div>
                  );
                },
              },
            ];

            return (
              <DataTable<OutrosItemAlocado>
                data={data}
                columns={outrosAlocadosPorProjetoColumns}
                keyExtractor={(r) => String(r.id)}
                loading={outrosLoading}
                emptyMessage="Nenhum item alocado para este projeto."
                paginate
                initialPageSize={20}
              />
            );
          })()}
        </div>
      )}

      {activeTab === 'outros' && (
        <div className="space-y-6">
          {canEdit && produtoId != null && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
              <h3 className="text-lg font-semibold">Entrada de outros itens</h3>
              <form onSubmit={(e) => void handleAddOtherEntry(e)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">Item</label>
                    <input
                      value={otherEntryForm.item}
                      onChange={(e) => setOtherEntryForm((prev) => ({ ...prev, item: e.target.value }))}
                      className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder="Nome do item"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">Quantidade</label>
                    <input
                      type="number"
                      min={1}
                      value={otherEntryForm.quantidade}
                      onChange={(e) => setOtherEntryForm((prev) => ({ ...prev, quantidade: Number(e.target.value) || 1 }))}
                      className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">Valor unitário (R$)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={otherEntryForm.valorUnitario}
                      onChange={(e) => setOtherEntryForm((prev) => ({ ...prev, valorUnitario: Number(e.target.value) || 0 }))}
                      className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">Categoria (opcional)</label>
                    <AppSelect
                      value={otherEntryForm.categoriaId ?? ''}
                      onChange={(value) => setOtherEntryForm((prev) => ({ ...prev, categoriaId: value ? Number(value) : undefined }))}
                      placeholder="Sem categoria"
                      options={categoriesItens.map((c) => ({ value: c.id, label: c.nome }))}
                      selectClassName="w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/90 mb-1">Descrição (opcional)</label>
                  <textarea
                    rows={3}
                    value={otherEntryForm.descricao}
                    onChange={(e) => setOtherEntryForm((prev) => ({ ...prev, descricao: e.target.value }))}
                    className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
                  <button type="button" className={btn.secondaryLg} disabled={outrosEntrySubmitting} onClick={() => setOtherEntryForm({ item: '', descricao: '', categoriaId: undefined, quantidade: 1, valorUnitario: 0 })}>
                    Limpar
                  </button>
                  <button type="submit" className={btn.primaryLg} disabled={outrosEntrySubmitting}>
                    {outrosEntrySubmitting ? 'Registrando...' : 'Registrar entrada'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <CollapsibleFilters
            show={showOutrosFilters}
            setShow={setShowOutrosFilters}
            hasActiveFilters={outrosSearch.trim().length > 0}
            title="Filtros"
            badgeText="Ativo"
            onClear={() => {
              setOutrosSearch('');
              void loadOutros();
            }}
          >
            <div>
              <label className="block text-xs font-medium text-white/90 mb-1">Buscar item</label>
              <input
                value={outrosSearch}
                onChange={(e) => setOutrosSearch(e.target.value)}
                placeholder="Item..."
                className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </CollapsibleFilters>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Outros itens disponíveis</h3>
            <DataTable<OutrosItemDisponivel>
              data={outrosDisponiveis}
              columns={outrosDisponiveisColumns}
              keyExtractor={(r) => String(r.id)}
              loading={outrosLoading}
              emptyMessage="Nenhum item disponível."
              paginate
              initialPageSize={20}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Outros itens alocados</h3>
            <DataTable<OutrosItemAlocado>
              data={outrosAlocados}
              columns={outrosAlocadosColumns}
              keyExtractor={(r) => String(r.id)}
              loading={outrosLoading}
              emptyMessage="Nenhum item reservado para baixa."
              paginate
              initialPageSize={20}
            />
          </div>
        </div>
      )}

      {/* Modal: Alocar livro (por fornecedor) */}
      <AppModal
        open={livrosAlocarModalOpen}
        onClose={() => {
          setLivrosAlocarModalOpen(false);
          setLivroToAlocarModal(null);
          setLivroAlocarModalFornecedorId(null);
          setLivroAlocarModalFornecedorOptions([]);
          setLivroAlocarModalQuantidade(1);
        }}
        title="Alocar livro"
        size="md"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!produtoId) return;
            if (!livroToAlocarModal) return;
            if (livroAlocarModalFornecedorId == null) return;
            if (livroAlocarModalQuantidade < 1) {
              toast.error('Quantidade inválida.');
              return;
            }

            const ok = await handleAllocateBook(livroToAlocarModal, livroAlocarModalFornecedorId, livroAlocarModalQuantidade);
            if (ok) {
              setLivrosAlocarModalOpen(false);
              setLivroToAlocarModal(null);
              setLivroAlocarModalFornecedorId(null);
              setLivroAlocarModalFornecedorOptions([]);
              setLivroAlocarModalQuantidade(1);
            }
          }}
          className="space-y-4"
        >
          <div className="text-sm text-white/70">
            {livroToAlocarModal ? (
              <>
                Livro: <span className="text-white">{livroToAlocarModal.nome}</span> ({livroToAlocarModal.isbn})
              </>
            ) : (
              'Selecione um livro'
            )}
          </div>

          <AppSelect
            label="Fornecedor (estoque disponível)"
            value={livroAlocarModalFornecedorId ?? ''}
            onChange={(value) => setLivroAlocarModalFornecedorId(value ? Number(value) : null)}
            placeholder={livroAlocarModalFornecedorOptions.length ? 'Selecionar' : 'Sem opções'}
            options={livroAlocarModalFornecedorOptions}
            disabled={livroAlocarModalFornecedorLoading || livrosAlocando}
            selectClassName="w-full"
          />

          <div>
            <label className="block text-xs font-medium text-white/90 mb-1">Quantidade</label>
            <input
              type="number"
              min={1}
              max={
                livroAlocarModalFornecedorId != null
                  ? livroAlocarModalFornecedorOptions.find((o) => o.value === livroAlocarModalFornecedorId)?.quantidadeDisponivel ??
                    undefined
                  : undefined
              }
              value={livroAlocarModalQuantidade}
              onChange={(e) => setLivroAlocarModalQuantidade(Number(e.target.value) || 1)}
              className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              disabled={livrosAlocando || livroAlocarModalFornecedorLoading}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              className={btn.secondaryLg}
              onClick={() => {
                setLivrosAlocarModalOpen(false);
                setLivroToAlocarModal(null);
                setLivroAlocarModalFornecedorId(null);
                setLivroAlocarModalFornecedorOptions([]);
                setLivroAlocarModalQuantidade(1);
              }}
              disabled={livrosAlocando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={btn.primaryLg}
              disabled={livrosAlocando || livroAlocarModalFornecedorId == null || livroToAlocarModal == null}
            >
              {livrosAlocando ? 'Alocando...' : 'Alocar'}
            </button>
          </div>
        </form>
      </AppModal>

      {/* Modal: Alocar item */}
      <AppModal
        open={outrosAllocateModalOpen}
        onClose={() => {
          setOutrosAllocateModalOpen(false);
          setOutrosAllocateItem(null);
          setOutrosAllocateProdutoId(null);
          setOutrosAllocateQuantidade(1);
        }}
        title="Alocar item do galpão"
        size="md"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!outrosAllocateItem || !outrosAllocateProdutoId) return;
            const ok = await handleAllocateOther(outrosAllocateItem, outrosAllocateProdutoId, outrosAllocateQuantidade);
            if (ok) {
              setOutrosAllocateModalOpen(false);
              setOutrosAllocateItem(null);
            }
          }}
          className="space-y-4"
        >
          <div className="text-sm text-white/70">
            {outrosAllocateItem ? (
              <>
                Item: <span className="text-white">{outrosAllocateItem.item}</span> (Disponível:{' '}
                <span className="text-white">{outrosAllocateItem.quantidadeDisponivel}</span>)
              </>
            ) : (
              'Selecione um item'
            )}
          </div>

          <AppSelect
            label="Produto do galpão (destino)"
            value={outrosAllocateProdutoId ?? ''}
            onChange={(value) => setOutrosAllocateProdutoId(value ? Number(value) : null)}
            placeholder="Selecionar"
            options={produtosOptions.map((p) => ({ value: p.id, label: p.nome }))}
            selectClassName="w-full"
            disabled={produtosOptionsLoading || !canEdit}
          />

          <div>
            <label className="block text-xs font-medium text-white/90 mb-1">Quantidade</label>
            <input
              type="number"
              min={1}
              max={outrosAllocateItem?.quantidadeDisponivel ?? undefined}
              value={outrosAllocateQuantidade}
              onChange={(e) => setOutrosAllocateQuantidade(Number(e.target.value) || 1)}
              className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              disabled={outrosAllocateLoading}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              className={btn.secondaryLg}
              onClick={() => {
                setOutrosAllocateModalOpen(false);
                setOutrosAllocateItem(null);
              }}
              disabled={outrosAllocateLoading}
            >
              Cancelar
            </button>
            <button type="submit" className={btn.primaryLg} disabled={outrosAllocateLoading || !outrosAllocateProdutoId || !outrosAllocateItem}>
              {outrosAllocateLoading ? 'Alocando...' : 'Alocar'}
            </button>
          </div>
        </form>
      </AppModal>

      {/* Modal: Avarias */}
      <AppModal
        open={outrosAvariaModalOpen}
        onClose={() => {
          setOutrosAvariaModalOpen(false);
          setOutrosAvariaItem(null);
          setOutrosAvariaProdutoId(null);
          setOutrosAvariaQuantidade(1);
          setOutrosAvariaJustificativa('');
          setOutrosAvarias([]);
        }}
        title="Avaria de item"
        size="md"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!outrosAvariaItem || !outrosAvariaProdutoId) return;
            const avariaItemId = outrosAvariaItem.id;
            if (!outrosAvariaJustificativa.trim()) {
              toast.error('Informe a justificativa da avaria.');
              return;
            }

            setOutrosAvariaLoading(true);
            try {
              await api.post(`/galpao/produtos/${outrosAvariaProdutoId}/outros-itens/avaria`, {
                estoqueId: outrosAvariaItem.id,
                quantidade: outrosAvariaQuantidade,
                justificativa: outrosAvariaJustificativa.trim(),
              });
              toast.success('Avaria registrada com sucesso.');
              setOutrosAvariaModalOpen(false);
              setOutrosAvariaItem(null);
              await loadOutros(outrosProdutoIdQuery);
              await loadOutrosAvarias(avariaItemId);
            } catch (err: any) {
              toast.error(formatApiError(err));
            } finally {
              setOutrosAvariaLoading(false);
            }
          }}
          className="space-y-4"
        >
          <div className="text-sm text-white/70">
            {outrosAvariaItem ? (
              <>
                Item: <span className="text-white">{outrosAvariaItem.item}</span> (Disponível:{' '}
                <span className="text-white">{outrosAvariaItem.quantidadeDisponivel}</span>)
              </>
            ) : (
              'Selecione um item'
            )}
          </div>

          <AppSelect
            label="Produto do galpão (registro)"
            value={outrosAvariaProdutoId ?? ''}
            onChange={(value) => setOutrosAvariaProdutoId(value ? Number(value) : null)}
            placeholder="Selecionar"
            options={produtosOptions.map((p) => ({ value: p.id, label: p.nome }))}
            selectClassName="w-full"
            disabled={produtosOptionsLoading || !canEdit}
          />

          <div>
            <label className="block text-xs font-medium text-white/90 mb-1">Quantidade (retira do estoque disponível)</label>
            <input
              type="number"
              min={1}
              max={outrosAvariaItem?.quantidadeDisponivel ?? undefined}
              value={outrosAvariaQuantidade}
              onChange={(e) => setOutrosAvariaQuantidade(Number(e.target.value) || 1)}
              className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              disabled={outrosAvariaLoading}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/90 mb-1">Justificativa da avaria</label>
            <textarea
              value={outrosAvariaJustificativa}
              onChange={(e) => setOutrosAvariaJustificativa(e.target.value)}
              rows={4}
              className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none"
              disabled={outrosAvariaLoading}
              placeholder="Ex.: item danificado / perda / prazo vencido..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              className={btn.secondaryLg}
              onClick={() => {
                setOutrosAvariaModalOpen(false);
                setOutrosAvariaItem(null);
              }}
              disabled={outrosAvariaLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={btn.primaryLg}
              disabled={outrosAvariaLoading || !outrosAvariaProdutoId || !outrosAvariaItem}
            >
              {outrosAvariaLoading ? 'Salvando...' : 'Registrar avaria'}
            </button>
          </div>

          {outrosAvariaItem && (
            <div className="space-y-3 pt-4 border-t border-white/10">
              <h4 className="text-sm font-semibold text-white/90">Histórico de avarias</h4>
              <DataTable<OutrosItemAvaria>
                data={outrosAvarias}
                keyExtractor={(a) => a.id}
                loading={outrosAvariasLoading}
                emptyMessage="Nenhuma avaria registrada para este item."
                paginate
                initialPageSize={10}
                columns={[
                  {
                    key: 'data',
                    label: 'Data',
                    render: (a) => (
                      <span className="text-xs text-white/70">
                        {new Date(a.dataCriacao).toLocaleString('pt-BR')}
                      </span>
                    ),
                  },
                  { key: 'qtd', label: 'Qtd', align: 'right', tdClassName: 'text-right', render: (a) => <span className="font-semibold">{a.quantidade}</span> },
                  {
                    key: 'produto',
                    label: 'Produto do galpão',
                    render: (a) => <span className="text-xs text-white/80">{a.galpaoProduto?.nome ?? '-'}</span>,
                  },
                  {
                    key: 'just',
                    label: 'Justificativa',
                    render: (a) => <span className="text-xs text-white/80 break-words">{a.justificativa}</span>,
                  },
                ]}
              />
            </div>
          )}
        </form>
      </AppModal>

      {/* Botão de dica e controle */}
      {!canEdit && (
        <p className="text-sm text-white/60">
          Seu perfil não possui permissão para movimentar estoque no Galpão.
        </p>
      )}
    </div>
  );
}

