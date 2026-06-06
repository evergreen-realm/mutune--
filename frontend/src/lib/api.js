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

// ── Properties ────────────────────────────────────────────────────────────────
export const fetchProperties       = (params = {})       => api.get('/properties', { params });
export const fetchProperty         = (id)                => api.get(`/properties/${id}`);
export const createProperty        = (data)              => api.post('/properties', data);
export const updateProperty        = (id, data)          => api.patch(`/properties/${id}`, data);
export const deleteProperty        = (id)                => api.delete(`/properties/${id}`);
export const fetchNearby           = (params)            => api.get('/properties/nearby', { params });
export const addUnit               = (propertyId, data)  => api.post(`/properties/${propertyId}/units`, data);
export const updateUnit            = (propertyId, unitId, data) => api.patch(`/properties/${propertyId}/units/${unitId}`, data);

// Phase 2: GPS property creation
export const createPropertyWithGPS = (data) => api.post('/properties/with-gps', data);

// ── Tenants ───────────────────────────────────────────────────────────────────
export const fetchTenants             = (params = {}) => api.get('/tenants', { params });
export const fetchTenant              = (id)          => api.get(`/tenants/${id}`);
export const createTenant             = (data)        => api.post('/tenants', data);
export const updateTenant             = (id, data)    => api.patch(`/tenants/${id}`, data);
export const terminateTenancy         = (id, data)    => api.post(`/tenants/${id}/terminate`, data);
export const fetchTenantPaymentHistory = (id)         => api.get(`/tenants/${id}/payment-history`);

// Phase 2: Tenant portal self-service
export const fetchMyPayments = () => api.get('/tenants/my/payments');
export const fetchMyNotices  = () => api.get('/tenants/my/notices');
export const fetchMyProfile  = () => api.get('/tenants/my/profile');

// ── Payments ──────────────────────────────────────────────────────────────────
export const initiatePayment = (data)         => api.post('/payments/initiate-stk', data);
export const fetchPayments   = (params = {})  => api.get('/payments', { params });
export const overridePayment = (id, data)     => api.post(`/payments/${id}/override`, data);

// ── Users ─────────────────────────────────────────────────────────────────────
export const fetchMe    = ()          => api.get('/users/me');
export const fetchUsers = (params = {}) => api.get('/users', { params });
export const createUser = (data)      => api.post('/users', data);
export const updateUser = (id, data)  => api.patch(`/users/${id}`, data);
export const syncClerk  = (data)      => api.post('/users/sync-clerk', data);

// ── Agents (Phase 2) ──────────────────────────────────────────────────────────
export const agentCheckIn      = (data) => api.post('/agents/checkin', data);
export const getAgentLocation  = ()     => api.get('/agents/location');
export const getAllAgentLocations = ()  => api.get('/agents/all-locations');

// ── Admin Stats (Phase 2) ─────────────────────────────────────────────────────
export const fetchAdminStats = () => api.get('/admin/stats');
export const fetchOverdue    = () => api.get('/admin/overdue');

// ── Maintenance Tickets (Phase 2) ─────────────────────────────────────────────
export const fetchMyTickets          = ()           => api.get('/maintenance/my-tickets');
export const fetchMaintenanceTickets = (params = {}) => api.get('/maintenance', { params });
export const createMaintenanceTicket = (data)       => api.post('/maintenance', data);
export const updateMaintenanceTicket = (id, data)   => api.patch(`/maintenance/${id}`, data);
export const deleteMaintenanceTicket = (id)         => api.delete(`/maintenance/${id}`);

// ── KRA Reports (Phase 2) ─────────────────────────────────────────────────────
export const fetchReportSummary = (month) => api.get('/reports/summary', { params: { month } });

/**
 * downloadKRAReport — triggers a CSV file download in the browser.
 * Uses a direct anchor-href approach to handle binary blob streaming.
 * @param {string} month — YYYY-MM
 */
export const downloadKRAReport = async (month) => {
  const token  = localStorage.getItem('clerk_token');
  const base   = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
  const url    = `${base}/reports/kra?month=${month}`;

  const response = await fetch(url, {
    headers: { Authorization: token ? `Bearer ${token}` : '' }
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw json;
  }

  const blob     = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link      = document.createElement('a');
  link.href       = objectUrl;
  link.download   = `kra_reconciliation_${month}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};

export default api;
