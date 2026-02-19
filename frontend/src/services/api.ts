import axios from 'axios';
import { useAuthStore } from '../store/auth';

// VPS: VITE_API_URL vazio ou '/api' = chamadas no mesmo domínio (Nginx proxy /api). Local: use URL do backend.
const raw = import.meta.env.VITE_API_URL != null ? String(import.meta.env.VITE_API_URL).trim() : '';
const baseURL =
  raw === '' || raw === '/api'
    ? import.meta.env.DEV
      ? 'http://localhost:3000'
      : '/api'
    : raw;

export const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (config.headers) {
    // Remover header de autorização se não houver token
    delete config.headers.Authorization;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Apenas fazer logout em caso de 401 (não autenticado)
    // 403 (Forbidden) significa que está autenticado mas sem permissão - não deve fazer logout
    if (error.response?.status === 401) {
      // Logout e limpar localStorage
      useAuthStore.getState().logout();
      // Redirecionar para login se não estiver já lá (usar replace para não adicionar ao histórico)
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  },
);
