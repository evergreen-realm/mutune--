import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, Link as LinkIcon, UserCheck } from 'lucide-react';
import { fetchUnmatchedPayments, assignUnmatchedPayment, fetchTenants } from '../lib/api';
import { toast } from 'react-toastify';

export default function UnmatchedPaymentsTab() {
  const [loading, setLoading] = useState(true);
  const [unmatched, setUnmatched] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [assignTenantId, setAssignTenantId] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [unmatchedRes, tenantsRes] = await Promise.allSettled([
        fetchUnmatchedPayments(),
        fetchTenants()
      ]);
      if (unmatchedRes.status === 'fulfilled' && unmatchedRes.value?.data) {
        setUnmatched(unmatchedRes.value.data);
      }
      if (tenantsRes.status === 'fulfilled' && tenantsRes.value?.data) {
        setTenants(tenantsRes.value.data);
      }
    } catch (err) {
      toast.error('Failed to load unmatched payment queue');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!selectedPayment || !assignTenantId) {
      toast.error('Select a tenant to assign this payment');
      return;
    }

    setAssigning(true);
    try {
      const res = await assignUnmatchedPayment(selectedPayment._id, assignTenantId);
      if (res?.success) {
        toast.success('Payment successfully reconciled & assigned to tenant ✓');
        setSelectedPayment(null);
        setAssignTenantId('');
        loadData();
      } else {
        toast.error(res?.error?.message || 'Failed to assign payment');
      }
    } catch (err) {
      toast.error('Error assigning payment');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-400">
              <AlertTriangle size={22} />
            </div>
            <h2 className="text-xl font-black tracking-tight text-white font-sans">
              M-Pesa Auto-Reconciliation & Unmatched Queue
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Field agent queue for assigning ambiguous M-Pesa paybill transactions to tenants.
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl transition-all border border-slate-700"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Queue
        </button>
      </div>

      {/* Unmatched Payments Table */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl space-y-4">
        <h3 className="text-sm font-bold text-slate-200">Pending Unmatched Transactions ({unmatched.length})</h3>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
            Scanning payment feed...
          </div>
        ) : unmatched.length === 0 ? (
          <div className="py-8 text-center text-xs text-emerald-400 flex items-center justify-center gap-2">
            <CheckCircle2 size={16} />
            All incoming M-Pesa payments are 100% reconciled!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4 rounded-l-lg">M-Pesa Code / Ref</th>
                  <th className="py-3 px-4">Amount (KES)</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status / Discrepancy</th>
                  <th className="py-3 px-4 text-center rounded-r-lg">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {unmatched.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-mono font-bold text-amber-400">
                      {p.transaction_id || 'M-PESA-REF'}
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-400 font-bold">
                      KES {(p.amount_kes || 0).toLocaleString('en-KE')}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(p.created_at).toLocaleDateString('en-KE')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {p.discrepancy_reason || 'Unmatched Tenant'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedPayment(p)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 mx-auto shadow-md shadow-indigo-600/20"
                      >
                        <LinkIcon size={12} /> Assign to Tenant
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative text-slate-100">
            <h3 className="text-base font-bold text-white mb-2">
              Assign Payment (KES {selectedPayment.amount_kes})
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Select the tenant who made payment reference <span className="font-mono text-amber-400">{selectedPayment.transaction_id}</span>.
            </p>

            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Select Tenant *
                </label>
                <select
                  value={assignTenantId}
                  onChange={(e) => setAssignTenantId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  required
                >
                  <option value="">-- Choose Tenant --</option>
                  {tenants.map(t => (
                    <option key={t._id} value={t._id}>
                      {t.full_name} ({t.tenant_code || t.phone}) - KES {t.rent_amount_kes}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedPayment(null)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl"
                >
                  {assigning ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
