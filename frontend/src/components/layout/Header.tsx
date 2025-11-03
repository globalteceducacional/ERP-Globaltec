import { useAuthStore } from '../../store/auth';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  return (
    <header className="flex items-center justify-between border-b border-white/10 px-8 py-5 sticky top-0 bg-neutral/80 backdrop-blur supports-[backdrop-filter]:bg-neutral/60 z-20">
      <div>
        <h2 className="text-2xl font-bold">{title}</h2>
        {subtitle && <p className="text-sm text-white/60 mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        {user && (
          <span className="text-sm text-white/70">
            {user.email}
          </span>
        )}
        <button
          onClick={logout}
          className="px-4 py-2 rounded-md bg-danger hover:bg-danger/80 text-white text-sm"
        >
          Sair
        </button>
      </div>
    </header>
  );
}
