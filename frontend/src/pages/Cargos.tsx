import { useEffect, useMemo, useState, FormEvent } from 'react';
import { api } from '../services/api';
import { Cargo, CargoPermission } from '../types';
import { btn } from '../utils/buttonStyles';
import { useAuthStore } from '../store/auth';
import { DataTable, DataTableColumn } from '../components/DataTable';
import { toast, formatApiError } from '../utils/toast';
import { useFormValidation, validators, errorMessages } from '../utils/validation';

interface CreateCargoForm {
  nome: string;
  descricao?: string;
  ativo: boolean;
  paginasPermitidas: string[];
  permissions: string[];
}

// Catálogo estático de permissões — garante que todas apareçam mesmo sem seed no banco
const PERMISSIONS_CATALOG: CargoPermission[] = [
  { id: 0, modulo: 'compras',   acao: 'aprovar',      chave: 'compras:aprovar',      descricao: 'Aprovar solicitações de compras' },
  { id: 0, modulo: 'compras',   acao: 'solicitar',    chave: 'compras:solicitar',    descricao: 'Solicitar compras e orçamentos' },
  { id: 0, modulo: 'estoque',   acao: 'movimentar',   chave: 'estoque:movimentar',   descricao: 'Registrar movimentações de estoque' },
  { id: 0, modulo: 'estoque',   acao: 'visualizar',   chave: 'estoque:visualizar',   descricao: 'Visualizar itens de estoque' },
  { id: 0, modulo: 'projetos',  acao: 'aprovar',      chave: 'projetos:aprovar',     descricao: 'Aprovar etapas e metas de projetos' },
  { id: 0, modulo: 'projetos',  acao: 'editar',       chave: 'projetos:editar',      descricao: 'Criar e editar projetos' },
  { id: 0, modulo: 'projetos',  acao: 'visualizar',   chave: 'projetos:visualizar',  descricao: 'Visualizar projetos' },
  { id: 0, modulo: 'sistema',   acao: 'administrar',  chave: 'sistema:administrar',  descricao: 'Administrar configurações avançadas do sistema' },
  { id: 0, modulo: 'trabalhos', acao: 'avaliar',      chave: 'trabalhos:avaliar',    descricao: 'Avaliar entregas e aprovar objetivos' },
  { id: 0, modulo: 'trabalhos', acao: 'registrar',    chave: 'trabalhos:registrar',  descricao: 'Registrar progresso e anexos das tarefas' },
  { id: 0, modulo: 'trabalhos', acao: 'visualizar',   chave: 'trabalhos:visualizar', descricao: 'Visualizar tarefas atribuídas' },
  { id: 0, modulo: 'usuarios',  acao: 'gerenciar',    chave: 'usuarios:gerenciar',   descricao: 'Gerenciar usuários e cargos' },
];

// Lista de todas as páginas disponíveis no sistema
const todasPaginas = [
  { value: '/dashboard', label: 'Dashboard' },
  { value: '/projects', label: 'Projetos' },
  { value: '/tasks/my', label: 'Meu Trabalho' },
  { value: '/stock', label: 'Compras & Estoque' },
  { value: '/suppliers', label: 'Fornecedores' },
  { value: '/categories', label: 'Categorias' },
  { value: '/communications', label: 'Requerimentos' },
  { value: '/users', label: 'Usuários' },
  { value: '/cargos', label: 'Cargos' },
];

