import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useMemo } from 'react';

const titles: Record<string, { title: string; subtitle?: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Visão geral dos projetos e indicadores' },
  '/projects': { title: 'Projetos', subtitle: 'Gestão de projetos ativos e finalizados' },
  '/tasks/my': { title: 'Meu Trabalho', subtitle: 'Acompanhe suas tarefas e subetapas' },
  '/stock': { title: 'Compras & Estoque', subtitle: 'Controle de ativos e requisições' },
  '/occurrences': { title: 'Ocorrências', subtitle: 'Comunicação interna e registros' },
  '/requests': { title: 'Requerimentos', subtitle: 'Solicitações e direcionamentos' },
  '/users': { title: 'Usuários', subtitle: 'Administração de acesso e perfis' },
};

export function AppLayout() {
  const location = useLocation();

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
