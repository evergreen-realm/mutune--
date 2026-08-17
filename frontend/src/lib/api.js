import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || 'https://mutunerent-api.onrender.com/api/v1';

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
export const generate3DModel       = (id)                => api.post(`/properties/${id}/generate-3d-model`);
export const fetchNearby           = (params)            => api.get('/properties/nearby', { params });
export const addUnit               = (propertyId, data)  => api.post(`/properties/${propertyId}/units`, data);
export const updateUnit            = (propertyId, unitId, data) => api.patch(`/properties/${propertyId}/units/${unitId}`, data);
export const fetchVacantUnits      = ()                  => api.get('/properties/units/vacant');
export const initiateSplatScan     = (data)              => api.post('/scans/initiate', data);
export const getPropertyScans      = (propertyId)        => api.get(`/scans/property/${propertyId}`);
export const deleteScan            = (propertyId, scanId)=> api.delete(`/scans/property/${propertyId}/${scanId}`);
export const getShareLink          = (propertyId, scanId)=> api.get(`/scans/share/${propertyId}/${scanId}`);

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
export const initiateSTKPush = (data)         => api.post('/payments/initiate-stk', data);
export const fetchPayments   = (params = {})  => api.get('/payments', { params });
export const overridePayment = (id, data)     => api.post(`/payments/${id}/override`, data);
export const initiateBankPayment = (data)     => api.post('/bank-payments/checkout', data);
export const getBankPaymentStatus = (txnId)   => api.get(`/bank-payments/status/${txnId}`);
export const queryMpesaTransactionStatus = (data) => api.post('/payments/mpesa/query-status', data);
export const reverseMpesaTransaction = (data) => api.post('/payments/mpesa/reverse', data);
export const fetchMpesaWorkingBalance = ()    => api.get('/payments/mpesa/balance');

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
  const base   = API_BASE;
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

export const fetchNotices      = ()        => api.get('/notices');
export const generateNotice    = (data)    => api.post('/notices/generate', data);
export const acknowledgeNotice = (id)      => api.post(`/notices/${id}/acknowledge`);
export const sendBulkNotice    = (data)    => api.post('/notices/bulk', data);
export const updateNotice      = (id, data) => api.patch(`/notices/${id}`, data);
export const deleteNotice      = (id)       => api.delete(`/notices/${id}`);

// ── Onboarding / User (Phase 4) ───────────────────────────────────────────────
export const updateUserRole    = (data)    => api.patch('/users/me/role', data);
export const checkTenantEmail  = (email)   => api.get(`/users/check-tenant-email/${encodeURIComponent(email)}`);
export const updateUserProfilePicture = (profile_picture) => api.put('/users/me/profile-picture', { profile_picture });

// ── Units Lock & Geo-checkin (Phase 4) ────────────────────────────────────────
export const deletePropertyUnit    = (id, unitId) => api.delete(`/properties/${id}/units/${unitId}`);
export const lockPropertyUnit      = (id, unitId, action) => api.post(`/properties/${id}/units/${unitId}/lock`, { action });

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
  const base = API_BASE;
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
export const fetchNotifications    = ()   => api.get('/notifications');
export const markNotifRead         = (id) => api.patch(`/notifications/${id}/read`);
export const markAllNotifsRead     = ()   => api.patch('/notifications/read-all');
export const deleteNotification    = (id) => api.delete(`/notifications/${id}`);
export const clearAllNotifications = ()   => api.delete('/notifications');


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
export const reclaimInventoryItem  = (propId, data)   => api.post(`/inventory/${propId}/reclaim`, data);
export const addInventoryItem      = (propId, data)   => api.post(`/inventory/${propId}/add-item`, data);
export const deleteInventoryItem   = (propId, itemId) => api.delete(`/inventory/${propId}/items/${itemId}`);

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
export const voidPayment              = (id, reason)      => api.post(`/payments/${id}/void`, { reason });

// ── Financial Settings & GL Endpoints ─────────────────────────────────────────
export const fetchFinancialSettings   = ()                => api.get('/settings/financial');
export const updateFinancialSettings  = (data)            => api.put('/settings/financial', data);
export const fetchTrialBalance        = ()                => api.get('/settings/trial-balance');

// ── Agent Salary & Commission Payroll Endpoints ────────────────────────────────
export const fetchAgentPayrollList    = (month)           => api.get('/commission/agents', { params: { month } });
export const fetchAgentSalary         = (agentId, month)  => api.get(`/commission/salary/${agentId}`, { params: { month } });
export const processAgentPayroll      = (data)            => api.post('/commission/payroll/process', data);

// ── Bulk Disbursement & Auto-Reconciliation Endpoints (Phase 3) ───────────────
export const fetchDisbursementPriority= ()                => api.get('/disbursement/priority');
export const updateDisbursementPriority= (priority)       => api.put('/disbursement/priority', { disbursement_priority: priority });
export const executeBulkDisbursement  = ()                => api.post('/disbursement/execute');
export const fetchUnmatchedPayments   = ()                => api.get('/payments/unmatched');
export const assignUnmatchedPayment   = (id, tenant_id)   => api.post(`/payments/unmatched/${id}/assign`, { tenant_id });

