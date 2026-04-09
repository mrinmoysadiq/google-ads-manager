import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach auth token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('app_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api
