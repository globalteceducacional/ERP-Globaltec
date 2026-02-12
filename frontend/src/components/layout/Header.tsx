import { useAuthStore } from '../../store/auth';
import { useNavigate } from 'react-router-dom';
import { useState, FormEvent, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { buttonStyles } from '../../utils/buttonStyles';
import { Notifications } from '../Notifications';
import { Notificacao } from '../../types';
import { toast } from '../../utils/toast';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationsRef = useRef<HTMLDivElement>(null);

  function handleLogout() { 
    navigate('/login', { replace: true });
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      setError('Todos os campos são obrigatórios');
      return;
    }

    if (novaSenha.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setError('As senhas não coincidem');
      return;
    }

    try {
      setLoading(true);
      await api.patch('/users/me/password', {
        senhaAtual,
        novaSenha,
      });
      setShowPasswordModal(false);
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
      toast.success('Senha alterada com sucesso!');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  }

  // Carregar contador de notificações não lidas
  useEffect(() => {
    async function loadUnreadCount() {
      try {
        const { data } = await api.get<Notificacao[]>('/notifications?unread=true');
        setUnreadCount(data.length);
      } catch (err) {
        console.error('Erro ao carregar contador de notificações:', err);
      }
    }

    loadUnreadCount();
    
    // Atualizar contador a cada 30 segundos
    const interval = setInterval(loadUnreadCount, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showNotifications]);

  return (
    <>
      <header className="flex items-center justify-between border-b border-white/10 px-8 py-5 sticky top-0 bg-neutral/80 backdrop-blur supports-[backdrop-filter]:bg-neutral/60 z-20">
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          {subtitle && <p className="text-sm text-white/60 mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <>
              {/* Botão de Notificações */}
              <div className="relative" ref={notificationsRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Notificações"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-danger text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <Notifications 
                    onClose={() => setShowNotifications(false)}
                    onUpdateCount={setUnreadCount}
                  />
                )}
              </div>

              <button
                onClick={() => setShowPasswordModal(true)}
                className="px-4 py-2 rounded-md bg-primary/20 hover:bg-primary/30 text-primary text-sm border border-primary/30"
              >
                Alterar Senha
              </button>
              <span className="text-sm text-white/70">
                {user.email}
              </span>
            </>
          )}
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-md bg-danger hover:bg-danger/80 text-white text-sm"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Modal de Alterar Senha */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral border border-white/20 rounded-xl shadow-2xl max-w-md w-full">
            <div className="px-8 py-6 border-b border-white/20">
              <h2 className="text-2xl font-bold text-white">Alterar Senha</h2>
            </div>
            <form onSubmit={handleChangePassword} className="p-8 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Senha Atual <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Nova Senha <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  required
                  minLength={6}
                />
                <p className="text-xs text-white/50 mt-1">Mínimo de 6 caracteres</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Confirmar Nova Senha <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  className="w-full bg-white/10 border border-white/30 rounded-md px-4 py-2.5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-md text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end space-x-4 pt-4 border-t border-white/20">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setError(null);
                    setSenhaAtual('');
                    setNovaSenha('');
                    setConfirmarSenha('');
                  }}
                  className={buttonStyles.secondary}
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`${buttonStyles.primary} disabled:opacity-50 disabled:cursor-not-allowed`}
                  disabled={loading}
                >
                  {loading ? 'Alterando...' : 'Alterar Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
