import axios from 'axios';

const resolveApiUrl = (): string => {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) return configured;
  if (import.meta.env.DEV) return 'http://localhost:5000/api';
  throw new Error('VITE_API_URL must be set in production builds');
};

const api = axios.create({
  baseURL: resolveApiUrl(),
});

// Intercept requests to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