export default function Cargos() {
  const user = useAuthStore((state) => state.user);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCargo, setEditingCargo] = useState<Cargo | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Filtros de busca
  const [searchNome, setSearchNome] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [form, setForm] = useState<CreateCargoForm>({
    nome: '',
    descricao: '',
    ativo: true,
    paginasPermitidas: [],
    permissions: [],
  });
  const [permissionsCatalog, setPermissionsCatalog] = useState<CargoPermission[]>([]);

  // Hook de validação
  const validation = useFormValidation<CreateCargoForm>({
    nome: [
      { validator: validators.required, message: errorMessages.required },
      { validator: validators.minLength(2), message: errorMessages.minLength(2) },
      { validator: validators.maxLength(50), message: errorMessages.maxLength(50) },
    ],
  });

  // Verificar se o usuário é DIRETOR
  const isDiretor =
    user?.cargo?.nome === 'DIRETOR' ||
    user?.cargo?.nome === 'GM' ||
    (typeof user?.cargo === 'string' && (user.cargo === 'DIRETOR' || user.cargo === 'GM'));

  async function load() {
    try {
      const { data } = await api.get<Cargo[]>('/cargos/all');
      const normalized = data.map((cargo) => ({
        ...cargo,
        permissions: (cargo.permissions ?? []).map((permission) => ({
          ...permission,
          chave: permission.chave ?? `${permission.modulo}:${permission.acao}`,
        })),
      }));
      setCargos(normalized);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Erro ao carregar cargos');
    } finally {
      setLoading(false);
    }
  }

  async function loadPermissions() {
    // Começa com o catálogo estático para garantir que todas as permissões apareçam
    setPermissionsCatalog(PERMISSIONS_CATALOG);
    try {
      const { data } = await api.get<Array<{ id: number; modulo: string; acao: string; descricao?: string | null }>>('/cargos/permissions');
      // Mescla: API sobrepõe id real; itens do catálogo estático não presentes na API são mantidos
      const apiMap = new Map(data.map((p) => [`${p.modulo}:${p.acao}`, p]));
      const merged = PERMISSIONS_CATALOG.map((item) => {
        const fromApi = apiMap.get(item.chave);
        return fromApi ? { ...item, id: fromApi.id, descricao: fromApi.descricao ?? item.descricao } : item;
      });
      setPermissionsCatalog(merged);
    } catch (err) {
      console.error('Erro ao carregar permissões da API, usando catálogo local', err);
    }
  }

  useEffect(() => {
    load();
    loadPermissions();
  }, []);

  const permissionsByModule = useMemo(() => {
    const grouped = permissionsCatalog.reduce<Record<string, CargoPermission[]>>((acc, permission) => {
      if (!acc[permission.modulo]) {
        acc[permission.modulo] = [];
      }
      acc[permission.modulo].push(permission);
      return acc;
    }, {});

    Object.values(grouped).forEach((list) => {
      list.sort((a, b) => (a.descricao || a.acao).localeCompare(b.descricao || b.acao));
    });

    return grouped;
  }, [permissionsCatalog]);

  // Filtro local dos cargos
  const filteredCargos = useMemo(() => {
    return cargos.filter((cargo) => {
      // Busca por nome
      if (searchNome.trim()) {
        const nomeMatch = cargo.nome.toLowerCase().includes(searchNome.toLowerCase());
        const descricaoMatch = cargo.descricao?.toLowerCase().includes(searchNome.toLowerCase());
        if (!nomeMatch && !descricaoMatch) {
          return false;
        }
      }

      // Filtro por status
      if (filterStatus !== 'all') {
        const isAtivo = filterStatus === 'true';
        if (cargo.ativo !== isAtivo) {
          return false;
        }
      }

      return true;
    });
  }, [cargos, searchNome, filterStatus]);

  async function toggleActive(cargo: Cargo) {
    try {
      setError(null);
      await api.patch(`/cargos/${cargo.id}`, { ativo: !cargo.ativo });
      await load();
      toast.success(`Cargo ${!cargo.ativo ? 'ativado' : 'desativado'} com sucesso!`);
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      toast.error(errorMessage);
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
        ativo: form.ativo,
        paginasPermitidas: form.paginasPermitidas,
        permissions: form.permissions,
      };

      if (form.descricao && form.descricao.trim().length > 0) {
        payload.descricao = form.descricao.trim();
      }

      if (editingCargo) {
        await api.patch(`/cargos/${editingCargo.id}`, payload);
      } else {
        await api.post('/cargos', payload);
      }

      setShowModal(false);
      setEditingCargo(null);
      setForm({
        nome: '',
        descricao: '',
        ativo: true,
        paginasPermitidas: [],
        permissions: [],
      });
      validation.reset();
      await load();
      toast.success(editingCargo ? 'Cargo atualizado com sucesso!' : 'Cargo criado com sucesso!');
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setModalError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  function openCreateModal() {
    setEditingCargo(null);
    setForm({
      nome: '',
      descricao: '',
      ativo: true,
      paginasPermitidas: [],
      permissions: [],
    });
    validation.reset();
    setModalError(null);
    setShowModal(true);
  }

  function openEditModal(cargo: Cargo) {
    setEditingCargo(cargo);
    setForm({
      nome: cargo.nome,
      descricao: cargo.descricao || '',
      ativo: cargo.ativo,
      paginasPermitidas: (cargo.paginasPermitidas as string[]) || [],
      permissions: (cargo.permissions ?? []).map((perm) => perm.chave),
    });
    validation.reset();
    setModalError(null);
    setShowModal(true);
  }

  function togglePagina(value: string) {
    setForm((prev) => {
      const current = prev.paginasPermitidas;
      if (current.includes(value)) {
        return { ...prev, paginasPermitidas: current.filter((p) => p !== value) };
      } else {
        return { ...prev, paginasPermitidas: [...current, value] };
      }
    });
  }

  function togglePermissao(value: string) {
    setForm((prev) => {
      const current = prev.permissions;
      if (current.includes(value)) {
        return { ...prev, permissions: current.filter((p) => p !== value) };
      }
      return { ...prev, permissions: [...current, value] };
    });
  }

  async function handleDelete(cargo: Cargo) {
    if (!confirm(`Tem certeza que deseja excluir o cargo "${cargo.nome}"?`)) {
      return;
    }

    try {
      setError(null);
      await api.delete(`/cargos/${cargo.id}`);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Erro ao excluir cargo');
    }
  }

  if (loading) {
    return <p>Carregando cargos...</p>;
  }

  if (!isDiretor) {
    return (
      <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-md">
        Você não tem permissão para acessar esta página.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Cargos</h3>
        <button onClick={openCreateModal} className={btn.primary}>
          Novo Cargo
        </button>
      </div>

      {error && !showModal && (
        <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Filtros de Busca */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Buscar por Nome ou Descrição
            </label>
            <input
              type="text"
              placeholder="Digite o nome ou descrição do cargo..."
              value={searchNome}
              onChange={(e) => setSearchNome(e.target.value)}
              className="w-full px-4 py-2 rounded-md bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
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
        {(searchNome || filterStatus !== 'all') && (
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => {
                setSearchNome('');
                setFilterStatus('all');
              }}
              className={btn.secondary}
            >
              Limpar Filtros
            </button>
            <span className="text-xs text-white/50">
              {filteredCargos.length} {filteredCargos.length === 1 ? 'cargo encontrado' : 'cargos encontrados'}
            </span>
          </div>
        )}
      </div>

      <DataTable<Cargo>
        data={filteredCargos}
        keyExtractor={(c) => c.id}
        emptyMessage="Nenhum cargo encontrado"
        renderMobileCard={(c) => (
          <div className="bg-neutral/60 border border-white/10 rounded-xl p-4 space-y-3">
            {/* Cabeçalho: nome + status */}
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-white truncate flex-1">{c.nome}</p>
              <span className={`shrink-0 text-xs px-2 py-0.5 rounded font-medium ${
                c.ativo
                  ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                  : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
              }`}>
                {c.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            {/* Descrição */}
            {c.descricao && (
              <p className="text-xs text-white/60 line-clamp-2">{c.descricao}</p>
            )}
            {/* Info: usuários */}
            <div className="bg-white/5 rounded-lg p-3 text-sm">
              <p className="text-xs text-white/50 mb-0.5">Usuários</p>
              <p className="text-white/80 font-semibold">{c._count?.usuarios || 0}</p>
            </div>
            {/* Ações */}
            <div className="flex items-center gap-2 pt-1 border-t border-white/10">
              <button onClick={() => openEditModal(c)} className={btn.editSm}>Editar</button>
              <button onClick={() => toggleActive(c)} className={c.ativo ? btn.warningSm : btn.successSm}>
                {c.ativo ? 'Desativar' : 'Ativar'}
              </button>
              {c._count?.usuarios === 0 && (
                <button onClick={() => handleDelete(c)} className={btn.dangerSm}>Excluir</button>
              )}
            </div>
          </div>
        )}
        columns={[
          {
            key: 'nome',
            label: 'Nome',
            render: (c) => <span className="font-medium">{c.nome}</span>,
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
            key: 'usuarios',
            label: 'Usuários',
            render: (c) => <span>{c._count?.usuarios || 0}</span>,
          },
          {
            key: 'status',
            label: 'Status',
            render: (c) => (
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                c.ativo
                  ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                  : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
              }`}>
                {c.ativo ? 'Ativo' : 'Inativo'}
              </span>
            ),
          },
          {
            key: 'acoes',
            label: 'Ações',
            stopRowClick: true,
            render: (c) => (
              <div className="flex items-center gap-1.5 flex-nowrap">
                <button onClick={() => openEditModal(c)} className={btn.editSm}>
                  Editar
                </button>
                <button
                  onClick={() => toggleActive(c)}
                  className={c.ativo ? btn.warningSm : btn.successSm}
                >
                  {c.ativo ? 'Desativar' : 'Ativar'}
                </button>
                {c._count?.usuarios === 0 && (
                  <button onClick={() => handleDelete(c)} className={btn.dangerSm}>
                    Excluir
                  </button>
                )}
              </div>
            ),
          },
        ] satisfies DataTableColumn<Cargo>[]}
      />

      {/* Modal de Criar/Editar Cargo */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/10 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">
                {editingCargo ? 'Editar Cargo' : 'Novo Cargo'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingCargo(null);
                  setError(null);
                  setModalError(null);
                }}
                className="text-white/50 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                  placeholder="Ex: GERENTE, ANALISTA, etc."
                />
                {validation.hasError('nome') && (
                  <p className="text-red-500 text-xs mt-1">{validation.getFieldError('nome')}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">Descrição</label>
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))}
                  className="w-full bg-neutral/60 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="Descreva as responsabilidades deste cargo..."
                />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-2">
                  Páginas Permitidas
                </label>
                <div className="bg-neutral/60 border border-white/10 rounded-md p-4 max-h-48 overflow-y-auto">
                  <div className="space-y-2">
                    {todasPaginas.map((pagina) => (
                      <label
                        key={pagina.value}
                        className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={form.paginasPermitidas.includes(pagina.value)}
                          onChange={() => togglePagina(pagina.value)}
                          className="w-4 h-4 rounded border-white/10 bg-neutral/60 text-primary focus:ring-2 focus:ring-primary"
                        />
                        <span className="text-sm text-white/90">{pagina.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-white/50 mt-2">
                  Selecione as páginas que este cargo terá acesso
                </p>
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-2">
                  Permissões do Sistema
                </label>
                <div className="bg-neutral/60 border border-white/10 rounded-md p-4 space-y-4 max-h-60 overflow-y-auto">
                  {Object.keys(permissionsByModule).length === 0 && (
                    <p className="text-xs text-white/50">Nenhuma permissão cadastrada. Cadastre pelo backend.</p>
                  )}
                  {Object.entries(permissionsByModule).map(([modulo, permissions]) => (
                    <div key={modulo}>
                      <p className="text-xs uppercase tracking-wide text-white/50 mb-2">{modulo}</p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {permissions.map((permission) => (
                          <label
                            key={permission.id}
                            className="flex items-start gap-2 bg-white/5 hover:bg-white/10 rounded-md p-2 transition-colors cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={form.permissions.includes(permission.chave)}
                              onChange={() => togglePermissao(permission.chave)}
                              className="mt-1 w-4 h-4 rounded border-white/10 bg-neutral/60 text-primary focus:ring-2 focus:ring-primary"
                            />
                            <span className="text-sm text-white/80">
                              <span className="font-semibold block">{permission.descricao || permission.acao}</span>
                              <span className="text-xs text-white/50">{permission.modulo}:{permission.acao}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-white/50 mt-2">
                  O acesso do cargo é definido pelas permissões marcadas acima. Marque apenas o que este cargo pode fazer.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-white/70">Configurações</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    onChange={(e) => setForm((prev) => ({ ...prev, ativo: e.target.checked }))}
                    className="w-4 h-4 rounded border-white/10 bg-neutral/60 text-primary focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-sm text-white/70">Cargo ativo</span>
                </label>
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
                    setEditingCargo(null);
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
                    ? editingCargo
                      ? 'Salvando...'
                      : 'Criando...'
                    : editingCargo
                      ? 'Salvar Alterações'
                      : 'Criar Cargo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

