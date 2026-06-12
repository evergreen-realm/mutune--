import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchNotices, generateNotice, acknowledgeNotice } from '../lib/api';
import { FileText, Send, Download, CheckCircle, AlertCircle, Loader2, Clock, Eye } from 'lucide-react';
import { toast } from 'react-toastify';

const NOTICE_TYPES = [
  { value: 'rent_increase',    label: 'Rent Increase',      color: 'bg-amber-100 text-amber-800' },
  { value: 'maintenance',      label: 'Maintenance',         color: 'bg-blue-100 text-blue-800' },
  { value: 'eviction',         label: 'Eviction',            color: 'bg-red-100 text-red-800' },
  { value: 'lease_renewal',    label: 'Lease Renewal',       color: 'bg-green-100 text-green-800' },
  { value: 'entry_inspection', label: 'Entry Inspection',    color: 'bg-purple-100 text-purple-800' },
  { value: 'general',          label: 'General',             color: 'bg-gray-100 text-gray-800' }
];

const DELIVERY_METHODS = ['portal', 'sms', 'email'];

const EMPTY_FORM = {
  notice_type: 'rent_increase',
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
  const { data: noticesData, isLoading } = useQuery({
    queryKey: ['notices'],
    queryFn: fetchNotices
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

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
      const base = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="animate-spin text-green-600" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={22} className="text-green-600" />
            Digital Notices
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Official notices with PDF generation and multi-channel delivery</p>
        </div>
        {canIssue && (
          <button
            id="issue-notice-btn"
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            {showForm ? 'Cancel' : <><Send size={14} /> Issue Notice</>}
          </button>
        )}
      </div>

      {/* Issue Notice Form */}
      {showForm && canIssue && (
        <form
          id="notice-form"
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-sm"
        >
          <h3 className="font-semibold text-gray-800 text-sm">Issue New Notice</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="notice-type-select" className="block text-xs font-medium text-gray-600 mb-1">Notice Type</label>
              <select
                id="notice-type-select"
                value={form.notice_type}
                onChange={e => setForm({ ...form, notice_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {NOTICE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="notice-effective-date" className="block text-xs font-medium text-gray-600 mb-1">Effective Date</label>
              <input
                id="notice-effective-date"
                type="date"
                value={form.effective_date}
                onChange={e => setForm({ ...form, effective_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="notice-property-id" className="block text-xs font-medium text-gray-600 mb-1">Property ID</label>
              <input
                id="notice-property-id"
                value={form.property_id}
                onChange={e => setForm({ ...form, property_id: e.target.value })}
                placeholder="MongoDB ObjectId"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
                required
              />
            </div>
            <div>
              <label htmlFor="notice-unit-id" className="block text-xs font-medium text-gray-600 mb-1">Unit ID</label>
              <input
                id="notice-unit-id"
                value={form.unit_id}
                onChange={e => setForm({ ...form, unit_id: e.target.value })}
                placeholder="Unit ObjectId"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
                required
              />
            </div>
            <div>
              <label htmlFor="notice-tenant-id" className="block text-xs font-medium text-gray-600 mb-1">Tenant ID</label>
              <input
                id="notice-tenant-id"
                value={form.tenant_id}
                onChange={e => setForm({ ...form, tenant_id: e.target.value })}
                placeholder="Tenant ObjectId"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="notice-title" className="block text-xs font-medium text-gray-600 mb-1">Notice Title</label>
            <input
              id="notice-title"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Rent Increase Effective July 2026"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              required
              maxLength={200}
            />
          </div>

          <div>
            <label htmlFor="notice-body" className="block text-xs font-medium text-gray-600 mb-1">Notice Body</label>
            <textarea
              id="notice-body"
              value={form.body}
              onChange={e => setForm({ ...form, body: e.target.value })}
              placeholder="Full notice text that will appear in the PDF and delivery channels..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 h-28 resize-none"
              required
              maxLength={5000}
            />
            <p className="text-[10px] text-gray-400 mt-0.5 text-right">{form.body.length}/5000</p>
          </div>

          <div>
            <label htmlFor="notice-legal-basis" className="block text-xs font-medium text-gray-600 mb-1">Legal Basis (optional)</label>
            <input
              id="notice-legal-basis"
              value={form.legal_basis}
              onChange={e => setForm({ ...form, legal_basis: e.target.value })}
              placeholder="e.g. Section 4(1) Rent Restriction Act (Cap 296)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Delivery Methods</label>
            <div className="flex gap-4">
              {DELIVERY_METHODS.map(method => (
                <label key={method} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    id={`delivery-${method}`}
                    type="checkbox"
                    checked={form.delivery_method.includes(method)}
                    onChange={() => toggleDelivery(method)}
                    className="w-4 h-4 accent-green-600"
                  />
                  <span className="capitalize font-medium text-gray-700">{method}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            id="notice-submit-btn"
            type="submit"
            disabled={generateMutation.isPending}
            className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
          >
            {generateMutation.isPending
              ? <><Loader2 size={14} className="animate-spin" /> Generating PDF &amp; Delivering...</>
              : <><Send size={14} /> Generate &amp; Deliver Notice</>}
          </button>
        </form>
      )}

      {/* Notices Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {notices.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <FileText size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No notices issued yet</p>
            {canIssue && <p className="text-xs mt-1">Click &quot;Issue Notice&quot; to create your first digital notice</p>}
          </div>
        ) : (
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                {!isTenant && <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tenant</th>}
                <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Effective</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Delivered</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ack</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {notices.map(n => {
                const typeStyle = NOTICE_TYPES.find(t => t.value === n.notice_type)?.color || 'bg-gray-100 text-gray-800';
                const allDelivered = n.delivery_status?.length > 0 && n.delivery_status.every(d => ['delivered', 'sent'].includes(d.status));
                const hasFailure = n.delivery_status?.some(d => d.status === 'failed');

                return (
                  <tr key={n._id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${typeStyle}`}>
                        {n.notice_type?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-gray-800 max-w-[180px] truncate">{n.title}</td>
                    {!isTenant && (
                      <td className="p-3 text-gray-500 text-xs">
                        {n.tenant_id?.full_name || 'N/A'}
                      </td>
                    )}
                    <td className="p-3 text-gray-500 text-xs whitespace-nowrap">
                      {n.effective_date ? new Date(n.effective_date).toLocaleDateString('en-KE') : '—'}
                    </td>
                    <td className="p-3">
                      {allDelivered
                        ? <CheckCircle size={15} className="text-green-500" />
                        : hasFailure
                          ? <AlertCircle size={15} className="text-red-500" />
                          : <Clock size={15} className="text-amber-500" />}
                    </td>
                    <td className="p-3">
                      {n.tenant_acknowledged
                        ? <CheckCircle size={15} className="text-green-500" />
                        : isTenant
                          ? (
                            <button
                              id={`ack-notice-${n._id}`}
                              onClick={() => acknowledgeMutation.mutate(n._id)}
                              disabled={acknowledgeMutation.isPending}
                              className="text-[10px] px-2 py-0.5 bg-green-50 text-green-700 rounded border border-green-200 hover:bg-green-100 transition-colors font-medium"
                            >
                              Acknowledge
                            </button>
                          )
                          : <span className="text-gray-400 text-xs flex items-center gap-1"><Eye size={11} /> Pending</span>}
                    </td>
                    <td className="p-3">
                      {n.pdf_url && (
                        <button
                          id={`download-notice-${n._id}`}
                          onClick={() => handleDownload(n._id, n.title)}
                          className="text-green-700 hover:text-green-900 flex items-center gap-1 text-xs font-medium transition-colors"
                        >
                          <Download size={12} /> PDF
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
