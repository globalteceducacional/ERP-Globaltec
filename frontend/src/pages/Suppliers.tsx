import { useEffect, useState, FormEvent, useMemo } from 'react';
import { api } from '../services/api';
import { toast, formatApiError } from '../utils/toast';
import { useFormValidation, validators, errorMessages } from '../utils/validation';
import { btn } from '../utils/buttonStyles';
import { DataTable, DataTableColumn } from '../components/DataTable';

interface Supplier {
  id: number;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  endereco?: string | null;
  contato?: string | null;
  ativo: boolean;
  dataCriacao: string;
  dataAtualizacao: string;
}

interface CreateSupplierForm {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  endereco: string;
  contato: string;
  ativo: boolean;
}

// Função para formatar CNPJ
function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length <= 14) {
    return cleaned
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return cleaned;
}

// Função para validar CNPJ básico
function validateCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, '');
  return cleaned.length === 14;
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [searchNome, setSearchNome] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loadingCNPJ, setLoadingCNPJ] = useState(false);
  const [form, setForm] = useState<CreateSupplierForm>({
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    endereco: '',
    contato: '',
    ativo: true,
  });

  // Hook de validação
  const validation = useFormValidation<CreateSupplierForm>({
    razaoSocial: [
      { validator: validators.required, message: errorMessages.required },
      { validator: validators.minLength(3), message: errorMessages.minLength(3) },
    ],
    nomeFantasia: [
      { validator: validators.required, message: errorMessages.required },
      { validator: validators.minLength(3), message: errorMessages.minLength(3) },
    ],
    cnpj: [
      { validator: validators.required, message: errorMessages.required },
      {
        validator: (value: string) => validateCNPJ(value),
        message: 'CNPJ inválido. Deve conter 14 dígitos.',
      },
    ],
  });

  async function load() {
    try {
      setLoading(true);
      const endpoint = showInactive ? '/suppliers/all' : '/suppliers';
      const { data } = await api.get<Supplier[]>(endpoint);
      setSuppliers(data);
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
    setEditingSupplier(null);
    setForm({
      razaoSocial: '',
      nomeFantasia: '',
      cnpj: '',
      endereco: '',
      contato: '',
      ativo: true,
    });
    setModalError(null);
    validation.reset();
    setShowModal(true);
  }

  function openEditModal(supplier: Supplier) {
    setEditingSupplier(supplier);
    setForm({
      razaoSocial: supplier.razaoSocial,
      nomeFantasia: supplier.nomeFantasia,
      cnpj: supplier.cnpj,
      endereco: supplier.endereco || '',
      contato: supplier.contato || '',
      ativo: supplier.ativo,
    });
    setModalError(null);
    validation.reset();
    setShowModal(true);
  }

  /** Busca dados do fornecedor pela API de CNPJ (mesma do sistema de compras). Só em modo criação. */
  async function fetchCNPJData(cnpj: string) {
    const cleaned = cnpj.replace(/\D/g, '');
    if (cleaned.length !== 14 || editingSupplier) return;

    setLoadingCNPJ(true);
    setModalError(null);

    try {
      const { data } = await api.get<{ razaoSocial?: string; nomeFantasia?: string; endereco?: string; contato?: string }>(`/suppliers/cnpj/${cleaned}`);
      setForm((prev) => ({
        ...prev,
        razaoSocial: data.razaoSocial ?? prev.razaoSocial,
        nomeFantasia: data.nomeFantasia ?? prev.nomeFantasia,
        endereco: data.endereco ?? prev.endereco,
        contato: data.contato ?? prev.contato,
      }));
      if (data.razaoSocial) validation.handleChange('razaoSocial', data.razaoSocial);
      if (data.nomeFantasia) validation.handleChange('nomeFantasia', data.nomeFantasia);
      toast.success('Dados do CNPJ carregados com sucesso!');
    } catch (err: any) {
      const msg = err.response?.data?.message ?? err.message ?? 'Erro ao buscar dados do CNPJ';
      setModalError(msg);
      toast.error(msg);
    } finally {
      setLoadingCNPJ(false);
    }
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
      const cleanedCNPJ = form.cnpj.replace(/\D/g, '');
      const payload: any = {
        razaoSocial: form.razaoSocial.trim(),
        nomeFantasia: form.nomeFantasia.trim(),
        cnpj: cleanedCNPJ,
        ativo: form.ativo,
      };

      // Adicionar campos opcionais apenas se não estiverem vazios
      if (form.endereco && form.endereco.trim()) {
        payload.endereco = form.endereco.trim();
      }
      if (form.contato && form.contato.trim()) {
        payload.contato = form.contato.trim();
      }

      if (editingSupplier) {
        await api.patch(`/suppliers/${editingSupplier.id}`, payload);
        toast.success('Fornecedor atualizado com sucesso!');
      } else {
        await api.post('/suppliers', payload);
        toast.success('Fornecedor criado com sucesso!');
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

  async function handleToggleActive(supplier: Supplier) {
    try {
      await api.patch(`/suppliers/${supplier.id}/toggle-active`);
      toast.success(`Fornecedor ${supplier.ativo ? 'desativado' : 'ativado'} com sucesso!`);
      await load();
    } catch (err: any) {
      toast.error(formatApiError(err));
    }
  }

  async function handleDelete(supplier: Supplier) {
    if (!confirm(`Tem certeza que deseja excluir o fornecedor "${supplier.razaoSocial}"?`)) {
      return;
    }

    try {
      await api.delete(`/suppliers/${supplier.id}`);
      toast.success('Fornecedor excluído com sucesso!');
      await load();
    } catch (err: any) {
      toast.error(formatApiError(err));
    }
  }

  const filteredSuppliers = useMemo(() => {
    let list = suppliers;
    if (!showInactive) {
      list = list.filter((s) => s.ativo);
    }
    if (filterStatus === 'true') {
      list = list.filter((s) => s.ativo);
    } else if (filterStatus === 'false') {
      list = list.filter((s) => !s.ativo);
    }
    if (searchNome.trim()) {
      const term = searchNome.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.razaoSocial.toLowerCase().includes(term) ||
          s.nomeFantasia.toLowerCase().includes(term) ||
          (s.cnpj && s.cnpj.replace(/\D/g, '').includes(term.replace(/\D/g, '')))
      );
    }
    return list;
  }, [suppliers, showInactive, filterStatus, searchNome]);

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
        <h3 className="text-xl font-semibold">Fornecedores</h3>
        <button onClick={openCreateModal} className={btn.primary}>
          + Novo Fornecedor
        </button>
      </div>

      {error && (
        <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-white/70 mb-2">
              Buscar por nome ou CNPJ
            </label>
            <input
              type="text"
              placeholder="Razão social, nome fantasia ou CNPJ..."
              value={searchNome}
              onChange={(e) => setSearchNome(e.target.value)}
              className="w-full px-4 py-2 rounded-md bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 rounded-md bg-neutral border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 1rem center',
                paddingRight: '2.5rem'
              }}
            >
              <option value="all" className="bg-neutral text-white">Todos</option>
              <option value="true" className="bg-neutral text-white">Ativos</option>
              <option value="false" className="bg-neutral text-white">Inativos</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="w-4 h-4 rounded border-white/30 bg-white/10 text-primary focus:ring-primary"
            />
            <span className="text-sm text-white/80">Incluir inativos na lista</span>
          </label>
          {(searchNome || filterStatus !== 'all') && (
            <>
              <button
                type="button"
                onClick={() => {
                  setSearchNome('');
                  setFilterStatus('all');
                }}
                className={btn.secondary}
              >
                Limpar filtros
              </button>
              <span className="text-xs text-white/50">
                {filteredSuppliers.length} {filteredSuppliers.length === 1 ? 'fornecedor' : 'fornecedores'}
              </span>
            </>
          )}
        </div>
      </div>

      <DataTable<Supplier>
        data={filteredSuppliers}
        keyExtractor={(s) => s.id}
        emptyMessage="Nenhum fornecedor encontrado"
        columns={[
          {
            key: 'razaoSocial',
            label: 'Razão Social',
            render: (s) => (
              <span className="text-white/90 block truncate" title={s.razaoSocial}>
                {s.razaoSocial}
              </span>
            ),
          },
          {
            key: 'nomeFantasia',
            label: 'Nome Fantasia',
            render: (s) => (
              <span className="text-white/90 block truncate" title={s.nomeFantasia}>
                {s.nomeFantasia}
              </span>
            ),
          },
          {
            key: 'cnpj',
            label: 'CNPJ',
            thClassName: 'whitespace-nowrap',
            render: (s) => (
              <span className="text-white/90 whitespace-nowrap">{formatCNPJ(s.cnpj)}</span>
            ),
          },
          {
            key: 'endereco',
            label: 'Endereço',
            render: (s) => (
              <span className="block max-w-[220px] truncate text-white/70" title={s.endereco || undefined}>
                {s.endereco || '-'}
              </span>
            ),
          },
          {
            key: 'contato',
            label: 'Contato',
            render: (s) => (
              <span className="block max-w-[160px] truncate text-white/70" title={s.contato || undefined}>
                {s.contato || '-'}
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (s) => (
              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                s.ativo
                  ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                  : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
              }`}>
                {s.ativo ? 'Ativo' : 'Inativo'}
              </span>
            ),
          },
          {
            key: 'acoes',
            label: 'Ações',
            align: 'right',
            stopRowClick: true,
            render: (s) => (
              <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                <button onClick={() => openEditModal(s)} className={btn.editSm}>
                  Editar
                </button>
                <button
                  onClick={() => handleToggleActive(s)}
                  className={s.ativo ? btn.warningSm : btn.successSm}
                >
                  {s.ativo ? 'Desativar' : 'Ativar'}
                </button>
                <button onClick={() => handleDelete(s)} className={btn.dangerSm}>
                  Excluir
                </button>
              </div>
            ),
          },
        ] satisfies DataTableColumn<Supplier>[]}
      />

      {/* Modal Criar/Editar Fornecedor */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral border-b border-white/20 px-8 py-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                {editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
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
                  CNPJ *
                  {loadingCNPJ && (
                    <span className="ml-2 text-xs text-primary">Buscando dados...</span>
                  )}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={form.cnpj}
                    onChange={(e) => {
                      const formatted = formatCNPJ(e.target.value);
                      setForm((prev) => ({ ...prev, cnpj: formatted }));
                      validation.handleChange('cnpj', formatted);
                      const cleaned = formatted.replace(/\D/g, '');
                      if (cleaned.length === 14 && !loadingCNPJ && !editingSupplier) {
                        fetchCNPJData(formatted);
                      }
                    }}
                    onBlur={() => {
                      validation.handleBlur('cnpj');
                      const cleaned = form.cnpj.replace(/\D/g, '');
                      if (cleaned.length === 14 && !loadingCNPJ && !editingSupplier && !form.razaoSocial) {
                        fetchCNPJData(form.cnpj);
                      }
                    }}
                    className="flex-1 bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                    disabled={loadingCNPJ}
                  />
                  {!editingSupplier && (
                    <button
                      type="button"
                      onClick={() => fetchCNPJData(form.cnpj)}
                      disabled={loadingCNPJ || !validateCNPJ(form.cnpj)}
                      className={`${btn.primaryLg} whitespace-nowrap`}
                      title="Buscar dados do CNPJ"
                    >
                      {loadingCNPJ ? 'Buscando...' : 'Buscar'}
                    </button>
                  )}
                </div>
                {validation.errors.cnpj && (
                  <p className="mt-1 text-sm text-red-400">{validation.errors.cnpj}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Razão Social *
                </label>
                <input
                  type="text"
                  required
                  value={form.razaoSocial}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, razaoSocial: e.target.value }));
                    validation.handleChange('razaoSocial', e.target.value);
                  }}
                  onBlur={() => validation.handleBlur('razaoSocial')}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Digite a razão social"
                />
                {validation.errors.razaoSocial && (
                  <p className="mt-1 text-sm text-red-400">{validation.errors.razaoSocial}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Nome Fantasia *
                </label>
                <input
                  type="text"
                  required
                  value={form.nomeFantasia}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, nomeFantasia: e.target.value }));
                    validation.handleChange('nomeFantasia', e.target.value);
                  }}
                  onBlur={() => validation.handleBlur('nomeFantasia')}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Digite o nome fantasia"
                />
                {validation.errors.nomeFantasia && (
                  <p className="mt-1 text-sm text-red-400">{validation.errors.nomeFantasia}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Endereço</label>
                <input
                  type="text"
                  value={form.endereco}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Digite o endereço"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Contato</label>
                <input
                  type="text"
                  value={form.contato}
                  onChange={(e) => setForm({ ...form, contato: e.target.value })}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Telefone, email ou outro contato"
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
                  <span className="text-white/90">Ativo</span>
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
                  {submitting ? 'Salvando...' : editingSupplier ? 'Salvar Alterações' : 'Criar Fornecedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
