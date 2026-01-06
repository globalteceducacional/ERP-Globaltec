export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

function notify() {
  toastListeners.forEach(listener => listener([...toasts]));
}

export function showToast(message: string, type: ToastType = 'info', duration = 5000) {
  const id = Math.random().toString(36).substring(2, 9);
  const toast: Toast = { id, message, type, duration };
  
  toasts.push(toast);
  notify();

  // Remover automaticamente após a duração
  if (duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }

  return id;
}

export function removeToast(id: string) {
  toasts = toasts.filter(t => t.id !== id);
  notify();
}

export function clearToasts() {
  toasts = [];
  notify();
}

export function subscribe(listener: (toasts: Toast[]) => void) {
  toastListeners.push(listener);
  return () => {
    toastListeners = toastListeners.filter(l => l !== listener);
  };
}

export function getToasts() {
  return [...toasts];
}

// Funções auxiliares
export const toast = {
  success: (message: string, duration?: number) => showToast(message, 'success', duration),
  error: (message: string, duration?: number) => showToast(message, 'error', duration),
  warning: (message: string, duration?: number) => showToast(message, 'warning', duration),
  info: (message: string, duration?: number) => showToast(message, 'info', duration),
};

// Função para formatar erros da API
export function formatApiError(error: any): string {
  if (!error) {
    return 'Erro desconhecido';
  }

  // Erro de rede (sem resposta do servidor)
  if (!error.response) {
    if (error.message === 'Network Error') {
      return 'Erro de conexão. Verifique sua internet.';
    }
    return error.message || 'Erro de conexão com o servidor';
  }

  const { status, data } = error.response;

  // Erro 401 - Não autenticado (já tratado no interceptor)
  if (status === 401) {
    return 'Sessão expirada. Faça login novamente.';
  }

  // Erro 403 - Sem permissão
  if (status === 403) {
    return 'Você não tem permissão para realizar esta ação.';
  }

  // Erro 404 - Não encontrado
  if (status === 404) {
    return 'Recurso não encontrado.';
  }

  // Erro 500 - Erro do servidor
  if (status >= 500) {
    return 'Erro interno do servidor. Tente novamente mais tarde.';
  }

  // Mensagem de erro do backend
  if (data?.message) {
    // Se for array (validação do NestJS)
    if (Array.isArray(data.message)) {
      return data.message
        .map((msg: any) => {
          if (typeof msg === 'string') return msg;
          if (msg.constraints) {
            return Object.values(msg.constraints).join(', ');
          }
          return JSON.stringify(msg);
        })
        .join('. ');
    }
    // Se for string
    if (typeof data.message === 'string') {
      return data.message;
    }
  }

  // Mensagem padrão baseada no status
  const statusMessages: Record<number, string> = {
    400: 'Requisição inválida',
    401: 'Não autenticado',
    403: 'Acesso negado',
    404: 'Não encontrado',
    422: 'Dados inválidos',
    500: 'Erro interno do servidor',
  };

  return statusMessages[status] || `Erro ${status}: ${data?.message || 'Erro desconhecido'}`;
}

