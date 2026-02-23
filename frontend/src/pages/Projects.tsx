import { useEffect, useState, FormEvent, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Projeto } from '../types';
import { btn } from '../utils/buttonStyles';
import { DataTable, DataTableColumn } from '../components/DataTable';
import { toast, formatApiError } from '../utils/toast';
import { useFormValidation, validators, errorMessages } from '../utils/validation';

interface SimpleUser {
  id: number;
  nome: string;
}

interface CreateProjectForm {
  nome: string;
  resumo?: string;
  objetivo?: string;
  valorTotal?: number;
  supervisorId?: number;
  responsavelIds: number[];
  status?: 'EM_ANDAMENTO' | 'FINALIZADO';
}

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Projeto | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [editingProject, setEditingProject] = useState<Projeto | null>(null);
  const [form, setForm] = useState<CreateProjectForm>({
    nome: '',
    resumo: '',
    objetivo: '',
    valorTotal: undefined,
    supervisorId: undefined,
    responsavelIds: [],
    status: 'EM_ANDAMENTO',
  });

  const statusOptions = [
    { value: 'EM_ANDAMENTO', label: 'Em Andamento' },
    { value: 'FINALIZADO', label: 'Finalizado' },
  ];

  // Regras de validação
  const validationRules = useMemo(() => ({
    nome: [
      { validator: validators.required, message: errorMessages.required },
      { validator: validators.minLength(3), message: errorMessages.minLength(3) },
      { validator: validators.maxLength(120), message: errorMessages.maxLength(120) },
    ],
    valorTotal: form.valorTotal !== undefined && form.valorTotal !== null
      ? [{ validator: validators.positive, message: errorMessages.positive }]
      : [],
    supervisorId: form.supervisorId !== undefined && form.supervisorId !== null
      ? [{ validator: (v: number) => v > 0, message: 'Selecione um supervisor' }]
      : [],
  }), [form.valorTotal, form.supervisorId]);

  // Validação de formulário
  const validation = useFormValidation<CreateProjectForm>(validationRules);

  async function loadProjects() {
    setLoading(true);
    try {
      setError(null);
      const { data } = await api.get<Projeto[]>('/projects');
      setProjects(data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Falha ao carregar projetos');
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const { data } = await api.get<SimpleUser[]>('/users/options');
      setUsers(data);
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
    }
  }

  useEffect(() => {
    loadProjects();
    loadUsers();

    // Recarregar projetos quando a página ganha foco novamente
    const handleFocus = () => {
      loadProjects();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

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

      if (editingProject) {
        const payload: any = {
          nome: form.nome.trim(),
        };

        if (typeof form.resumo === 'string') payload.resumo = form.resumo?.trim() ?? '';
        if (typeof form.objetivo === 'string') payload.objetivo = form.objetivo?.trim() ?? '';
        if (typeof form.valorTotal === 'number') payload.valorTotal = form.valorTotal;
        if (typeof form.supervisorId !== 'undefined') payload.supervisorId = form.supervisorId;
        if (form.status) payload.status = form.status;

        await api.patch(`/projects/${editingProject.id}`, payload);

        // Sempre atualizar responsáveis, mesmo se o array estiver vazio (para remover todos)
        await api.patch(`/projects/${editingProject.id}/responsibles`, {
          responsavelIds: form.responsavelIds,
        });
      } else {
        const payload: any = {
          nome: form.nome.trim(),
        };

        if (form.resumo && form.resumo.trim().length > 0) payload.resumo = form.resumo.trim();
        if (form.objetivo && form.objetivo.trim().length > 0) payload.objetivo = form.objetivo.trim();
        if (typeof form.valorTotal === 'number') payload.valorTotal = form.valorTotal;
        if (form.supervisorId) payload.supervisorId = form.supervisorId;
        if (form.responsavelIds.length > 0) {
          payload.responsavelIds = form.responsavelIds;
        }

        await api.post('/projects', payload);
      }

      setShowModal(false);
      setEditingProject(null);
      setForm({
        nome: '',
        resumo: '',
        objetivo: '',
        valorTotal: undefined,
        supervisorId: undefined,
        responsavelIds: [],
        status: 'EM_ANDAMENTO',
      });
      validation.reset();
      await loadProjects();
      toast.success(editingProject ? 'Projeto atualizado com sucesso!' : 'Projeto criado com sucesso!');
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setModalError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  function openCreateModal() {
    setEditingProject(null);
    setForm({
      nome: '',
      resumo: '',
      objetivo: '',
      valorTotal: undefined,
      supervisorId: undefined,
      responsavelIds: [],
      status: 'EM_ANDAMENTO',
    });
    validation.reset();
    setModalError(null);
    setShowModal(true);
  }

  function openEditModal(project: Projeto) {
    setEditingProject(project);
    setForm({
      nome: project.nome,
      resumo: project.resumo ?? '',
      objetivo: project.objetivo ?? '',
      valorTotal: project.valorTotal ?? undefined,
      supervisorId: project.supervisor?.id ?? undefined,
      responsavelIds: project.responsaveis ? project.responsaveis.map((r) => r.usuario.id) : [],
      status: project.status,
    });
    validation.reset();
    setModalError(null);
    setShowModal(true);
  }

  async function handleDeleteProject(id: number) {
    const project = projects.find((p) => p.id === id);
    if (!project) return;
    
    setProjectToDelete(project);
    setDeleteConfirmName('');
    setError(null);
    setShowDeleteModal(true);
  }

  async function handleConfirmDelete() {
    if (!projectToDelete) return;
    
    if (deleteConfirmName.trim() !== projectToDelete.nome.trim()) {
      setError('O nome digitado não corresponde ao nome do projeto.');
      return;
    }

    setDeletingId(projectToDelete.id);
    setError(null);
    
    try {
      await api.delete(`/projects/${projectToDelete.id}`);
      setShowDeleteModal(false);
      setProjectToDelete(null);
      setDeleteConfirmName('');
      await loadProjects();
      toast.success('Projeto excluído com sucesso!');
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setDeletingId(null);
    }
  }

  const responsaveisSelectRef = useRef<HTMLSelectElement>(null);

  const statusLabels: Record<string, { label: string; className: string }> = {
    EM_ANDAMENTO: { label: 'Em Andamento', className: 'bg-blue-500/20 text-blue-300 border border-blue-500/40' },
    FINALIZADO: { label: 'Finalizado', className: 'bg-green-500/20 text-green-300 border border-green-500/40' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-white/70">Carregando projetos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold sm:text-xl">Projetos</h3>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button
            onClick={() => navigate('/projects/import')}
            className={`${btn.success} flex-1 sm:flex-none`}
          >
            Importar do Excel
          </button>
          <button onClick={openCreateModal} className={`${btn.primary} flex-1 sm:flex-none`}>
            Novo Projeto
          </button>
        </div>
      </div>

      {error && !showModal && (
        <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <DataTable<Projeto>
        data={projects}
        keyExtractor={(p) => p.id}
        emptyMessage="Nenhum projeto cadastrado"
        onRowClick={(p) => navigate(`/projects/${p.id}`)}
        renderMobileCard={(p) => {
          const progressValue = p.progress ?? 0;
          const statusKey = progressValue === 100 ? 'FINALIZADO' : p.status;
          const status = statusLabels[statusKey] ?? statusLabels.EM_ANDAMENTO;
          return (
            <div
              className="bg-neutral/60 border border-white/10 rounded-xl p-4 space-y-3 cursor-pointer active:bg-white/5"
              onClick={() => navigate(`/projects/${p.id}`)}
            >
              {/* Cabeçalho: nome + status */}
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-white truncate flex-1">{p.nome}</p>
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded font-medium ${status.className}`}>
                  {status.label}
                </span>
              </div>
              {/* Barra de progresso */}
              <div className="space-y-1">
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      progressValue >= 100
                        ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                        : progressValue >= 50
                          ? 'bg-gradient-to-r from-blue-500 to-cyan-400'
                          : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                    }`}
                    style={{ width: `${progressValue}%` }}
                  />
                </div>
                <span className={`text-xs font-medium ${
                  progressValue >= 100 ? 'text-green-400' : progressValue >= 50 ? 'text-blue-400' : 'text-amber-400'
                }`}>{progressValue}% concluído</span>
              </div>
              {/* Info: supervisor + valor */}
              <div className="grid grid-cols-2 gap-2 bg-white/5 rounded-lg p-3 text-sm">
                <div>
                  <p className="text-xs text-white/50 mb-0.5">Supervisor</p>
                  <p className="text-white/90 truncate">{p.supervisor?.nome ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-white/50 mb-0.5">Valor Total</p>
                  <p className="text-white/90 font-medium">
                    {p.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              </div>
              {/* Ações */}
              <div className="flex items-center gap-2 pt-1 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => openEditModal(p)} className={btn.editSm}>Editar</button>
                <button
                  onClick={() => handleDeleteProject(p.id)}
                  className={btn.dangerSm}
                  disabled={deletingId === p.id}
                >
                  {deletingId === p.id ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          );
        }}
        columns={[
          {
            key: 'nome',
            label: 'Nome',
            render: (p) => (
              <span className="block truncate font-medium" title={p.nome}>{p.nome}</span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            thClassName: 'min-w-[7rem]',
            tdClassName: 'whitespace-nowrap min-w-[7rem]',
            render: (p) => {
              const progressValue = p.progress ?? 0;
              const statusKey = progressValue === 100 ? 'FINALIZADO' : p.status;
              const status = statusLabels[statusKey] ?? statusLabels.EM_ANDAMENTO;
              return (
                <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap min-w-[6.5rem] ${status.className}`}>
                  {status.label}
                </span>
              );
            },
          },
          {
            key: 'progresso',
            label: 'Progresso',
            render: (p) => {
              const progressValue = p.progress ?? 0;
              return (
                <div className="space-y-1 min-w-[6rem]">
                  <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        progressValue >= 100
                          ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                          : progressValue >= 50
                            ? 'bg-gradient-to-r from-blue-500 to-cyan-400'
                            : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                      }`}
                      style={{ width: `${progressValue}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${
                    progressValue >= 100 ? 'text-green-400' : progressValue >= 50 ? 'text-blue-400' : 'text-amber-400'
                  }`}>{progressValue}%</span>
                </div>
              );
            },
          },
          {
            key: 'supervisor',
            label: 'Supervisor',
            render: (p) => <span>{p.supervisor?.nome ?? '—'}</span>,
          },
          {
            key: 'valorTotal',
            label: 'Valor Total',
            render: (p) => (
              <span className="whitespace-nowrap">
                {p.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            ),
          },
          {
            key: 'acoes',
            label: 'Ações',
            stopRowClick: true,
            render: (p) => (
              <div className="flex items-center gap-1.5 flex-nowrap">
                <button onClick={() => openEditModal(p)} className={btn.editSm}>
                  Editar
                </button>
                <button
                  onClick={() => handleDeleteProject(p.id)}
                  className={btn.dangerSm}
                  disabled={deletingId === p.id}
                >
                  {deletingId === p.id ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            ),
          },
        ] satisfies DataTableColumn<Projeto>[]}
      />

      {/* Modal de Novo Projeto */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/10 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">
                {editingProject ? 'Editar Projeto' : 'Novo Projeto'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setError(null);
                  setModalError(null);
                  setEditingProject(null);
                }}
                className="text-white/50 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  Nome do Projeto <span className="text-danger">*</span>
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
                  maxLength={120}
                />
                {validation.hasError('nome') && (
                  <p className="text-red-500 text-xs mt-1">{validation.getFieldError('nome')}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">Resumo</label>
                <textarea
                value={form.resumo}
                onChange={(e) => setForm((prev) => ({ ...prev, resumo: e.target.value }))}
                  className="w-full bg-neutral/60 border border-white/10 rounded-md px-3 py-2 h-20 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">Objetivo</label>
                <textarea
                value={form.objetivo}
                onChange={(e) => setForm((prev) => ({ ...prev, objetivo: e.target.value }))}
                  className="w-full bg-neutral/60 border border-white/10 rounded-md px-3 py-2 h-20 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">Valor Total (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={typeof form.valorTotal === 'number' ? form.valorTotal : ''}
                  onChange={(e) => {
                    const value = e.target.value ? Number(e.target.value) : undefined;
                    setForm((prev) => ({ ...prev, valorTotal: value }));
                    if (value !== undefined) {
                      validation.handleChange('valorTotal', value);
                    }
                  }}
                  onBlur={() => {
                    if (form.valorTotal !== undefined) {
                      validation.handleBlur('valorTotal');
                    }
                  }}
                  className={`w-full bg-neutral/60 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 ${
                    validation.hasError('valorTotal')
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-white/10 focus:ring-primary'
                  }`}
                />
                {validation.hasError('valorTotal') && (
                  <p className="text-red-500 text-xs mt-1">{validation.getFieldError('valorTotal')}</p>
                )}
              </div>

              {editingProject && (
                <div>
                  <label className="block text-sm text-white/70 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        status: e.target.value as 'EM_ANDAMENTO' | 'FINALIZADO',
                      }))
                    }
                    className="w-full bg-neutral/60 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Supervisor *</label>
                <select
                  required
                  value={form.supervisorId ?? ''}
                  onChange={(e) => {
                    const newSupervisorId = e.target.value ? Number(e.target.value) : undefined;
                    setForm((prev) => {
                      // Remover o supervisor da lista de responsáveis se ele estiver lá
                      const newResponsavelIds = prev.responsavelIds.filter(
                        (id) => id !== newSupervisorId
                      );
                      return {
                        ...prev,
                        supervisorId: newSupervisorId,
                        responsavelIds: newResponsavelIds,
                      };
                    });
                  }}
                  className="w-full bg-neutral border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 1rem center',
                    paddingRight: '2.5rem'
                  }}
                >
                  <option value="" className="bg-neutral text-white">Selecione um supervisor...</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id} className="bg-neutral text-white">
                      {user.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Responsáveis</label>
                <select
                  ref={responsaveisSelectRef}
                  value=""
                  onChange={(e) => {
                    const selectedUserId = Number(e.target.value);
                    if (selectedUserId && !form.responsavelIds.includes(selectedUserId)) {
                      setForm({
                        ...form,
                        responsavelIds: [...form.responsavelIds, selectedUserId],
                      });
                    }
                    // Resetar o select após seleção
                    if (responsaveisSelectRef.current) {
                      responsaveisSelectRef.current.value = '';
                    }
                  }}
                  className="w-full bg-neutral border border-white/30 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 1rem center',
                    paddingRight: '2.5rem'
                  }}
                >
                  <option value="" className="bg-neutral text-white">Selecione um responsável...</option>
                  {users
                    .filter((user) => 
                      !form.responsavelIds.includes(user.id) && 
                      user.id !== form.supervisorId
                    )
                    .map((user) => (
                      <option key={user.id} value={user.id} className="bg-neutral text-white">
                        {user.nome}
                      </option>
                    ))}
                </select>
                {form.responsavelIds.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {form.responsavelIds.map((responsavelId) => {
                      const responsavel = users.find((u) => u.id === responsavelId);
                      if (!responsavel) return null;
                      return (
                        <div
                          key={responsavelId}
                          className="flex items-center justify-between bg-white/5 border border-white/10 rounded-md px-3 py-2"
                        >
                          <span className="text-sm text-white/90">
                            {responsavel.nome}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setForm({
                                ...form,
                                responsavelIds: form.responsavelIds.filter((id) => id !== responsavelId),
                              });
                            }}
                            className="text-danger hover:text-danger/80 text-sm font-medium transition-colors"
                          >
                            Remover
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {form.responsavelIds.length === 0 && (
                  <p className="text-xs text-white/50 mt-2">Nenhum responsável adicionado ainda</p>
                )}
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
                    setEditingProject(null);
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
                  {submitting ? (editingProject ? 'Salvando...' : 'Criando...') : editingProject ? 'Salvar Alterações' : 'Criar Projeto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão de Projeto */}
      {showDeleteModal && projectToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-md w-full">
            <div className="px-8 py-6 border-b border-white/20">
              <h2 className="text-2xl font-bold text-white">Confirmar Exclusão</h2>
            </div>
            <div className="p-8">
              <p className="text-white/90 mb-2">
                Tem certeza que deseja remover o projeto:
              </p>
              <p className="text-xl font-semibold text-white mb-6">
                "{projectToDelete.nome}"
              </p>
              <p className="text-sm text-white/70 mb-4">
                Esta ação não pode ser desfeita. Para confirmar, digite o nome do projeto:
              </p>
              <div className="mb-6">
                <input
                  type="text"
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  placeholder="Digite o nome do projeto"
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  autoFocus
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
                    setShowDeleteModal(false);
                    setProjectToDelete(null);
                    setDeleteConfirmName('');
                    setError(null);
                  }}
                  className={btn.secondaryLg}
                  disabled={deletingId === projectToDelete.id}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className={btn.dangerLg}
                  disabled={deletingId === projectToDelete.id || deleteConfirmName.trim() !== projectToDelete.nome.trim()}
                >
                  {deletingId === projectToDelete.id ? 'Removendo...' : 'Confirmar Remoção'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