// ── Multi-Role Paperwork & PDF Engine (Phase 4) ───────────────────────────────
export const generateLegalPDF         = (doc_type, payload) => api.post('/paperwork/generate-pdf', { doc_type, payload }, { responseType: 'blob' });
export const downloadLegalPDF         = (docType, params) => api.get(`/paperwork/download/${docType}`, { params, responseType: 'blob' });
export const requestLeaseSigningOTP   = (tenant_id)       => api.post('/paperwork/sign/request-otp', { tenant_id });
export const verifyAndSignLease       = (data)            => api.post('/paperwork/sign/verify-and-sign', data);
export const fetchLeaseSignatureStatus= (tenantId)        => api.get(`/paperwork/sign/status/${tenantId}`);

// ── KRA eTIMS Tax Compliance Engine (Phase 5) ─────────────────────────────────
export const fetchETIMSSummary        = (month)           => api.get('/tax/etims/summary', { params: { month } });
export const downloadETIMSCSV         = (month)           => api.get('/tax/etims/export-csv', { params: { month }, responseType: 'blob' });
export const downloadITMRI01CSV       = (month)           => api.get('/tax/etims/mri-return', { params: { month }, responseType: 'blob' });

// ── Tenant Vacation & Move-Out Damage Survey Engine (Phase 6) ──────────────────
export const fileVacationNotice       = (data)            => api.post('/vacation/notice', data);
export const createMoveOutInspection  = (data)            => api.post('/vacation/inspection', data);
export const processDepositRefund     = (id)              => api.post(`/vacation/inspection/${id}/refund`);

// ── Multi-Currency Forex & Audit Trail (Phase 7) ───────────────────────────────
export const fetchCBKExchangeRate    = ()                => api.get('/exchange/cbk-rate');
export const fetchAuditLogs           = ()                => api.get('/audit/logs');

// ── Utility Metering, Token Vending & Water Management (Phase 6) ─────────────
export const fetchUtilityProviders    = ()                => api.get('/utilities/providers');
export const registerUtilityMeter     = (data)            => api.post('/utilities/meters', data);
export const logUtilityReading        = (data)            => api.post('/utilities/readings', data);
export const recordMeterReading       = (data)            => api.post('/utilities/readings', data);
export const fetchCombinedInvoice     = (tenantId)        => api.get(`/utilities/invoice/${tenantId}`);
export const purchasePrepaidToken     = (data)            => api.post('/utilities/prepaid/purchase-token', data);
export const queryPostpaidBill        = (accountNumber, provider) => api.get(`/utilities/postpaid/bill/${accountNumber}`, { params: { provider } });
export const payPostpaidBill          = (data)            => api.post('/utilities/postpaid/pay', data);
export const validateWaterAccount     = (data)            => api.post('/utilities/water/validate', data);
export const queryWaterBill           = (accountNumber, provider_id) => api.get(`/utilities/water/bill/${accountNumber}`, { params: { provider_id } });
export const payWaterBill             = (data)            => api.post('/utilities/water/pay', data);
export const fetchWaterAnalytics      = (propertyId, months = 6) => api.get(`/utilities/water/analytics/${propertyId}`, { params: { months } });
export const bulkImportReadings       = (readings)        => api.post('/utilities/readings/bulk', { readings });
export const calculateMewascoWaterBill= (data)            => api.post('/utilities/water/calculate-bill', data);
export const fetchMewascoTariffs      = ()                => api.get('/settings/mewasco-tariffs');
export const updateMewascoTariffs     = (tariffs)         => api.put('/settings/mewasco-tariffs', { tariffs });
export const fetchTenantHealthScore   = (tenantId)        => api.get(`/scoring/tenant/${tenantId}`);
export const registerVendor           = (data)            => api.post('/vendors', data);
export const dispatchWorkOrder        = (data)            => api.post('/vendors/dispatch', data);
export const approveVendorInvoice     = (data)            => api.post('/vendors/approve-invoice', data);

// ── Public Property Listings & Inquiries Engine (Phase 5) ─────────────────────
export const fetchPublicListings      = (params)          => api.get('/listings', { params });
export const submitPropertyInquiry    = (propertyId, data)=> api.post(`/listings/${propertyId}/inquire`, data);
export const updateUnitListingStatus  = (propertyId, unitId, status) => api.put(`/listings/${propertyId}/units/${unitId}/status`, { listing_status: status });
export const fetchAgentInquiries      = ()                => api.get('/listings/inquiries/manage');

export const geocodeAddress = async (street, area, city = 'Mombasa') => {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  if (!token) {
    console.warn('geocodeAddress: VITE_MAPBOX_TOKEN is not configured. Falling back to default region coordinates.');
    return { lng: 39.6682, lat: -4.0435, isFallback: true };
  }
  const query = `${street ? street + ', ' : ''}${area}, ${city}, Kenya`;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=1`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return { lng, lat, isFallback: false };
    }
  } catch (err) {
    console.error('Geocoding request failed:', err);
  }
  return { lng: 39.6682, lat: -4.0435, isFallback: true };
};

export default api;
