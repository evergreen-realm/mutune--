import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import { fetchPayments, voidPayment } from '../lib/api';
import { TableSkeleton } from '../components/SkeletonLoader';
import { toast } from 'react-toastify';
import {
  WalletCards, Search, CheckCircle2, XCircle, Clock,
  AlertTriangle, ArrowUpRight, Phone, Receipt, Download, Ban, Loader2
} from 'lucide-react';

const STATUS_CONFIG = {
  confirmed:        { label: 'Confirmed',       color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  pending:          { label: 'Pending',          color: 'text-blue-700 bg-blue-50 border-blue-200', icon: Clock },
  failed:           { label: 'Failed',           color: 'text-red-700 bg-red-50 border-red-200', icon: XCircle },
  manual_override:  { label: 'Override',         color: 'text-purple-700 bg-purple-50 border-purple-200', icon: AlertTriangle },
  reversed:         { label: 'Reversed',         color: 'text-orange-700 bg-orange-50 border-orange-200', icon: XCircle },
  processing:       { label: 'Processing',       color: 'text-gray-700 bg-gray-50 border-gray-200', icon: Clock }
};

const CHANNEL_LABELS = {
  mpesa_stk: 'M-Pesa STK',
  mpesa_c2b: 'M-Pesa C2B',
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  diaspora_wire: 'Diaspora Wire'
};

export default function PaymentsPage() {
  const qc = useQueryClient();
  const { user: clerkUser } = useUser();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [voidingPmt, setVoidingPmt] = useState(null);
  const [voidReason, setVoidReason] = useState('');

  const role = clerkUser?.publicMetadata?.role || 'landlord';
  const isAdmin = ['admin', 'super_admin'].includes(role);

  const { data, isLoading, error } = useQuery({
    queryKey: ['payments', search, statusFilter],
    queryFn: () => fetchPayments({ search, status: statusFilter || undefined }),
    refetchInterval: 10000
  });

  const voidMutation = useMutation({
    mutationFn: ({ id, reason }) => voidPayment(id, reason),
    onSuccess: () => {
      toast.success('Payment voided successfully');
      setVoidingPmt(null);
      setVoidReason('');
      qc.invalidateQueries(['payments']);
    },
    onError: (err) => {
      toast.error(err?.error?.message || 'Failed to void payment');
    }
  });

  const handleVoidSubmit = (e) => {
    e.preventDefault();
    if (!voidReason.trim()) {
      toast.error('Please specify a reason');
      return;
    }
    voidMutation.mutate({ id: voidingPmt._id, reason: voidReason });
  };

  const handleExportCSV = () => {
    const headers = ['Transaction ID', 'M-Pesa Receipt', 'Tenant', 'Phone', 'Property', 'Amount (KES)', 'Channel', 'Status', 'Date'];
    const rows = filtered.map(p => [
      p.transaction_id || '',
      p.mpesa_receipt || '',
      p.tenant_id?.full_name || '',
      p.tenant_id?.phone || '',
      p.property_id?.name || '',
      p.amount_kes || 0,
      p.channel || '',
      p.status || '',
      new Date(p.created_at).toLocaleDateString('en-KE')
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `payments_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const payments = data?.data || [];
  const totalRevenue = payments.filter(p => p.status === 'confirmed').reduce((s, p) => s + p.amount_kes, 0);
  const pendingCount = payments.filter(p => p.status === 'pending').length;
  const failedCount = payments.filter(p => p.status === 'failed').length;


  const filtered = payments.filter(p => {
    const matchSearch = !search ||
      p.mpesa_receipt?.toLowerCase().includes(search.toLowerCase()) ||
      p.tenant_id?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.transaction_id?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (isLoading) return <TableSkeleton rows={5} cols={6} />;

  if (error) return (
    <div className="flex h-96 items-center justify-center border border-dashed border-red-200 rounded-xl bg-red-50 p-8">
      <div className="text-center">
        <XCircle className="mx-auto text-red-400 mb-3" size={32} />
        <div className="text-red-600 font-semibold">Failed to load payments</div>
        <p className="text-sm text-red-400 mt-1">{error?.error?.message || error?.message}</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <WalletCards className="text-green-600" size={24} /> Rent Payments
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Lipa Na M-Pesa auto-reconciliation · Mombasa Estate Agency
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition shadow-sm self-start sm:self-auto"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-tr from-emerald-50 to-green-50/20 border border-emerald-100 rounded-2xl p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Collected</div>
          <div className="text-2xl font-black text-emerald-800">KES {totalRevenue.toLocaleString()}</div>
          <div className="text-[11px] text-emerald-600 mt-2 flex items-center gap-0.5 font-medium">
            <ArrowUpRight size={12} /> {payments.filter(p => p.status === 'confirmed').length} confirmed payments
          </div>
        </div>
        <div className="bg-gradient-to-tr from-blue-50 to-indigo-50/20 border border-blue-100 rounded-2xl p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Pending</div>
          <div className="text-2xl font-black text-blue-800">{pendingCount}</div>
          <div className="text-[11px] text-blue-500 mt-2 font-medium">Awaiting M-Pesa confirmation</div>
        </div>
        <div className="bg-gradient-to-tr from-red-50 to-orange-50/20 border border-red-100 rounded-2xl p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Failed / Review</div>
          <div className="text-2xl font-black text-red-800">{failedCount}</div>
          <div className="text-[11px] text-red-500 mt-2 font-medium">Require manual review</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            id="payment-search"
            type="text"
            placeholder="Search receipt, name, transaction ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition"
          />
        </div>
        <select
          id="payment-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 bg-white text-gray-600"
        >
          <option value="">All Statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="manual_override">Manual Override</option>
          <option value="reversed">Reversed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">Transaction</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">Tenant</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">Property</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">Amount</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">Channel</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">Reconciliation</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">Status</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">Date</th>
                {isAdmin && <th className="px-5 py-3.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="text-center py-16 text-gray-400">
                    <WalletCards size={36} className="mx-auto mb-2 text-gray-200" />
                    <div className="font-medium">No payments found</div>
                  </td>
                </tr>
              ) : (
                filtered.map((pmt) => {
                  const cfg = STATUS_CONFIG[pmt.status] || STATUS_CONFIG.pending;
                  const StatusIcon = cfg.icon;
                  return (
                    <tr key={pmt._id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Receipt size={14} className="text-gray-300 flex-shrink-0" />
                          <div>
                            <div className="font-mono text-xs font-semibold text-gray-700">
                              {pmt.mpesa_receipt || pmt.transaction_id?.slice(0, 16)}
                            </div>
                            <div className="text-[11px] text-gray-400 capitalize">{pmt.payment_type}</div>
                          </div>
                        </div>
                        {pmt.discrepancy_flag && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-600 font-medium">
                            <AlertTriangle size={10} />
                            {pmt.discrepancy_reason?.slice(0, 40)}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-800 text-xs">{pmt.tenant_id?.full_name}</div>
                        <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
                          <Phone size={10} /> {pmt.tenant_id?.phone}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-xs font-semibold text-gray-700">{pmt.property_id?.name}</div>
                        <div className="text-[11px] text-gray-400">{pmt.property_id?.property_code}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-black text-gray-900 text-sm">
                          {pmt.amount_kes?.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-gray-400">KES</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-[11px] font-semibold text-gray-600 bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                          {CHANNEL_LABELS[pmt.channel] || pmt.channel}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {pmt.status === 'confirmed' && pmt.mpesa_receipt ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Matched ✓
                          </span>
                        ) : pmt.discrepancy_flag ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 animate-pulse">
                            Unmatched ⚠️
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Pending Match
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cfg.color}`}>
                          <StatusIcon size={10} /> {cfg.label}
                        </span>
                        {pmt.verification_method && (
                          <div className="text-[10px] text-gray-400 mt-0.5 capitalize">
                            via {pmt.verification_method.replace(/_/g, ' ')}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-xs text-gray-500">
                          {new Date(pmt.created_at).toLocaleDateString('en-KE', {
                            month: 'short', day: 'numeric', year: 'numeric'
                          })}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {new Date(pmt.created_at).toLocaleTimeString('en-KE', {
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </div>
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-4 text-right">
                          {pmt.status !== 'failed' && pmt.status !== 'reversed' ? (
                            <button
                              onClick={() => setVoidingPmt(pmt)}
                              className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition"
                              title="Void Payment"
                            >
                              <Ban size={14} />
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-bold uppercase">Voided</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Void Payment Modal */}
      {voidingPmt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-gray-100 animate-fade-in">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <Ban size={20} className="text-red-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Void Payment</h2>
                <p className="text-xs text-gray-400">
                  {voidingPmt.mpesa_receipt || voidingPmt.transaction_id} · KES {voidingPmt.amount_kes?.toLocaleString()}
                </p>
              </div>
            </div>
            <form onSubmit={handleVoidSubmit} className="space-y-4">
              <div>
                <label htmlFor="void-reason" className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Reason for Voiding <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="void-reason"
                  rows={3}
                  value={voidReason}
                  onChange={e => setVoidReason(e.target.value)}
                  placeholder="e.g. Bounced check / incorrect manual entry"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition resize-none"
                  required
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => { setVoidingPmt(null); setVoidReason(''); }}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!voidReason.trim() || voidMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {voidMutation.isPending ? (
                    <><Loader2 size={14} className="animate-spin" /> Voiding...</>
                  ) : (
                    'Void Payment'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
