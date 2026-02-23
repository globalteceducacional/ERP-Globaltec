import { useEffect, useState, FormEvent } from 'react';
import { api } from '../services/api';
import { toast, formatApiError } from '../utils/toast';
import { useFormValidation, validators, errorMessages } from '../utils/validation';
import { DataTable, DataTableColumn } from '../components/DataTable';
import { btn } from '../utils/buttonStyles';

interface Category {
  id: number;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
  dataCriacao: string;
  dataAtualizacao: string;
}

interface CreateCategoryForm {
  nome: string;
  descricao: string;
  ativo: boolean;
}

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState<CreateCategoryForm>({
    nome: '',
    descricao: '',
    ativo: true,
  });

  // Hook de validação
  const validation = useFormValidation<CreateCategoryForm>({
    nome: [
      { validator: validators.required, message: errorMessages.required },
      { validator: validators.minLength(2), message: errorMessages.minLength(2) },
      { validator: validators.maxLength(100), message: errorMessages.maxLength(100) },
    ],
  });

  async function load() {
    try {
      setLoading(true);
      const endpoint = showInactive ? '/categories/all' : '/categories';
      const { data } = await api.get<Category[]>(endpoint);
      setCategories(data);
    } catch (err: any) {
      setError(formatApiError(err));
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [showInactive]);

  function openCreateModal() {
    setEditingCategory(null);
    setForm({
      nome: '',
      descricao: '',
      ativo: true,
    });
    setModalError(null);
    validation.reset();
    setShowModal(true);
  }

  function openEditModal(category: Category) {
    setEditingCategory(category);
    setForm({
      nome: category.nome,
      descricao: category.descricao || '',
      ativo: category.ativo,
    });
    setModalError(null);
    validation.reset();
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!validation.validateAll(form)) {
      setModalError('Por favor, corrija os erros no formulário');
      return;
    }

    setSubmitting(true);
    setModalError(null);

    try {
      const payload: any = {
        nome: form.nome.trim(),
        ativo: form.ativo,
      };

      if (form.descricao && form.descricao.trim()) {
        payload.descricao = form.descricao.trim();
      }

      if (editingCategory) {
        await api.patch(`/categories/${editingCategory.id}`, payload);
        toast.success('Categoria atualizada com sucesso!');
      } else {
        await api.post('/categories', payload);
        toast.success('Categoria criada com sucesso!');
      }

      await load();
      setShowModal(false);
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setModalError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(category: Category) {
    try {
      await api.patch(`/categories/${category.id}/toggle-active`);
      toast.success(`Categoria ${category.ativo ? 'desativada' : 'ativada'} com sucesso!`);
      await load();
    } catch (err: any) {
      toast.error(formatApiError(err));
    }
  }

  async function handleDelete(category: Category) {
    if (!confirm(`Tem certeza que deseja excluir a categoria "${category.nome}"?`)) {
      return;
    }

    try {
      await api.delete(`/categories/${category.id}`);
      toast.success('Categoria excluída com sucesso!');
      await load();
    } catch (err: any) {
      toast.error(formatApiError(err));
    }
  }

  const filteredCategories = showInactive
    ? categories
    : categories.filter((c) => c.ativo);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-white">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold">Categorias</h3>
          <p className="text-sm text-white/60">Gerenciamento de categorias de compras</p>
        </div>
        <button
          onClick={openCreateModal}
          className={btn.primary}
        >
          + Nova Categoria
        </button>
      </div>

      {error && (
        <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div className="bg-white/5 rounded-xl border border-white/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="w-4 h-4 rounded border-white/30 bg-white/10 text-primary focus:ring-primary"
            />
            <span className="text-sm text-white/80">Mostrar inativas</span>
          </label>
          <span className="text-xs text-white/50">
            {filteredCategories.length}{' '}
            {filteredCategories.length === 1 ? 'categoria' : 'categorias'}
          </span>
        </div>
      </div>

      <DataTable<Category>
        data={filteredCategories}
        keyExtractor={(c) => c.id}
        emptyMessage="Nenhuma categoria encontrada"
        renderMobileCard={(c) => (
          <div className="bg-neutral/60 border border-white/10 rounded-xl p-4 space-y-3">
            {/* Cabeçalho: nome + status */}
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-white truncate flex-1">{c.nome}</p>
              <span className={`shrink-0 text-xs px-2 py-0.5 rounded font-medium ${
                c.ativo
                  ? 'bg-success/20 text-success border border-success/40'
                  : 'bg-danger/20 text-danger border border-danger/40'
              }`}>
                {c.ativo ? 'Ativa' : 'Inativa'}
              </span>
            </div>
            {/* Descrição */}
            {c.descricao && (
              <p className="text-sm text-white/60 line-clamp-2">{c.descricao}</p>
            )}
            {/* Ações */}
            <div className="flex items-center gap-2 pt-1 border-t border-white/10">
              <button onClick={() => openEditModal(c)} className={btn.editSm}>Editar</button>
              <button onClick={() => handleToggleActive(c)} className={c.ativo ? btn.warningSm : btn.successSm}>
                {c.ativo ? 'Desativar' : 'Ativar'}
              </button>
              <button onClick={() => handleDelete(c)} className={btn.dangerSm}>Excluir</button>
            </div>
          </div>
        )}
        columns={[
          {
            key: 'nome',
            label: 'Nome',
            render: (c) => (
              <span className="font-medium text-white/90 block truncate" title={c.nome}>
                {c.nome}
              </span>
            ),
          },
          {
            key: 'descricao',
            label: 'Descrição',
            render: (c) => (
              <span className="block max-w-[220px] truncate text-white/70" title={c.descricao || undefined}>
                {c.descricao || '-'}
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (c) => (
              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                c.ativo
                  ? 'bg-success/20 text-success border border-success/40'
                  : 'bg-danger/20 text-danger border border-danger/40'
              }`}>
                {c.ativo ? 'Ativa' : 'Inativa'}
              </span>
            ),
          },
          {
            key: 'acoes',
            label: 'Ações',
            align: 'right',
            stopRowClick: true,
            render: (c) => (
              <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                <button
                  onClick={() => openEditModal(c)}
                  className={btn.editSm}
                >
                  Editar
                </button>
                <button
                  onClick={() => handleToggleActive(c)}
                  className={c.ativo ? btn.warningSm : btn.successSm}
                >
                  {c.ativo ? 'Desativar' : 'Ativar'}
                </button>
                <button
                  onClick={() => handleDelete(c)}
                  className={btn.dangerSm}
                >
                  Excluir
                </button>
              </div>
            ),
          },
        ] satisfies DataTableColumn<Category>[]}
      />

      {/* Modal Criar/Editar Categoria */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral border-b border-white/20 px-8 py-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setModalError(null);
                  validation.reset();
                }}
                className="text-white/50 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Nome da Categoria *
                </label>
                <input
                  type="text"
                  required
                  value={form.nome}
                  onChange={(e) => {
                    setForm({ ...form, nome: e.target.value });
                    validation.handleChange('nome', e.target.value);
                  }}
                  onBlur={() => validation.handleBlur('nome')}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Ex: Impressão 3D, Eletrônica, TI..."
                />
                {validation.hasError('nome') && (
                  <p className="mt-1 text-sm text-red-400">{validation.getFieldError('nome')}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Descrição</label>
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                  placeholder="Descrição opcional da categoria"
                  rows={3}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                    className="w-4 h-4 rounded border-white/30 bg-white/10 text-primary focus:ring-primary"
                  />
                  <span className="text-white/90">Ativa</span>
                </label>
              </div>

              {modalError && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-md text-sm">
                  {modalError}
                </div>
              )}

              <div className="flex justify-end space-x-4 pt-4 border-t border-white/20">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setModalError(null);
                    validation.reset();
                  }}
                  className={btn.secondaryLg}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={btn.primaryLg}
                >
                  {submitting ? 'Salvando...' : editingCategory ? 'Salvar Alterações' : 'Criar Categoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
