import React from 'react';
import { Wrench, Plus, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

const STATUS_BADGES = {
  open: { label: 'Open', color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  assigned: { label: 'Assigned', color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  resolved: { label: 'Resolved', color: 'bg-green-500/10 text-green-400 border border-green-500/20' },
  closed: { label: 'Closed', color: 'bg-green-500/10 text-green-400 border border-green-500/20' }
};

export default function MaintenancePanel({
  tickets = [],
  onCreateTicketClick,
  onViewTicket
}) {
  return (
    <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Wrench size={16} className="text-amber-400" /> Maintenance Tickets ({tickets.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Active repairs and work orders for this property.</p>
        </div>
        {onCreateTicketClick && (
          <button
            onClick={onCreateTicketClick}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-md shadow-amber-600/20"
          >
            <Plus size={13} /> Report Issue
          </button>
        )}
      </div>

      {tickets.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-xs bg-slate-950/40 rounded-2xl border border-slate-800">
          No maintenance tickets logged for this property.
        </div>
      ) : (
        <div className="space-y-2 text-xs">
          {tickets.map((t) => {
            const badge = STATUS_BADGES[t.status] || STATUS_BADGES.open;
            return (
              <div
                key={t._id}
                onClick={() => onViewTicket && onViewTicket(t)}
                className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span>{t.title}</span>
                    <span className="text-[10px] text-slate-500 uppercase font-mono">({t.category || 'General'})</span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{t.description}</p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badge.color} whitespace-nowrap`}>
                  {badge.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
