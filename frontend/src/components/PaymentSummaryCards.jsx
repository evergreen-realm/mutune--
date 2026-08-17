import React from 'react';
import { WalletCards, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function PaymentSummaryCards({ totalRevenue, pendingCount, failedCount, totalCount }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl space-y-1">
        <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
          <span>Total Collected (KES)</span>
          <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
            <CheckCircle2 size={16} />
          </div>
        </div>
        <div className="text-2xl font-black text-white font-mono">
          KES {Number(totalRevenue || 0).toLocaleString('en-KE')}
        </div>
        <p className="text-[11px] text-slate-500">Confirmed automated M-Pesa & Bank inflows</p>
      </div>

      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl space-y-1">
        <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
          <span>Pending Transactions</span>
          <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
            <Clock size={16} />
          </div>
        </div>
        <div className="text-2xl font-black text-amber-400 font-mono">
          {pendingCount}
        </div>
        <p className="text-[11px] text-slate-500">Awaiting Safaricom/Bank webhook confirmation</p>
      </div>

      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl space-y-1">
        <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
          <span>Failed / Unmatched</span>
          <div className="p-2 bg-rose-500/10 rounded-xl text-rose-400">
            <AlertTriangle size={16} />
          </div>
        </div>
        <div className="text-2xl font-black text-rose-400 font-mono">
          {failedCount}
        </div>
        <p className="text-[11px] text-slate-500">Insufficient balance or timeout errors</p>
      </div>
    </div>
  );
}
