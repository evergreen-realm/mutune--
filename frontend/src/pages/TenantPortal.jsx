import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Home, CreditCard, Wrench, Bell, Loader2, CheckCircle2,
  AlertTriangle, Clock, XCircle, ChevronRight, Receipt
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  fetchMyPayments, fetchMyNotices, fetchMyTickets,
  createMaintenanceTicket, initiatePayment, fetchMyProfile
} from '../lib/api';

const CATEGORIES = ['plumbing', 'electrical', 'structural', 'security', 'appliance', 'pest_control', 'cleaning', 'other'];
const PRIORITIES  = ['low', 'medium', 'high', 'emergency'];

const TICKET_STATUS_CFG = {
  open:             { label: 'Open',          color: 'text-yellow-700 bg-yellow-50 border-yellow-200', icon: Clock },
  assigned:         { label: 'Assigned',      color: 'text-blue-700 bg-blue-50 border-blue-200',   icon: ChevronRight },
  in_progress:      { label: 'In Progress',   color: 'text-purple-700 bg-purple-50 border-purple-200', icon: Loader2 },
  pending_parts:    { label: 'Pending Parts', color: 'text-orange-700 bg-orange-50 border-orange-200', icon: Clock },
  resolved:         { label: 'Resolved',      color: 'text-green-700 bg-green-50 border-green-200',  icon: CheckCircle2 },
  closed:           { label: 'Closed',        color: 'text-gray-700 bg-gray-50 border-gray-200',    icon: XCircle },
  tenant_disputed:  { label: 'Disputed',      color: 'text-red-700 bg-red-50 border-red-200',       icon: AlertTriangle }
};

const PRIORITY_CFG = {
  low:       'text-gray-500 bg-gray-50 border-gray-200',
  medium:    'text-blue-600 bg-blue-50 border-blue-200',
  high:      'text-orange-600 bg-orange-50 border-orange-200',
  emergency: 'text-red-700 bg-red-50 border-red-200'
};

