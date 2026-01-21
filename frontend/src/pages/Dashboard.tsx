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

// Resposta simplificada da rota /tasks/my (reutilizada para limitar projetos do usuário)
interface MyTasksResponse {
  projetos: Projeto[];
  etapasPendentes: any[];
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

  // Verificar se o usuário tem acesso à página de projetos
  const hasProjectsAccess = useMemo(() => {
    if (!user) return false;

    let paginasPermitidas: string[] = [];
    
    if (typeof user.cargo === 'string') {
      const allowedMap: Record<string, string[]> = {
        DIRETOR: ['/dashboard', '/projects', '/tasks/my', '/stock', '/communications', '/users', '/cargos'],
        SUPERVISOR: ['/tasks/my', '/communications'],
        EXECUTOR: ['/tasks/my', '/communications'],
        COTADOR: ['/tasks/my', '/stock', '/communications'],
        PAGADOR: ['/tasks/my', '/stock', '/communications'],
      };
      paginasPermitidas = allowedMap[user.cargo] || [];
    } else if (user.cargo && typeof user.cargo === 'object' && 'nome' in user.cargo) {
      if (user.cargo.paginasPermitidas && Array.isArray(user.cargo.paginasPermitidas)) {
        paginasPermitidas = user.cargo.paginasPermitidas;
      } else {
        const allowedMap: Record<string, string[]> = {
          DIRETOR: ['/dashboard', '/projects', '/tasks/my', '/stock', '/communications', '/users', '/cargos'],
          SUPERVISOR: ['/tasks/my', '/communications'],
          EXECUTOR: ['/tasks/my', '/communications'],
          COTADOR: ['/tasks/my', '/stock'],
          PAGADOR: ['/tasks/my', '/stock'],
        };
        paginasPermitidas = allowedMap[user.cargo.nome] || [];
      }
    }

    return paginasPermitidas.includes('/projects');
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
        setLoading(true);

        if (hasProjectsAccess) {
          // Usuários com acesso a "Projetos" veem todos os projetos
          const { data } = await api.get<Projeto[]>('/projects');
          setAllProjects(data);
          setProjects(data);
        } else {
          // Usuários SEM acesso a "Projetos" veem apenas projetos em que estão inseridos
          const { data } = await api.get<MyTasksResponse>('/tasks/my');
          const userProjects = data.projetos ?? [];
          const etapasPendentes = (data.etapasPendentes ?? []) as any[];

          // Agrupar etapas pendentes por projeto
          const projectsWithEtapas: ProjectDetails[] = userProjects.map((project) => {
            const etapasForProject: Etapa[] = etapasPendentes
              .filter((etapa: any) => etapa.projeto?.id === project.id)
              .map((etapa: any) => ({
                id: etapa.id,
                nome: etapa.nome,
                descricao: etapa.descricao,
                status: etapa.status,
                executor: etapa.executor
                  ? { id: etapa.executor.id, nome: etapa.executor.nome }
                  : null,
                integrantes: (etapa.integrantes ?? []).map((i: any) => ({
                  usuario: { id: i.usuario.id, nome: i.usuario.nome },
                })),
              }));

            return {
              ...project,
              etapas: etapasForProject,
            };
          });

          setAllProjects(projectsWithEtapas);
          setProjects(projectsWithEtapas);
        }
      } catch (err: any) {
        const errorMessage = formatApiError(err);
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [hasProjectsAccess]);

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
      // Usuários sem acesso a "Projetos" não devem buscar detalhes adicionais via /projects/:id
      if (!hasProjectsAccess) {
        setExpandedProjects(prev => {
          const newSet = new Set(prev);
          newSet.add(projectId);
          return newSet;
        });
        return;
      }

      // Expandir - buscar detalhes completos do projeto
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
        return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40';
      case 'EM_ANDAMENTO':
        return 'bg-blue-500/20 text-blue-300 border border-blue-500/40';
      case 'EM_ANALISE':
        return 'bg-purple-500/20 text-purple-300 border border-purple-500/40';
      case 'APROVADA':
        return 'bg-green-500/20 text-green-300 border border-green-500/40';
      case 'REPROVADA':
        return 'bg-red-500/20 text-red-300 border border-red-500/40';
      default:
        return 'bg-white/10 text-white/70 border border-white/20';
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
        <div className="rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-6 hover:border-blue-500/50 transition-all">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm text-blue-300/80 font-medium">Projetos Ativos</h3>
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-4xl font-bold text-blue-100">{ativos}</p>
        </div>
        <div className="rounded-xl border border-green-500/30 bg-gradient-to-br from-green-500/10 to-green-600/5 p-6 hover:border-green-500/50 transition-all">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm text-green-300/80 font-medium">Projetos Finalizados</h3>
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-4xl font-bold text-green-100">{finalizados}</p>
        </div>
        {hasProjectsAccess && (
          <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-6 hover:border-amber-500/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm text-amber-300/80 font-medium">Valor Total</h3>
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-amber-100">
              {projects.reduce((acc, project) => acc + (project.valorTotal ?? 0), 0).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </p>
          </div>
        )}
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
                className="bg-gradient-to-br from-neutral/90 to-neutral/70 border border-white/10 rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
              >
                {/* Cabeçalho do Card - Sempre visível */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-lg text-white flex-1 pr-2">
                      {project.nome}
                    </h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasProjectsAccess) {
                          navigate(`/projects/${project.id}`);
                        } else {
                          navigate('/tasks/my');
                        }
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
                    <div className="w-full bg-white/10 rounded-full h-2.5 mb-3 overflow-hidden">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${
                          project.progress >= 100 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-400' 
                            : project.progress >= 50 
                              ? 'bg-gradient-to-r from-blue-500 to-cyan-400'
                              : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                        }`}
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>
                      {project.supervisor ? `Supervisor: ${project.supervisor.nome}` : 'Sem supervisor'}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleProject(project.id)}
                      className="flex items-center gap-1 text-xs text-white/70 hover:text-primary transition-colors"
                    >
                      {isLoadingDetails ? (
                        <span>Carregando...</span>
                      ) : (
                        <>
                          <svg
                            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          {isExpanded ? 'Recolher' : 'Expandir'}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Conteúdo Expandido com animação de abrir/fechar */}
                <div
                  className={`transition-all duration-300 ease-in-out overflow-hidden border-t border-white/10 ${
                    isExpanded && !isLoadingDetails ? 'max-h-[520px] opacity-100 px-4 pb-4 pt-4' : 'max-h-0 opacity-0 px-4'
                  }`}
                >
                  {isExpanded && !isLoadingDetails && (
                    <div className="space-y-4">
                      {/* Integrantes */}
                      {(project.supervisor || responsaveis.length > 0) && (
                        <div>
                          <h5 className="text-sm font-semibold text-white/90 mb-2 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-3-3h-4a3 3 0 00-3 3v2zM13 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Equipe
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {project.supervisor && (
                              <div className="flex items-center gap-2 text-sm bg-primary/10 border border-primary/30 rounded-full px-3 py-1">
                                <div className="w-2 h-2 rounded-full bg-primary"></div>
                                <span className="text-primary/90 font-medium">
                                  {project.supervisor.nome}
                                </span>
                                <span className="text-xs text-primary/60">(Supervisor)</span>
                              </div>
                            )}
                            {responsaveis.map((resp, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm bg-blue-500/10 border border-blue-500/30 rounded-full px-3 py-1">
                                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                                <span className="text-blue-300">
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
                          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                            {etapas.map((etapa) => {
                              // Cor de destaque lateral baseada no status
                              const borderLeftColor = 
                                etapa.status === 'APROVADA' ? 'border-l-green-500' :
                                etapa.status === 'EM_ANDAMENTO' ? 'border-l-blue-500' :
                                etapa.status === 'EM_ANALISE' ? 'border-l-purple-500' :
                                etapa.status === 'REPROVADA' ? 'border-l-red-500' :
                                'border-l-yellow-500';
                              
                              return (
                                <div
                                  key={etapa.id}
                                  className={`bg-white/5 border border-white/10 border-l-4 ${borderLeftColor} rounded-lg p-3 hover:bg-white/10 transition-all duration-200`}
                                >
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <h6 className="font-medium text-sm text-white/90 flex-1">
                                      {etapa.nome}
                                    </h6>
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getEtapaStatusColor(etapa.status)}`}>
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
                                      <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        {etapa.executor.nome}
                                      </span>
                                    )}
                                    {etapa.integrantes && etapa.integrantes.length > 0 && (
                                      <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                        {etapa.integrantes.length} integrante{etapa.integrantes.length !== 1 ? 's' : ''}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-white/50">Nenhuma tarefa cadastrada</p>
                        )}
                      </div>

                      {/* Informações Adicionais */}
                      <div className="pt-3 border-t border-white/10">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          {hasProjectsAccess && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                              <span className="text-amber-300/80 block mb-0.5">Valor Total</span>
                              <p className="text-amber-100 font-bold text-base">
                                {project.valorTotal.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}
                              </p>
                            </div>
                          )}
                          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2">
                            <span className="text-blue-300/80 block mb-0.5">Total de Etapas</span>
                            <p className="text-blue-100 font-bold text-base">{project._count?.etapas || etapas.length}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

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
