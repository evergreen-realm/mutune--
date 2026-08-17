import React from 'react';
import { Wallet, CreditCard, Receipt, Download } from 'lucide-react';
import { toast } from 'react-toastify';

export default function TenantRentSection({
  payments = [],
  paying = false,
  onPayRent,
  profile
}) {
  return (
    <div className="bg-surface/30 backdrop-blur-md border border-border rounded-[24px] p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-4 gap-4">
        <div>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Statement of Accounts</h2>
          <p className="text-xs text-muted mt-1">Check verified transactions and receipts.</p>
        </div>
        <button
          onClick={onPayRent}
          disabled={paying}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition tracking-wider shadow-lg shadow-emerald-950/40 uppercase active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <Wallet size={14} /> {paying ? 'Connecting…' : 'Quick Rent Payment'}
        </button>
      </div>

      {payments.length === 0 ? (
        <div className="text-center py-12">
          <CreditCard size={40} className="text-slate-700 mx-auto mb-3" />
          <p className="text-xs text-muted">No payment statement found for this account.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map(p => {
            const receipt = p.mpesa_receipt || p.mpesa_code || null;
            const isMpesa = p.channel === 'mpesa_stk' || p.channel === 'mpesa_c2b';
            return (
              <div 
                key={p._id} 
                className="flex items-center justify-between p-3.5 bg-surface/50 border border-border rounded-xl hover:border-slate-700 transition"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isMpesa ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    <Receipt size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">
                        KES {Number(p.amount_kes || p.amount || 0).toLocaleString('en-KE')}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        p.status === 'verified' || p.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {p.status || 'Verified'}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted mt-0.5">
                      {receipt ? `Receipt: ${receipt}` : (p.transaction_id ? `Ref: ${p.transaction_id}` : 'Direct Remittance')} • {new Date(p.created_at || p.createdAt || Date.now()).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const content = [
                        'MUTUNE RENT PRO — OFFICIAL RECEIPT',
                        '==================================',
                        `Receipt No : ${receipt || p._id?.slice(-8) || 'N/A'}`,
                        `Date       : ${new Date(p.created_at || p.createdAt || Date.now()).toLocaleDateString()}`,
                        `Tenant     : ${profile?.full_name || 'Valued Tenant'}`,
                        `Unit       : ${profile?.unit_number || 'N/A'}`,
                        `Amount     : KES ${Number(p.amount_kes || p.amount || 0).toLocaleString('en-KE')}`,
                        `Channel    : ${p.channel || 'M-Pesa'}`,
                        `Status     : ${p.status || 'Verified'}`,
                        '==================================',
                        'This is an official digital payment receipt from Mutune Estate Agency.',
                        'Support: mutunerentz@gmail.com'
                      ].join('\n');
                      const blob = new Blob([content], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Receipt_${receipt || p._id?.slice(-6) || 'pay'}.txt`;
                      document.body.appendChild(a); a.click(); a.remove();
                      URL.revokeObjectURL(url);
                      toast.success('Receipt downloaded!');
                    }}
                    className="bg-surface hover:bg-background border border-border text-muted hover:text-foreground rounded-lg px-2.5 py-1 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Download size={12} /> Download
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
