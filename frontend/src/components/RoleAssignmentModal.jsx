import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, Building2, Check } from 'lucide-react';
import { updateUserRole, updateUser, fetchProperties } from '../lib/api';
import { toast } from 'react-toastify';

const ROLES = [
  { value: 'tenant', label: 'Tenant', desc: 'Can view leased units, pay rent, log maintenance tickets' },
  { value: 'landlord', label: 'Landlord', desc: 'Can view properties, financial disbursements, and tax reports' },
  { value: 'agent', label: 'Agent', desc: 'Can manage listings, check in at units, capture 3D spatial models' },
  { value: 'caretaker', label: 'Caretaker', desc: 'Scoped on-site maintenance supervisor for assigned properties' },
  { value: 'accountant', label: 'Accountant', desc: 'Can reconcile statements, review GL accounts, download MRI returns' },
  { value: 'admin', label: 'Admin', desc: 'Can manage all platform properties, approvals, and financial settings' }
];

export default function RoleAssignmentModal({
  user,
  onClose,
  onSuccess
}) {
  const [selectedRole, setSelectedRole] = useState(user?.role || 'tenant');
  const [assignedProperties, setAssignedProperties] = useState(
    user?.assigned_properties?.map(p => (typeof p === 'object' ? p._id : p)) ||
    user?.assigned_property_ids?.map(p => (typeof p === 'object' ? p._id : p)) || []
  );
  const [allProperties, setAllProperties] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProperties().then(res => {
      if (Array.isArray(res?.data)) {
        setAllProperties(res.data);
      }
    }).catch(() => {});
  }, []);

  if (!user) return null;

  const toggleProperty = (propId) => {
    setAssignedProperties(prev => 
      prev.includes(propId) ? prev.filter(id => id !== propId) : [...prev, propId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (selectedRole !== user.role) {
        await updateUserRole({ role: selectedRole, user_id: user._id });
      }
      if (selectedRole === 'caretaker' || selectedRole === 'agent') {
        await updateUser(user._id, {
          assigned_properties: assignedProperties,
          assigned_property_ids: assignedProperties
        });
      }
      toast.success(`Role and property assignments updated for ${user.full_name || 'user'}`);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to update user assignments');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Assign Role & Properties</h3>
              <p className="text-xs text-slate-400">{user.full_name || user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Select System Role</label>
            {ROLES.map(r => (
              <label
                key={r.value}
                className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition ${
                  selectedRole === r.value
                    ? 'bg-indigo-950/40 border-indigo-500 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r.value}
                  checked={selectedRole === r.value}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="mt-1 accent-indigo-500"
                />
                <div>
                  <span className="text-xs font-bold capitalize block">{r.label}</span>
                  <span className="text-[10px] text-slate-400 block">{r.desc}</span>
                </div>
              </label>
            ))}
          </div>

          {/* Caretaker / Agent Per-Property Scoping UI */}
          {(selectedRole === 'caretaker' || selectedRole === 'agent') && (
            <div className="space-y-2 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 size={13} /> Assigned Properties ({assignedProperties.length})
                </label>
                <span className="text-[10px] text-slate-400">Strict Scoped Access</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {selectedRole === 'caretaker' ? 'Caretaker will ONLY see and manage the selected properties.' : 'Agent will have assigned access to selected properties.'}
              </p>

              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                {allProperties.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">No properties available to assign.</p>
                ) : (
                  allProperties.map(p => {
                    const isSelected = assignedProperties.includes(p._id);
                    return (
                      <div
                        key={p._id}
                        onClick={() => toggleProperty(p._id)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                          isSelected
                            ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <span className="text-xs font-bold text-white block">{p.name}</span>
                          <span className="text-[10px] text-slate-400 block">{p.address?.area || 'Mombasa'} · {p.units?.length || 0} Units</span>
                        </div>
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                          isSelected ? 'bg-emerald-500 border-emerald-400 text-slate-950' : 'border-slate-700'
                        }`}>
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Assignments'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
