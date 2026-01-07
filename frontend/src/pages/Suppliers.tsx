import { useEffect, useState, FormEvent } from 'react';
import { api } from '../services/api';
import { toast, formatApiError } from '../utils/toast';
import { useFormValidation, validators, errorMessages } from '../utils/validation';

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!validation.validate(form)) {
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

      console.log('=== CRIAR FORNECEDOR ===');
      console.log('Payload:', JSON.stringify(payload, null, 2));

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
      console.error('=== ERRO AO CRIAR/ATUALIZAR FORNECEDOR ===');
      console.error('Erro completo:', err);
      console.error('Status:', err.response?.status);
      console.error('Data:', err.response?.data);
      
      if (err.response?.data) {
        console.error('Mensagem de erro:', err.response.data.message);
        if (Array.isArray(err.response.data.message)) {
          console.error('Array de erros:', err.response.data.message);
          err.response.data.message.forEach((msg: any, index: number) => {
            console.error(`  Erro ${index + 1}:`, msg);
          });
        }
      }
      
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

  const filteredSuppliers = showInactive
    ? suppliers
    : suppliers.filter((s) => s.ativo);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-white">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Fornecedores</h1>
          <p className="text-white/60">Gerenciamento de fornecedores</p>
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="w-4 h-4 rounded border-white/30 bg-white/10 text-primary focus:ring-primary"
            />
            <span className="text-white/90">Mostrar inativos</span>
          </label>
          <button
            onClick={openCreateModal}
            className="px-6 py-2.5 rounded-md bg-primary hover:bg-primary/80 text-white font-semibold transition-colors"
          >
            + Novo Fornecedor
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div className="bg-neutral/80 border border-white/20 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/90">Razão Social</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/90">Nome Fantasia</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/90">CNPJ</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/90">Endereço</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/90">Contato</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/90">Status</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-white/90">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-white/60">
                    Nenhum fornecedor encontrado
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    className="border-b border-white/10 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4 text-white/90">{supplier.razaoSocial}</td>
                    <td className="px-6 py-4 text-white/90">{supplier.nomeFantasia}</td>
                    <td className="px-6 py-4 text-white/90">{formatCNPJ(supplier.cnpj)}</td>
                    <td className="px-6 py-4 text-white/70">{supplier.endereco || '-'}</td>
                    <td className="px-6 py-4 text-white/70">{supplier.contato || '-'}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          supplier.ativo
                            ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                            : 'bg-red-500/20 text-red-300 border border-red-500/50'
                        }`}
                      >
                        {supplier.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(supplier)}
                          className="px-3 py-1.5 rounded-md bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-sm font-medium transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleToggleActive(supplier)}
                          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            supplier.ativo
                              ? 'bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300'
                              : 'bg-green-600/20 hover:bg-green-600/30 text-green-300'
                          }`}
                        >
                          {supplier.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => handleDelete(supplier)}
                          className="px-3 py-1.5 rounded-md bg-red-600/20 hover:bg-red-600/30 text-red-300 text-sm font-medium transition-colors"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                  Razão Social *
                </label>
                <input
                  type="text"
                  required
                  value={form.razaoSocial}
                  onChange={(e) => {
                    setForm({ ...form, razaoSocial: e.target.value });
                    validation.validateField('razaoSocial', e.target.value);
                  }}
                  onBlur={() => validation.validateField('razaoSocial', form.razaoSocial)}
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
                    setForm({ ...form, nomeFantasia: e.target.value });
                    validation.validateField('nomeFantasia', e.target.value);
                  }}
                  onBlur={() => validation.validateField('nomeFantasia', form.nomeFantasia)}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Digite o nome fantasia"
                />
                {validation.errors.nomeFantasia && (
                  <p className="mt-1 text-sm text-red-400">{validation.errors.nomeFantasia}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">CNPJ *</label>
                <input
                  type="text"
                  required
                  value={form.cnpj}
                  onChange={(e) => {
                    const formatted = formatCNPJ(e.target.value);
                    setForm({ ...form, cnpj: formatted });
                    validation.validateField('cnpj', formatted);
                  }}
                  onBlur={() => validation.validateField('cnpj', form.cnpj)}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                />
                {validation.errors.cnpj && (
                  <p className="mt-1 text-sm text-red-400">{validation.errors.cnpj}</p>
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
                  className="px-6 py-2.5 rounded-md bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-md bg-primary hover:bg-primary/80 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
