import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Projeto } from '../types';

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
}

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CreateProjectForm>({
    nome: '',
    resumo: '',
    objetivo: '',
    valorTotal: undefined,
    valorInsumos: undefined,
    supervisorId: undefined,
    responsavelIds: [],
  });

  async function loadProjects() {
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
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        nome: form.nome,
      };

      if (form.resumo) payload.resumo = form.resumo;
      if (form.objetivo) payload.objetivo = form.objetivo;
      if (form.valorTotal) payload.valorTotal = Number(form.valorTotal);
      if (form.valorInsumos) payload.valorInsumos = Number(form.valorInsumos);
      if (form.supervisorId) payload.supervisorId = Number(form.supervisorId);
      if (form.responsavelIds.length > 0) {
        payload.responsavelIds = form.responsavelIds.map(Number);
      }

      await api.post('/projects', payload);
      setShowModal(false);
      setForm({
        nome: '',
        resumo: '',
        objetivo: '',
        valorTotal: undefined,
        valorInsumos: undefined,
        supervisorId: undefined,
        responsavelIds: [],
      });
      loadProjects();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Erro ao criar projeto');
    } finally {
      setSubmitting(false);
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
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-md bg-primary hover:bg-primary/80 text-sm font-semibold transition-colors"
        >
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
              <th className="px-4 py-3 text-left">Supervisor</th>
              <th className="px-4 py-3 text-left">Valor Total</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-white/50">
                  Nenhum projeto cadastrado
                </td>
              </tr>
            ) : (
              projects.map((project) => (
                <tr
                  key={project.id}
                  className="border-t border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <td className="px-4 py-3">{project.nome}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        project.status === 'EM_ANDAMENTO'
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-green-500/20 text-green-300'
                      }`}
                    >
                      {project.status === 'EM_ANDAMENTO' ? 'Em Andamento' : 'Finalizado'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{project.supervisor?.nome ?? '—'}</td>
                  <td className="px-4 py-3">
                    {project.valorTotal.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Novo Projeto */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/10 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-neutral border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Novo Projeto</h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setError(null);
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
                    value={form.valorTotal || ''}
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
                    value={form.valorInsumos || ''}
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

              <div>
                <label className="block text-sm text-white/70 mb-1">Supervisor</label>
                <select
                  value={form.supervisorId || ''}
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

              {error && (
                <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-md text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setError(null);
                  }}
                  className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-sm font-semibold transition-colors"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-primary hover:bg-primary/80 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={submitting}
                >
                  {submitting ? 'Criando...' : 'Criar Projeto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
