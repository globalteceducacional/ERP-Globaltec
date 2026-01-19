import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Projeto } from '../types';
import { toast, formatApiError } from '../utils/toast';
import { useAuthStore } from '../store/auth';

interface Etapa {
  id: number;
  nome: string;
  descricao?: string | null;
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'EM_ANALISE' | 'APROVADA' | 'REPROVADA';
  executor?: { id: number; nome: string } | null;
  integrantes?: Array<{ usuario: { id: number; nome: string } }>;
}

interface ProjectDetails extends Omit<Projeto, 'responsaveis'> {
  etapas?: Etapa[];
  responsaveis?: Array<{ usuario: { id: number; nome: string; email: string } }>;
}

interface SimpleUser {
  id: number;
  nome: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [projects, setProjects] = useState<ProjectDetails[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectDetails[]>([]);
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const [loadingDetails, setLoadingDetails] = useState<Set<number>>(new Set());

  // Verificar se o usuário é DIRETOR
  const isDiretor = useMemo(() => {
    if (!user) return false;
    if (typeof user.cargo === 'string') {
      return user.cargo === 'DIRETOR' || user.cargo === 'GM';
    }
    if (user.cargo && typeof user.cargo === 'object' && 'nome' in user.cargo) {
      return user.cargo.nome === 'DIRETOR' || user.cargo.nome === 'GM';
    }
    return false;
  }, [user]);

  // Carregar usuários para o filtro (apenas se for diretor)
  useEffect(() => {
    async function loadUsers() {
      if (!isDiretor) return;
      try {
        const { data } = await api.get<SimpleUser[]>('/users/options');
        setUsers(data);
      } catch (err) {
        console.error('Erro ao carregar usuários:', err);
      }
    }
    loadUsers();
  }, [isDiretor]);

  // Carregar projetos
  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get<Projeto[]>('/projects');
        setAllProjects(data);
        setProjects(data);
      } catch (err: any) {
        const errorMessage = formatApiError(err);
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Filtrar projetos baseado no usuário selecionado
  useEffect(() => {
    async function filterProjects() {
      if (selectedUserId === 'all') {
        setProjects(allProjects);
        return;
      }

      // Primeiro filtrar pelos projetos que já temos dados (supervisor e responsáveis)
      const initiallyFiltered = allProjects.filter(project => {
        // Verificar se o usuário é supervisor
        if (project.supervisor?.id === selectedUserId) {
          return true;
        }

        // Verificar se o usuário é responsável
        if (project.responsaveis?.some(resp => resp.usuario.id === selectedUserId)) {
          return true;
        }

        // Verificar se já temos etapas carregadas e o usuário está nelas
        if (project.etapas?.some(etapa => {
          if (etapa.executor?.id === selectedUserId) return true;
          if (etapa.integrantes?.some(integrante => integrante.usuario.id === selectedUserId)) return true;
          return false;
        })) {
          return true;
        }

        return false;
      });

      // Para projetos que ainda não foram expandidos, precisamos verificar as etapas
      const projectsToCheck = allProjects.filter(project => {
        // Já está na lista inicial, não precisa verificar novamente
        if (initiallyFiltered.some(p => p.id === project.id)) {
          return false;
        }
        // Se já tem etapas carregadas, já foi verificado acima
        if (project.etapas) {
          return false;
        }
        return true;
      });

      // Carregar detalhes dos projetos restantes para verificar etapas
      if (projectsToCheck.length > 0) {
        try {
          const projectsWithDetails = await Promise.all(
            projectsToCheck.map(async (project) => {
              try {
                const { data } = await api.get<ProjectDetails>(`/projects/${project.id}`);
                return data;
              } catch (err) {
                console.error(`Erro ao carregar detalhes do projeto ${project.id}:`, err);
                return null;
              }
            })
          );

          // Filtrar projetos que têm o usuário como executor ou integrante de etapas (remover nulls)
          const filteredByEtapas = projectsWithDetails
            .filter((project): project is ProjectDetails => project !== null)
            .filter(project => {
              return project.etapas?.some(etapa => {
                if (etapa.executor?.id === selectedUserId) return true;
                if (etapa.integrantes?.some(integrante => integrante.usuario.id === selectedUserId)) return true;
                return false;
              });
            });

          // Combinar todos os projetos filtrados
          const allFiltered = [...initiallyFiltered, ...filteredByEtapas];
          
          // Atualizar projetos com os detalhes carregados
          const validProjects = allFiltered.map(p => {
            const withDetails = projectsWithDetails.find(d => d !== null && d.id === p.id);
            return withDetails || p;
          });
          
          setProjects(validProjects);
        } catch (err) {
          console.error('Erro ao filtrar projetos:', err);
          // Em caso de erro, usar apenas os inicialmente filtrados
          setProjects(initiallyFiltered);
        }
      } else {
        // Se não há projetos para verificar, usar apenas os inicialmente filtrados
        setProjects(initiallyFiltered);
      }
    }

    filterProjects();
  }, [selectedUserId, allProjects]);

  async function toggleProject(projectId: number) {
    const isExpanded = expandedProjects.has(projectId);
    
    if (isExpanded) {
      // Colapsar
      setExpandedProjects(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });
    } else {
      // Expandir - buscar detalhes
      setLoadingDetails(prev => new Set(prev).add(projectId));
      
      try {
        const { data } = await api.get<ProjectDetails>(`/projects/${projectId}`);
        
        setProjects(prev => prev.map(p => 
          p.id === projectId 
            ? { ...p, etapas: data.etapas, responsaveis: data.responsaveis }
            : p
        ));
        
        setExpandedProjects(prev => new Set(prev).add(projectId));
      } catch (err: any) {
        const errorMessage = formatApiError(err);
        toast.error(errorMessage);
      } finally {
        setLoadingDetails(prev => {
          const newSet = new Set(prev);
          newSet.delete(projectId);
          return newSet;
        });
      }
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'EM_ANDAMENTO':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/50';
      case 'FINALIZADO':
        return 'bg-green-500/20 text-green-300 border-green-500/50';
      default:
        return 'bg-white/10 text-white/70 border-white/30';
    }
  }

