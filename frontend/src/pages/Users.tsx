import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Cargo, Usuario } from '../types';

export default function Users() {
  const [users, setUsers] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const { data } = await api.get<Usuario[]>('/users');
      setUsers(data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(user: Usuario) {
    try {
      if (user.ativo) {
        await api.patch(`/users/${user.id}/deactivate`);
      } else {
        await api.patch(`/users/${user.id}/activate`);
      }
      load();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Erro ao atualizar usuário');
    }
  }

  async function changeRole(user: Usuario, cargo: Cargo) {
    try {
      setError(null);
      await api.patch(`/users/${user.id}/role`, { cargo });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Erro ao alterar cargo');
    }
  }

  if (loading) {
    return <p>Carregando usuários...</p>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-danger">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">E-mail</th>
              <th className="px-4 py-3 text-left">Cargo</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-4 py-3">{user.nome}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={user.cargo}
                    onChange={(event) => changeRole(user, event.target.value as Cargo)}
                    className="bg-neutral/60 border border-white/10 rounded-md px-2 py-1"
                  >
                    <option value="DIRETOR">Diretor</option>
                    <option value="SUPERVISOR">Supervisor</option>
                    <option value="EXECUTOR">Executor</option>
                    <option value="COTADOR">Cotador</option>
                    <option value="PAGADOR">Pagador</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={user.ativo ? 'text-success' : 'text-warning'}>
                    {user.ativo ? 'Ativo' : 'Pendente'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(user)}
                    className="px-3 py-1 rounded-md bg-primary hover:bg-primary/80 text-xs"
                  >
                    {user.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
