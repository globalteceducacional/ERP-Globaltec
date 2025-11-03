import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { Cargo } from '../../types';

const links = [
  { to: '/dashboard', label: 'Dashboard', allowed: ['DIRETOR'] },
  { to: '/projects', label: 'Projetos', allowed: ['DIRETOR'] },
  { to: '/tasks/my', label: 'Meu Trabalho', allowed: ['DIRETOR', 'SUPERVISOR', 'EXECUTOR', 'COTADOR', 'PAGADOR'] },
  { to: '/stock', label: 'Compras & Estoque', allowed: ['DIRETOR', 'COTADOR', 'PAGADOR'] },
  { to: '/occurrences', label: 'Ocorrências', allowed: ['DIRETOR', 'SUPERVISOR', 'EXECUTOR', 'COTADOR', 'PAGADOR'] },
  { to: '/requests', label: 'Requerimentos', allowed: ['DIRETOR', 'SUPERVISOR', 'EXECUTOR'] },
  { to: '/users', label: 'Usuários', allowed: ['DIRETOR'] },
];

export function Sidebar() {
  const user = useAuthStore((state) => state.user);
  if (!user) {
    return null;
  }

  const filteredLinks = links.filter((link) => link.allowed.includes(user.cargo as Cargo));

  return (
    <aside className="w-64 bg-neutral/80 border-r border-white/10 h-screen sticky top-0">
      <div className="p-6 border-b border-white/10">
        <h1 className="text-2xl font-bold">ERP Globaltec</h1>
        <p className="text-sm text-white/60 mt-2">{user.nome}</p>
        <p className="text-xs text-white/40 uppercase">{user.cargo}</p>
      </div>
      <nav className="p-4 flex flex-col gap-2">
        {filteredLinks.map((link) => (
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
        ))}
      </nav>
    </aside>
  );
}
