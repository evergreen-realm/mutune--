import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, MapPin, Home, Users, CheckCircle2, Clock, Eye, AlertCircle, Sparkles
} from 'lucide-react';

const STATUS_BADGE = {
  active:                  { bg: 'bg-emerald-500/10 border-emerald-500/20',  color: 'text-emerald-400', label: 'Active' },
  pending_admin_approval:  { bg: 'bg-amber-500/10 border-amber-500/20',  color: 'text-amber-400', label: 'Pending' },
  rejected:                { bg: 'bg-red-500/10 border-red-500/20',   color: 'text-red-400', label: 'Rejected' },
  inactive:                { bg: 'bg-slate-500/10 border-slate-500/20', color: 'text-slate-400', label: 'Inactive' },
};

export default function PropertyGrid({
  properties,
  viewMode,
  canApprove,
  working,
  onApprove,
  onReject
}) {
  const navigate = useNavigate();

  if (properties.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
        No properties found matching your filters.
      </div>
    );
  }

  if (viewMode === 'table') {
    return (
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/80 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Property Name</th>
              <th className="px-4 py-3">Location & Area</th>
              <th className="px-4 py-3">Total Units</th>
              <th className="px-4 py-3">Occupied</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {properties.map((p) => {
              const statusCfg = STATUS_BADGE[p.status] || STATUS_BADGE.active;
              const totalUnits = p.units?.length || p.total_units || 0;
              const occupiedUnits = p.units?.filter(u => u.status === 'occupied').length || 0;

              return (
                <tr key={p._id} className="hover:bg-slate-800/30 transition">
                  <td className="px-4 py-3">
                    <div className="font-bold text-white flex items-center gap-2">
                      <Building2 size={14} className="text-blue-400" />
                      {p.name}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{p.property_code}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    <div className="flex items-center gap-1">
                      <MapPin size={12} className="text-slate-400" />
                      <span>{p.address?.area || 'Mombasa'}, {p.address?.city || 'Mombasa'}</span>
                    </div>
                    {p.plus_code && <span className="text-[10px] text-blue-400 font-mono block">{p.plus_code}</span>}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-white">{totalUnits}</td>
                  <td className="px-4 py-3 font-mono text-emerald-400 font-bold">{occupiedUnits}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.bg} ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => navigate(`/properties/${p._id}`)}
                      className="px-3 py-1 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1 border border-blue-500/20"
                    >
                      <Eye size={12} /> View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {properties.map((p) => {
        const statusCfg = STATUS_BADGE[p.status] || STATUS_BADGE.active;
        const totalUnits = p.units?.length || p.total_units || 0;
        const occupiedUnits = p.units?.filter(u => u.status === 'occupied').length || 0;
        const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
        const imgUrl = p.images?.[0] || p.cover_image || null;

        return (
          <div
            key={p._id}
            onClick={() => navigate(`/properties/${p._id}`)}
            className="group cursor-pointer rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-blue-500/40 transition-all duration-300 backdrop-blur-xl overflow-hidden flex flex-col justify-between shadow-lg hover:shadow-2xl hover:shadow-blue-500/5"
          >
            <div>
              {/* Card Header Media */}
              <div className="relative h-44 w-full bg-slate-950 overflow-hidden">
                {imgUrl ? (
                  <img
                    src={imgUrl}
                    alt={p.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 bg-slate-950/80">
                    <Building2 size={36} className="mb-1" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Mutune Building</span>
                  </div>
                )}

                <div className="absolute top-3 right-3">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-md ${statusCfg.bg} ${statusCfg.color}`}>
                    {statusCfg.label}
                  </span>
                </div>

                {p.gaussian_splat_url && (
                  <div className="absolute bottom-3 left-3 px-2 py-0.5 rounded-lg bg-blue-950/80 border border-blue-500/30 text-blue-300 text-[10px] font-bold flex items-center gap-1 backdrop-blur-md">
                    <Sparkles size={11} className="text-amber-400" /> 3D Splat
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="p-5 space-y-3">
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                    {p.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                    <MapPin size={13} className="text-slate-400" />
                    <span>{p.address?.area || 'Mombasa'}, {p.address?.city || 'Mombasa'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Units</span>
                    <span className="text-sm font-black text-white font-mono">{totalUnits}</span>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Occupancy</span>
                    <span className="text-sm font-black text-emerald-400 font-mono">{occupancyRate}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Admin Approval Quick Bar */}
            {canApprove && p.status === 'pending_admin_approval' && (
              <div
                className="p-3 bg-amber-950/20 border-t border-amber-500/20 flex items-center justify-end gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => onReject(p._id)}
                  disabled={working[p._id]}
                  className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold transition border border-red-500/20"
                >
                  Reject
                </button>
                <button
                  onClick={() => onApprove(p._id)}
                  disabled={working[p._id]}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-md"
                >
                  Approve
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
