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

// ── Properties ──────────────────────────────────────────────────────────────
export const fetchProperties = (params = {}) => api.get('/properties', { params });
export const fetchProperty = (id) => api.get(`/properties/${id}`);
export const createProperty = (data) => api.post('/properties', data);
export const updateProperty = (id, data) => api.patch(`/properties/${id}`, data);
export const deleteProperty = (id) => api.delete(`/properties/${id}`);
export const fetchNearby = (params) => api.get('/properties/nearby', { params });
export const addUnit = (propertyId, data) => api.post(`/properties/${propertyId}/units`, data);
export const updateUnit = (propertyId, unitId, data) => api.patch(`/properties/${propertyId}/units/${unitId}`, data);

// ── Tenants ──────────────────────────────────────────────────────────────────
export const fetchTenants = (params = {}) => api.get('/tenants', { params });
export const fetchTenant = (id) => api.get(`/tenants/${id}`);
export const createTenant = (data) => api.post('/tenants', data);
export const updateTenant = (id, data) => api.patch(`/tenants/${id}`, data);
export const terminateTenancy = (id, data) => api.post(`/tenants/${id}/terminate`, data);
export const fetchTenantPaymentHistory = (id) => api.get(`/tenants/${id}/payment-history`);

// ── Payments ─────────────────────────────────────────────────────────────────
export const initiatePayment = (data) => api.post('/payments/initiate-stk', data);
export const fetchPayments = (params = {}) => api.get('/payments', { params });
export const overridePayment = (id, data) => api.post(`/payments/${id}/override`, data);

// ── Users ─────────────────────────────────────────────────────────────────────
export const fetchMe = () => api.get('/users/me');
export const fetchUsers = (params = {}) => api.get('/users', { params });
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.patch(`/users/${id}`, data);
export const syncClerk = (data) => api.post('/users/sync-clerk', data);

export default api;
