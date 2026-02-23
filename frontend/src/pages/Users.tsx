import { useEffect, useState, FormEvent, useMemo } from 'react';
import { api } from '../services/api';
import { Cargo, Usuario } from '../types';
import { btn } from '../utils/buttonStyles';
import { useAuthStore } from '../store/auth';
import { DataTable, DataTableColumn } from '../components/DataTable';
import { toast, formatApiError } from '../utils/toast';
import { useFormValidation, validators, errorMessages } from '../utils/validation';

interface CreateUserForm {
  nome: string;
  email: string;
  senha: string;
  cargoId: number;
  telefone?: string;
  formacao?: string;
  funcao?: string;
  dataNascimento?: string;
}

export default function Users() {
  const user = useAuthStore((state) => state.user);
  const [users, setUsers] = useState<Usuario[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<Usuario | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  // Filtros de busca
  const [searchNome, setSearchNome] = useState('');
  const [filterCargo, setFilterCargo] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [form, setForm] = useState<CreateUserForm>({
    nome: '',
    email: '',
    senha: '',
    cargoId: 0,
    telefone: '',
    formacao: '',
    funcao: '',
    dataNascimento: '',
  });

  // Verificar se o usuário é DIRETOR (compatibilidade com formato antigo e novo)
  const isDiretor =
    (typeof user?.cargo === 'string' && (user.cargo === 'DIRETOR' || user.cargo === 'GM')) ||
    (user?.cargo &&
      typeof user.cargo === 'object' &&
      'nome' in user.cargo &&
      (user.cargo.nome === 'DIRETOR' || user.cargo.nome === 'GM'));

  // Regras de validação (memoizadas para evitar recriação)
  const validationRules = useMemo(() => ({
    nome: [
      { validator: validators.required, message: errorMessages.required },
      { validator: validators.minLength(2), message: errorMessages.minLength(2) },
    ],
    email: [
      { validator: validators.required, message: errorMessages.required },
      { validator: validators.email, message: errorMessages.email },
    ],
    senha: editingUser
      ? [] // Senha opcional na edição
      : [
          { validator: validators.required, message: errorMessages.required },
          { validator: validators.minLength(6), message: errorMessages.minLength(6) },
        ],
    cargoId: [{ validator: (v: number) => v > 0, message: 'Selecione um cargo' }],
    telefone: form.telefone && form.telefone.trim().length > 0
      ? [{ validator: validators.phone, message: errorMessages.phone }]
      : [],
    dataNascimento: form.dataNascimento && form.dataNascimento.trim().length > 0
      ? [{ validator: validators.date, message: errorMessages.date }]
      : [],
  }), [editingUser, form.telefone, form.dataNascimento]);

  // Validação de formulário
  const validation = useFormValidation<CreateUserForm>(validationRules);

  async function loadCargos() {
    try {
      const { data } = await api.get<Cargo[]>('/cargos');
      setCargos(data);
      // Se não há cargo selecionado e há cargos disponíveis, selecionar o primeiro
      if (form.cargoId === 0 && data.length > 0) {
        setForm((prev) => ({ ...prev, cargoId: data[0].id }));
      }
    } catch (err) {
      console.error('Erro ao carregar cargos:', err);
    }
  }

  async function load() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (searchNome.trim()) {
        params.append('nome', searchNome.trim());
      }
      if (filterCargo !== 'all') {
        params.append('cargo', filterCargo);
      }
      if (filterStatus !== 'all') {
        params.append('ativo', filterStatus);
      }

      const queryString = params.toString();
      const url = queryString ? `/users?${queryString}` : '/users';
      const { data } = await api.get<Usuario[]>(url);
      setUsers(data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCargos();
  }, []);

  useEffect(() => {
    // Debounce da busca por nome
    const timeoutId = setTimeout(() => {
      load();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchNome, filterCargo, filterStatus]);

  async function toggleActive(user: Usuario) {
    try {
      if (user.ativo) {
        await api.patch(`/users/${user.id}/deactivate`);
      } else {
        await api.patch(`/users/${user.id}/activate`);
      }
      load();
      toast.success(`Usuário ${user.ativo ? 'desativado' : 'ativado'} com sucesso!`);
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    }
  }

  async function changeRole(user: Usuario, cargoId: number) {
    try {
      setError(null);
      await api.patch(`/users/${user.id}/role`, { cargoId });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Erro ao alterar cargo');
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setModalError(null);
    setError(null);

    // Validar todos os campos
    if (!validation.validateAll(form)) {
      setSubmitting(false);
      return;
    }

    try {

      const payload: any = {
        nome: form.nome.trim(),
        email: form.email.trim(),
        cargoId: form.cargoId,
      };

      // Senha só é obrigatória na criação
      if (!editingUser) {
        payload.senha = form.senha;
      } else if (form.senha && form.senha.length > 0) {
        // Se estiver editando e forneceu senha, validar e atualizar
        if (!validation.validate('senha', form.senha)) {
          setSubmitting(false);
          return;
        }
        payload.senha = form.senha;
      }

      if (form.telefone && form.telefone.trim().length > 0) {
        payload.telefone = form.telefone.trim();
      } else if (editingUser) {
        payload.telefone = null;
      }

      if (form.formacao && form.formacao.trim().length > 0) {
        payload.formacao = form.formacao.trim();
      } else if (editingUser) {
        payload.formacao = null;
      }

      if (form.funcao && form.funcao.trim().length > 0) {
        payload.funcao = form.funcao.trim();
      } else if (editingUser) {
        payload.funcao = null;
      }

      if (form.dataNascimento && form.dataNascimento.trim().length > 0) {
        payload.dataNascimento = form.dataNascimento;
      } else if (editingUser) {
        payload.dataNascimento = null;
      }

      if (editingUser) {
        await api.patch(`/users/${editingUser.id}`, payload);
      } else {
        await api.post('/users', payload);
      }

      setShowModal(false);
      setEditingUser(null);
      setForm({
        nome: '',
        email: '',
        senha: '',
        cargoId: cargos.length > 0 ? cargos[0].id : 0,
        telefone: '',
        formacao: '',
        funcao: '',
        dataNascimento: '',
      });
      validation.reset();
      await load();
      toast.success(editingUser ? 'Usuário atualizado com sucesso!' : 'Usuário criado com sucesso!');
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setModalError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  function openCreateModal() {
    setEditingUser(null);
    setForm({
      nome: '',
      email: '',
      senha: '',
      cargoId: cargos.length > 0 ? cargos[0].id : 0,
      telefone: '',
      formacao: '',
      funcao: '',
      dataNascimento: '',
    });
    setModalError(null);
    setShowModal(true);
  }

  function openEditModal(user: Usuario) {
    setEditingUser(user);
    setForm({
      nome: user.nome,
      email: user.email,
      senha: '', // Não preencher senha na edição
      cargoId: user.cargo.id,
      telefone: user.telefone || '',
      formacao: user.formacao || '',
      funcao: user.funcao || '',
      dataNascimento: user.dataNascimento || '',
    });
    validation.reset();
    setModalError(null);
    setShowModal(true);
  }

  function openDeleteModal(user: Usuario) {
    setUserToDelete(user);
    setDeleteConfirmName('');
    setShowDeleteModal(true);
  }

  async function handleDeleteUser() {
    if (!userToDelete) return;

    if (deleteConfirmName.trim() !== userToDelete.nome.trim()) {
      setError('O nome não confere. Digite o nome exatamente como aparece.');
      return;
    }

    try {
      setDeleting(true);
      setError(null);
      await api.delete(`/users/${userToDelete.id}`);
      setShowDeleteModal(false);
      setUserToDelete(null);
      setDeleteConfirmName('');
      await load();
      toast.success('Usuário excluído com sucesso!');
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <p>Carregando usuários...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Usuários</h3>
        {isDiretor && (
          <button onClick={openCreateModal} className={btn.primary}>
            Novo Usuário
          </button>
        )}
      </div>

      {error && !showModal && (
        <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Filtros de Busca */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Buscar por Nome
            </label>
            <input
              type="text"
              placeholder="Digite o nome do usuário..."
              value={searchNome}
              onChange={(e) => setSearchNome(e.target.value)}
              className="w-full px-4 py-2 rounded-md bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Filtrar por Cargo
            </label>
            <select
              value={filterCargo}
              onChange={(e) => setFilterCargo(e.target.value)}
              className="w-full px-4 py-2 rounded-md bg-neutral border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 1rem center',
                paddingRight: '2.5rem'
              }}
            >
              <option value="all" className="bg-neutral text-white">Todos os Cargos</option>
              {cargos.map((cargo) => (
                <option key={cargo.id} value={cargo.nome} className="bg-neutral text-white">
                  {cargo.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Filtrar por Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 rounded-md bg-neutral border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none cursor-pointer"
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
        {(searchNome || filterCargo !== 'all' || filterStatus !== 'all') && (
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => {
                setSearchNome('');
                setFilterCargo('all');
                setFilterStatus('all');
              }}
              className={btn.secondary}
            >
              Limpar Filtros
            </button>
            <span className="text-xs text-white/50">
              {users.length} {users.length === 1 ? 'usuário encontrado' : 'usuários encontrados'}
            </span>
          </div>
        )}
      </div>

      <DataTable<Usuario>
        data={users}
        keyExtractor={(u) => u.id}
        emptyMessage="Nenhum usuário encontrado"
        columns={[
          {
            key: 'nome',
            label: 'Nome',
            render: (u) => (
              <span className="block truncate" title={u.nome}>{u.nome}</span>
            ),
          },
          {
            key: 'email',
            label: 'E-mail',
            render: (u) => (
              <span className="block truncate text-white/80" title={u.email}>{u.email}</span>
            ),
          },
          {
            key: 'cargo',
            label: 'Cargo',
            render: (u) => <span>{u?.cargo?.nome || 'Sem cargo'}</span>,
          },
          {
            key: 'status',
            label: 'Status',
            render: (u) => (
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                u.ativo
                  ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                  : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
              }`}>
                {u.ativo ? 'Ativo' : 'Pendente'}
              </span>
            ),
          },
          {
            key: 'acoes',
            label: 'Ações',
            stopRowClick: true,
            render: (u) => (
              <div className="flex items-center gap-1.5 flex-nowrap">
                {isDiretor && (
                  <>
                    <select
                      value={u.cargo.id}
                      onChange={(e) => changeRole(u, Number(e.target.value))}
                      className="bg-neutral/60 border border-white/10 rounded-md px-2 py-1 text-xs"
                    >
                      {cargos.map((cargo) => (
                        <option key={cargo.id} value={cargo.id}>{cargo.nome}</option>
                      ))}
                    </select>
                    <button onClick={() => openEditModal(u)} className={btn.editSm}>
                      Editar
                    </button>
                    <button
                      onClick={() => toggleActive(u)}
                      className={u.ativo ? btn.warningSm : btn.successSm}
                    >
                      {u.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                    <button onClick={() => openDeleteModal(u)} className={btn.dangerSm}>
                      Excluir
                    </button>
                  </>
                )}
              </div>
            ),
          },
        ] satisfies DataTableColumn<Usuario>[]}
      />

      {/* Modal de Novo Usuário */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/10 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingUser(null);
                  setError(null);
                  setModalError(null);
                }}
                className="text-white/50 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">
                    Nome <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.nome}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, nome: e.target.value }));
                      validation.handleChange('nome', e.target.value);
                    }}
                    onBlur={() => validation.handleBlur('nome')}
                    className={`w-full bg-neutral/60 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 ${
                      validation.hasError('nome')
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-white/10 focus:ring-primary'
                    }`}
                    required
                  />
                  {validation.hasError('nome') && (
                    <p className="text-red-500 text-xs mt-1">{validation.getFieldError('nome')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-white/70 mb-1">
                    E-mail <span className="text-danger">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, email: e.target.value }));
                      validation.handleChange('email', e.target.value);
                    }}
                    onBlur={() => validation.handleBlur('email')}
                    className={`w-full bg-neutral/60 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 ${
                      validation.hasError('email')
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-white/10 focus:ring-primary'
                    }`}
                    required
                  />
                  {validation.hasError('email') && (
                    <p className="text-red-500 text-xs mt-1">{validation.getFieldError('email')}</p>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">
                    Senha {!editingUser && <span className="text-danger">*</span>}
                  </label>
                  <input
                    type="password"
                    value={form.senha}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, senha: e.target.value }));
                      if (!editingUser || e.target.value.length > 0) {
                        validation.handleChange('senha', e.target.value);
                      }
                    }}
                    onBlur={() => {
                      if (!editingUser || form.senha.length > 0) {
                        validation.handleBlur('senha');
                      }
                    }}
                    className={`w-full bg-neutral/60 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 ${
                      validation.hasError('senha')
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-white/10 focus:ring-primary'
                    }`}
                    required={!editingUser}
                    minLength={form.senha.length > 0 ? 6 : undefined}
                    placeholder={editingUser ? 'Deixe em branco para não alterar' : ''}
                  />
                  {validation.hasError('senha') ? (
                    <p className="text-red-500 text-xs mt-1">{validation.getFieldError('senha')}</p>
                  ) : (
                    <p className="text-xs text-white/50 mt-1">
                      {editingUser ? 'Deixe em branco para não alterar a senha' : 'Mínimo de 6 caracteres'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-white/70 mb-1">
                    Cargo <span className="text-danger">*</span>
                  </label>
                  <select
                    value={form.cargoId}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, cargoId: Number(e.target.value) }));
                      validation.handleChange('cargoId', Number(e.target.value));
                    }}
                    onBlur={() => validation.handleBlur('cargoId')}
                    className={`w-full bg-neutral/60 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 ${
                      validation.hasError('cargoId')
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-white/10 focus:ring-primary'
                    }`}
                    required
                  >
                    {cargos.length === 0 ? (
                      <option value="">Carregando cargos...</option>
                    ) : (
                      cargos.map((cargo) => (
                        <option key={cargo.id} value={cargo.id}>
                          {cargo.nome}
                        </option>
                      ))
                    )}
                  </select>
                  {validation.hasError('cargoId') && (
                    <p className="text-red-500 text-xs mt-1">{validation.getFieldError('cargoId')}</p>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">Telefone</label>
                  <input
                    type="tel"
                    value={form.telefone}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, telefone: e.target.value }));
                      if (e.target.value.length > 0) {
                        validation.handleChange('telefone', e.target.value);
                      }
                    }}
                    onBlur={() => {
                      if (form.telefone && form.telefone.length > 0) {
                        validation.handleBlur('telefone');
                      }
                    }}
                    className={`w-full bg-neutral/60 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 ${
                      validation.hasError('telefone')
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-white/10 focus:ring-primary'
                    }`}
                  />
                  {validation.hasError('telefone') && (
                    <p className="text-red-500 text-xs mt-1">{validation.getFieldError('telefone')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-white/70 mb-1">Data de Nascimento</label>
                  <input
                    type="date"
                    value={form.dataNascimento}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, dataNascimento: e.target.value }));
                      if (e.target.value.length > 0) {
                        validation.handleChange('dataNascimento', e.target.value);
                      }
                    }}
                    onBlur={() => {
                      if (form.dataNascimento && form.dataNascimento.length > 0) {
                        validation.handleBlur('dataNascimento');
                      }
                    }}
                    className={`w-full bg-neutral/60 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 ${
                      validation.hasError('dataNascimento')
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-white/10 focus:ring-primary'
                    }`}
                  />
                  {validation.hasError('dataNascimento') && (
                    <p className="text-red-500 text-xs mt-1">{validation.getFieldError('dataNascimento')}</p>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">Formação</label>
                  <input
                    type="text"
                    value={form.formacao}
                    onChange={(e) => setForm((prev) => ({ ...prev, formacao: e.target.value }))}
                    className="w-full bg-neutral/60 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm text-white/70 mb-1">Função</label>
                  <input
                    type="text"
                    value={form.funcao}
                    onChange={(e) => setForm((prev) => ({ ...prev, funcao: e.target.value }))}
                    className="w-full bg-neutral/60 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {modalError && (
                <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-md text-sm">
                  {modalError}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setError(null);
                    setModalError(null);
                  }}
                  className={btn.secondaryLg}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={btn.primaryLg}
                  disabled={submitting}
                >
                  {submitting
                    ? editingUser
                      ? 'Salvando...'
                      : 'Criando...'
                    : editingUser
                      ? 'Salvar Alterações'
                      : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-md w-full">
            <div className="px-8 py-6 border-b border-white/20">
              <h2 className="text-2xl font-bold text-white">Confirmar Exclusão</h2>
            </div>
            <div className="p-8">
              <p className="text-white/90 mb-2">
                Tem certeza que deseja excluir o usuário:
              </p>
              <p className="text-xl font-semibold text-white mb-6">
                "{userToDelete.nome}"
              </p>
              <p className="text-sm text-white/70 mb-4">
                Esta ação não pode ser desfeita. Para confirmar, digite o nome do usuário:
              </p>
              <input
                type="text"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={userToDelete.nome}
                className="w-full bg-neutral/60 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              />
              {error && (
                <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-md mb-4 text-sm">
                  {error}
                </div>
              )}
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setUserToDelete(null);
                    setDeleteConfirmName('');
                    setError(null);
                  }}
                  className={btn.secondaryLg}
                  disabled={deleting}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  className={btn.dangerLg}
                  disabled={deleting || deleteConfirmName.trim() !== userToDelete.nome.trim()}
                >
                  {deleting ? 'Excluindo...' : 'Excluir Usuário'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
