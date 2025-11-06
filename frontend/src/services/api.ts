import axios from 'axios';
import { useAuthStore } from '../store/auth';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
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
    if (error.response?.status === 401) {
      // Logout e limpar localStorage
      useAuthStore.getState().logout();
      // Redirecionar para login se não estiver já lá
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);
