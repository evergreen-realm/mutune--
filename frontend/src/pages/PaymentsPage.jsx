import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
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

export default function PaymentsPage({ dbUser }) {
  const qc = useQueryClient();
  const { user: clerkUser } = useUser();
  const { theme } = useThemeStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [voidingPmt, setVoidingPmt] = useState(null);
  const [voidReason, setVoidReason] = useState('');

  const role = dbUser?.role || clerkUser?.publicMetadata?.role || 'landlord';
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
      toast.error('Void reason is required');
      return;
    }
    voidMutation.mutate({ id: voidingPmt._id, reason: voidReason.trim() });
  };

  const payments = Array.isArray(data?.data) ? data.data : [];

  const totalRevenue = payments
    .filter(p => p.status === 'confirmed')
    .reduce((sum, p) => sum + Number(p.amount_kes || 0), 0);

  const pendingCount = payments.filter(p => p.status === 'pending').length;
  const failedCount  = payments.filter(p => p.status === 'failed').length;

  const handleExportCSV = () => {
    if (payments.length === 0) {
      toast.info("No payment records to export");
      return;
    }
    const headers = ["Transaction ID", "Tenant Name", "Property Name", "Unit Number", "Amount (KES)", "Channel", "M-Pesa Code", "Status", "Date"];
    const rows = payments.map(p => [
      p.transaction_id || p._id,
      p.tenant_id?.full_name || p.user_id?.full_name || 'N/A',
      p.property_id?.name || 'N/A',
      p.unit_id?.unit_number || 'N/A',
      p.amount_kes || 0,
      p.channel || 'N/A',
      p.mpesa_receipt || p.mpesa_code || 'N/A',
      p.status || 'N/A',
      p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : 'N/A'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    
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
    <div className="flex h-96 items-center justify-center border border-dashed border-red-500/30 rounded-2xl bg-red-500/5 p-8">
      <div className="text-center">
        <XCircle className="mx-auto text-red-500 mb-3" size={32} />
        <div className="text-red-500 font-bold text-sm">Failed to load payments</div>
        <p className="text-xs text-red-400 mt-1">{error?.error?.message || error?.message}</p>
      </div>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <span className="text-[10px] text-primary font-extrabold uppercase tracking-widest block mb-1">Financials</span>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <WalletCards className="text-primary" size={24} /> Rent Payments
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Lipa Na M-Pesa auto-reconciliation · Mombasa Estate Agency
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-5 py-2.5 bg-surface hover:bg-surface-bright text-foreground text-xs font-bold rounded-xl border border-border transition shadow-md cursor-pointer self-start sm:self-auto uppercase tracking-wider active:scale-95"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-surface/30 border border-border rounded-2xl p-5 shadow-sm bg-gradient-to-tr from-emerald-500/5 to-transparent"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Collected Revenue</div>
          <div className="text-2xl font-black text-emerald-500 font-mono">KES {totalRevenue.toLocaleString()}</div>
          <div className="text-xs text-emerald-400 mt-2.5 flex items-center gap-1 font-semibold">
            <ArrowUpRight size={13} /> {payments.filter(p => p.status === 'confirmed').length} confirmed payments
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-surface/30 border border-border rounded-2xl p-5 shadow-sm bg-gradient-to-tr from-amber-500/5 to-transparent"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Pending Payments</div>
          <div className="text-2xl font-black text-amber-500 font-mono">{pendingCount}</div>
          <div className="text-xs text-amber-400 mt-2.5 font-semibold">Awaiting M-Pesa callback status</div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-surface/30 border border-border rounded-2xl p-5 shadow-sm bg-gradient-to-tr from-red-500/5 to-transparent"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Failed / Review</div>
          <div className="text-2xl font-black text-red-500 font-mono">{failedCount}</div>
          <div className="text-xs text-red-405 mt-2.5 font-semibold">Requires admin manual check</div>
        </motion.div>
      </div>

      {/* Filters and Inputs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="payment-search"
            type="text"
            placeholder="Search receipt, tenant name, transaction ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-surface/40 border border-border focus:border-primary/50 rounded-xl text-foreground focus:outline-none transition"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-initial">
            <select
              id="payment-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs bg-surface/40 border border-border focus:border-primary/50 rounded-xl pl-3 pr-8 py-2.5 focus:outline-none text-foreground appearance-none cursor-pointer font-bold"
            >
              <option value="">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="manual_override">Override</option>
              <option value="reversed">Reversed</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
              <Filter size={12} />
            </div>
          </div>

          {(search || statusFilter) && (
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); }}
              className="p-2.5 bg-surface/50 border border-border rounded-xl text-muted hover:text-foreground transition cursor-pointer"
              title="Clear filters"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-surface/30 backdrop-blur-md border border-border rounded-2xl overflow-hidden shadow-md">
        {payments.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <WalletCards size={40} className="mx-auto mb-3" />
            <p className="text-xs">No matching transactions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-background/30 text-muted uppercase tracking-wider font-extrabold">
                  <th className="p-4">Tenant / Property</th>
                  <th className="p-4">Transaction Details</th>
                  <th className="p-4 text-right">Amount (KES)</th>
                  <th className="p-4">Method / Channel</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {payments.map(p => {
                  const tenantName = p.tenant_id?.full_name || p.user_id?.full_name || 'Internal / Admin';
                  const phone = p.tenant_id?.phone || p.user_id?.phone || '';
                  const propertyName = p.property_id?.name || 'Unassigned Property';
                  const unitNumber = p.unit_id?.unit_number || 'N/A';
                  const code = p.mpesa_receipt || p.mpesa_code || null;
                  const date = p.created_at ? new Date(p.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                  const config = STATUS_CONFIG[p.status] || { label: p.status, color: 'text-slate-400 border-border bg-surface', icon: AlertTriangle };
                  const IconComp = config.icon;

                  return (
                    <tr key={p._id} className="hover:bg-background/25 transition">
                      <td className="p-4">
                        <div className="font-bold text-foreground">{tenantName}</div>
                        <div className="text-[10px] text-muted mt-1 flex items-center gap-1.5">
                          <span>{propertyName} · Unit {unitNumber}</span>
                          {phone && (
                            <a href={`tel:${phone}`} className="text-muted hover:text-primary flex items-center gap-0.5">
                              <Phone size={10} /> {phone}
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-mono text-foreground font-bold">{p.transaction_id || p._id?.slice(-8).toUpperCase()}</div>
                        <div className="text-[10px] text-muted mt-1">{date}</div>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-foreground">
                        {p.amount_kes?.toLocaleString() || 0}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-foreground">{CHANNEL_LABELS[p.channel] || p.channel || 'Manual'}</div>
                        {code && (
                          <div className="text-[10px] text-emerald-400 font-mono font-bold tracking-wider mt-1 flex items-center gap-0.5">
                            <Receipt size={10} /> {code}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 border rounded-full text-[10px] font-black uppercase tracking-wider ${config.color}`}>
                          <IconComp size={10} />
                          {config.label}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              const content = [
                                'MutuneRent Pro — Payment Receipt',
                                '========================================',
                                `Date:           ${date}`,
                                `Amount:         KES ${p.amount_kes?.toLocaleString()}`,
                                `Receipt Code:   ${code || 'N/A'}`,
                                `Ref:            ${p.transaction_id || p._id}`,
                                `Channel:        ${p.channel || 'Manual'}`,
                                `Status:         ${p.status?.toUpperCase()}`,
                                `Unit:           ${propertyName} — Unit ${unitNumber}`,
                                `Tenant:         ${tenantName}`,
                                '',
                                'This is an official payment receipt from Mutune Estate Agency.',
                                'For queries: mutunerentz@gmail.com'
                              ].join('\n');
                              const blob = new Blob([content], { type: 'text/plain' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `Receipt_${code || p._id?.slice(-6)}.txt`;
                              document.body.appendChild(a); a.click(); a.remove();
                              URL.revokeObjectURL(url);
                              toast.success('Receipt downloaded!');
                            }}
                            className="p-1.5 bg-background/50 hover:bg-surface border border-border rounded-lg text-muted hover:text-foreground transition cursor-pointer"
                            title="Download Receipt"
                          >
                            <Download size={13} />
                          </button>

                          {isAdmin && p.status === 'confirmed' && (
                            <button
                              onClick={() => setVoidingPmt(p)}
                              className="p-1.5 bg-background/50 hover:bg-red-500/10 border border-border hover:border-red-500/30 text-muted hover:text-red-400 rounded-lg transition cursor-pointer"
                              title="Void Transaction"
                            >
                              <Ban size={13} />
                            </button>
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

      {/* Void Modal */}
      {voidingPmt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 relative text-foreground">
            <button
              onClick={() => setVoidingPmt(null)}
              className="absolute top-4 right-4 p-1.5 hover:bg-background border border-border rounded-lg text-muted hover:text-foreground transition cursor-pointer"
            >
              <X size={14} />
            </button>

            <h3 className="text-sm font-bold uppercase tracking-wider border-b border-border pb-3 mb-4 text-red-400 flex items-center gap-1.5">
              <Ban size={16} /> Void Transaction
            </h3>

            <p className="text-xs text-muted mb-4">
              Voiding transaction <strong className="text-foreground font-mono">{voidingPmt.transaction_id || voidingPmt._id}</strong> of amount <strong className="text-foreground">KES {voidingPmt.amount_kes}</strong>. This will revert the payment record status.
            </p>

            <form onSubmit={handleVoidSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Reason for voiding</label>
                <textarea
                  placeholder="Explain why this payment is being voided..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full h-24 bg-background border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary transition resize-none text-foreground"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={voidMutation.isPending}
                className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition uppercase tracking-wider shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {voidMutation.isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Voiding...
                  </>
                ) : 'Confirm Void'}
              </button>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
}
