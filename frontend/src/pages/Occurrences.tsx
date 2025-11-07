import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';
import { toast, formatApiError } from '../utils/toast';

interface Occurrence {
  id: number;
  texto: string;
  status: string;
  dataCriacao: string;
  destinatario?: { nome: string } | null;
  usuario?: { nome: string } | null;
}

interface SimpleUser {
  id: number;
  nome: string;
}

export default function Occurrences() {
  const [tab, setTab] = useState<'sent' | 'received'>('sent');
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [form, setForm] = useState({ destinatarioId: 0, texto: '' });
  const [error, setError] = useState<string | null>(null);

  async function loadOccurrences(currentTab: 'sent' | 'received') {
    try {
      const { data } = await api.get<Occurrence[]>(`/occurrences/${currentTab}`);
      setOccurrences(data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Erro ao carregar ocorrências');
    }
  }

  async function loadUsers() {
    try {
      const { data } = await api.get<SimpleUser[]>('/users/options');
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadOccurrences(tab);
  }, [tab]);

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api.post('/occurrences', {
        destinatarioId: Number(form.destinatarioId),
        texto: form.texto,
      });
      setForm({ destinatarioId: 0, texto: '' });
      loadOccurrences('sent');
      toast.success('Ocorrência registrada com sucesso!');
    } catch (err: any) {
      const errorMessage = formatApiError(err);
      setError(errorMessage);
      toast.error(errorMessage);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          onClick={() => setTab('sent')}
          className={`px-4 py-2 rounded-md ${tab === 'sent' ? 'bg-primary text-neutral' : 'bg-white/10'}`}
        >
          Enviadas
        </button>
        <button
          onClick={() => setTab('received')}
          className={`px-4 py-2 rounded-md ${tab === 'received' ? 'bg-primary text-neutral' : 'bg-white/10'}`}
        >
          Recebidas
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-neutral/80 border border-white/10 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold">Nova Ocorrência</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm text-white/70">
            Destinatário
            <select
              value={form.destinatarioId}
              onChange={(e) => setForm((prev) => ({ ...prev, destinatarioId: Number(e.target.value) }))}
              className="mt-1 w-full bg-neutral/60 border border-white/10 rounded-md px-3 py-2"
              required
            >
              <option value={0}>Selecione...</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-white/70 md:col-span-2">
            Texto
            <textarea
              value={form.texto}
              onChange={(e) => setForm((prev) => ({ ...prev, texto: e.target.value }))}
              className="mt-1 w-full h-24 bg-neutral/60 border border-white/10 rounded-md px-3 py-2"
              required
            />
          </label>
        </div>
        {error && <p className="text-danger text-sm">{error}</p>}
        <button type="submit" className="px-4 py-2 rounded-md bg-primary hover:bg-primary/80 text-sm font-semibold">
          Enviar Ocorrência
        </button>
      </form>

      <div className="bg-neutral/80 border border-white/10 rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-left">Mensagem</th>
              <th className="px-4 py-3 text-left">Usuário</th>
              <th className="px-4 py-3 text-left">Data</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {occurrences.map((occurrence) => (
              <tr key={occurrence.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-4 py-3 max-w-xl">
                  <p className="font-medium">{occurrence.texto}</p>
                </td>
                <td className="px-4 py-3">
                  {tab === 'sent'
                    ? occurrence.destinatario?.nome ?? '—'
                    : occurrence.usuario?.nome ?? '—'}
                </td>
                <td className="px-4 py-3">
                  {new Date(occurrence.dataCriacao).toLocaleString('pt-BR')}
                </td>
                <td className="px-4 py-3 text-white/60">{occurrence.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
