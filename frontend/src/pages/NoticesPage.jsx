import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchNotices,
  generateNotice,
  acknowledgeNotice,
  sendBulkNotice,
  fetchProperties,
  updateNotice,
  deleteNotice,
  fetchTenants
} from '../lib/api';
import {
  FileText,
  Send,
  Download,
  CheckCircle,
  AlertCircle,
  Loader2,
  Clock,
  Eye,
  Megaphone,
  X,
  Edit2,
  Trash2,
  Calendar,
  Building,
  User as UserIcon
} from 'lucide-react';
import { toast } from 'react-toastify';

const NOTICE_TYPES = [
  { value: 'rent_increase',    label: 'Rent Increase',      color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  { value: 'maintenance',      label: 'Maintenance',         color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  { value: 'eviction',         label: 'Eviction',            color: 'bg-red-500/10 text-red-400 border border-red-500/20' },
  { value: 'lease_renewal',    label: 'Lease Renewal',       color: 'bg-green-500/10 text-green-400 border border-green-500/20' },
  { value: 'entry_inspection', label: 'Entry Inspection',    color: 'bg-purple-500/10 text-purple-400 border border-purple-500/20' },
  { value: 'general',          label: 'General',             color: 'bg-slate-500/10 text-slate-400 border border-slate-500/20' }
];

const DELIVERY_METHODS = ['portal', 'sms', 'email'];

const EMPTY_FORM = {
  notice_type: 'general',
  property_id: '',
  unit_id: '',
  tenant_id: '',
  title: '',
  body: '',
  effective_date: '',
  delivery_method: ['portal'],
  legal_basis: ''
};

export default function NoticesPage({ user }) {
  const queryClient = useQueryClient();

  const { data: noticesData, isLoading: noticesLoading } = useQuery({
    queryKey: ['notices'],
    queryFn: fetchNotices
  });

  const { data: propertiesData, isLoading: propertiesLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: () => fetchProperties({ limit: 200 }),
    staleTime: 60_000
  });

  const { data: tenantsData, isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants-list'],
    queryFn: () => fetchTenants({ limit: 1000 }),
    staleTime: 60_000
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  // Bulk Notice Modal state
  const EMPTY_BULK = {
    notice_type: 'general',
    property_id: '',
    unit_id: '',
    title: '',
    body: '',
    effective_date: new Date().toISOString().split('T')[0]
  };
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkForm, setBulkForm] = useState(EMPTY_BULK);
  const [recipientScope, setRecipientScope] = useState('property'); // 'all', 'property', 'unit'

  // Edit / Delete Notice states
  const [editingNotice, setEditingNotice] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', body: '', effective_date: '' });
  const [deletingNotice, setDeletingNotice] = useState(null);

  const bulkMutation = useMutation({
    mutationFn: sendBulkNotice,
    onSuccess: (data) => {
      const count = data?.count ?? data?.data?.length ?? 0;
      toast.success(`Bulk notice sent to ${count} tenant${count !== 1 ? 's' : ''} successfully`);
      setShowBulkModal(false);
      setBulkForm(EMPTY_BULK);
      queryClient.invalidateQueries({ queryKey: ['notices'] });
    },
    onError: (err) => {
      const msg = err?.error?.message || err?.error?.details?.[0]?.msg || 'Failed to send bulk notice';
      toast.error(msg);
    }
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }) => updateNotice(id, data),
    onSuccess: () => {
      toast.success('Notice updated successfully');
      setEditingNotice(null);
      queryClient.invalidateQueries({ queryKey: ['notices'] });
    },
    onError: (err) => {
      toast.error(err?.error?.message || 'Failed to update notice');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteNotice(id),
    onSuccess: () => {
      toast.success('Notice deleted successfully');
      setDeletingNotice(null);
      queryClient.invalidateQueries({ queryKey: ['notices'] });
    },
    onError: (err) => {
      toast.error(err?.error?.message || 'Failed to delete notice');
    }
  });

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editForm.title.trim() || !editForm.body.trim()) {
      toast.error('Title and body are required');
      return;
    }
    editMutation.mutate({ id: editingNotice._id, data: editForm });
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (recipientScope === 'property' && !bulkForm.property_id) {
      toast.error('Please select a property');
      return;
    }
    if (recipientScope === 'unit' && (!bulkForm.property_id || !bulkForm.unit_id)) {
      toast.error('Please select a property and unit');
      return;
    }
    if (!bulkForm.title.trim() || !bulkForm.body.trim()) {
      toast.error('Subject and message body are required');
      return;
    }

    try {
      if (recipientScope === 'all') {
        const activeTenants = tenantsData?.data || [];
        if (activeTenants.length === 0) {
          toast.error('No active tenants found');
          return;
        }

        const tenantsByProperty = {};
        activeTenants.forEach(t => {
          const propId = t.current_property_id?._id || t.current_property_id;
          if (propId) {
            if (!tenantsByProperty[propId]) tenantsByProperty[propId] = [];
            tenantsByProperty[propId].push(t._id);
          }
        });

        const promises = Object.entries(tenantsByProperty).map(([propId, tIds]) => {
          return sendBulkNotice({
            notice_type: bulkForm.notice_type,
            property_id: propId,
            title: bulkForm.title,
            body: bulkForm.body,
            effective_date: bulkForm.effective_date,
            tenant_ids: tIds
          });
        });

        if (promises.length === 0) {
          toast.error('No tenants grouped by property found.');
          return;
        }

        await Promise.all(promises);
        toast.success(`Bulk notices sent successfully to all tenants across properties`);
        setShowBulkModal(false);
        setBulkForm(EMPTY_BULK);
        queryClient.invalidateQueries({ queryKey: ['notices'] });
      } else if (recipientScope === 'property') {
        await bulkMutation.mutateAsync({
          notice_type: bulkForm.notice_type,
          property_id: bulkForm.property_id,
          title: bulkForm.title,
          body: bulkForm.body,
          effective_date: bulkForm.effective_date
        });
      } else if (recipientScope === 'unit') {
        // Find tenant in that unit
        const activeTenants = tenantsData?.data || [];
        const tenantsInUnit = activeTenants.filter(t => {
          const uId = t.current_unit_id?._id || t.current_unit_id;
          const pId = t.current_property_id?._id || t.current_property_id;
          return pId === bulkForm.property_id && uId === bulkForm.unit_id;
        });

        if (tenantsInUnit.length === 0) {
          toast.error('No active tenant found in the selected unit');
          return;
        }

        await bulkMutation.mutateAsync({
          notice_type: bulkForm.notice_type,
          property_id: bulkForm.property_id,
          title: bulkForm.title,
          body: bulkForm.body,
          effective_date: bulkForm.effective_date,
          tenant_ids: tenantsInUnit.map(t => t._id)
        });
      }
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to send bulk notices');
    }
  };

  const generateMutation = useMutation({
    mutationFn: generateNotice,
    onSuccess: () => {
      toast.success('Notice generated and delivered successfully');
      setShowForm(false);
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ['notices'] });
    },
    onError: (err) => {
      const msg = err?.error?.message || err?.error?.details?.[0]?.msg || 'Failed to generate notice';
      toast.error(msg);
    }
  });

  const acknowledgeMutation = useMutation({
    mutationFn: acknowledgeNotice,
    onSuccess: () => {
      toast.success('Notice acknowledged');
      queryClient.invalidateQueries({ queryKey: ['notices'] });
    },
    onError: () => toast.error('Failed to acknowledge notice')
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.property_id) {
      toast.error('Property selection is required');
      return;
    }
    if (!form.unit_id) {
      toast.error('Unit selection is required');
      return;
    }
    if (!form.tenant_id) {
      toast.error('No tenant is assigned to this unit');
      return;
    }
    if (!form.delivery_method.length) {
      toast.error('Select at least one delivery method');
      return;
    }
    generateMutation.mutate(form);
  };

  const toggleDelivery = (method) => {
    setForm(prev => ({
      ...prev,
      delivery_method: prev.delivery_method.includes(method)
        ? prev.delivery_method.filter(m => m !== method)
        : [...prev.delivery_method, method]
    }));
  };

  const handleDownload = async (noticeId, title = 'Notice') => {
    try {
      const base = import.meta.env.VITE_API_URL || 'https://mutunerent-api.onrender.com/api/v1';
      let token = null;
      try {
        const clerk = window.Clerk;
        if (clerk?.session) {
          token = await clerk.session.getToken();
        }
      } catch (err) {
        console.warn('Failed to resolve Clerk token for notice download:', err.message);
      }

      const response = await fetch(`${base}/notices/${noticeId}/download`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });

      if (!response.ok) {
        throw new Error('Failed to download PDF notice');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `notice_${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      toast.error('Failed to download notice PDF');
    }
  };

  const isTenant = user?.role === 'tenant';
  const canIssue = ['admin', 'super_admin', 'agent'].includes(user?.role);
  const notices = noticesData?.data || [];
  const properties = propertiesData?.data || [];

  if (noticesLoading || propertiesLoading || tenantsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-6 bg-slate-900 rounded-lg w-40 animate-pulse"></div>
            <div className="h-4 bg-slate-900 rounded-lg w-64 animate-pulse"></div>
          </div>
          <div className="h-10 bg-slate-900 rounded-lg w-32 animate-pulse"></div>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 space-y-4">
          <div className="h-10 bg-slate-950/50 rounded-xl w-full animate-pulse"></div>
          <div className="h-10 bg-slate-950/50 rounded-xl w-full animate-pulse"></div>
          <div className="h-10 bg-slate-950/50 rounded-xl w-full animate-pulse"></div>
        </div>
      </div>
    );
  }

  // Find currently selected property's active tenant for the unit in the single form
  const selectedProperty = properties.find(p => p._id === form.property_id);
  const selectedUnit = selectedProperty?.units?.find(u => u._id === form.unit_id);
  const resolvedTenantId = selectedUnit?.current_tenant_id;
  const resolvedTenant = tenantsData?.data?.find(t => t._id === resolvedTenantId);

  return (
    <div className="space-y-6 text-white">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText size={22} className="text-green-600" />
            Digital Notices
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Official notices with PDF generation and multi-channel delivery</p>
        </div>
        {canIssue && (
          <div className="flex items-center gap-2">
            <button
              id="send-bulk-notice-btn"
              onClick={() => setShowBulkModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-500 transition-all duration-150 flex items-center gap-2 cursor-pointer"
            >
              <Megaphone size={14} /> Send Bulk Notice
            </button>
            <button
              id="issue-notice-btn"
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-slate-800 text-slate-200 rounded-xl text-sm font-medium hover:bg-slate-700 border border-slate-700 transition-all duration-150 flex items-center gap-2 cursor-pointer"
            >
              {showForm ? 'Cancel' : <><Send size={14} /> Issue Notice</>}
            </button>
          </div>
        )}
      </div>

      {/* Issue Notice Form */}
      {showForm && canIssue && (
        <form
          id="notice-form"
          onSubmit={handleSubmit}
          className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-4 shadow-xl"
        >
          <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
            <Send size={16} className="text-green-600" /> Issue New Notice
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="notice-property-id" className="block text-xs font-medium text-slate-400 mb-1">
                Property <span className="text-red-500">*</span>
              </label>
              <select
                id="notice-property-id"
                value={form.property_id}
                onChange={e => {
                  setForm({ ...form, property_id: e.target.value, unit_id: '', tenant_id: '' });
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-green-500/50 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer"
                required
              >
                <option value="">— Select Property —</option>
                {properties.map(p => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="notice-unit-id" className="block text-xs font-medium text-slate-400 mb-1">
                Unit <span className="text-red-500">*</span>
              </label>
              <select
                id="notice-unit-id"
                value={form.unit_id}
                onChange={e => {
                  const uId = e.target.value;
                  const unitObj = selectedProperty?.units?.find(u => u._id === uId);
                  setForm({
                    ...form,
                    unit_id: uId,
                    tenant_id: unitObj?.current_tenant_id || ''
                  });
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-green-500/50 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer"
                required
                disabled={!form.property_id}
              >
                <option value="">— Select Unit —</option>
                {selectedProperty?.units?.map(u => (
                  <option key={u._id} value={u._id}>
                    {u.unit_number} {u.current_tenant_id ? '(Occupied)' : '(Vacant)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="notice-tenant-display" className="block text-xs font-medium text-slate-400 mb-1">
                Active Tenant
              </label>
              <input
                id="notice-tenant-display"
                type="text"
                readOnly
                value={resolvedTenant ? `${resolvedTenant.full_name} (${resolvedTenant.phone})` : 'No tenant assigned'}
                className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-slate-400 text-sm focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="notice-type-select" className="block text-xs font-medium text-slate-400 mb-1">
                Notice Type <span className="text-red-500">*</span>
              </label>
              <select
                id="notice-type-select"
                value={form.notice_type}
                onChange={e => setForm({ ...form, notice_type: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-green-500/50 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer"
                required
              >
                {NOTICE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="notice-effective-date" className="block text-xs font-medium text-slate-400 mb-1">
                Effective Date <span className="text-red-500">*</span>
              </label>
              <input
                id="notice-effective-date"
                type="date"
                value={form.effective_date}
                onChange={e => setForm({ ...form, effective_date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-green-500/50 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="notice-title" className="block text-xs font-medium text-slate-400 mb-1">
              Notice Title / Subject <span className="text-red-500">*</span>
            </label>
            <input
              id="notice-title"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Notice of Rent Adjustment"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-green-500/50 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
              required
              maxLength={200}
            />
          </div>

          <div>
            <label htmlFor="notice-body" className="block text-xs font-medium text-slate-400 mb-1">
              Notice Message Body <span className="text-red-500">*</span>
            </label>
            <textarea
              id="notice-body"
              value={form.body}
              onChange={e => setForm({ ...form, body: e.target.value })}
              placeholder="Full notice text details..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-green-500/50 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500 h-28 resize-none"
              required
              maxLength={5000}
            />
            <p className="text-[10px] text-slate-500 mt-0.5 text-right">{form.body.length}/5000</p>
          </div>

          <div>
            <label htmlFor="notice-legal-basis" className="block text-xs font-medium text-slate-400 mb-1">Legal Basis (optional)</label>
            <input
              id="notice-legal-basis"
              value={form.legal_basis}
              onChange={e => setForm({ ...form, legal_basis: e.target.value })}
              placeholder="e.g. Section 4(1) Rent Restriction Act (Cap 296)"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-green-500/50 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Delivery Channels</label>
            <div className="flex gap-4">
              {DELIVERY_METHODS.map(method => (
                <label key={method} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    id={`delivery-${method}`}
                    type="checkbox"
                    checked={form.delivery_method.includes(method)}
                    onChange={() => toggleDelivery(method)}
                    className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-green-600 focus:ring-0 accent-green-600 cursor-pointer"
                  />
                  <span className="capitalize font-medium text-slate-300">{method}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            id="notice-submit-btn"
            type="submit"
            disabled={generateMutation.isPending}
            className="w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer"
          >
            {generateMutation.isPending
              ? <><Loader2 size={14} className="animate-spin" /> Generating PDF &amp; Delivering...</>
              : <><Send size={14} /> Generate &amp; Deliver Notice</>}
          </button>
        </form>
      )}

      {/* Notices Table */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        {notices.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <FileText size={36} className="mx-auto mb-3 opacity-30 text-slate-400" />
            <p className="text-sm font-medium">No notices issued yet</p>
            {canIssue && <p className="text-xs mt-1">Click &quot;Issue Notice&quot; to create your first digital notice</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-slate-950/40 border-b border-slate-800/80">
                  <th className="p-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="p-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Title</th>
                  {!isTenant && <th className="p-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Tenant</th>}
                  <th className="p-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Effective Date</th>
                  <th className="p-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Delivery</th>
                  <th className="p-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Ack Status</th>
                  <th className="p-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {notices.map(n => {
                  const typeStyle = NOTICE_TYPES.find(t => t.value === n.notice_type)?.color || 'bg-slate-800 text-slate-400 border border-slate-700/50';
                  const allDelivered = n.delivery_status?.length > 0 && n.delivery_status.every(d => ['delivered', 'sent'].includes(d.status));
                  const hasFailure = n.delivery_status?.some(d => d.status === 'failed');

                  return (
                    <tr key={n._id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${typeStyle}`}>
                          {n.notice_type?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-slate-200 max-w-[200px] truncate" title={n.title}>
                        {n.title}
                      </td>
                      {!isTenant && (
                        <td className="p-4 text-slate-300 text-xs">
                          {n.tenant_id?.full_name || <span className="text-slate-500">N/A</span>}
                        </td>
                      )}
                      <td className="p-4 text-slate-400 text-xs">
                        {n.effective_date ? new Date(n.effective_date).toLocaleDateString('en-KE', { dateStyle: 'medium' }) : '—'}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5" title={n.delivery_status?.map(d => `${d.method}: ${d.status}`).join(', ')}>
                          {allDelivered ? (
                            <span className="flex items-center gap-1 text-[11px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                              <CheckCircle size={12} /> Sent
                            </span>
                          ) : hasFailure ? (
                            <span className="flex items-center gap-1 text-[11px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                              <AlertCircle size={12} /> Error
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                              <Clock size={12} /> Pending
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        {n.tenant_acknowledged ? (
                          <span className="flex items-center gap-1 text-[11px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20 w-fit">
                            <CheckCircle size={12} /> Acknowledged
                          </span>
                        ) : isTenant ? (
                          <button
                            id={`ack-notice-${n._id}`}
                            onClick={() => acknowledgeMutation.mutate(n._id)}
                            disabled={acknowledgeMutation.isPending}
                            className="text-[10px] px-2.5 py-1 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors font-medium cursor-pointer"
                          >
                            Acknowledge
                          </button>
                        ) : (
                          <span className="text-slate-500 text-xs flex items-center gap-1">
                            <Eye size={11} /> Awaiting tenant
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {n.pdf_url && (
                            <button
                              id={`download-notice-${n._id}`}
                              onClick={() => handleDownload(n._id, n.title)}
                              className="text-green-400 hover:text-green-300 flex items-center gap-1 text-xs font-bold transition-colors cursor-pointer"
                            >
                              <Download size={13} /> PDF
                            </button>
                          )}
                          {canIssue && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingNotice(n);
                                  setEditForm({
                                    title: n.title,
                                    body: n.body,
                                    effective_date: n.effective_date ? n.effective_date.split('T')[0] : ''
                                  });
                                }}
                                className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-xs font-bold transition-colors cursor-pointer"
                              >
                                <Edit2 size={13} /> Edit
                              </button>
                              <button
                                onClick={() => setDeletingNotice(n)}
                                className="text-red-400 hover:text-red-300 flex items-center gap-1 text-xs font-bold transition-colors cursor-pointer"
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Bulk Notice Modal ───────────────────────────────────────────────── */}
      {showBulkModal && canIssue && (
        <div
          id="bulk-notice-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowBulkModal(false); }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in text-white relative">
            {/* Modal Close Button */}
            <button
              id="bulk-modal-close-btn"
              onClick={() => setShowBulkModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-2 px-6 pt-5 pb-4 border-b border-slate-800">
              <Megaphone size={18} className="text-green-500" />
              <h3 className="text-base font-bold text-white">Send Bulk Notice</h3>
            </div>

            {/* Modal Form */}
            <form id="bulk-notice-form" onSubmit={handleBulkSubmit} className="p-6 space-y-4">
              {/* Recipient Scope Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  Recipient Scope <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'all', label: 'All Tenants' },
                    { value: 'property', label: 'By Property' },
                    { value: 'unit', label: 'By Unit' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setRecipientScope(opt.value);
                        setBulkForm({ ...bulkForm, property_id: '', unit_id: '' });
                      }}
                      className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all duration-150 cursor-pointer ${
                        recipientScope === opt.value
                          ? 'bg-green-600/10 text-green-400 border-green-500/30'
                          : 'bg-slate-950/50 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Property Selector (for property / unit scopes) */}
              {recipientScope !== 'all' && (
                <div>
                  <label htmlFor="bulk-property-select" className="block text-xs font-medium text-slate-400 mb-1">
                    Select Property <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="bulk-property-select"
                    value={bulkForm.property_id}
                    onChange={e => {
                      setBulkForm({ ...bulkForm, property_id: e.target.value, unit_id: '' });
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-green-500/50 rounded-xl text-white text-sm cursor-pointer"
                    required
                  >
                    <option value="">— Select property —</option>
                    {properties.map(p => (
                      <option key={p._id} value={p._id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Unit Selector (for unit scope only) */}
              {recipientScope === 'unit' && bulkForm.property_id && (
                <div>
                  <label htmlFor="bulk-unit-select" className="block text-xs font-medium text-slate-400 mb-1">
                    Select Unit <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="bulk-unit-select"
                    value={bulkForm.unit_id}
                    onChange={e => setBulkForm({ ...bulkForm, unit_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-green-500/50 rounded-xl text-white text-sm cursor-pointer"
                    required
                  >
                    <option value="">— Select unit —</option>
                    {properties.find(p => p._id === bulkForm.property_id)?.units?.map(u => (
                      <option key={u._id} value={u._id}>
                        {u.unit_number} {u.current_tenant_id ? '(Occupied)' : '(Vacant)'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {recipientScope === 'all' && (
                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-400 flex items-start gap-2">
                  <AlertCircle size={15} className="text-green-500 shrink-0 mt-0.5" />
                  <span>This notice will be sent to all active tenants across all registered properties.</span>
                </div>
              )}

              {/* Notice Type */}
              <div>
                <label htmlFor="bulk-notice-type" className="block text-xs font-medium text-slate-400 mb-1">Notice Type</label>
                <select
                  id="bulk-notice-type"
                  value={bulkForm.notice_type}
                  onChange={e => setBulkForm({ ...bulkForm, notice_type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-green-500/50 rounded-xl text-white text-sm cursor-pointer"
                >
                  {NOTICE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Subject / Title */}
              <div>
                <label htmlFor="bulk-notice-title" className="block text-xs font-medium text-slate-400 mb-1">
                  Subject / Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="bulk-notice-title"
                  type="text"
                  value={bulkForm.title}
                  onChange={e => setBulkForm({ ...bulkForm, title: e.target.value })}
                  placeholder="e.g. Schedule for Water Tank Cleaning"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-green-500/50 rounded-xl text-white text-sm"
                  required
                  maxLength={200}
                />
              </div>

              {/* Message / Body */}
              <div>
                <label htmlFor="bulk-notice-body" className="block text-xs font-medium text-slate-400 mb-1">
                  Message Details <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="bulk-notice-body"
                  value={bulkForm.body}
                  onChange={e => setBulkForm({ ...bulkForm, body: e.target.value })}
                  placeholder="Type your notice body here..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-green-500/50 rounded-xl text-white text-sm h-28 resize-none"
                  required
                  maxLength={5000}
                />
                <p className="text-[10px] text-slate-500 mt-0.5 text-right">{bulkForm.body.length}/5000</p>
              </div>

              {/* Effective Date */}
              <div>
                <label htmlFor="bulk-effective-date" className="block text-xs font-medium text-slate-400 mb-1">
                  Effective Date <span className="text-red-500">*</span>
                </label>
                <input
                  id="bulk-effective-date"
                  type="date"
                  value={bulkForm.effective_date}
                  onChange={e => setBulkForm({ ...bulkForm, effective_date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-green-500/50 rounded-xl text-white text-sm cursor-pointer"
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium border border-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="bulk-notice-submit-btn"
                  type="submit"
                  disabled={bulkMutation.isPending}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {bulkMutation.isPending ? (
                    <><Loader2 size={14} className="animate-spin" /> Sending...</>
                  ) : (
                    <><Send size={14} /> Send Notice</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Notice Modal ────────────────────────────────────────────────── */}
      {editingNotice && canIssue && (
        <div
          id="edit-notice-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditingNotice(null); }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in text-white relative">
            {/* Modal Close Button */}
            <button
              onClick={() => setEditingNotice(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-2 px-6 pt-5 pb-4 border-b border-slate-800">
              <Edit2 size={18} className="text-blue-400" />
              <h3 className="text-base font-bold text-white">Edit Notice Details</h3>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Title / Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-green-500/50 rounded-xl text-white text-sm"
                  required
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Message Details <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editForm.body}
                  onChange={e => setEditForm({ ...editForm, body: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-green-500/50 rounded-xl text-white text-sm h-28 resize-none"
                  required
                  maxLength={5000}
                />
                <p className="text-[10px] text-slate-500 mt-0.5 text-right">{editForm.body.length}/5000</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Effective Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={editForm.effective_date}
                  onChange={e => setEditForm({ ...editForm, effective_date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-green-500/50 rounded-xl text-white text-sm cursor-pointer"
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingNotice(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium border border-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editMutation.isPending}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {editMutation.isPending ? (
                    <><Loader2 size={14} className="animate-spin" /> Saving...</>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ────────────────────────────────────────── */}
      {deletingNotice && canIssue && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDeletingNotice(null); }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in text-white relative">
            {/* Modal Close Button */}
            <button
              onClick={() => setDeletingNotice(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-2 px-6 pt-5 pb-4 border-b border-slate-800">
              <Trash2 size={18} className="text-red-500" />
              <h3 className="text-base font-bold text-white">Delete Notice</h3>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-300">
                Are you sure you want to permanently delete the notice:
              </p>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-medium text-slate-200 break-words">
                {deletingNotice.title}
              </div>
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertCircle size={14} /> This action cannot be undone.
              </p>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeletingNotice(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium border border-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={deleteMutation.isPending}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {deleteMutation.isPending ? (
                    <><Loader2 size={14} className="animate-spin" /> Deleting...</>
                  ) : (
                    'Confirm Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
