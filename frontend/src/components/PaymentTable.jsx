import React from 'react';
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, Phone, Ban
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

export default function PaymentTable({ payments, isAdmin, onVoidClick }) {
  if (payments.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
        No payment records found matching your filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl">
      <table className="w-full text-left text-xs text-slate-300">
        <thead className="bg-slate-950/80 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
          <tr>
            <th className="px-4 py-3">Tenant & Unit</th>
            <th className="px-4 py-3">Property</th>
            <th className="px-4 py-3">Amount (KES)</th>
            <th className="px-4 py-3">Channel / Receipt</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Date</th>
            {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {payments.map((p) => {
            const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusCfg.icon;
            return (
              <tr key={p._id} className="hover:bg-slate-800/30 transition">
                <td className="px-4 py-3">
                  <div className="font-bold text-white">
                    {p.tenant_id?.full_name || p.user_id?.full_name || 'Walk-in / Unlinked'}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Unit: {p.unit_id?.unit_number || 'N/A'} • {p.phone_number || p.tenant_id?.phone || '—'}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-300 font-medium">
                  {p.property_id?.name || '—'}
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono font-black text-white text-sm">
                    KES {Number(p.amount_kes || 0).toLocaleString('en-KE')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-slate-300 block">
                    {CHANNEL_LABELS[p.channel] || p.channel || 'M-Pesa'}
                  </span>
                  <span className="font-mono text-[11px] text-blue-400">
                    {p.mpesa_receipt || p.mpesa_code || p.transaction_id || '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusCfg.color}`}>
                    <StatusIcon size={11} /> {statusCfg.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-[11px] text-slate-400 font-mono">
                  {p.created_at ? new Date(p.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-right">
                    {p.status === 'confirmed' && (
                      <button
                        onClick={() => onVoidClick(p)}
                        className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ml-auto"
                      >
                        <Ban size={11} /> Void
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
