import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Projeto } from '../types';
import { buttonStyles } from '../utils/buttonStyles';

interface SimpleUser {
  id: number;
  nome: string;
}

interface CreateProjectForm {
  nome: string;
  resumo?: string;
  objetivo?: string;
  valorTotal?: number;
  valorInsumos?: number;
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
    valorInsumos: undefined,
    supervisorId: undefined,
    responsavelIds: [],
    status: 'EM_ANDAMENTO',
  });

  const statusOptions = [
    { value: 'EM_ANDAMENTO', label: 'Em Andamento' },
    { value: 'FINALIZADO', label: 'Finalizado' },
  ];

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

    try {
      if (form.nome.trim().length === 0) {
        setModalError('Nome do projeto é obrigatório');
        return;
      }

      if (editingProject) {
        const payload: any = {
          nome: form.nome.trim(),
        };

        if (typeof form.resumo === 'string') payload.resumo = form.resumo?.trim() ?? '';
        if (typeof form.objetivo === 'string') payload.objetivo = form.objetivo?.trim() ?? '';
        if (typeof form.valorTotal === 'number') payload.valorTotal = form.valorTotal;
        if (typeof form.valorInsumos === 'number') payload.valorInsumos = form.valorInsumos;
        if (typeof form.supervisorId !== 'undefined') payload.supervisorId = form.supervisorId;
        if (form.status) payload.status = form.status;

        await api.patch(`/projects/${editingProject.id}`, payload);

        if (form.responsavelIds.length > 0) {
          await api.patch(`/projects/${editingProject.id}/responsibles`, {
            responsavelIds: form.responsavelIds,
          });
        }
      } else {
        const payload: any = {
          nome: form.nome.trim(),
        };

        if (form.resumo && form.resumo.trim().length > 0) payload.resumo = form.resumo.trim();
        if (form.objetivo && form.objetivo.trim().length > 0) payload.objetivo = form.objetivo.trim();
        if (typeof form.valorTotal === 'number') payload.valorTotal = form.valorTotal;
        if (typeof form.valorInsumos === 'number') payload.valorInsumos = form.valorInsumos;
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
        valorInsumos: undefined,
        supervisorId: undefined,
        responsavelIds: [],
        status: 'EM_ANDAMENTO',
      });
      await loadProjects();
    } catch (err: any) {
      const message = err.response?.data?.message ?? 'Erro ao salvar projeto';
      setModalError(typeof message === 'string' ? message : JSON.stringify(message));
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
      valorInsumos: undefined,
      supervisorId: undefined,
      responsavelIds: [],
      status: 'EM_ANDAMENTO',
    });
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
      valorInsumos: project.valorInsumos ?? undefined,
      supervisorId: project.supervisor?.id ?? undefined,
      responsavelIds: project.responsaveis ? project.responsaveis.map((r) => r.usuario.id) : [],
      status: project.status,
    });
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
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Erro ao excluir projeto');
    } finally {
      setDeletingId(null);
    }
  }

  function toggleResponsavel(userId: number) {
    setForm((prev) => ({
      ...prev,
      responsavelIds: prev.responsavelIds.includes(userId)
        ? prev.responsavelIds.filter((id) => id !== userId)
        : [...prev.responsavelIds, userId],
    }));
  }

  const statusLabels: Record<string, { label: string; className: string }> = {
    EM_ANDAMENTO: { label: 'Em Andamento', className: 'bg-blue-500/20 text-blue-300' },
    FINALIZADO: { label: 'Finalizado', className: 'bg-green-500/20 text-green-300' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-white/70">Carregando projetos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Projetos</h3>
        <button onClick={openCreateModal} className={buttonStyles.primary}>
          Novo Projeto
        </button>
      </div>

      {error && !showModal && (
        <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Progresso</th>
              <th className="px-4 py-3 text-left">Supervisor</th>
              <th className="px-4 py-3 text-left">Valor Total</th>
              <th className="px-4 py-3 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-white/50">
                  Nenhum projeto cadastrado
                </td>
              </tr>
            ) : (
              projects.map((project) => {
                const progressValue = project.progress ?? 0;
                const statusKey = progressValue === 100 ? 'FINALIZADO' : project.status;
                const status = statusLabels[statusKey] ?? statusLabels.EM_ANDAMENTO;

                return (
                  <tr
                    key={project.id}
                    className="border-t border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td
                      className="px-4 py-3 cursor-pointer"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      {project.nome}
                    </td>
                    <td 
                      className="px-4 py-3 cursor-pointer"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <span className={`px-2 py-1 rounded text-xs ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td 
                      className="px-4 py-3 cursor-pointer"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <div className="space-y-1">
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${progressValue}%` }}
                          />
                        </div>
                        <span className="text-xs text-white/60">{progressValue}%</span>
                      </div>
                    </td>
                    <td 
                      className="px-4 py-3 cursor-pointer"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      {project.supervisor?.nome ?? '—'}
                    </td>
                    <td 
                      className="px-4 py-3 cursor-pointer"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      {project.valorTotal.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </td>
                    <td 
                      className="px-4 py-3 flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => openEditModal(project)}
                        className={buttonStyles.edit}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteProject(project.id)}
                        className={`${buttonStyles.danger} disabled:opacity-50 disabled:cursor-not-allowed`}
                        disabled={deletingId === project.id}
                      >
                        {deletingId === project.id ? 'Excluindo...' : 'Excluir'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

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
                  onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
                  className="w-full bg-neutral/60 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                  maxLength={120}
                />
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

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">Valor Total (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={typeof form.valorTotal === 'number' ? form.valorTotal : ''}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        valorTotal: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                    className="w-full bg-neutral/60 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm text-white/70 mb-1">Valor Insumos (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={typeof form.valorInsumos === 'number' ? form.valorInsumos : ''}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        valorInsumos: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                    className="w-full bg-neutral/60 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
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
                <label className="block text-sm text-white/70 mb-1">Supervisor</label>
                <select
                  value={form.supervisorId ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      supervisorId: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                  className="w-full bg-neutral/60 border border-white/10 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Selecione um supervisor...</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-2">Responsáveis</label>
                <div className="bg-neutral/40 border border-white/10 rounded-md p-3 max-h-40 overflow-y-auto">
                  {users.length === 0 ? (
                    <p className="text-white/50 text-sm">Carregando usuários...</p>
                  ) : (
                    <div className="space-y-2">
                      {users.map((user) => (
                        <label
                          key={user.id}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-white/5 p-2 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={form.responsavelIds.includes(user.id)}
                            onChange={() => toggleResponsavel(user.id)}
                            className="rounded border-white/20"
                          />
                          <span className="text-sm">{user.nome}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {form.responsavelIds.length > 0 && (
                  <p className="text-xs text-white/50 mt-1">
                    {form.responsavelIds.length} responsável(is) selecionado(s)
                  </p>
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
                  className={buttonStyles.secondary}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`${buttonStyles.primary} disabled:opacity-50 disabled:cursor-not-allowed`}
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
                  className="px-6 py-2.5 rounded-md bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
                  disabled={deletingId === projectToDelete.id}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-6 py-2.5 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
