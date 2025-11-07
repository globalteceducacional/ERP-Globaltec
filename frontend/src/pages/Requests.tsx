import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';
import { toast, formatApiError } from '../utils/toast';

interface Request {
  id: number;
  texto: string;
  status: string;
  dataCriacao: string;
  resposta?: string | null;
  usuario?: { nome: string } | null;
  destinatario?: { nome: string } | null;
}

interface SimpleUser {
  id: number;
  nome: string;
}

export default function Requests() {
  const [tab, setTab] = useState<'sent' | 'received'>('sent');
  const [requests, setRequests] = useState<Request[]>([]);
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [form, setForm] = useState({ destinatarioId: 0, texto: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load(tab);
  }, [tab]);

  useEffect(() => {
    api.get<SimpleUser[]>('/users/options').then(({ data }) => setUsers(data));
  }, []);

  async function load(type: 'sent' | 'received') {
    try {
      const { data } = await api.get<Request[]>(`/requests/${type}`);
      setRequests(data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Erro ao carregar requerimentos');
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api.post('/requests', {
        destinatarioId: Number(form.destinatarioId),
        texto: form.texto,
      });
      setForm({ destinatarioId: 0, texto: '' });
      load('sent');
      toast.success('Requerimento enviado com sucesso!');
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
          Enviados
        </button>
        <button
          onClick={() => setTab('received')}
          className={`px-4 py-2 rounded-md ${tab === 'received' ? 'bg-primary text-neutral' : 'bg-white/10'}`}
        >
          Recebidos
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-neutral/80 border border-white/10 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold">Novo Requerimento</h3>
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
          Enviar Requerimento
        </button>
      </form>

      <div className="bg-neutral/80 border border-white/10 rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-left">Mensagem</th>
              <th className="px-4 py-3 text-left">Usuário</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Resposta</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-4 py-3 max-w-xl">
                  <p className="font-medium">{request.texto}</p>
                  <p className="text-xs text-white/50">{new Date(request.dataCriacao).toLocaleString('pt-BR')}</p>
                </td>
                <td className="px-4 py-3">
                  {tab === 'sent'
                    ? request.destinatario?.nome ?? '—'
                    : request.usuario?.nome ?? '—'}
                </td>
                <td className="px-4 py-3 text-white/60">{request.status}</td>
                <td className="px-4 py-3 text-white/70">{request.resposta ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
