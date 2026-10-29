import React from 'react';
import { Wallet, CreditCard, Receipt, Download } from 'lucide-react';
import { toast } from 'react-toastify';
import { generateLegalPDF, extractPdfBlob } from '../lib/api';

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
                    onClick={async () => {
                      const toastId = toast.loading('Generating official KRA eTIMS Tax Invoice PDF...');
                      try {
                        const response = await generateLegalPDF('etims_tax_receipt', {
                          tenant_name: profile?.full_name || 'Tenant',
                          tenant_code: profile?.tenant_code || 'TEN-MOM',
                          rent_amount_kes: Number(p.amount_kes || p.amount || 0),
                          etims_invoice_number: receipt || `INV-${p._id?.slice(-8)}`,
                          unit_number: profile?.unit_number || '1A',
                          property_name: profile?.current_property_id?.name || 'Property'
                        });
                        const blob = await extractPdfBlob(response);
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `KRA_eTIMS_Receipt_${receipt || p._id?.slice(-6) || 'tax'}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                        toast.update(toastId, { render: 'Official KRA eTIMS Tax Receipt PDF downloaded! ✓', type: 'success', isLoading: false, autoClose: 3500 });
                      } catch (err) {
                        toast.update(toastId, { render: 'Failed to generate PDF receipt', type: 'error', isLoading: false, autoClose: 3000 });
                      }
                    }}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg px-2.5 py-1 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    title="Download Official KRA eTIMS Tax Invoice PDF"
                  >
                    <Download size={12} /> eTIMS PDF
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
