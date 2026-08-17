import React, { useState } from 'react';
import { Users, UserPlus, X, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-toastify';

export default function TenantAssignment({
  isOpen,
  onClose,
  unit,
  tenants = [],
  onAssign
}) {
  const [selectedTenantId, setSelectedTenantId] = useState('');

  if (!isOpen || !unit) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedTenantId) {
      toast.error('Please select a tenant');
      return;
    }
    onAssign(unit._id, selectedTenantId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
              <UserPlus size={18} />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Assign Tenant to Unit {unit.unit_number}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 font-bold mb-1">Select Tenant</label>
            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none font-bold focus:border-blue-500"
            >
              <option value="">Select Tenant...</option>
              {tenants.map(t => (
                <option key={t._id} value={t._id}>
                  {t.full_name} ({t.phone || t.email})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition shadow-lg shadow-blue-600/20"
            >
              Confirm Assignment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
