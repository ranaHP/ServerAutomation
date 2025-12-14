import axios from 'axios';
import { useSession } from './state/session';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000' });

api.interceptors.request.use((config) => {
  const token = useSession.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
