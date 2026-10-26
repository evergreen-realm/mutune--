import React, { useState, useEffect } from 'react';
import { Phone, DollarSign, Send, X, Loader2 } from 'lucide-react';
import { initiateSTKPush, fetchTenants } from '../lib/api';
import { toast } from 'react-toastify';

export default function STKPushModal({
  isOpen = true,
  onClose,
  onSuccess,
  defaultPropertyId,
  defaultUnitId,
  defaultTenantId,
  unit,
  tenant,
  property
}) {
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState(defaultTenantId || tenant?._id || '');
  const [selectedUnitId, setSelectedUnitId] = useState(defaultUnitId || unit?._id || tenant?.current_unit_id?._id || tenant?.current_unit_id || '');
  const [selectedUnitCode, setSelectedUnitCode] = useState(unit?.unit_number || tenant?.unit_number || tenant?.current_unit_id?.unit_number || '');
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    defaultPropertyId || property?._id || tenant?.current_property_id?._id || tenant?.current_property_id || ''
  );
  const [phone, setPhone] = useState(tenant?.phone || '254');
  const [amount, setAmount] = useState(tenant?.rent_amount_kes || unit?.rent_kes || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedTenantId(defaultTenantId || tenant?._id || '');
    setSelectedUnitId(defaultUnitId || unit?._id || tenant?.current_unit_id?._id || tenant?.current_unit_id || '');
    setSelectedUnitCode(unit?.unit_number || tenant?.unit_number || tenant?.current_unit_id?.unit_number || '');
    setSelectedPropertyId(
      defaultPropertyId || property?._id || tenant?.current_property_id?._id || tenant?.current_property_id || ''
    );
    if (tenant?.phone) setPhone(tenant.phone);
    if (tenant?.rent_amount_kes || unit?.rent_kes) setAmount(tenant?.rent_amount_kes || unit?.rent_kes || '');

    fetchTenants({ limit: 100 })
      .then((res) => {
        const list = res?.data || res?.data?.data || [];
        if (Array.isArray(list)) setTenants(list);
      })
      .catch(() => {});
  }, [isOpen, defaultPropertyId, defaultUnitId, defaultTenantId, unit, tenant, property]);

  if (!isOpen) return null;

  const handleTenantChange = (tid) => {
    setSelectedTenantId(tid);
    const found = tenants.find((t) => t._id === tid);
    if (found) {
      setSelectedUnitId(found.current_unit_id?._id || found.current_unit_id || '');
      setSelectedUnitCode(found.unit_number || found.current_unit_id?.unit_number || '');
      setSelectedPropertyId(found.current_property_id?._id || found.current_property_id || '');
      if (found.phone) setPhone(found.phone);
      if (found.rent_amount_kes) setAmount(found.rent_amount_kes);
    }
  };

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
      const numericAmount = Math.round(Number(amount));
      const res = await initiateSTKPush({
        phone: phone.trim(),
        phone_number: phone.trim(),
        amount: numericAmount,
        amount_kes: numericAmount,
        property_id: selectedPropertyId || undefined,
        unit_id: selectedUnitId || undefined,
        unit_code: selectedUnitCode || selectedUnitId || undefined,
        tenant_id: selectedTenantId || undefined
      });

      if (res?.success || res?.data?.success) {
        toast.update(toastId, { render: res?.message || res?.data?.message || 'STK push prompt sent! Check phone to enter PIN.', type: 'success', isLoading: false, autoClose: 5000 });
        if (onSuccess) onSuccess(res.data || res);
        onClose();
      } else {
        toast.update(toastId, { render: res?.error?.message || res?.data?.error?.message || 'STK Push failed', type: 'error', isLoading: false, autoClose: 5000 });
      }
    } catch (err) {
      toast.update(toastId, { render: err?.error?.message || err?.response?.data?.error?.message || err?.message || 'Error triggering STK push', type: 'error', isLoading: false, autoClose: 5000 });
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
          {tenants.length > 0 && !defaultTenantId && !tenant && (
            <div>
              <label className="block text-slate-400 font-bold mb-1">Select Tenant (Optional)</label>
              <select
                value={selectedTenantId}
                onChange={(e) => handleTenantChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500"
              >
                <option value="">-- Select tenant or enter phone below --</option>
                {tenants.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.full_name} ({t.phone}) — KES {(t.rent_amount_kes || 0).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
          )}

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
