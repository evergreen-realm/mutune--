import React from 'react';
import { Droplets, Zap, Plus, RefreshCw } from 'lucide-react';

export default function UtilityPanel({
  meters = [],
  onAddMeterClick,
  onQueryMeter
}) {
  return (
    <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Droplets size={16} className="text-blue-400" /> Utility Meters & Submeters ({meters.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Water and KPLC power accounts registered to this property.</p>
        </div>
        {onAddMeterClick && (
          <button
            onClick={onAddMeterClick}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-md shadow-blue-600/20"
          >
            <Plus size={13} /> Add Meter
          </button>
        )}
      </div>

      {meters.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-xs bg-slate-950/40 rounded-2xl border border-slate-800">
          No utility meters mapped to this property yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {meters.map((m) => {
            const isWater = m.meter_type === 'water';
            return (
              <div
                key={m._id}
                className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${isWater ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      {isWater ? <Droplets size={14} /> : <Zap size={14} />}
                    </div>
                    <span className="font-bold text-white uppercase tracking-wide text-[11px]">{m.provider || 'Utility'}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${m.connection_status === 'active' || m.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                    {m.connection_status || (m.is_active ? 'Active' : 'Inactive')}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Meter / Token No.</span>
                    <span className="font-mono font-bold text-white text-xs">{m.token_number}</span>
                  </div>
                  {onQueryMeter && (
                    <button
                      onClick={() => onQueryMeter(m)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                      title="Query Balance"
                    >
                      <RefreshCw size={12} />
                    </button>
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
