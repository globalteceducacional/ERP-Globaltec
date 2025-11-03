import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Projeto } from '../types';

export default function Dashboard() {
  const [projects, setProjects] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get<Projeto[]>('/projects');
        setProjects(data);
      } catch (err: any) {
        setError(err.response?.data?.message ?? 'Não foi possível carregar os projetos');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <p>Carregando dados...</p>;
  }

  if (error) {
    return <p className="text-danger">{error}</p>;
  }

  const ativos = projects.filter((p) => p.status === 'EM_ANDAMENTO').length;
  const finalizados = projects.filter((p) => p.status === 'FINALIZADO').length;

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/10 bg-neutral/80 p-6">
          <h3 className="text-sm text-white/60">Projetos Ativos</h3>
          <p className="text-3xl font-bold">{ativos}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-neutral/80 p-6">
          <h3 className="text-sm text-white/60">Projetos Finalizados</h3>
          <p className="text-3xl font-bold">{finalizados}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-neutral/80 p-6">
          <h3 className="text-sm text-white/60">Valor Total (R$)</h3>
          <p className="text-3xl font-bold">
            {projects.reduce((acc, project) => acc + (project.valorTotal ?? 0), 0).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-neutral/80 p-6">
        <h3 className="text-lg font-semibold mb-4">Últimos Projetos</h3>
        <div className="space-y-4">
          {projects.slice(0, 5).map((project) => (
            <div key={project.id} className="flex items-center justify-between border-b border-white/5 pb-2">
              <div>
                <p className="font-medium">{project.nome}</p>
                <p className="text-sm text-white/60">Status: {project.status}</p>
              </div>
              <span className="text-sm text-white/60">
                {project.supervisor ? `Supervisor: ${project.supervisor.nome}` : 'Sem supervisor'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
