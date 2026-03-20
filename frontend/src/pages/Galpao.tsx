import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, DataTableColumn } from '../components/DataTable';
import { api } from '../services/api';
import { useAuthStore } from '../store/auth';
import { toast, formatApiError } from '../utils/toast';
import { btn } from '../utils/buttonStyles';
import { AppModal } from '../components/ui/AppModal';
import { ConfirmDeleteByNameModal } from '../components/ui/ConfirmDeleteByNameModal';
import { AppSelect } from '../components/ui/AppSelect';
import { CollapsibleFilters } from '../components/filters/CollapsibleFilters';
import type { GalpaoProduto, LivroDisponivel, LivroDisponivelPorFornecedor } from '../types/galpao';
import type { Category } from '../types/stock';
import GalpaoProdutoDetails from './GalpaoProdutoDetails';

interface LivroAvariaRegistro {
  id: number;
  galpaoProdutoId: number | null;
  quantidade: number;
  justificativa: string;
  dataCriacao: string;
  galpaoProduto?: { id: number; nome: string } | null;
  fornecedor?: { id: number; nomeFantasia: string; razaoSocial: string } | null;
  projeto?: { id: number; nome: string } | null;
}

export default function Galpao() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [produtos, setProdutos] = useState<GalpaoProduto[]>([]);
  type MainTabKey = 'produto' | 'livros' | 'itens';
  const [activeMainTab, setActiveMainTab] = useState<MainTabKey>('produto');

  // Usado para alimentar as telas de estoque (livros/itens), que dependem
  // do `galpaoProdutoId` no backend.
  const [produtosAllForTabs, setProdutosAllForTabs] = useState<GalpaoProduto[]>([]);
  const [selectedProdutoId, setSelectedProdutoId] = useState<number | null>(null);

  const [livrosSearch, setLivrosSearch] = useState('');
  const [livrosCategoriaId, setLivrosCategoriaId] = useState<number | 'all'>('all');
  const [livrosEditoraFilter, setLivrosEditoraFilter] = useState('');
  const [livrosAvariasFilter, setLivrosAvariasFilter] = useState<'all' | 'com' | 'sem'>('all');
  const [categoriesLivros, setCategoriesLivros] = useState<Category[]>([]);
  const [livrosDisponiveis, setLivrosDisponiveis] = useState<LivroDisponivel[]>([]);
  const [livrosLoading, setLivrosLoading] = useState(false);

  const [showAlocarLivroModal, setShowAlocarLivroModal] = useState(false);
  const [livroToAlocar, setLivroToAlocar] = useState<LivroDisponivel | null>(null);
  const [livroAlocarProdutoId, setLivroAlocarProdutoId] = useState<number | null>(null);
  const [livroAlocarQuantidade, setLivroAlocarQuantidade] = useState(1);
  const [alocandoLivro, setAlocandoLivro] = useState(false);

  const [livroAlocarFornecedorId, setLivroAlocarFornecedorId] = useState<number | null>(null);
  const [livroAlocarFornecedorOptions, setLivroAlocarFornecedorOptions] = useState<
    Array<{ value: number; label: string; quantidadeDisponivel: number }>
  >([]);
  const [livroAlocarOrigemLoading, setLivroAlocarOrigemLoading] = useState(false);

  const [showAvariaLivroModal, setShowAvariaLivroModal] = useState(false);
  const [livroToAvariar, setLivroToAvariar] = useState<LivroDisponivel | null>(null);
  const [livroAvariaQuantidade, setLivroAvariaQuantidade] = useState(1);
  const [livroAvariaJustificativa, setLivroAvariaJustificativa] = useState('');
  const [avariandoLivro, setAvariandoLivro] = useState(false);
  const [livroAvarias, setLivroAvarias] = useState<LivroAvariaRegistro[]>([]);
  const [livroAvariasLoading, setLivroAvariasLoading] = useState(false);

  const [livroAvariaFornecedorId, setLivroAvariaFornecedorId] = useState<number | null>(null);
  const [livroAvariaProjetoId, setLivroAvariaProjetoId] = useState<number | null>(null);
  const [livroAvariaFornecedorOptions, setLivroAvariaFornecedorOptions] = useState<
    Array<{ value: number; label: string; quantidadeDisponivel: number }>
  >([]);
  const [livroAvariaProjetoOptions, setLivroAvariaProjetoOptions] = useState<Array<{ value: number; label: string }>>([]);
  const [livroAvariaOrigemLoading, setLivroAvariaOrigemLoading] = useState(false);
  const [showAddLivroModal, setShowAddLivroModal] = useState(false);
  const [addingLivro, setAddingLivro] = useState(false);
  const [addLivroForm, setAddLivroForm] = useState({
    isbn: '',
    nome: '',
    categoriaId: '' as number | '',
    quantidade: 1,
    valor: 1,
    desconto: 0,
    autor: '',
    editora: '',
    anoPublicacao: '',
  });

  const [showCreateEditModal, setShowCreateEditModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingProduto, setEditingProduto] = useState<GalpaoProduto | null>(null);

  const [form, setForm] = useState<{ nome: string; descricao?: string; ativo: boolean }>({
    nome: '',
    descricao: '',
    ativo: true,
  });

  const [produtoToDelete, setProdutoToDelete] = useState<GalpaoProduto | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showProdutoFilters, setShowProdutoFilters] = useState(false);
  const [showLivrosFilters, setShowLivrosFilters] = useState(false);

  const permissionKeys = useMemo(() => {
    if (!user?.cargo || typeof user.cargo === 'string') return new Set<string>();
    const permissions = Array.isArray(user.cargo.permissions) ? user.cargo.permissions : [];
    return new Set(
      permissions.map((p) => p.chave ?? `${p.modulo}:${p.acao}`),
    );
  }, [user]);

  const canEdit = permissionKeys.has('estoque:movimentar');

  async function loadProdutos() {
    setLoading(true);
    try {
      const { data } = await api.get<GalpaoProduto[]>('/galpao/produtos', {
        params: search.trim() ? { search: search.trim() } : undefined,
      });
      setProdutos(Array.isArray(data) ? data : []);
    } catch (err: any) {
      const message = formatApiError(err);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProdutos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carrega 1x a lista completa apenas para as abas
  useEffect(() => {
    async function loadProdutosAllForTabs() {
      try {
        const { data } = await api.get<GalpaoProduto[]>('/galpao/produtos');
        const list = Array.isArray(data) ? data : [];
        setProdutosAllForTabs(list);
        setSelectedProdutoId(list[0]?.id ?? null);
      } catch {
        setProdutosAllForTabs([]);
        setSelectedProdutoId(null);
      }
    }
    void loadProdutosAllForTabs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadProdutos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function loadLivrosDisponiveis() {
    setLivrosLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (livrosSearch.trim()) params.search = livrosSearch.trim();
      if (livrosCategoriaId !== 'all') params.categoriaId = livrosCategoriaId;
      const { data } = await api.get<LivroDisponivel[]>('/galpao/livros-disponiveis', { params });
      setLivrosDisponiveis(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(formatApiError(err));
    } finally {
      setLivrosLoading(false);
    }
  }

  async function loadCategoriasLivros() {
    try {
      const { data } = await api.get<Category[]>('/categories/all?tipo=LIVRO');
      setCategoriesLivros(Array.isArray(data) ? data : []);
    } catch {
      setCategoriesLivros([]);
    }
  }

  useEffect(() => {
    if (activeMainTab === 'livros') {
      void loadCategoriasLivros();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMainTab]);

  useEffect(() => {
    if (activeMainTab !== 'livros') return;
    const timeoutId = window.setTimeout(() => {
      void loadLivrosDisponiveis();
    }, 300);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMainTab, livrosSearch, livrosCategoriaId]);

  const columns: DataTableColumn<GalpaoProduto>[] = [
    {
      key: 'nome',
      label: 'Produto',
      render: (p) => <span className="font-medium">{p.nome}</span>,
    },
    {
      key: 'ativo',
      label: 'Status',
      render: (p) => (
        <span
          className={`px-2 py-0.5 rounded text-xs font-semibold border ${
            p.ativo ? 'bg-success/20 text-success border-success/30' : 'bg-danger/20 text-danger border-danger/30'
          }`}
        >
          {p.ativo ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
    {
      key: 'acoes',
      label: 'Ações',
      align: 'right',
      stopRowClick: true,
      render: (p) => (
        <div className="flex items-center justify-end gap-2">
          <button type="button" className={btn.primarySoft} onClick={() => navigate(`/galpao/${p.id}`)}>
            Detalhes
          </button>
          {canEdit && (
            <>
              <button
                type="button"
                className={btn.editSm}
                onClick={() => {
                  setModalMode('edit');
                  setEditingProduto(p);
                  setForm({ nome: p.nome, descricao: p.descricao ?? '', ativo: p.ativo });
                  setShowCreateEditModal(true);
                }}
              >
                Editar
              </button>
              <button
                type="button"
                className={btn.dangerSm}
                onClick={() => {
                  setProdutoToDelete(p);
                  setDeleteConfirmName('');
                  setDeleteError(null);
                }}
              >
                Excluir
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const livrosColumns: DataTableColumn<LivroDisponivel>[] = [
    { key: 'isbn', label: 'ISBN', render: (r) => <span className="font-mono text-xs">{r.isbn}</span> },
    { key: 'nome', label: 'Título', render: (r) => <span className="font-medium">{r.nome}</span> },
    { key: 'categoria', label: 'Gênero', render: (r) => <span>{r.categoriaNome ?? '-'}</span> },
    { key: 'autor', label: 'Autor', render: (r) => <span className="text-xs text-white/80">{r.autor ?? '-'}</span> },
    { key: 'editora', label: 'Editora', render: (r) => <span className="text-xs text-white/80">{r.editora ?? '-'}</span> },
    {
      key: 'qtd',
      label: 'Qtd disponível',
      align: 'right',
      tdClassName: 'text-right',
      render: (r) => <span className="font-semibold">{r.quantidadeDisponivel}</span>,
    },
    {
      key: 'alocados',
      label: 'Alocados',
      align: 'right',
      tdClassName: 'text-right',
      render: (r) => <span className="font-semibold text-sky-300">{r.quantidadeReservadaTotal ?? 0}</span>,
    },
    {
      key: 'avarias',
      label: 'Avarias',
      align: 'right',
      tdClassName: 'text-right',
      render: (r) => <span className="font-semibold text-amber-300">{r.quantidadeAvariasTotal ?? 0}</span>,
    },
    {
      key: 'acoes',
      label: 'Ações',
      align: 'right',
      stopRowClick: true,
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className={btn.primarySm}
            disabled={!canEdit}
            onClick={() => {
              setLivroToAlocar(r);
              setLivroAlocarProdutoId(selectedProdutoId ?? produtosAllForTabs[0]?.id ?? null);
              setLivroAlocarQuantidade(1);
              setLivroAlocarFornecedorId(null);
              setLivroAlocarFornecedorOptions([]);
              setShowAlocarLivroModal(true);
              void loadAlocarLivroFornecedorOptions(r);
            }}
          >
            Alocar
          </button>
          <button
            type="button"
            className={btn.warningSm}
            disabled={!canEdit}
            onClick={() => {
              setLivroToAvariar(r);
              setLivroAvariaQuantidade(1);
              setLivroAvariaJustificativa('');
              setLivroAvariaFornecedorId(null);
              setLivroAvariaProjetoId(null);
              setLivroAvariaFornecedorOptions([]);
              setLivroAvariaProjetoOptions([]);
              setShowAvariaLivroModal(true);
              void loadAvariasLivro(r);
              void loadAvariaLivroOrigemOptions(r);
            }}
          >
            Avarias
          </button>
          <button
            type="button"
            className={btn.dangerSm}
            disabled={!canEdit}
            onClick={() => void handleDeleteLivroCadastro(r)}
          >
            Excluir
          </button>
        </div>
      ),
    },
  ];

  const filteredLivrosDisponiveis = useMemo(() => {
    const editoraTerm = livrosEditoraFilter.trim().toLowerCase();
    return livrosDisponiveis.filter((r) => {
      const matchesEditora =
        !editoraTerm || (r.editora ?? '').toLowerCase().includes(editoraTerm);
      const avarias = r.quantidadeAvariasTotal ?? 0;
      const matchesAvarias =
        livrosAvariasFilter === 'all' ||
        (livrosAvariasFilter === 'com' ? avarias > 0 : avarias === 0);
      return matchesEditora && matchesAvarias;
    });
  }, [livrosDisponiveis, livrosEditoraFilter, livrosAvariasFilter]);

  async function handleDeleteLivroCadastro(row: LivroDisponivel) {
    if (!canEdit) return;
    const ok = window.confirm(`Excluir do estoque o livro "${row.nome}" (ISBN ${row.isbn})?`);
    if (!ok) return;
    try {
      await api.delete(`/galpao/livros-disponiveis/${encodeURIComponent(row.isbn)}`, {
        params: row.categoriaId != null ? { categoriaId: row.categoriaId } : undefined,
      });
      toast.success('Cadastro de livro removido do estoque.');
      await loadLivrosDisponiveis();
    } catch (err: any) {
      toast.error(formatApiError(err));
    }
  }

  async function handleAddLivroToStock() {
    if (!canEdit) return;
    if (!selectedProdutoId) {
      toast.error('Selecione um produto do galpão para registrar a entrada do livro.');
      return;
    }
    if (!addLivroForm.isbn.trim()) {
      toast.error('Informe o ISBN.');
      return;
    }
    if (addLivroForm.quantidade < 1) {
      toast.error('Quantidade inválida.');
      return;
    }
    if (addLivroForm.valor < 0) {
      toast.error('Valor inválido.');
      return;
    }
    setAddingLivro(true);
    try {
      await api.post(`/galpao/produtos/${selectedProdutoId}/livros/entrada`, {
        isbn: addLivroForm.isbn.trim(),
        nome: addLivroForm.nome.trim() || undefined,
        categoriaId: addLivroForm.categoriaId || undefined,
        quantidade: addLivroForm.quantidade,
        valor: addLivroForm.valor,
        desconto: addLivroForm.desconto > 0 ? addLivroForm.desconto : undefined,
        autor: addLivroForm.autor.trim() || undefined,
        editora: addLivroForm.editora.trim() || undefined,
        anoPublicacao: addLivroForm.anoPublicacao.trim() || undefined,
      });
      toast.success('Livro adicionado ao estoque com sucesso!');
      setShowAddLivroModal(false);
      setAddLivroForm({
        isbn: '',
        nome: '',
        categoriaId: '',
        quantidade: 1,
        valor: 1,
        desconto: 0,
        autor: '',
        editora: '',
        anoPublicacao: '',
      });
      await loadLivrosDisponiveis();
    } catch (err: any) {
      toast.error(formatApiError(err));
    } finally {
      setAddingLivro(false);
    }
  }

  async function handleSubmit() {
    if (!canEdit) return;
    const nome = form.nome.trim();
    if (!nome) {
      toast.error('Informe o nome do produto.');
      return;
    }

    try {
      if (modalMode === 'create') {
        await api.post('/galpao/produtos', { nome, descricao: form.descricao?.trim() || undefined, ativo: form.ativo });
        toast.success('Produto criado com sucesso!');
      } else if (modalMode === 'edit' && editingProduto) {
        await api.patch(`/galpao/produtos/${editingProduto.id}`, {
          nome,
          descricao: form.descricao?.trim() || undefined,
          ativo: form.ativo,
        });
        toast.success('Produto atualizado com sucesso!');
      }
      setShowCreateEditModal(false);
      setEditingProduto(null);
      setForm({ nome: '', descricao: '', ativo: true });
      await loadProdutos();
    } catch (err: any) {
      toast.error(formatApiError(err));
    }
  }

  async function handleConfirmAlocarLivro() {
    if (!livroToAlocar || !livroAlocarProdutoId) return;
    if (livroAlocarQuantidade < 1) {
      toast.error('Quantidade inválida.');
      return;
    }

    if (livroAlocarFornecedorId == null) {
      toast.error('Selecione o fornecedor do estoque.');
      return;
    }

    const maxPorFornecedor =
      livroAlocarFornecedorOptions.find((o) => o.value === livroAlocarFornecedorId)?.quantidadeDisponivel ?? 0;

    if (livroAlocarQuantidade > maxPorFornecedor) {
      toast.error('Quantidade excede o disponível para o fornecedor selecionado.');
      return;
    }

    setAlocandoLivro(true);
    try {
      await api.post(`/galpao/produtos/${livroAlocarProdutoId}/livros/alocar`, {
        isbn: livroToAlocar.isbn,
        categoriaId: livroToAlocar.categoriaId ?? undefined,
        quantidade: livroAlocarQuantidade,
        fornecedorId: livroAlocarFornecedorId,
      });
      toast.success('Livro alocado com sucesso!');
      setSelectedProdutoId(livroAlocarProdutoId);
      setShowAlocarLivroModal(false);
      setLivroToAlocar(null);
      setLivroAlocarFornecedorId(null);
      setLivroAlocarFornecedorOptions([]);
      await loadLivrosDisponiveis();
    } catch (err: any) {
      toast.error(formatApiError(err));
    } finally {
      setAlocandoLivro(false);
    }
  }

  async function loadAlocarLivroFornecedorOptions(livro: LivroDisponivel) {
    setLivroAlocarOrigemLoading(true);
    try {
      const params: Record<string, string | number> = {
        isbn: livro.isbn,
      };
      if (livro.categoriaId != null) params.categoriaId = livro.categoriaId;

      const { data } = await api.get<LivroDisponivelPorFornecedor[]>(
        '/galpao/livros-disponiveis-por-fornecedor',
        { params },
      );

      const supplierOptions = Array.isArray(data) ? data : [];

      setLivroAlocarFornecedorOptions(
        supplierOptions.map((s) => ({
          value: s.fornecedorId,
          label: `${s.fornecedorNome} (disponível: ${s.quantidadeDisponivel})`,
          quantidadeDisponivel: s.quantidadeDisponivel,
        })),
      );

      setLivroAlocarFornecedorId(supplierOptions.length === 1 ? supplierOptions[0].fornecedorId : null);
    } catch (err: any) {
      toast.error(formatApiError(err));
      setLivroAlocarFornecedorOptions([]);
      setLivroAlocarFornecedorId(null);
    } finally {
      setLivroAlocarOrigemLoading(false);
    }
  }

  async function loadAvariasLivro(livro: LivroDisponivel) {
    setLivroAvariasLoading(true);
    try {
      const params: Record<string, string | number> = {
        isbn: livro.isbn,
      };
      if (livro.categoriaId != null) {
        params.categoriaId = livro.categoriaId;
      }
      const { data } = await api.get<LivroAvariaRegistro[]>('/galpao/livros/avarias', { params });
      setLivroAvarias(Array.isArray(data) ? data : []);
    } catch {
      setLivroAvarias([]);
    } finally {
      setLivroAvariasLoading(false);
    }
  }

  async function loadAvariaLivroOrigemOptions(livro: LivroDisponivel) {
    setLivroAvariaOrigemLoading(true);
    try {
      const categoriaId = livro.categoriaId ?? null;

      // 1) Fornecedores com quantidade disponível (respeitando reservas atuais)
      const supplierParams: Record<string, string | number> = { isbn: livro.isbn };
      if (categoriaId !== null) supplierParams.categoriaId = categoriaId;

      const { data: suppliersData } = await api.get<LivroDisponivelPorFornecedor[]>(
        `/galpao/livros-disponiveis-por-fornecedor`,
        { params: supplierParams },
      );

      const supplierOptions = Array.isArray(suppliersData) ? suppliersData : [];

      // 2) Projetos: a partir das cotações (pra mostrar o "projeto alocado")
      type CotacaoOrigem = {
        projetoId: number | null;
        projetoNome: string | null;
        categoriaId: number | null;
      };

      const { data: cotacoesData } = await api.get<CotacaoOrigem[]>(
        `/curadoria/estoque/${encodeURIComponent(livro.isbn)}/cotacoes`,
      );

      const cotacoes = Array.isArray(cotacoesData) ? cotacoesData : [];
      const filtered = cotacoes.filter((q) => (q.categoriaId ?? null) === (categoriaId ?? null));

      const projetoMap = new Map<number, string>();
      for (const q of filtered) {
        if (q.projetoId != null) projetoMap.set(q.projetoId, q.projetoNome ?? 'Projeto');
      }

      const projetoOptions = Array.from(projetoMap.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([value, label]) => ({ value, label }));

      setLivroAvariaFornecedorOptions(
        supplierOptions.map((s) => ({
          value: s.fornecedorId,
          label: `${s.fornecedorNome} (disponível: ${s.quantidadeDisponivel})`,
          quantidadeDisponivel: s.quantidadeDisponivel,
        })),
      );
      setLivroAvariaProjetoOptions(projetoOptions);

      setLivroAvariaFornecedorId(supplierOptions.length === 1 ? supplierOptions[0].fornecedorId : null);
      setLivroAvariaProjetoId(projetoOptions.length === 1 ? projetoOptions[0].value : null);
    } catch (err: any) {
      toast.error(formatApiError(err));
      setLivroAvariaFornecedorOptions([]);
      setLivroAvariaProjetoOptions([]);
      setLivroAvariaFornecedorId(null);
      setLivroAvariaProjetoId(null);
    } finally {
      setLivroAvariaOrigemLoading(false);
    }
  }

  async function handleConfirmAvariaLivro() {
    if (!livroToAvariar) return;
    if (livroAvariaQuantidade < 1) {
      toast.error('Quantidade inválida.');
      return;
    }

    const maxPorFornecedor =
      livroAvariaFornecedorId != null
        ? livroAvariaFornecedorOptions.find((o) => o.value === livroAvariaFornecedorId)?.quantidadeDisponivel ?? 0
        : 0;
    if (!livroAvariaJustificativa.trim()) {
      toast.error('Informe a justificativa da avaria.');
      return;
    }

    if (livroAvariaFornecedorOptions.length > 0 && livroAvariaFornecedorId == null) {
      toast.error('Selecione o fornecedor da avaria.');
      return;
    }

    if (livroAvariaProjetoOptions.length > 0 && livroAvariaProjetoId == null) {
      toast.error('Selecione o projeto da avaria.');
      return;
    }

    if (livroAvariaFornecedorId != null && livroAvariaQuantidade > maxPorFornecedor) {
      toast.error('Quantidade excede o disponível para o fornecedor selecionado.');
      return;
    }

    setAvariandoLivro(true);
    try {
      await api.post(`/galpao/livros/avaria`, {
        isbn: livroToAvariar.isbn,
        categoriaId: livroToAvariar.categoriaId ?? undefined,
        quantidade: livroAvariaQuantidade,
        justificativa: livroAvariaJustificativa.trim(),
        fornecedorId: livroAvariaFornecedorId ?? undefined,
        projetoId: livroAvariaProjetoId ?? undefined,
      });
      toast.success('Avaria de livro registrada com sucesso!');
      await loadLivrosDisponiveis();
      await loadAvariasLivro(livroToAvariar);
      setLivroAvariaQuantidade(1);
      setLivroAvariaJustificativa('');
      setLivroAvariaFornecedorId(null);
      setLivroAvariaProjetoId(null);
    } catch (err: any) {
      toast.error(formatApiError(err));
    } finally {
      setAvariandoLivro(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {canEdit && activeMainTab === 'produto' && (
          <button
            type="button"
            className={btn.primary}
            onClick={() => {
              setModalMode('create');
              setEditingProduto(null);
              setForm({ nome: '', descricao: '', ativo: true });
              setShowCreateEditModal(true);
            }}
          >
            Novo produto
          </button>
        )}
      </div>

      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="flex border-b border-white/10">
          <button
            type="button"
            onClick={() => setActiveMainTab('produto')}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors ${
              activeMainTab === 'produto'
                ? 'bg-primary text-white border-b-2 border-primary'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            Produto
          </button>
          <button
            type="button"
            onClick={() => setActiveMainTab('livros')}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors ${
              activeMainTab === 'livros'
                ? 'bg-primary text-white border-b-2 border-primary'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            Estoque de livros
          </button>
          <button
            type="button"
            onClick={() => setActiveMainTab('itens')}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors ${
              activeMainTab === 'itens'
                ? 'bg-primary text-white border-b-2 border-primary'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            Estoque de itens
          </button>
        </div>
      </div>

      {activeMainTab === 'produto' && (
        <>
          <CollapsibleFilters
            show={showProdutoFilters}
            setShow={setShowProdutoFilters}
            hasActiveFilters={search.trim().length > 0}
            title="Busca e filtros"
            badgeText="Ativo"
            onClear={() => setSearch('')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-white/90 mb-1">Buscar</label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar produto por nome ou descrição..."
                  className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <div className="text-xs text-white/60 flex items-end">
                {loading ? 'Carregando...' : `${produtos.length} produto(s)`}
              </div>
            </div>
          </CollapsibleFilters>

          <DataTable<GalpaoProduto>
            data={produtos}
            columns={columns}
            keyExtractor={(p) => p.id}
            loading={loading}
            emptyMessage="Nenhum produto encontrado."
            paginate
            initialPageSize={20}
            renderMobileCard={(p) => (
              <div className="bg-neutral/60 border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{p.nome}</p>
                    {p.descricao && <p className="text-xs text-white/60 mt-0.5">{p.descricao}</p>}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                      p.ativo ? 'bg-success/20 text-success border-success/30' : 'bg-danger/20 text-danger border-danger/30'
                    }`}
                  >
                    {p.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                  <button type="button" className={btn.primarySoft} onClick={() => navigate(`/galpao/${p.id}`)}>
                    Detalhes
                  </button>
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        className={btn.editSm}
                        onClick={() => {
                          setModalMode('edit');
                          setEditingProduto(p);
                          setForm({ nome: p.nome, descricao: p.descricao ?? '', ativo: p.ativo });
                          setShowCreateEditModal(true);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={btn.dangerSm}
                        onClick={() => {
                          setProdutoToDelete(p);
                          setDeleteConfirmName('');
                          setDeleteError(null);
                        }}
                      >
                        Excluir
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          />
        </>
      )}

      {activeMainTab === 'livros' && (
        <div className="pt-1 space-y-4">
          {canEdit && (
            <div className="flex justify-end">
              <button type="button" className={btn.primary} onClick={() => setShowAddLivroModal(true)}>
                Adicionar livro
              </button>
            </div>
          )}

          <CollapsibleFilters
            show={showLivrosFilters}
            setShow={setShowLivrosFilters}
            hasActiveFilters={
              livrosSearch.trim().length > 0 ||
              livrosCategoriaId !== 'all' ||
              selectedProdutoId != null ||
              livrosEditoraFilter.trim().length > 0 ||
              livrosAvariasFilter !== 'all'
            }
            title="Busca e filtros"
            badgeText="Ativo"
            onClear={() => {
              setSelectedProdutoId(null);
              setLivrosSearch('');
              setLivrosCategoriaId('all');
              setLivrosEditoraFilter('');
              setLivrosAvariasFilter('all');
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <AppSelect
                label="Produto do galpão (destino)"
                value={selectedProdutoId ?? ''}
                onChange={(value) => setSelectedProdutoId(value ? Number(value) : null)}
                placeholder="Selecionar"
                options={produtosAllForTabs.map((p) => ({ value: p.id, label: p.nome }))}
                selectClassName="w-full"
              />
              <div>
                <label className="block text-xs font-medium text-white/90 mb-1">Buscar</label>
                <input
                  type="text"
                  value={livrosSearch}
                  onChange={(e) => setLivrosSearch(e.target.value)}
                  placeholder="ISBN, título, gênero, autor..."
                  className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <AppSelect
                label="Gênero"
                value={livrosCategoriaId === 'all' ? '' : livrosCategoriaId}
                onChange={(value) => setLivrosCategoriaId(value ? Number(value) : 'all')}
                placeholder="Todos"
                options={categoriesLivros.map((c) => ({ value: c.id, label: c.nome }))}
                selectClassName="w-full"
              />
              <div>
                <label className="block text-xs font-medium text-white/90 mb-1">Editora</label>
                <input
                  type="text"
                  value={livrosEditoraFilter}
                  onChange={(e) => setLivrosEditoraFilter(e.target.value)}
                  placeholder="Filtrar por editora..."
                  className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <AppSelect
                label="Avarias"
                value={livrosAvariasFilter}
                onChange={(value) => setLivrosAvariasFilter((value as 'all' | 'com' | 'sem') || 'all')}
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'com', label: 'Com avarias' },
                  { value: 'sem', label: 'Sem avarias' },
                ]}
                selectClassName="w-full"
              />
            </div>
          </CollapsibleFilters>

          <DataTable<LivroDisponivel>
            data={filteredLivrosDisponiveis}
            columns={livrosColumns}
            keyExtractor={(r) => `${r.isbn}::${r.categoriaId ?? 'null'}`}
            loading={livrosLoading}
            emptyMessage="Nenhum livro disponível."
            paginate
            initialPageSize={20}
            renderMobileCard={(r) => (
              <div className="bg-neutral/60 border border-white/10 rounded-xl p-4 space-y-3">
                <div>
                  <p className="font-semibold text-white">{r.nome}</p>
                  <p className="text-xs text-white/60 mt-0.5">{r.isbn}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-white/50">Gênero:</span> <span className="text-white/80">{r.categoriaNome ?? '-'}</span>
                  </div>
                  <div>
                    <span className="text-white/50">Autor:</span> <span className="text-white/80">{r.autor ?? '-'}</span>
                  </div>
                  <div>
                    <span className="text-white/50">Editora:</span> <span className="text-white/80">{r.editora ?? '-'}</span>
                  </div>
                  <div>
                    <span className="text-white/50">Disponível:</span> <span className="font-semibold text-white">{r.quantidadeDisponivel}</span>
                  </div>
                  <div>
                    <span className="text-white/50">Alocados:</span>{' '}
                    <span className="font-semibold text-sky-300">{r.quantidadeReservadaTotal ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-white/50">Avarias:</span> <span className="font-semibold text-amber-300">{r.quantidadeAvariasTotal ?? 0}</span>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    className={btn.primarySm}
                    disabled={!canEdit}
                    onClick={() => {
                      setLivroToAlocar(r);
                      setLivroAlocarProdutoId(selectedProdutoId ?? produtosAllForTabs[0]?.id ?? null);
                      setLivroAlocarQuantidade(1);
                      setLivroAlocarFornecedorId(null);
                      setLivroAlocarFornecedorOptions([]);
                      setShowAlocarLivroModal(true);
                      void loadAlocarLivroFornecedorOptions(r);
                    }}
                  >
                    Alocar
                  </button>
                  <button
                    type="button"
                    className={btn.warningSm}
                    disabled={!canEdit}
                    onClick={() => {
                      setLivroToAvariar(r);
                      setLivroAvariaQuantidade(1);
                      setLivroAvariaJustificativa('');
                      setLivroAvariaFornecedorId(null);
                      setLivroAvariaProjetoId(null);
                      setLivroAvariaFornecedorOptions([]);
                      setLivroAvariaProjetoOptions([]);
                      setShowAvariaLivroModal(true);
                      void loadAvariasLivro(r);
                      void loadAvariaLivroOrigemOptions(r);
                    }}
                  >
                    Avarias
                  </button>
                  <button
                    type="button"
                    className={btn.dangerSm}
                    disabled={!canEdit}
                    onClick={() => void handleDeleteLivroCadastro(r)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            )}
          />
        </div>
      )}

      {activeMainTab === 'itens' && (
        <div className="pt-1 space-y-4">
          {produtosAllForTabs.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="w-full sm:w-72">
                <AppSelect
                  label="Produto do galpão (opcional)"
                  value={selectedProdutoId ?? ''}
                  onChange={(value) => setSelectedProdutoId(Number(value))}
                  placeholder="Selecionar"
                  options={produtosAllForTabs.map((p) => ({ value: p.id, label: p.nome }))}
                  selectClassName="w-full"
                />
              </div>
              <div className="text-sm text-white/60">Controle de itens</div>
            </div>
          )}

          {produtosAllForTabs.length === 0 && (
            <div className="text-sm text-white/60">
              Você pode visualizar o estoque disponível mesmo sem criar um “produto do galpão”. Para
              reservar/baixar/alocar, crie um produto depois.
            </div>
          )}

          <GalpaoProdutoDetails
            produtoIdOverride={selectedProdutoId}
            showBackButton={false}
            initialFiltersOpen={false}
            showLivroValorTotal={false}
            forcedTab="outros"
            showSubTabs={false}
          />
        </div>
      )}

      <AppModal
        open={showAddLivroModal}
        onClose={() => setShowAddLivroModal(false)}
        title="Adicionar livro ao estoque"
        size="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleAddLivroToStock();
          }}
          className="space-y-4"
        >
          <AppSelect
            label="Produto do galpão (destino da entrada)"
            value={selectedProdutoId ?? ''}
            onChange={(value) => setSelectedProdutoId(value ? Number(value) : null)}
            placeholder="Selecionar"
            options={produtosAllForTabs.map((p) => ({ value: p.id, label: p.nome }))}
            selectClassName="w-full"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/90 mb-1">ISBN</label>
              <input
                value={addLivroForm.isbn}
                onChange={(e) => setAddLivroForm((prev) => ({ ...prev, isbn: e.target.value }))}
                className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/90 mb-1">Título (opcional)</label>
              <input
                value={addLivroForm.nome}
                onChange={(e) => setAddLivroForm((prev) => ({ ...prev, nome: e.target.value }))}
                className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <AppSelect
              label="Gênero (opcional)"
              value={addLivroForm.categoriaId}
              onChange={(value) => setAddLivroForm((prev) => ({ ...prev, categoriaId: value ? Number(value) : '' }))}
              placeholder="Sem gênero"
              options={categoriesLivros.map((c) => ({ value: c.id, label: c.nome }))}
              selectClassName="w-full"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/90 mb-1">Quantidade</label>
              <input
                type="number"
                min={1}
                value={addLivroForm.quantidade}
                onChange={(e) => setAddLivroForm((prev) => ({ ...prev, quantidade: Number(e.target.value) || 1 }))}
                className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/90 mb-1">Valor unitário (R$)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={addLivroForm.valor}
                onChange={(e) => setAddLivroForm((prev) => ({ ...prev, valor: Number(e.target.value) || 0 }))}
                className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/90 mb-1">Desconto (R$)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={addLivroForm.desconto}
                onChange={(e) => setAddLivroForm((prev) => ({ ...prev, desconto: Number(e.target.value) || 0 }))}
                className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/90 mb-1">Autor</label>
              <input
                value={addLivroForm.autor}
                onChange={(e) => setAddLivroForm((prev) => ({ ...prev, autor: e.target.value }))}
                className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/90 mb-1">Editora</label>
              <input
                value={addLivroForm.editora}
                onChange={(e) => setAddLivroForm((prev) => ({ ...prev, editora: e.target.value }))}
                className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/90 mb-1">Ano</label>
              <input
                value={addLivroForm.anoPublicacao}
                onChange={(e) => setAddLivroForm((prev) => ({ ...prev, anoPublicacao: e.target.value }))}
                className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button type="button" className={btn.secondaryLg} onClick={() => setShowAddLivroModal(false)} disabled={addingLivro}>
              Cancelar
            </button>
            <button type="submit" className={btn.primaryLg} disabled={addingLivro}>
              {addingLivro ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      </AppModal>

      <AppModal
        open={showAlocarLivroModal}
        onClose={() => {
          setShowAlocarLivroModal(false);
          setLivroToAlocar(null);
          setLivroAlocarQuantidade(1);
          setLivroAlocarFornecedorId(null);
          setLivroAlocarFornecedorOptions([]);
        }}
        title="Alocar livro"
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleConfirmAlocarLivro();
          }}
          className="space-y-4"
        >
          <div className="text-sm text-white/70">
            {livroToAlocar ? (
              <>
                Livro: <span className="text-white">{livroToAlocar.nome}</span> ({livroToAlocar.isbn})
              </>
            ) : (
              'Selecione um livro'
            )}
          </div>
          <AppSelect
            label="Produto do galpão"
            value={livroAlocarProdutoId ?? ''}
            onChange={(value) => setLivroAlocarProdutoId(value ? Number(value) : null)}
            placeholder="Selecionar"
            options={produtosAllForTabs.map((p) => ({ value: p.id, label: p.nome }))}
            selectClassName="w-full"
          />

          <AppSelect
            label="Fornecedor (origem do estoque)"
            value={livroAlocarFornecedorId ?? ''}
            onChange={(value) => setLivroAlocarFornecedorId(value ? Number(value) : null)}
            placeholder={livroAlocarFornecedorOptions.length ? 'Selecionar' : 'Sem opções'}
            options={livroAlocarFornecedorOptions}
            disabled={alocandoLivro || livroAlocarOrigemLoading}
            selectClassName="w-full"
          />
          <div className="rounded-md border border-white/10 bg-white/5 p-3 text-xs">
            <p className="text-white/70 mb-2">Disponível por fornecedor</p>
            {livroAlocarFornecedorOptions.length === 0 ? (
              <p className="text-white/50">Nenhum fornecedor com saldo disponível para este livro.</p>
            ) : (
              <div className="space-y-1">
                {livroAlocarFornecedorOptions.map((opt) => (
                  <div key={opt.value} className="flex items-center justify-between gap-2">
                    <span className="text-white/80 truncate">{opt.label.split(' (disponível:')[0]}</span>
                    <span className="font-semibold text-emerald-300">{opt.quantidadeDisponivel}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-white/90 mb-1">Quantidade</label>
            <input
              type="number"
              min={1}
              max={
                livroAlocarFornecedorId != null
                  ? livroAlocarFornecedorOptions.find((o) => o.value === livroAlocarFornecedorId)
                      ?.quantidadeDisponivel ?? undefined
                  : livroToAlocar?.quantidadeDisponivel ?? undefined
              }
              value={livroAlocarQuantidade}
              onChange={(e) => setLivroAlocarQuantidade(Number(e.target.value) || 1)}
              className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              disabled={alocandoLivro}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button type="button" className={btn.secondaryLg} onClick={() => setShowAlocarLivroModal(false)} disabled={alocandoLivro}>
              Cancelar
            </button>
            <button
              type="submit"
              className={btn.primaryLg}
              disabled={
                alocandoLivro || livroAlocarOrigemLoading || !livroAlocarProdutoId || !livroToAlocar || livroAlocarFornecedorId == null
              }
            >
              {alocandoLivro ? 'Alocando...' : 'Alocar'}
            </button>
          </div>
        </form>
      </AppModal>

      <AppModal
        open={showAvariaLivroModal}
        onClose={() => {
          setShowAvariaLivroModal(false);
          setLivroToAvariar(null);
          setLivroAvariaQuantidade(1);
          setLivroAvariaJustificativa('');
          setLivroAvarias([]);
          setLivroAvariaFornecedorId(null);
          setLivroAvariaProjetoId(null);
          setLivroAvariaFornecedorOptions([]);
          setLivroAvariaProjetoOptions([]);
          setLivroAvariaOrigemLoading(false);
        }}
        title="Avaria de livro"
        size="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleConfirmAvariaLivro();
          }}
          className="space-y-4"
        >
          <div className="text-sm text-white/70">
            {livroToAvariar ? (
              <>
                Livro: <span className="text-white">{livroToAvariar.nome}</span> ({livroToAvariar.isbn})
              </>
            ) : (
              'Selecione um livro'
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/90 mb-1">Quantidade</label>
              <input
                type="number"
                min={1}
                max={
                  livroAvariaFornecedorId != null
                    ? livroAvariaFornecedorOptions.find((o) => o.value === livroAvariaFornecedorId)
                        ?.quantidadeDisponivel ?? undefined
                    : livroToAvariar?.quantidadeDisponivel ?? undefined
                }
                value={livroAvariaQuantidade}
                onChange={(e) => setLivroAvariaQuantidade(Number(e.target.value) || 1)}
                className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                disabled={avariandoLivro}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/90 mb-1">Justificativa</label>
            <textarea
              rows={3}
              value={livroAvariaJustificativa}
              onChange={(e) => setLivroAvariaJustificativa(e.target.value)}
              className="w-full bg-neutral border border-white/30 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none"
              placeholder="Descreva o motivo da avaria"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <AppSelect
              label="Fornecedor (origem da avaria)"
              value={livroAvariaFornecedorId ?? ''}
              onChange={(value) => setLivroAvariaFornecedorId(value ? Number(value) : null)}
              placeholder={livroAvariaFornecedorOptions.length ? 'Selecionar' : 'Sem opções'}
              options={livroAvariaFornecedorOptions}
              disabled={avariandoLivro || livroAvariaOrigemLoading}
              selectClassName="w-full"
            />
            <AppSelect
              label="Projeto (alocação)"
              value={livroAvariaProjetoId ?? ''}
              onChange={(value) => setLivroAvariaProjetoId(value ? Number(value) : null)}
              placeholder={livroAvariaProjetoOptions.length ? 'Selecionar' : 'Sem opções'}
              options={livroAvariaProjetoOptions}
              disabled={avariandoLivro || livroAvariaOrigemLoading}
              selectClassName="w-full"
            />
          </div>
          <div className="rounded-md border border-white/10 bg-white/5 p-3 text-xs">
            <p className="text-white/70 mb-2">Saldo por fornecedor (base para avaria/alocação)</p>
            {livroAvariaFornecedorOptions.length === 0 ? (
              <p className="text-white/50">Nenhum fornecedor com saldo disponível para este livro.</p>
            ) : (
              <div className="space-y-1">
                {livroAvariaFornecedorOptions.map((opt) => (
                  <div key={opt.value} className="flex items-center justify-between gap-2">
                    <span className="text-white/80 truncate">{opt.label.split(' (disponível:')[0]}</span>
                    <span className="font-semibold text-emerald-300">{opt.quantidadeDisponivel}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button type="button" className={btn.secondaryLg} onClick={() => setShowAvariaLivroModal(false)} disabled={avariandoLivro}>
              Cancelar
            </button>
            <button type="submit" className={btn.primaryLg} disabled={avariandoLivro || livroAvariaOrigemLoading || !livroToAvariar}>
              {avariandoLivro ? 'Registrando...' : 'Registrar avaria'}
            </button>
          </div>

          <div className="pt-3 border-t border-white/10 space-y-2">
            <h4 className="text-sm font-semibold text-white/90">Histórico de avarias</h4>
            <DataTable<LivroAvariaRegistro>
              data={livroAvarias}
              keyExtractor={(a) => a.id}
              loading={livroAvariasLoading}
              emptyMessage="Nenhuma avaria registrada para este livro."
              paginate
              initialPageSize={10}
              columns={[
                {
                  key: 'data',
                  label: 'Data',
                  render: (a) => <span className="text-xs text-white/70">{new Date(a.dataCriacao).toLocaleString('pt-BR')}</span>,
                },
                { key: 'qtd', label: 'Qtd', align: 'right', tdClassName: 'text-right', render: (a) => <span className="font-semibold">{a.quantidade}</span> },
                { key: 'produto', label: 'Produto', render: (a) => <span className="text-xs">{a.galpaoProduto?.nome ?? '-'}</span> },
                {
                  key: 'projeto',
                  label: 'Projeto',
                  render: (a) => <span className="text-xs">{a.projeto?.nome ?? '-'}</span>,
                },
                {
                  key: 'fornecedor',
                  label: 'Fornecedor',
                  render: (a) => (
                    <span className="text-xs">
                      {a.fornecedor?.nomeFantasia ?? a.fornecedor?.razaoSocial ?? '-'}
                    </span>
                  ),
                },
                { key: 'just', label: 'Justificativa', render: (a) => <span className="text-xs break-words">{a.justificativa}</span> },
              ]}
              renderMobileCard={(a) => (
                <div className="bg-neutral/60 border border-white/10 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/70">{new Date(a.dataCriacao).toLocaleString('pt-BR')}</span>
                    <span className="font-semibold text-white">Qtd: {a.quantidade}</span>
                  </div>
                  <div className="text-xs text-white/80">Produto: {a.galpaoProduto?.nome ?? '-'}</div>
                  <div className="text-xs text-white/80">Projeto: {a.projeto?.nome ?? '-'}</div>
                  <div className="text-xs text-white/80">
                    Fornecedor: {a.fornecedor?.nomeFantasia ?? a.fornecedor?.razaoSocial ?? '-'}
                  </div>
                  <div className="text-xs text-white/80 break-words">Justificativa: {a.justificativa}</div>
                </div>
              )}
            />
          </div>
        </form>
      </AppModal>

      {showCreateEditModal && (
        <AppModal
          open={showCreateEditModal}
          onClose={() => setShowCreateEditModal(false)}
          title={modalMode === 'create' ? 'Novo produto do galpão' : 'Editar produto do galpão'}
          size="lg"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">Nome</label>
              <input
                required
                type="text"
                value={form.nome}
                onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
                className="w-full bg-neutral border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">Descrição (opcional)</label>
              <textarea
                value={form.descricao ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))}
                rows={3}
                className="w-full bg-neutral border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm((prev) => ({ ...prev, ativo: e.target.checked }))}
                className="accent-primary"
                id="ativo"
              />
              <label htmlFor="ativo" className="text-sm text-white/80">
                Produto ativo
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                className={btn.secondaryLg}
                onClick={() => setShowCreateEditModal(false)}
              >
                Cancelar
              </button>
              <button type="submit" className={btn.primaryLg} disabled={!canEdit}>
                {modalMode === 'create' ? 'Criar' : 'Salvar'}
              </button>
            </div>
          </form>
        </AppModal>
      )}

      {produtoToDelete && (
        <ConfirmDeleteByNameModal
          open={!!produtoToDelete}
          title="Excluir produto do galpão"
          entityLabel="o produto"
          entityName={produtoToDelete.nome}
          confirmValue={deleteConfirmName}
          onConfirmValueChange={setDeleteConfirmName}
          onClose={() => setProdutoToDelete(null)}
          onConfirm={async () => {
            if (!produtoToDelete) return;
            try {
              setDeleting(true);
              setDeleteError(null);
              await api.delete(`/galpao/produtos/${produtoToDelete.id}`);
              toast.success('Produto excluído com sucesso!');
              setProdutoToDelete(null);
              await loadProdutos();
            } catch (err: any) {
              setDeleteError(formatApiError(err));
              toast.error(formatApiError(err));
            } finally {
              setDeleting(false);
            }
          }}
          loading={deleting}
          errorMessage={deleteError}
          confirmButtonLabel="Excluir produto"
        />
      )}
    </div>
  );
}

