import axios from 'axios';
import toast from 'react-hot-toast';

// In Capacitor mobile builds the app is served from a local file:// URL,
// so the Vite proxy doesn't exist. VITE_API_URL must be set to the
// production backend URL (e.g. https://propflow-backend.onrender.com/api).
// In web dev and Vercel, the Vite proxy handles /api → localhost:5000.
const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    const message = err.response?.data?.error || 'Something went wrong';
    toast.error(message);
    return Promise.reject(err);
  }
);

export default api;
