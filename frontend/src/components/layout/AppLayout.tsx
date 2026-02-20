import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { Sidebar, getSidebarCollapsedDefault, setSidebarCollapsed } from './Sidebar';
import { Header } from './Header';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '../../store/auth';
import { getFirstAllowedPage } from '../../utils/getFirstAllowedPage';
import { useIsDesktop } from '../../hooks/useMediaQuery';

const titles: Record<string, { title: string; subtitle?: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Visão geral dos projetos e indicadores' },
  '/projects': { title: 'Projetos', subtitle: 'Gestão de projetos ativos e finalizados' },
  '/tasks/my': { title: 'Meu Trabalho', subtitle: 'Acompanhe suas tarefas e subetapas' },
  '/stock': { title: 'Compras & Estoque', subtitle: 'Controle de ativos e requisições' },
  '/suppliers': { title: 'Fornecedores', subtitle: 'Gerenciamento de fornecedores' },
  '/categories': { title: 'Categorias', subtitle: 'Gerenciamento de categorias de compras' },
  '/communications': { title: 'Requerimentos', subtitle: 'Solicitações e direcionamentos' },
  '/users': { title: 'Usuários', subtitle: 'Administração de acesso e perfis' },
  '/cargos': { title: 'Cargos', subtitle: 'Gerenciamento de cargos e permissões' },
};

export function AppLayout() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isDesktop = useIsDesktop();
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(getSidebarCollapsedDefault);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsedState((prev) => {
      const next = !prev;
      setSidebarCollapsed(next);
      return next;
    });
  }, []);

  // Fechar menu mobile ao trocar de rota
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Bloquear scroll do body quando menu mobile estiver aberto
  useEffect(() => {
    if (!isDesktop && mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isDesktop, mobileMenuOpen]);

  // Verificar se o usuário tem acesso à página atual
  const hasAccess = useMemo(() => {
    if (!user) return false;

    let paginasPermitidas: string[] = [];
    
    if (typeof user.cargo === 'string') {
      const allowedMap: Record<string, string[]> = {
        DIRETOR: ['/dashboard', '/projects', '/tasks/my', '/stock', '/suppliers', '/categories', '/communications', '/users', '/cargos'],
        GM: ['/dashboard', '/projects', '/tasks/my', '/stock', '/suppliers', '/categories', '/communications', '/users', '/cargos'],
        SUPERVISOR: ['/tasks/my', '/communications'],
        EXECUTOR: ['/tasks/my', '/communications'],
        COTADOR: ['/tasks/my', '/stock', '/suppliers', '/categories', '/communications'],
        PAGADOR: ['/tasks/my', '/stock', '/suppliers', '/categories', '/communications'],
      };
      paginasPermitidas = allowedMap[user.cargo] || [];
    } else if (user.cargo && typeof user.cargo === 'object' && 'nome' in user.cargo) {
      if (user.cargo.paginasPermitidas && Array.isArray(user.cargo.paginasPermitidas)) {
        paginasPermitidas = user.cargo.paginasPermitidas;
      } else {
        const allowedMap: Record<string, string[]> = {
          DIRETOR: ['/dashboard', '/projects', '/tasks/my', '/stock', '/suppliers', '/categories', '/communications', '/users', '/cargos'],
          GM: ['/dashboard', '/projects', '/tasks/my', '/stock', '/suppliers', '/categories', '/communications', '/users', '/cargos'],
          SUPERVISOR: ['/tasks/my', '/communications'],
          EXECUTOR: ['/tasks/my', '/communications'],
          COTADOR: ['/tasks/my', '/stock', '/suppliers', '/categories'],
          PAGADOR: ['/tasks/my', '/stock', '/suppliers', '/categories'],
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
    <div className="flex min-h-screen min-w-0">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        isMobile={!isDesktop}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <Header
          title={header.title}
          subtitle={header.subtitle}
          isMobile={!isDesktop}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />
        <section className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8 bg-neutral/70">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
