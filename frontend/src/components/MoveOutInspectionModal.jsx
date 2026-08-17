import React, { useState } from 'react';
import { ClipboardCheck, X, Plus, Trash2, CheckCircle2, DollarSign, AlertCircle, Camera } from 'lucide-react';
import { createMoveOutInspection, processDepositRefund } from '../lib/api';
import { toast } from 'react-toastify';

export default function MoveOutInspectionModal({ isOpen, onClose, tenant, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [damages, setDamages] = useState([
    { item_name: 'Wall Paint & Plaster', condition: 'good', repair_cost_kes: 0 },
    { item_name: 'Door Locks & Keys', condition: 'good', repair_cost_kes: 0 }
  ]);
  const [unpaidUtilities, setUnpaidUtilities] = useState(0);
  const [notes, setNotes] = useState('');

  if (!isOpen || !tenant) return null;

  const depositPaid = tenant.deposit_amount_kes || tenant.rent_amount_kes || 0;
  const totalDamages = damages.reduce((sum, d) => sum + (Number(d.repair_cost_kes) || 0), 0);
  const netRefund = depositPaid - totalDamages - Number(unpaidUtilities);

  const handleAddDamageItem = () => {
    setDamages([...damages, { item_name: '', condition: 'damaged', repair_cost_kes: 0 }]);
  };

  const handleRemoveDamageItem = (idx) => {
    setDamages(damages.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, val) => {
    const updated = [...damages];
    updated[idx][field] = val;
    setDamages(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await createMoveOutInspection({
        tenant_id: tenant._id,
        damages,
        unpaid_utility_deductions_kes: Number(unpaidUtilities),
        agent_notes: notes
      });

      if (res?.success && res?.data) {
        toast.success(`Inspection Report ${res.data.report_code} created ✓`);
        // Trigger deposit refund & unit unlocking
        const refundRes = await processDepositRefund(res.data._id);
        if (refundRes?.success) {
          toast.success('Deposit refund processed & unit unlocked successfully!');
        }
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast.error(res?.error?.message || 'Failed to submit move-out inspection');
      }
    } catch (err) {
      toast.error('Error submitting move-out inspection');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative text-slate-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
            <ClipboardCheck size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight text-white font-sans">
              Tenant Move-Out Damage Survey & Refund
            </h3>
            <p className="text-xs text-slate-400">
              Inspect unit condition for {tenant.full_name} ({tenant.tenant_code || 'Tenant'}).
            </p>
          </div>
        </div>

        {/* Deposit Summary Box */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 grid grid-cols-3 gap-3 mb-5 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Initial Deposit Paid</span>
            <span className="text-base font-black font-mono text-white">KES {depositPaid.toLocaleString('en-KE')}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Deductions</span>
            <span className="text-base font-black font-mono text-red-400">KES {(totalDamages + Number(unpaidUtilities)).toLocaleString('en-KE')}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Net Deposit Refund</span>
            <span className="text-base font-black font-mono text-emerald-400">KES {netRefund.toLocaleString('en-KE')}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-slate-200">Itemized Condition & Damage Deductions</label>
              <button
                type="button"
                onClick={handleAddDamageItem}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg font-bold text-[11px] flex items-center gap-1"
              >
                <Plus size={12} /> Add Item
              </button>
            </div>

            <div className="space-y-2">
              {damages.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
                  <input
                    type="text"
                    placeholder="Item name (e.g. Broken Window)"
                    value={item.item_name}
                    onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                    className="flex-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white outline-none"
                    required
                  />
                  <select
                    value={item.condition}
                    onChange={(e) => handleItemChange(idx, 'condition', e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 text-white rounded-lg px-2 py-1.5 outline-none font-bold"
                  >
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="damaged">Damaged</option>
                    <option value="missing">Missing</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Cost KES"
                    value={item.repair_cost_kes}
                    onChange={(e) => handleItemChange(idx, 'repair_cost_kes', Number(e.target.value))}
                    className="w-24 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-white outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveDamageItem(idx)}
                    className="p-1.5 text-slate-500 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Unpaid Utility Arrears (Water/Power KES)</label>
            <input
              type="number"
              value={unpaidUtilities}
              onChange={(e) => setUnpaidUtilities(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white outline-none font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Agent Move-Out Inspection Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter remarks regarding unit handover condition..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white outline-none"
            />
          </div>

          <div className="pt-3 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20"
            >
              {loading ? 'Processing Refund...' : 'Approve Refund & Unlock Unit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
