import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchPayments, voidPayment } from '../lib/api';
import { TableSkeleton } from '../components/SkeletonLoader';
import { toast } from 'react-toastify';
import {
  WalletCards, Search, CheckCircle2, XCircle, Clock,
  AlertTriangle, ArrowUpRight, Phone, Receipt, Download, Ban, Loader2, Filter, X
} from 'lucide-react';

const STATUS_CONFIG = {
  confirmed:        { label: 'Confirmed',       color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-sm shadow-emerald-500/5', icon: CheckCircle2 },
  pending:          { label: 'Pending',          color: 'text-amber-400 bg-amber-500/10 border-amber-500/20 shadow-sm shadow-amber-500/5', icon: Clock },
  failed:           { label: 'Failed',           color: 'text-red-400 bg-red-500/10 border-red-500/20 shadow-sm shadow-red-500/5', icon: XCircle },
  manual_override:  { label: 'Override',         color: 'text-purple-400 bg-purple-500/10 border-purple-500/20 shadow-sm shadow-purple-500/5', icon: AlertTriangle },
  reversed:         { label: 'Reversed',         color: 'text-orange-400 bg-orange-500/10 border-orange-500/20 shadow-sm shadow-orange-500/5', icon: XCircle },
  processing:       { label: 'Processing',       color: 'text-blue-400 bg-blue-500/10 border-blue-500/20 shadow-sm shadow-blue-500/5', icon: Clock }
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

  if (isLoading) return <TableSkeleton rows={5} cols={6} />;

  if (error) return (
    <div className="flex h-96 items-center justify-center border border-dashed border-red-200 rounded-2xl bg-red-50/50 p-8">
      <div className="text-center">
        <XCircle className="mx-auto text-red-400 mb-3" size={32} />
        <div className="text-red-650 font-bold text-sm">Failed to load payments</div>
        <p className="text-xs text-red-400 mt-1">{error?.error?.message || error?.message}</p>
      </div>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-6 text-white"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <WalletCards className="text-green-600" size={24} /> Rent Payments
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Lipa Na M-Pesa auto-reconciliation · Mombasa Estate Agency
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black rounded-xl border border-slate-700 transition shadow-md shadow-slate-950/10 cursor-pointer self-start sm:self-auto uppercase tracking-wider"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm bg-gradient-to-tr from-emerald-950/20 to-slate-900/80"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Collected Revenue</div>
          <div className="text-2xl font-black text-emerald-500">KES {totalRevenue.toLocaleString()}</div>
          <div className="text-xs text-emerald-450 mt-2.5 flex items-center gap-1 font-semibold">
            <ArrowUpRight size={13} /> {payments.filter(p => p.status === 'confirmed').length} confirmed payments
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm bg-gradient-to-tr from-amber-950/20 to-slate-900/80"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Pending Payments</div>
          <div className="text-2xl font-black text-amber-500">{pendingCount}</div>
          <div className="text-xs text-amber-450 mt-2.5 font-semibold">Awaiting M-Pesa callback status</div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm bg-gradient-to-tr from-red-950/20 to-slate-900/80"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Failed / Review</div>
          <div className="text-2xl font-black text-red-500">{failedCount}</div>
          <div className="text-xs text-red-405 mt-2.5 font-semibold">Requires admin manual check</div>
        </motion.div>
      </div>

      {/* Filters and Inputs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            id="payment-search"
            type="text"
            placeholder="Search receipt, tenant name, transaction ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-950/50 border border-slate-800 focus:border-green-500/50 rounded-xl text-white focus:outline-none transition"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-initial">
            <select
              id="payment-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs bg-slate-950/50 border border-slate-800 focus:border-green-500/50 rounded-xl pl-3 pr-8 py-2.5 focus:outline-none text-white appearance-none cursor-pointer font-bold"
            >
              <option value="" className="bg-slate-950 text-white font-sans">All Statuses</option>
              <option value="confirmed" className="bg-slate-950 text-white font-sans">Confirmed</option>
              <option value="pending" className="bg-slate-950 text-white font-sans">Pending</option>
              <option value="failed" className="bg-slate-950 text-white font-sans">Failed</option>
              <option value="manual_override" className="bg-slate-950 text-white font-sans">Manual Override</option>
              <option value="reversed" className="bg-slate-950 text-white font-sans">Reversed</option>
            </select>
            <Filter size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-950/40 border-b border-slate-800">
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Transaction</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Tenant</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Property</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Amount</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Channel</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Reconciliation</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Date</th>
                {isAdmin && <th className="px-5 py-4 w-12" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              <AnimatePresence>
                {filtered.length === 0 ? (
                  <motion.tr 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <td colSpan={isAdmin ? 9 : 8} className="text-center py-16 text-slate-500">
                      <WalletCards size={36} className="mx-auto mb-2 text-slate-700" />
                      <div className="font-bold">No matching payments found</div>
                    </td>
                  </motion.tr>
                ) : (
                  filtered.map((pmt, index) => {
                    const cfg = STATUS_CONFIG[pmt.status] || STATUS_CONFIG.pending;
                    const StatusIcon = cfg.icon;
                    return (
                      <motion.tr 
                        key={pmt._id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
                        className="hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <Receipt size={14} className="text-slate-500 flex-shrink-0" />
                            <div>
                              <div className="font-mono text-xs font-bold text-slate-200">
                                {pmt.mpesa_receipt || pmt.transaction_id?.slice(0, 16)}
                              </div>
                              <div className="text-xs text-slate-500 capitalize font-medium">{pmt.payment_type}</div>
                            </div>
                          </div>
                          {pmt.discrepancy_flag && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 w-max">
                              <AlertTriangle size={9} />
                              {pmt.discrepancy_reason?.slice(0, 32)}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-100">{pmt.tenant_id?.full_name}</div>
                          <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5 font-mono">
                            <Phone size={10} className="text-slate-500" /> {pmt.tenant_id?.phone}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-300">{pmt.property_id?.name}</div>
                          <div className="text-xs text-slate-500 font-bold">{pmt.property_id?.property_code}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-black text-white text-[13px]">
                            {pmt.amount_kes?.toLocaleString()}
                          </div>
                          <div className="text-xs text-slate-500 font-bold uppercase">KES</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-md">
                            {CHANNEL_LABELS[pmt.channel] || pmt.channel}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {pmt.status === 'confirmed' && pmt.mpesa_receipt ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Matched ✓
                            </span>
                          ) : pmt.discrepancy_flag ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/10 text-amber-450 border border-amber-500/20 animate-pulse">
                              Unmatched ⚠️
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              Pending Match
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black border ${cfg.color}`}>
                            <StatusIcon size={9} /> {cfg.label}
                          </span>
                          {pmt.verification_method && (
                            <div className="text-xs text-slate-500 mt-0.5 font-semibold capitalize">
                              via {pmt.verification_method.replace(/_/g, ' ')}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-slate-300 font-semibold">
                            {new Date(pmt.created_at).toLocaleDateString('en-KE', {
                              month: 'short', day: 'numeric', year: 'numeric'
                            })}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
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
                                className="p-1.5 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition cursor-pointer"
                                title="Void Payment"
                              >
                                <Ban size={14} />
                              </button>
                            ) : (
                              <span className="text-xs text-slate-500 font-extrabold uppercase">Voided</span>
                            )}
                          </td>
                        )}
                      </motion.tr>
                    );
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Void Payment Modal */}
      <AnimatePresence>
        {voidingPmt && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setVoidingPmt(null); setVoidReason(''); }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                className="bg-slate-900 rounded-3xl shadow-2xl p-6 w-full max-w-md border border-slate-800 space-y-6 relative text-white"
              >
                <button
                  type="button"
                  onClick={() => { setVoidingPmt(null); setVoidReason(''); }}
                  className="absolute top-4 right-4 p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X size={14} />
                </button>
                <div className="flex items-center gap-3.5 border-b border-slate-800 pb-3">
                  <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 animate-pulse">
                    <Ban size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-white">Void Payment Transaction</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {voidingPmt.mpesa_receipt || voidingPmt.transaction_id || 'Internal'} · KES {voidingPmt.amount_kes?.toLocaleString()}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleVoidSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="void-reason" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Reason for Voiding <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="void-reason"
                      rows={3}
                      value={voidReason}
                      onChange={e => setVoidReason(e.target.value)}
                      placeholder="e.g. Bounced check / incorrect manual entry details"
                      className="w-full text-xs bg-slate-950/50 border border-slate-800 focus:border-red-500/50 rounded-xl px-4 py-3 text-white focus:outline-none transition resize-none font-sans"
                      required
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => { setVoidingPmt(null); setVoidReason(''); }}
                      className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 transition border border-slate-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!voidReason.trim() || voidMutation.isPending}
                      className="flex-1 px-4 py-2.5 bg-red-650 text-white rounded-xl text-xs font-black hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
                    >
                      {voidMutation.isPending ? (
                        <><Loader2 size={12} className="animate-spin" /> Voiding...</>
                      ) : (
                        'Void Payment'
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
