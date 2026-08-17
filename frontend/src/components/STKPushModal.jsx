import React, { useState } from 'react';
import { Phone, DollarSign, Send, X, Loader2 } from 'lucide-react';
import { initiateSTKPush } from '../lib/api';
import { toast } from 'react-toastify';

export default function STKPushModal({ isOpen, onClose, onSuccess, defaultPropertyId, defaultUnitId, defaultTenantId }) {
  const [phone, setPhone] = useState('254');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      toast.error('Valid Kenyan phone number is required (e.g. 254712345678)');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error('Valid payment amount is required');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Sending M-Pesa STK Push prompt to tenant phone...');
    try {
      const res = await initiateSTKPush({
        phone_number: phone.trim(),
        amount: Number(amount),
        property_id: defaultPropertyId,
        unit_id: defaultUnitId,
        tenant_id: defaultTenantId
      });

      if (res?.data?.success) {
        toast.update(toastId, { render: 'STK push prompt sent! Check phone to enter PIN.', type: 'success', isLoading: false, autoClose: 5000 });
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        toast.update(toastId, { render: res?.data?.error?.message || 'STK Push failed', type: 'error', isLoading: false, autoClose: 5000 });
      }
    } catch (err) {
      toast.update(toastId, { render: err?.response?.data?.error?.message || err?.message || 'Error triggering STK push', type: 'error', isLoading: false, autoClose: 5000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
              <Phone size={18} />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Trigger M-Pesa STK Prompt
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 font-bold mb-1">M-Pesa Phone Number *</label>
            <input
              type="text"
              required
              placeholder="254712345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-emerald-500"
            />
            <span className="text-[10px] text-slate-500">Format: 2547XXXXXXXX or 2541XXXXXXXX</span>
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1">Amount (KES) *</label>
            <input
              type="number"
              required
              min="1"
              placeholder="e.g. 15000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-emerald-500 text-base font-bold"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              {loading ? 'Sending...' : 'Send Prompt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
