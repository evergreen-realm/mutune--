import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'https://mutunerent-api.onrender.com/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000
});

// Request interceptor: attach Clerk session JWT
api.interceptors.request.use(
  async (config) => {
    try {
      // window.Clerk is set by @clerk/clerk-react ClerkProvider
      const clerk = window.Clerk;
      if (clerk?.session) {
        const token = await clerk.session.getToken();
        if (token) config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (_) {
      // No session available — request goes unauthenticated (backend returns 401)
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: unwrap data, handle common errors
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED') {
      return Promise.reject({ error: { code: 'NETWORK_ERROR', message: 'Cannot reach the API server. Check your connection.' } });
    }
    return Promise.reject(err.response?.data || { error: { message: err.message } });
  }
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
export const fetchVacantUnits      = ()                  => api.get('/properties/units/vacant');

// Phase 4: Unit geospatial indexing
export const updateUnitGeolocation = (propertyId, unitId, data) => api.patch(`/properties/${propertyId}/units/${unitId}/geolocation`, data);
export const fetchUnitGeoJSON      = (propertyId)               => api.get(`/properties/${propertyId}/units/geojson`);

// Phase 2: GPS property creation
export const createPropertyWithGPS = (data) => api.post('/properties/with-gps', data);

// ── Tenants ───────────────────────────────────────────────────────────────────
export const fetchTenants             = (params = {}) => api.get('/tenants', { params });
export const fetchTenant              = (id)          => api.get(`/tenants/${id}`);
export const createTenant             = (data)        => api.post('/tenants', data);
export const updateTenant             = (id, data)    => api.patch(`/tenants/${id}`, data);
export const terminateTenancy         = (id, data)    => api.post(`/tenants/${id}/terminate`, data);
export const fetchTenantPaymentHistory = (id)         => api.get(`/tenants/${id}/payment-history`);
export const linkTenantUser            = (id, userId)  => api.post(`/tenants/${id}/link-user`, { user_id: userId });

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
  let token = null;
  try {
    const clerk = window.Clerk;
    if (clerk?.session) {
      token = await clerk.session.getToken();
    }
  } catch (err) {
    console.warn('Failed to resolve Clerk token for KRA report download:', err.message);
  }
  const base   = import.meta.env.VITE_API_URL || 'https://mutunerent-api.onrender.com/api/v1';
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

// ── AI Chat (Phase 3) ─────────────────────────────────────────────────────────
export const sendChatMessage  = (data)      => api.post('/ai/chat', data);
export const getChatHistory   = (sessionId) => api.get(`/ai/history/${sessionId}`);
export const clearChatHistory = (sessionId) => api.delete(`/ai/history/${sessionId}`);

// ── Notices (Phase 3) ─────────────────────────────────────────────────────────
export const fetchNotices      = ()        => api.get('/notices');
export const generateNotice    = (data)    => api.post('/notices/generate', data);
export const acknowledgeNotice = (id)      => api.post(`/notices/${id}/acknowledge`);

// ── Onboarding / User (Phase 4) ───────────────────────────────────────────────
export const updateUserRole    = (data)    => api.patch('/users/me/role', data);

// ── Units Lock & Geo-checkin (Phase 4) ────────────────────────────────────────
export const deletePropertyUnit    = (id, unitId) => api.delete(`/properties/${id}/units/${unitId}`);
export const lockPropertyUnit      = (id, unitId, action) => api.post(`/properties/${id}/units/${unitId}/lock`, { action });
export const checkInAgent          = (data) => api.post('/agents/checkin', data);

// ── Admin User Management (Phase 4) ──────────────────────────────────────────
export const disableUser  = (id)       => api.patch(`/users/${id}/disable`);
export const enableUser   = (id)       => api.patch(`/users/${id}/enable`);
export const softDeleteUser = (id)     => api.delete(`/users/${id}/soft`);

// ── Landlord Property Workflow (Phase 4) ──────────────────────────────────────
export const submitLandlordProperty = (data) => api.post('/properties/landlord/submit', data);
export const approveProperty        = (id)   => api.post(`/properties/${id}/approve`);
export const rejectProperty         = (id, reason) => api.post(`/properties/${id}/reject`, { reason });
export const fetchPendingProperties = ()     => api.get('/properties', { params: { status: 'pending_admin_approval' } });

// ── Tasks (Phase 4) ──────────────────────────────────────────────────────────
export const fetchMyTasks    = ()         => api.get('/tasks/agent/my');
export const fetchAllTasks   = (params)   => api.get('/tasks', { params });
export const createTask      = (data)     => api.post('/tasks', data);
export const updateTaskStatus = (id, status) => api.patch(`/tasks/${id}/status`, { status });
export const deleteTask      = (id)       => api.delete(`/tasks/${id}`);

// ── Inventory & Auction (Phase 4) ────────────────────────────────────────────
export const fetchAuctionableItems = ()               => api.get('/inventory/auctionable');
export const fetchAllInventory     = ()               => api.get('/inventory/all');
export const markItemAuctionable   = (propId, data)   => api.post(`/inventory/${propId}/mark-auctionable`, data);
export const recordAuctionSale     = (propId, data)   => api.post(`/inventory/${propId}/auction-sold`, data);
export const downloadAuctionReport = async () => {
  let token = null;
  try {
    const clerk = window.Clerk;
    if (clerk?.session) token = await clerk.session.getToken();
  } catch (_) { /* no session */ }
  const base = import.meta.env.VITE_API_URL || 'https://mutunerent-api.onrender.com/api/v1';
  const response = await fetch(`${base}/inventory/auction-report`, {
    headers: { Authorization: token ? `Bearer ${token}` : '' }
  });
  if (!response.ok) { const j = await response.json().catch(() => ({})); throw j; }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `auction-report-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
};

// ── Notifications (Phase 4) ──────────────────────────────────────────────────
export const fetchNotifications  = ()   => api.get('/notifications');
export const markNotifRead       = (id) => api.patch(`/notifications/${id}/read`);
export const markAllNotifsRead   = ()   => api.patch('/notifications/read-all');

// ── Agent Performance (Phase 4) ──────────────────────────────────────────────
export const fetchAgentPerformance = (params = {}) => api.get('/admin/agent-performance', { params });

// ── Agent Approvals & Late Fee Rules (Phase 4 / 5) ───────────────────────────
export const fetchPendingAgents    = ()               => api.get('/admin/agents/pending');
export const approveAgent          = (id)             => api.patch(`/admin/agents/${id}/approve`);
export const rejectAgent           = (id, reason)     => api.patch(`/admin/agents/${id}/reject`, { reason });
export const fetchLateFeeRules     = ()               => api.get('/admin/late-fee-rules');
export const createLateFeeRule     = (data)           => api.post('/admin/late-fee-rules', data);
export const updateLateFeeRule     = (id, data)       => api.patch(`/admin/late-fee-rules/${id}`, data);
export const deleteLateFeeRule     = (id)             => api.delete(`/admin/late-fee-rules/${id}`);
export const reclaimInventoryItem = (propId, data)   => api.post(`/inventory/${propId}/reclaim`, data);

// ── File Upload — Verification Docs (Phase 5) ─────────────────────────────────
/**
 * uploadDoc — uploads a file (PDF / image) to Cloudflare R2 via the backend.
 * @param {File} file — native browser File object
 * @returns {Promise<{ success: boolean, url: string }>}
 */
export const uploadDoc = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/upload/doc', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

// ── Overhauled Admin & Tier Endpoints (Phase 5) ──────────────────────────────
export const verifyAdminPassword      = (password)        => api.post('/admin/verify-password', { password });
export const fetchPendingLandlords    = ()                => api.get('/admin/landlords/pending');
export const approveLandlord          = (id)              => api.patch(`/admin/landlords/${id}/approve`);
export const rejectLandlord           = (id, reason)      => api.patch(`/admin/landlords/${id}/reject`, { reason });
export const createLandlordManually   = (data)            => api.post('/admin/landlords', data);
export const fetchPropertyTiers       = ()                => api.get('/admin/tiers');
export const createPropertyTier       = (data)            => api.post('/admin/tiers', data);
export const updatePropertyTier       = (id, data)        => api.patch(`/admin/tiers/${id}`, data);
export const verifyPropertyTier       = (id, data)        => api.patch(`/admin/properties/${id}/verify-tier`, data);
export const fetchCustomerCareNumber  = ()                => api.get('/admin/settings/customer-care');
export const updateCustomerCareNumber = (number)          => api.post('/admin/settings/customer-care', { number });
export const submitAgentReview        = (id, proposed_tier_id) => api.patch(`/properties/${id}/agent-review`, { proposed_tier_id });
export const autoInitiatePayment      = ()                => api.post('/payments/auto-initiate');

export default api;
