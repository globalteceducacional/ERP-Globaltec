import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Etapa } from '../types';

export default function MyTasks() {
  const [tasks, setTasks] = useState<Etapa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchTasks() {
    try {
      const { data } = await api.get<Etapa[]>('/tasks/my');
      setTasks(data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Falha ao buscar tarefas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTasks();
  }, []);

  async function handleDeliver(taskId: number) {
    try {
      await api.post(`/tasks/${taskId}/deliver`);
      fetchTasks();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Não foi possível entregar a tarefa');
    }
  }

  if (loading) {
    return <p>Carregando tarefas...</p>;
  }

  if (error) {
    return <p className="text-danger">{error}</p>;
  }

  if (!tasks.length) {
    return <p>Nenhuma tarefa atribuída.</p>;
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <div key={task.id} className="bg-neutral/80 border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{task.nome}</h3>
              <p className="text-white/60 text-sm">Projeto: {task.projeto.nome}</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-white/10 text-xs uppercase tracking-wide">
              {task.status}
            </span>
          </div>
          <p className="text-sm text-white/70 mt-3">{task.descricao ?? 'Sem descrição'}</p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => handleDeliver(task.id)}
              className="px-4 py-2 rounded-md bg-success hover:bg-success/80 text-sm"
            >
              Entregar
            </button>
            <button className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-sm">
              Ver detalhes
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
