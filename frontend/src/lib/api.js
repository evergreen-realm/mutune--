import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('clerk_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(err.response?.data || { error: { message: err.message } })
);

export const fetchProperties = () => api.get('/properties');
export const fetchProperty = (id) => api.get(`/properties/${id}`);
export const initiatePayment = (data) => api.post('/payments/initiate-stk', data);
export const fetchPayments = () => api.get('/payments');
export default api;
