import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/projects', label: 'Projetos' },
  { to: '/tasks/my', label: 'Meu Trabalho' },
  { to: '/stock', label: 'Compras & Estoque' },
  { to: '/occurrences', label: 'Ocorrências' },
  { to: '/requests', label: 'Requerimentos' },
  { to: '/users', label: 'Usuários' },
  { to: '/cargos', label: 'Cargos' },
];

export function Sidebar() {
  const user = useAuthStore((state) => state.user);
  
  if (!user) {
    return null;
  }

  // Compatibilidade: lidar com cargo como string (antigo) ou objeto (novo)
  let userCargoNome = '';
  let paginasPermitidas: string[] = [];
  
  if (typeof user.cargo === 'string') {
    // Formato antigo: cargo é uma string
    userCargoNome = user.cargo;
    // Se for formato antigo, usar lógica hardcoded para compatibilidade
    const allowedMap: Record<string, string[]> = {
      DIRETOR: ['/dashboard', '/projects', '/tasks/my', '/stock', '/occurrences', '/requests', '/users', '/cargos'],
      SUPERVISOR: ['/tasks/my', '/occurrences', '/requests'],
      EXECUTOR: ['/tasks/my', '/occurrences', '/requests'],
      COTADOR: ['/tasks/my', '/stock', '/occurrences'],
      PAGADOR: ['/tasks/my', '/stock', '/occurrences'],
    };
    paginasPermitidas = allowedMap[userCargoNome] || [];
  } else if (user.cargo && typeof user.cargo === 'object' && 'nome' in user.cargo) {
    // Formato novo: cargo é um objeto com propriedade nome
    userCargoNome = user.cargo.nome || '';
    // Pegar páginas permitidas do cargo
    if (user.cargo.paginasPermitidas && Array.isArray(user.cargo.paginasPermitidas)) {
      paginasPermitidas = user.cargo.paginasPermitidas;
    }
  }

  // Filtrar links baseado nas páginas permitidas do cargo
  const filteredLinks = links.filter((link) => {
    // Se não há páginas permitidas definidas (cargo antigo sem configuração), usar lógica padrão
    if (paginasPermitidas.length === 0) {
      // Fallback para compatibilidade com sistema antigo
      const allowedMap: Record<string, string[]> = {
        DIRETOR: ['/dashboard', '/projects', '/tasks/my', '/stock', '/occurrences', '/requests', '/users', '/cargos'],
        SUPERVISOR: ['/tasks/my', '/occurrences', '/requests'],
        EXECUTOR: ['/tasks/my', '/occurrences', '/requests'],
        COTADOR: ['/tasks/my', '/stock', '/occurrences'],
        PAGADOR: ['/tasks/my', '/stock', '/occurrences'],
      };
      return allowedMap[userCargoNome]?.includes(link.to) || false;
    }
    return paginasPermitidas.includes(link.to);
  });

  return (
    <aside className="w-64 bg-neutral/80 border-r border-white/10 h-screen sticky top-0">
      <div className="p-6 border-b border-white/10">
        <h1 className="text-2xl font-bold">ERP Globaltec</h1>
        <p className="text-sm text-white/60 mt-2">{user.nome}</p>
        <p className="text-xs text-white/40 uppercase">{userCargoNome || 'Sem cargo'}</p>
      </div>
      <nav className="p-4 flex flex-col gap-2">
        {filteredLinks.length === 0 ? (
          <p className="text-white/50 text-sm px-4 py-2">Nenhum menu disponível</p>
        ) : (
          filteredLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `px-4 py-2 rounded-md transition-colors ${
                  isActive ? 'bg-primary text-neutral font-semibold' : 'hover:bg-white/10'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))
        )}
      </nav>
    </aside>
  );
}
