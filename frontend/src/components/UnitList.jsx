import React from 'react';
import { Home, Lock, Unlock, Trash2, UserCheck, Plus, CheckCircle2 } from 'lucide-react';

export default function UnitList({
  units = [],
  canManage,
  onAddUnitClick,
  onToggleLock,
  onDeleteUnit,
  onAssignTenant
}) {
  return (
    <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Home size={16} className="text-blue-400" /> Units & Spatial Allocation ({units.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Manage unit listings, digital locks, and tenant assignments.</p>
        </div>
        {canManage && (
          <button
            onClick={onAddUnitClick}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-md shadow-blue-600/20"
          >
            <Plus size={13} /> Add Unit
          </button>
        )}
      </div>

      {units.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-xs bg-slate-950/40 rounded-2xl border border-slate-800">
          No units added to this property yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {units.map((unit) => {
            const isOccupied = unit.status === 'occupied';
            const isLocked = unit.is_locked;

            return (
              <div
                key={unit._id}
                className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 relative group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white text-sm font-mono block">Unit {unit.unit_number}</span>
                    <span className="text-[11px] text-slate-400">{unit.unit_type || 'Standard'} • Floor {unit.floor || 'G'}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${isOccupied ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                    {isOccupied ? 'Occupied' : 'Vacant'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Monthly Rent</span>
                    <span className="font-mono font-bold text-white">KES {Number(unit.rent_amount_kes || 0).toLocaleString('en-KE')}</span>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onToggleLock(unit._id, isLocked ? 'unlock' : 'lock')}
                        className={`p-1.5 rounded-lg border transition ${isLocked ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'}`}
                        title={isLocked ? 'Unlock Unit' : 'Lock Unit'}
                      >
                        {isLocked ? <Lock size={13} /> : <Unlock size={13} />}
                      </button>
                      <button
                        onClick={() => onDeleteUnit(unit._id)}
                        className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-700 transition"
                        title="Delete Unit"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
