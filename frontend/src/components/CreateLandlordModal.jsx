import React, { useState } from 'react';
import { UserPlus, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { createLandlordManually } from '../lib/api';
import { toast } from 'react-toastify';

export default function CreateLandlordModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    id_number: '',
    mpesa_number: '',
    bank_account_number: '',
    bank_name: 'KCB Bank'
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.phone.trim()) {
      toast.error('Landlord full name and phone number are required');
      return;
    }

    setLoading(true);
    try {
      const res = await createLandlordManually(form);
      if (res?.success) {
        toast.success(`Landlord ${form.full_name} registered successfully ✓`);
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        toast.error(res?.error?.message || 'Failed to create landlord');
      }
    } catch (err) {
      toast.error(err?.error?.message || 'Error creating landlord record');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400">
            <UserPlus size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight text-white font-sans">
              Register New Property Landlord
            </h3>
            <p className="text-xs text-slate-400">
              Create a landlord profile for owner property assignment.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Full Legal Name *
            </label>
            <input
              type="text"
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="e.g. Samuel Mutune"
              className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs outline-none font-sans text-slate-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Phone Number (254...) *
              </label>
              <input
                type="text"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="254712345678"
                className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs outline-none font-sans text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                National ID / Passport Number
              </label>
              <input
                type="text"
                value={form.id_number}
                onChange={(e) => setForm({ ...form, id_number: e.target.value })}
                placeholder="12345678"
                className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs outline-none font-sans text-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="landlord@example.com"
              className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs outline-none font-sans text-slate-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                M-Pesa B2C Payout Number
              </label>
              <input
                type="text"
                value={form.mpesa_number}
                onChange={(e) => setForm({ ...form, mpesa_number: e.target.value })}
                placeholder="254712345678"
                className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs outline-none font-sans text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Remittance Bank Account
              </label>
              <input
                type="text"
                value={form.bank_account_number}
                onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })}
                placeholder="A/C 1122334455"
                className="w-full bg-slate-950/70 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs outline-none font-sans text-slate-200"
              />
            </div>
          </div>

          <div className="pt-3 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20"
            >
              {loading ? 'Registering...' : 'Register Landlord'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
