import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { fetchPayments, voidPayment } from '../lib/api';
import { TableSkeleton } from '../components/SkeletonLoader';
import { toast } from 'react-toastify';
import {
  WalletCards, XCircle, Ban, Loader2, X, Plus
} from 'lucide-react';
import PaymentFilters from '../components/PaymentFilters';
import PaymentSummaryCards from '../components/PaymentSummaryCards';
import PaymentTable from '../components/PaymentTable';
import STKPushModal from '../components/STKPushModal';

export default function PaymentsPage({ dbUser }) {
  const qc = useQueryClient();
  const { user: clerkUser } = useUser();
  const { theme } = useThemeStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [voidingPmt, setVoidingPmt] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [showStkModal, setShowStkModal] = useState(false);

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

  if (isLoading) return <TableSkeleton rows={6} cols={6} />;

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
      className="space-y-6"
    >
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-xl">
        <div>
          <span className="text-[10px] text-blue-400 font-extrabold uppercase tracking-widest block mb-1">Financial Reconciliation</span>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <WalletCards className="text-blue-400" size={22} /> Rent & Utility Inflow Journal
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Lipa Na M-Pesa automated Daraja reconciliation and multi-bank settlement hub.
          </p>
        </div>

        <button
          onClick={() => setShowStkModal(true)}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/20 whitespace-nowrap self-start sm:self-auto"
        >
          <Plus size={14} /> Trigger STK Push
        </button>
      </div>

      {/* Summary Cards */}
      <PaymentSummaryCards
        totalRevenue={totalRevenue}
        pendingCount={pendingCount}
        failedCount={failedCount}
        totalCount={payments.length}
      />

      {/* Filters and Search */}
      <PaymentFilters
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        onExportCSV={handleExportCSV}
        paymentsCount={payments.length}
      />

      {/* Main Payment Table */}
      <PaymentTable
        payments={payments}
        isAdmin={isAdmin}
        onVoidClick={(pmt) => setVoidingPmt(pmt)}
      />

      {/* Void Modal */}
      {voidingPmt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-500/10 rounded-xl text-rose-400">
                  <Ban size={18} />
                </div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Void Payment Transaction
                </h3>
              </div>
              <button
                onClick={() => setVoidingPmt(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleVoidSubmit} className="space-y-4 text-xs">
              <p className="text-slate-400">
                Are you sure you want to void transaction <span className="text-white font-mono font-bold">{voidingPmt.mpesa_receipt || voidingPmt._id}</span> of <span className="text-amber-400 font-mono font-bold">KES {voidingPmt.amount_kes}</span>?
              </p>
              <div>
                <label className="block text-slate-400 font-bold mb-1">Reason for voiding *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Duplicate transaction, wrong unit allocated..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVoidingPmt(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={voidMutation.isPending}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-lg shadow-rose-600/20"
                >
                  {voidMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
                  {voidMutation.isPending ? 'Voiding...' : 'Confirm Void'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STK Push Trigger Modal */}
      <STKPushModal
        isOpen={showStkModal}
        onClose={() => setShowStkModal(false)}
        onSuccess={() => qc.invalidateQueries(['payments'])}
      />
    </motion.div>
  );
}
