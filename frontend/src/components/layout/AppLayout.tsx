import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useMemo } from 'react';
import { useAuthStore } from '../../store/auth';
import { getFirstAllowedPage } from '../../utils/getFirstAllowedPage';

const titles: Record<string, { title: string; subtitle?: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Visão geral dos projetos e indicadores' },
  '/projects': { title: 'Projetos', subtitle: 'Gestão de projetos ativos e finalizados' },
  '/tasks/my': { title: 'Meu Trabalho', subtitle: 'Acompanhe suas tarefas e subetapas' },
  '/stock': { title: 'Compras & Estoque', subtitle: 'Controle de ativos e requisições' },
  '/suppliers': { title: 'Fornecedores', subtitle: 'Gerenciamento de fornecedores' },
  '/categories': { title: 'Categorias', subtitle: 'Gerenciamento de categorias de compras' },
  '/occurrences': { title: 'Ocorrências', subtitle: 'Comunicação interna e registros' },
  '/requests': { title: 'Requerimentos', subtitle: 'Solicitações e direcionamentos' },
  '/users': { title: 'Usuários', subtitle: 'Administração de acesso e perfis' },
  '/cargos': { title: 'Cargos', subtitle: 'Gerenciamento de cargos e permissões' },
};

export function AppLayout() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  // Verificar se o usuário tem acesso à página atual
  const hasAccess = useMemo(() => {
    if (!user) return false;

    let paginasPermitidas: string[] = [];
    
    if (typeof user.cargo === 'string') {
      const allowedMap: Record<string, string[]> = {
        DIRETOR: ['/dashboard', '/projects', '/tasks/my', '/stock', '/suppliers', '/categories', '/occurrences', '/requests', '/users', '/cargos'],
        GM: ['/dashboard', '/projects', '/tasks/my', '/stock', '/suppliers', '/categories', '/occurrences', '/requests', '/users', '/cargos'],
        SUPERVISOR: ['/tasks/my', '/occurrences', '/requests'],
        EXECUTOR: ['/tasks/my', '/occurrences', '/requests'],
        COTADOR: ['/tasks/my', '/stock', '/suppliers', '/categories', '/occurrences'],
        PAGADOR: ['/tasks/my', '/stock', '/suppliers', '/categories', '/occurrences'],
      };
      paginasPermitidas = allowedMap[user.cargo] || [];
    } else if (user.cargo && typeof user.cargo === 'object' && 'nome' in user.cargo) {
      if (user.cargo.paginasPermitidas && Array.isArray(user.cargo.paginasPermitidas)) {
        paginasPermitidas = user.cargo.paginasPermitidas;
      } else {
        const allowedMap: Record<string, string[]> = {
          DIRETOR: ['/dashboard', '/projects', '/tasks/my', '/stock', '/suppliers', '/categories', '/occurrences', '/requests', '/users', '/cargos'],
          GM: ['/dashboard', '/projects', '/tasks/my', '/stock', '/suppliers', '/categories', '/occurrences', '/requests', '/users', '/cargos'],
          SUPERVISOR: ['/tasks/my', '/occurrences', '/requests'],
          EXECUTOR: ['/tasks/my', '/occurrences', '/requests'],
          COTADOR: ['/tasks/my', '/stock', '/suppliers', '/categories', '/occurrences'],
          PAGADOR: ['/tasks/my', '/stock', '/suppliers', '/categories', '/occurrences'],
        };
        paginasPermitidas = allowedMap[user.cargo.nome] || [];
      }
    }

    // Verificar se a rota atual está nas páginas permitidas
    // Para rotas dinâmicas como /projects/:id, verificar se começa com /projects
    const currentPath = location.pathname;
    if (currentPath.startsWith('/projects/')) {
      return paginasPermitidas.includes('/projects');
    }
    
    return paginasPermitidas.includes(currentPath);
  }, [user, location.pathname]);

  // Se não tem acesso, redirecionar para a primeira página permitida
  if (!hasAccess) {
    const firstPage = getFirstAllowedPage(user);
    return <Navigate to={firstPage} replace />;
  }

  const header = useMemo(() => {
    const entry = Object.entries(titles).find(([path]) => location.pathname.startsWith(path));
    return entry ? entry[1] : { title: 'ERP Globaltec' };
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <Header title={header.title} subtitle={header.subtitle} />
        <section className="flex-1 overflow-y-auto p-8 bg-neutral/70">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
