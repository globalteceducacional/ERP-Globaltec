import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

interface Usuario {
  id: number;
  nome: string;
  email: string;
  cargo: string;
}

interface Subetapa {
  id: number;
  nome: string;
  descricao?: string | null;
  status: string;
}

interface Etapa {
  id: number;
  nome: string;
  descricao?: string | null;
  status: string;
  executor: Usuario;
  subetapas: Subetapa[];
}

interface Responsavel {
  id: number;
  usuario: Usuario;
}

interface Compra {
  id: number;
  item: string;
  quantidade: number;
  valorUnitario: number;
  status: string;
}

interface ProjectDetails {
  id: number;
  nome: string;
  resumo?: string | null;
  objetivo?: string | null;
  status: 'EM_ANDAMENTO' | 'FINALIZADO';
  valorTotal: number;
  valorInsumos: number;
  dataCriacao: string;
  supervisor?: Usuario | null;
  responsaveis: Responsavel[];
  etapas: Etapa[];
  compras: Compra[];
}

export default function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!id) {
        setError('ID do projeto não fornecido');
        setLoading(false);
        return;
      }

      try {
        setError(null);
        const { data } = await api.get<ProjectDetails>(`/projects/${id}`);
        setProject(data);
      } catch (err: any) {
        setError(err.response?.data?.message ?? 'Erro ao carregar projeto');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  function getStatusColor(status: string) {
    switch (status) {
      case 'EM_ANDAMENTO':
        return 'bg-blue-500/20 text-blue-300';
      case 'FINALIZADO':
        return 'bg-green-500/20 text-green-300';
      case 'CONCLUIDA':
      case 'APROVADA':
        return 'bg-green-500/20 text-green-300';
      case 'PENDENTE':
        return 'bg-yellow-500/20 text-yellow-300';
      case 'REPROVADA':
        return 'bg-red-500/20 text-red-300';
      default:
        return 'bg-gray-500/20 text-gray-300';
    }
  }

  function getStatusLabel(status: string) {
    const labels: Record<string, string> = {
      EM_ANDAMENTO: 'Em Andamento',
      FINALIZADO: 'Finalizado',
      PENDENTE: 'Pendente',
      CONCLUIDA: 'Concluída',
      APROVADA: 'Aprovada',
      REPROVADA: 'Reprovada',
    };
    return labels[status] || status;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-white/70">Carregando detalhes do projeto...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/projects')}
          className="text-primary hover:text-primary/80 flex items-center space-x-2"
        >
          <span>←</span>
          <span>Voltar para Projetos</span>
        </button>
        <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-md">
          {error ?? 'Projeto não encontrado'}
        </div>
      </div>
    );
  }

  const totalEtapas = project.etapas.length;
  const etapasConcluidas = project.etapas.filter((e) => e.status === 'CONCLUIDA' || e.status === 'APROVADA').length;
  const progresso = totalEtapas > 0 ? Math.round((etapasConcluidas / totalEtapas) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/projects')}
            className="text-primary hover:text-primary/80 transition-colors"
          >
            ← Voltar
          </button>
          <div>
            <h2 className="text-2xl font-bold">{project.nome}</h2>
            <span className={`px-2 py-1 rounded text-xs ${getStatusColor(project.status)}`}>
              {getStatusLabel(project.status)}
            </span>
          </div>
        </div>
      </div>

      {/* Informações Gerais */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-neutral/80 border border-white/10 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold border-b border-white/10 pb-2">Informações Gerais</h3>
          
          <div>
            <label className="text-sm text-white/70">Resumo</label>
            <p className="mt-1 text-white/90">{project.resumo || '—'}</p>
          </div>

          <div>
            <label className="text-sm text-white/70">Objetivo</label>
            <p className="mt-1 text-white/90">{project.objetivo || '—'}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/10">
            <div>
              <label className="text-sm text-white/70">Valor Total</label>
              <p className="mt-1 text-lg font-semibold text-primary">
                {project.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
            <div>
              <label className="text-sm text-white/70">Valor Insumos</label>
              <p className="mt-1 text-lg font-semibold">
                {project.valorInsumos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10">
            <label className="text-sm text-white/70">Data de Criação</label>
            <p className="mt-1">
              {new Date(project.dataCriacao).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>

        <div className="bg-neutral/80 border border-white/10 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold border-b border-white/10 pb-2">Equipe</h3>
          
          <div>
            <label className="text-sm text-white/70">Supervisor</label>
            <p className="mt-1 text-white/90">
              {project.supervisor ? (
                <span>
                  {project.supervisor.nome} <span className="text-white/50">({project.supervisor.email})</span>
                </span>
              ) : (
                '—'
              )}
            </p>
          </div>

          <div>
            <label className="text-sm text-white/70">
              Responsáveis ({project.responsaveis.length})
            </label>
            {project.responsaveis.length > 0 ? (
              <div className="mt-2 space-y-1">
                {project.responsaveis.map((resp) => (
                  <div key={resp.id} className="text-sm text-white/90">
                    • {resp.usuario.nome} <span className="text-white/50">({resp.usuario.cargo})</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-white/50">Nenhum responsável atribuído</p>
            )}
          </div>
        </div>
      </div>

      {/* Progresso */}
      {totalEtapas > 0 && (
        <div className="bg-neutral/80 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">Progresso do Projeto</h3>
            <span className="text-sm text-white/70">
              {etapasConcluidas} de {totalEtapas} etapas concluídas
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3">
            <div
              className="bg-primary h-3 rounded-full transition-all"
              style={{ width: `${progresso}%` }}
            />
          </div>
          <p className="text-sm text-white/70 mt-2">{progresso}% concluído</p>
        </div>
      )}

      {/* Etapas */}
      <div className="bg-neutral/80 border border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold border-b border-white/10 pb-2 mb-4">
          Etapas ({totalEtapas})
        </h3>
        {project.etapas.length === 0 ? (
          <p className="text-white/50 text-center py-8">Nenhuma etapa cadastrada</p>
        ) : (
          <div className="space-y-4">
            {project.etapas.map((etapa) => (
              <div key={etapa.id} className="bg-neutral/60 border border-white/10 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-white/90">{etapa.nome}</h4>
                    {etapa.descricao && (
                      <p className="text-sm text-white/70 mt-1">{etapa.descricao}</p>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${getStatusColor(etapa.status)}`}>
                    {getStatusLabel(etapa.status)}
                  </span>
                </div>
                <div className="text-sm text-white/70 mt-2">
                  Executor: {etapa.executor.nome} ({etapa.executor.cargo})
                </div>
                {etapa.subetapas.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <label className="text-xs text-white/70 mb-2 block">
                      Subetapas ({etapa.subetapas.length})
                    </label>
                    <div className="space-y-1">
                      {etapa.subetapas.map((sub) => (
                        <div key={sub.id} className="text-sm text-white/80 flex items-center justify-between">
                          <span>• {sub.nome}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(sub.status)}`}>
                            {getStatusLabel(sub.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compras */}
      {project.compras.length > 0 && (
        <div className="bg-neutral/80 border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold border-b border-white/10 pb-2 mb-4">
            Compras Relacionadas ({project.compras.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white/5 text-white/70">
                <tr>
                  <th className="px-4 py-2 text-left">Item</th>
                  <th className="px-4 py-2 text-left">Quantidade</th>
                  <th className="px-4 py-2 text-left">Valor Unitário</th>
                  <th className="px-4 py-2 text-left">Total</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {project.compras.map((compra) => (
                  <tr key={compra.id} className="border-t border-white/5">
                    <td className="px-4 py-2">{compra.item}</td>
                    <td className="px-4 py-2">{compra.quantidade}</td>
                    <td className="px-4 py-2">
                      {compra.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-2 font-semibold">
                      {(compra.quantidade * compra.valorUnitario).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(compra.status)}`}>
                        {getStatusLabel(compra.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

