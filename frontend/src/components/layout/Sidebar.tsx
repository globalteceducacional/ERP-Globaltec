import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: IconDashboard },
  { to: '/projects', label: 'Projetos', icon: IconFolder },
  { to: '/tasks/my', label: 'Meu Trabalho', icon: IconClipboard },
  { to: '/stock', label: 'Compras & Estoque', icon: IconCart },
  { to: '/suppliers', label: 'Fornecedores', icon: IconTruck },
  { to: '/categories', label: 'Categorias', icon: IconTag },
  { to: '/communications', label: 'Requerimentos', icon: IconMail },
  { to: '/users', label: 'Usuários', icon: IconUsers },
  { to: '/cargos', label: 'Cargos', icon: IconBadge },
];

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}
function IconFolder({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}
function IconClipboard({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}
function IconCart({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
function IconTruck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  );
}
function IconTag({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}
function IconMail({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
function IconBadge({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

const SIDEBAR_STORAGE_KEY = 'erp-sidebar-collapsed';

export function getSidebarCollapsedDefault(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const v = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return v === 'true';
  } catch {
    return false;
  }
}

export function setSidebarCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  } catch {
    // ignore
  }
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ collapsed, onToggle, isMobile, mobileOpen, onCloseMobile }: SidebarProps) {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return null;
  }

  const showAsDrawer = isMobile && typeof mobileOpen === 'boolean';
  const isOpen = showAsDrawer ? mobileOpen : true;

  let userCargoNome = '';
  let paginasPermitidas: string[] = [];

  if (typeof user.cargo === 'string') {
    userCargoNome = user.cargo;
    const allowedMap: Record<string, string[]> = {
      DIRETOR: ['/dashboard', '/projects', '/tasks/my', '/stock', '/suppliers', '/categories', '/communications', '/users', '/cargos'],
      GM: ['/dashboard', '/projects', '/tasks/my', '/stock', '/suppliers', '/categories', '/communications', '/users', '/cargos'],
      SUPERVISOR: ['/tasks/my', '/communications'],
      EXECUTOR: ['/tasks/my', '/communications'],
      COTADOR: ['/tasks/my', '/stock', '/suppliers', '/categories', '/communications'],
      PAGADOR: ['/tasks/my', '/stock', '/suppliers', '/categories', '/communications'],
    };
    paginasPermitidas = allowedMap[userCargoNome] || [];
  } else if (user.cargo && typeof user.cargo === 'object' && 'nome' in user.cargo) {
    userCargoNome = user.cargo.nome || '';
    if (user.cargo.paginasPermitidas && Array.isArray(user.cargo.paginasPermitidas)) {
      paginasPermitidas = user.cargo.paginasPermitidas;
    }
  }

  const filteredLinks = links.filter((link) => {
    if (paginasPermitidas.length === 0) {
      const allowedMap: Record<string, string[]> = {
        DIRETOR: ['/dashboard', '/projects', '/tasks/my', '/stock', '/suppliers', '/categories', '/communications', '/users', '/cargos'],
        GM: ['/dashboard', '/projects', '/tasks/my', '/stock', '/suppliers', '/categories', '/communications', '/users', '/cargos'],
        SUPERVISOR: ['/tasks/my', '/communications'],
        EXECUTOR: ['/tasks/my', '/communications'],
        COTADOR: ['/tasks/my', '/stock', '/suppliers', '/categories', '/communications'],
        PAGADOR: ['/tasks/my', '/stock', '/suppliers', '/categories', '/communications'],
      };
      return allowedMap[userCargoNome]?.includes(link.to) || false;
    }
    return paginasPermitidas.includes(link.to);
  });

  const sidebarContent = (
    <>
      <div className={`border-b border-white/10 flex items-center shrink-0 ${showAsDrawer || collapsed ? 'p-3 justify-between' : 'p-6'} ${!showAsDrawer && collapsed ? 'justify-center' : ''}`}>
        {showAsDrawer ? (
          <>
            <h1 className="text-lg font-bold truncate">ERP Globaltec</h1>
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-2 rounded-md hover:bg-white/10 text-white transition-colors"
              title="Fechar menu"
              aria-label="Fechar menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        ) : collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            className="p-2 rounded-md hover:bg-white/10 text-white transition-colors"
            title="Expandir menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate">ERP Globaltec</h1>
              <p className="text-sm text-white/60 mt-1 truncate">{user.nome}</p>
              <p className="text-xs text-white/40 uppercase truncate">{userCargoNome || 'Sem cargo'}</p>
            </div>
            <button
              type="button"
              onClick={onToggle}
              className="p-2 rounded-md hover:bg-white/10 text-white transition-colors shrink-0"
              title="Recolher menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </>
        )}
      </div>

      <nav className={`flex flex-col gap-1 overflow-hidden flex-1 ${showAsDrawer || collapsed ? 'p-2' : 'p-4'}`}>
        {filteredLinks.length === 0 ? (
          <p className={`text-white/50 text-sm ${showAsDrawer || collapsed ? 'px-2 py-2 text-center' : 'px-4 py-2'}`}>
            {showAsDrawer || collapsed ? '—' : 'Nenhum menu disponível'}
          </p>
        ) : (
          filteredLinks.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                title={showAsDrawer || collapsed ? link.label : undefined}
                onClick={showAsDrawer ? onCloseMobile : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md transition-colors ${
                    showAsDrawer ? 'px-4 py-2' : collapsed ? 'justify-center px-0 py-3' : 'px-4 py-2'
                  } ${isActive ? 'bg-primary text-neutral font-semibold' : 'hover:bg-white/10'}`
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                {(!collapsed || showAsDrawer) && <span className="truncate">{link.label}</span>}
              </NavLink>
            );
          })
        )}
      </nav>
    </>
  );

  if (showAsDrawer) {
    return (
      <>
        {/* Overlay: fecha ao clicar fora */}
        <div
          className={`fixed inset-0 bg-black/60 z-30 transition-opacity duration-300 md:hidden ${
            isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={onCloseMobile}
          onKeyDown={(e) => e.key === 'Escape' && onCloseMobile?.()}
          role="button"
          tabIndex={-1}
          aria-label="Fechar menu"
        />
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 max-w-[85vw] bg-neutral border-r border-white/10 flex flex-col shadow-xl transition-transform duration-300 ease-out md:hidden ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {sidebarContent}
        </aside>
      </>
    );
  }

  return (
    <aside
      className={`hidden md:flex bg-neutral/80 border-r border-white/10 h-screen sticky top-0 flex-col transition-[width] duration-300 ease-in-out ${
        collapsed ? 'w-[4.5rem]' : 'w-64'
      }`}
    >
      {sidebarContent}
    </aside>
  );
}