function PaymentStatusBadge({ status }) {
  const cfg = {
    confirmed: { color: 'text-green-700 bg-green-50 border-green-200', label: 'Confirmed' },
    pending:   { color: 'text-yellow-700 bg-yellow-50 border-yellow-200', label: 'Pending' },
    failed:    { color: 'text-red-700 bg-red-50 border-red-200', label: 'Failed' }
  };
  const s = cfg[status] || cfg.pending;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.color}`}>
      {s.label}
    </span>
  );
}

function TabButton({ id, label, icon: Icon, active, onClick, badge }) {
  return (
    <button
      id={id}
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
        active
          ? 'bg-green-600 text-white shadow-sm'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      }`}
    >
      <Icon size={15} />
      {label}
      {badge > 0 && (
        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
          active ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

export default function TenantPortal() {
  const [activeTab, setActiveTab] = useState('overview');
  const [mForm, setMForm] = useState({ category: 'plumbing', priority: 'medium', description: '' });
  const queryClient = useQueryClient();

  const { data: profile }   = useQuery({ queryKey: ['myProfile'],  queryFn: fetchMyProfile,  retry: false });
  const { data: payments }  = useQuery({ queryKey: ['myPayments'], queryFn: fetchMyPayments });
  const { data: notices }   = useQuery({ queryKey: ['myNotices'],  queryFn: fetchMyNotices });
  const { data: tickets }   = useQuery({ queryKey: ['myTickets'],  queryFn: fetchMyTickets });

  const { mutate: submitTicket, isPending: submitting } = useMutation({
    mutationFn: createMaintenanceTicket,
    onSuccess: () => {
      toast.success('Maintenance request submitted ✓');
      setMForm({ category: 'plumbing', priority: 'medium', description: '' });
      queryClient.invalidateQueries({ queryKey: ['myTickets'] });
      setActiveTab('maintenance');
    },
    onError: (err) => toast.error(err?.error?.message || 'Failed to submit request')
  });

  const handlePayRent = async () => {
    const tenant = profile?.data;
    if (!tenant) { toast.error('Profile not loaded'); return; }
    try {
      const res = await initiatePayment({
        tenant_id: tenant._id,
        unit_id:   tenant.current_unit_id,
        amount:    tenant.rent_amount_kes,
        payment_type: 'rent'
      });
      toast.success(res.message || 'M-Pesa STK push sent to your phone 📱');
    } catch (err) {
      toast.error(err?.error?.message || 'Payment initiation failed');
    }
  };

  const handleMaintenance = (e) => {
    e.preventDefault();
    if (!mForm.description.trim()) { toast.error('Please describe the issue'); return; }
    const tenant = profile?.data;
    submitTicket({
      ...mForm,
      property_id: tenant?.current_property_id?._id || tenant?.current_property_id,
      unit_id:     tenant?.current_unit_id || 'self'
    });
  };

  const tenantData     = profile?.data;
  const paymentList    = payments?.data || [];
  const noticeList     = notices?.data  || [];
  const ticketList     = tickets?.data  || [];
  const openTickets    = ticketList.filter((t) => ['open', 'assigned', 'in_progress'].includes(t.status)).length;

  const leaseEnd = tenantData?.lease_end ? new Date(tenantData.lease_end) : null;
  const daysLeft = leaseEnd ? Math.ceil((leaseEnd - Date.now()) / 86400000) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-tr from-green-900 to-slate-900 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-green-400 text-xs font-bold uppercase tracking-widest mb-1">Tenant Portal</p>
            <h1 className="text-xl font-black">
              {tenantData?.full_name || 'My Portal'}
            </h1>
            {tenantData?.current_property_id && (
              <p className="text-slate-300 text-sm mt-1">
                {tenantData.current_property_id.name || tenantData.current_property_id} ·{' '}
                <span className="font-mono text-xs">{tenantData.tenant_code}</span>
              </p>
            )}
          </div>
          <button
            id="btn-pay-rent"
            onClick={handlePayRent}
            className="flex-shrink-0 bg-green-500 hover:bg-green-400 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition shadow-lg shadow-green-900/30"
          >
            <CreditCard size={15} /> Pay Rent
          </button>
        </div>

        {/* Lease info strip */}
        {tenantData && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/10">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Rent</p>
              <p className="font-black text-sm mt-0.5">KES {tenantData.rent_amount_kes?.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Lease Ends</p>
              <p className="font-black text-sm mt-0.5">
                {leaseEnd ? leaseEnd.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Days Left</p>
              <p className={`font-black text-sm mt-0.5 ${daysLeft !== null && daysLeft < 30 ? 'text-red-400' : ''}`}>
                {daysLeft !== null ? `${daysLeft}d` : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Status</p>
              <p className="font-black text-sm mt-0.5 capitalize">{tenantData.tenancy_status || 'active'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <TabButton id="tab-overview"     label="Overview"     icon={Home}    active={activeTab === 'overview'}     onClick={() => setActiveTab('overview')} />
        <TabButton id="tab-payments"     label="Payments"     icon={Receipt} active={activeTab === 'payments'}     onClick={() => setActiveTab('payments')}  badge={0} />
        <TabButton id="tab-maintenance"  label="Maintenance"  icon={Wrench}  active={activeTab === 'maintenance'}  onClick={() => setActiveTab('maintenance')} badge={openTickets} />
        <TabButton id="tab-notices"      label="Notices"      icon={Bell}    active={activeTab === 'notices'}      onClick={() => setActiveTab('notices')} badge={noticeList.length} />
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            onClick={() => setActiveTab('payments')}
            className="bg-white border border-gray-100 rounded-2xl p-5 cursor-pointer hover:border-green-200 hover:shadow-sm transition group"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-green-50 rounded-xl group-hover:bg-green-100 transition">
                <Receipt size={16} className="text-green-600" />
              </div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Payments</span>
            </div>
            <p className="text-2xl font-black text-gray-900">{paymentList.length}</p>
            <p className="text-xs text-gray-400 mt-1">
              {paymentList.filter((p) => p.status === 'confirmed').length} confirmed
            </p>
          </div>

          <div
            onClick={() => setActiveTab('maintenance')}
            className="bg-white border border-gray-100 rounded-2xl p-5 cursor-pointer hover:border-blue-200 hover:shadow-sm transition group"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition">
                <Wrench size={16} className="text-blue-600" />
              </div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Maintenance</span>
            </div>
            <p className="text-2xl font-black text-gray-900">{ticketList.length}</p>
            <p className="text-xs text-gray-400 mt-1">{openTickets} open</p>
          </div>

          <div
            onClick={() => setActiveTab('notices')}
            className="bg-white border border-gray-100 rounded-2xl p-5 cursor-pointer hover:border-yellow-200 hover:shadow-sm transition group"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-yellow-50 rounded-xl group-hover:bg-yellow-100 transition">
                <Bell size={16} className="text-yellow-600" />
              </div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Notices</span>
            </div>
            <p className="text-2xl font-black text-gray-900">{noticeList.length}</p>
            <p className="text-xs text-gray-400 mt-1">From management</p>
          </div>
        </div>
      )}

      {/* ── Payments Tab ── */}
      {activeTab === 'payments' && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Payment History</h3>
            <span className="text-xs text-gray-400">{paymentList.length} records</span>
          </div>
          {paymentList.length ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">Receipt</th>
                  <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">Amount</th>
                  <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paymentList.map((p) => (
                  <tr key={p._id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-gray-600">
                      {p.mpesa_receipt || p.transaction_id?.slice(0, 16) || '—'}
                    </td>
                    <td className="px-5 py-3 font-black text-gray-900">
                      KES {p.amount_kes?.toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <PaymentStatusBadge status={p.status} />
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {new Date(p.created_at).toLocaleDateString('en-KE', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-16 text-center text-gray-400">
              <Receipt size={32} className="mx-auto mb-2 text-gray-200" />
              <p className="text-sm font-medium">No payment history yet</p>
            </div>
          )}
        </div>
      )}

      {/* ── Maintenance Tab ── */}
      {activeTab === 'maintenance' && (
        <div className="space-y-5">
          {/* New Request Form */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-4">Submit Maintenance Request</h3>
            <form id="maintenance-request-form" onSubmit={handleMaintenance} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5" htmlFor="m-category">Category</label>
                  <select
                    id="m-category"
                    value={mForm.category}
                    onChange={(e) => setMForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/30 bg-white"
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5" htmlFor="m-priority">Priority</label>
                  <select
                    id="m-priority"
                    value={mForm.priority}
                    onChange={(e) => setMForm((f) => ({ ...f, priority: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/30 bg-white"
                  >
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5" htmlFor="m-description">Description *</label>
                <textarea
                  id="m-description"
                  value={mForm.description}
                  onChange={(e) => setMForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the issue in detail — location, severity, when it started…"
                  rows={4}
                  maxLength={2000}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/30 resize-none transition"
                  required
                />
                <p className="text-[10px] text-gray-400 mt-1 text-right">{mForm.description.length}/2000</p>
              </div>
              <button
                id="btn-submit-maintenance"
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition disabled:opacity-50"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </form>
          </div>

          {/* Ticket List */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">My Tickets</h3>
              <span className="text-xs text-gray-400">{ticketList.length} total</span>
            </div>
            {ticketList.length ? (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">Ticket</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">Category</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">Priority</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">Opened</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ticketList.map((t) => {
                    const scfg = TICKET_STATUS_CFG[t.status] || TICKET_STATUS_CFG.open;
                    const StatusIcon = scfg.icon;
                    return (
                      <tr key={t._id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3">
                          <span className="font-mono text-xs font-semibold text-gray-700">{t.ticket_code}</span>
                        </td>
                        <td className="px-5 py-3 capitalize text-xs text-gray-600">{t.category?.replace('_', ' ')}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${PRIORITY_CFG[t.priority] || PRIORITY_CFG.medium}`}>
                            {t.priority}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${scfg.color}`}>
                            <StatusIcon size={9} /> {scfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-400">
                          {new Date(t.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="py-16 text-center text-gray-400">
                <Wrench size={32} className="mx-auto mb-2 text-gray-200" />
                <p className="text-sm font-medium">No maintenance tickets yet</p>
                <p className="text-xs mt-1">Submit a request above</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Notices Tab ── */}
      {activeTab === 'notices' && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b bg-gray-50">
            <h3 className="font-bold text-gray-900">Notices from Management</h3>
          </div>
          {noticeList.length ? (
            <div className="divide-y divide-gray-50">
              {noticeList.map((n) => (
                <div key={n._id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-800">{n.title || 'Notice'}</p>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">
                      {new Date(n.created_at).toLocaleDateString('en-KE')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{n.body || n.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-gray-400">
              <Bell size={32} className="mx-auto mb-2 text-gray-200" />
              <p className="text-sm font-medium">No notices yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