  function getEtapaStatusColor(status: string) {
    switch (status) {
      case 'PENDENTE':
        return 'bg-yellow-500/20 text-yellow-300';
      case 'EM_ANDAMENTO':
        return 'bg-blue-500/20 text-blue-300';
      case 'EM_ANALISE':
        return 'bg-purple-500/20 text-purple-300';
      case 'APROVADA':
        return 'bg-green-500/20 text-green-300';
      case 'REPROVADA':
        return 'bg-red-500/20 text-red-300';
      default:
        return 'bg-white/10 text-white/70';
    }
  }

  function getEtapaStatusLabel(status: string) {
    const labels: Record<string, string> = {
      PENDENTE: 'Pendente',
      EM_ANDAMENTO: 'Em Andamento',
      EM_ANALISE: 'Em Análise',
      APROVADA: 'Completo', // Quando todas as checkboxes estão marcadas
      REPROVADA: 'Reprovada',
    };
    return labels[status] || status;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-white/70">Carregando projetos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-md">
        {error}
      </div>
    );
  }

  const ativos = projects.filter((p) => p.status === 'EM_ANDAMENTO').length;
  const finalizados = projects.filter((p) => p.status === 'FINALIZADO').length;

  return (
    <div className="space-y-6">
      {/* Filtro de Usuário (apenas para Diretores) */}
      {isDiretor && (
        <div className="bg-neutral/80 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-white/90 whitespace-nowrap">
              Filtrar por Usuário:
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="flex-1 max-w-xs bg-neutral/60 border border-white/10 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 1rem center',
                paddingRight: '2.5rem'
              }}
            >
              <option value="all" className="bg-neutral text-white">Todos os usuários</option>
              {users.map((u) => (
                <option key={u.id} value={u.id} className="bg-neutral text-white">
                  {u.nome}
                </option>
              ))}
            </select>
            {selectedUserId !== 'all' && (
              <button
                onClick={() => setSelectedUserId('all')}
                className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
              >
                Limpar Filtro
              </button>
            )}
          </div>
          {selectedUserId !== 'all' && (
            <p className="text-xs text-white/60 mt-2">
              Mostrando projetos onde <strong>{users.find(u => u.id === selectedUserId)?.nome}</strong> é supervisor, responsável ou executor/integrante de etapas
            </p>
          )}
        </div>
      )}

      {/* Cards de Métricas */}
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

      {/* Visualização Estilo Trello */}
              <div>
        <h3 className="text-xl font-semibold mb-4">Projetos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const isExpanded = expandedProjects.has(project.id);
            const isLoadingDetails = loadingDetails.has(project.id);
            const etapas = project.etapas || [];
            const responsaveis = project.responsaveis || [];

            return (
              <div
                key={project.id}
                className="bg-neutral/80 border border-white/10 rounded-xl overflow-hidden hover:border-primary/50 transition-all duration-200"
              >
                {/* Cabeçalho do Card - Oculto quando expandido */}
                {!isExpanded && (
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => toggleProject(project.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-lg text-white flex-1 pr-2">
                        {project.nome}
                      </h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/projects/${project.id}`);
                        }}
                        className="px-2 py-1 text-xs bg-primary/20 hover:bg-primary/30 text-primary rounded border border-primary/30 transition-colors"
                        title="Ver detalhes completos"
                      >
                        Ver
                      </button>
                    </div>

                    {project.resumo && (
                      <p className="text-sm text-white/60 mb-3 line-clamp-2">
                        {project.resumo}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(project.status)}`}>
                        {project.status === 'EM_ANDAMENTO' ? 'Em Andamento' : 'Finalizado'}
                      </span>
                      {project.progress !== undefined && (
                        <span className="text-xs text-white/60">
                          {project.progress}% concluído
                        </span>
                      )}
                    </div>

                    {project.progress !== undefined && (
                      <div className="w-full bg-white/10 rounded-full h-2 mb-3">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${project.progress}%` }}
                        />
              </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span>
                {project.supervisor ? `Supervisor: ${project.supervisor.nome}` : 'Sem supervisor'}
              </span>
                      <span className="flex items-center gap-1">
                        {isLoadingDetails ? (
                          <span>Carregando...</span>
                        ) : (
                          <>
                            <svg
                              className="w-4 h-4 transition-transform"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            Expandir
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {/* Conteúdo Expandido - Mostra apenas quando expandido */}
                {isExpanded && !isLoadingDetails && (
                  <div className="p-4 space-y-4">
                    {/* Cabeçalho do conteúdo expandido */}
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                      <div>
                        <h4 className="font-semibold text-lg text-white mb-1">
                          {project.nome}
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(project.status)}`}>
                            {project.status === 'EM_ANDAMENTO' ? 'Em Andamento' : 'Finalizado'}
                          </span>
                          {project.progress !== undefined && (
                            <span className="text-xs text-white/60">
                              {project.progress}% concluído
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/projects/${project.id}`);
                          }}
                          className="px-3 py-1.5 text-xs bg-primary/20 hover:bg-primary/30 text-primary rounded border border-primary/30 transition-colors"
                          title="Ver detalhes completos"
                        >
                          Ver Detalhes
                        </button>
                        <button
                          onClick={() => toggleProject(project.id)}
                          className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded border border-white/20 transition-colors flex items-center gap-1"
                          title="Recolher"
                        >
                          <svg
                            className="w-4 h-4 rotate-180"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          Recolher
                        </button>
                      </div>
                    </div>
                    {/* Integrantes */}
                    {(project.supervisor || responsaveis.length > 0) && (
                      <div>
                        <h5 className="text-sm font-semibold text-white/90 mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-3-3h-4a3 3 0 00-3 3v2zM13 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Equipe
                        </h5>
                        <div className="space-y-2">
                          {project.supervisor && (
                            <div className="flex items-center gap-2 text-sm">
                              <div className="w-2 h-2 rounded-full bg-primary"></div>
                              <span className="text-white/80">
                                <strong>Supervisor:</strong> {project.supervisor.nome}
                              </span>
                            </div>
                          )}
                          {responsaveis.map((resp, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                              <span className="text-white/80">
                                {resp.usuario.nome}
                              </span>
                            </div>
                          ))}
                          {!project.supervisor && responsaveis.length === 0 && (
                            <p className="text-xs text-white/50">Nenhum integrante cadastrado</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tarefas (Etapas) */}
                    <div>
                      <h5 className="text-sm font-semibold text-white/90 mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Tarefas ({etapas.length})
                      </h5>
                      {etapas.length > 0 ? (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {etapas.map((etapa) => (
                            <div
                              key={etapa.id}
                              className="bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h6 className="font-medium text-sm text-white/90 flex-1">
                                  {etapa.nome}
                                </h6>
                                <span className={`px-2 py-0.5 rounded text-xs ${getEtapaStatusColor(etapa.status)}`}>
                                  {getEtapaStatusLabel(etapa.status)}
                                </span>
                              </div>
                              
                              {etapa.descricao && (
                                <p className="text-xs text-white/60 mb-2 line-clamp-2">
                                  {etapa.descricao}
                                </p>
                              )}

                              <div className="flex items-center gap-3 text-xs text-white/50">
                                {etapa.executor && (
                                  <span className="flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    {etapa.executor.nome}
                                  </span>
                                )}
                                {etapa.integrantes && etapa.integrantes.length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                    {etapa.integrantes.length} integrante{etapa.integrantes.length !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
            </div>
          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-white/50">Nenhuma tarefa cadastrada</p>
                      )}
                    </div>

                    {/* Informações Adicionais */}
                    <div className="pt-3 border-t border-white/10">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-white/60">Valor Total:</span>
                          <p className="text-white/90 font-semibold">
                            {project.valorTotal.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </p>
                        </div>
                        {project._count && (
                          <div>
                            <span className="text-white/60">Etapas:</span>
                            <p className="text-white/90 font-semibold">{project._count.etapas || etapas.length}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Loading state quando expandindo */}
                {isExpanded && isLoadingDetails && (
                  <div className="p-8 flex items-center justify-center">
                    <div className="text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                      <p className="text-sm text-white/60">Carregando detalhes...</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {projects.length === 0 && (
          <div className="bg-neutral/80 border border-white/10 rounded-xl p-8 text-center">
            <p className="text-white/60">Nenhum projeto cadastrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
