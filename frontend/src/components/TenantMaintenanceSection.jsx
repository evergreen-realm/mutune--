import React from 'react';
import { Wrench, Plus, Edit2, Ban } from 'lucide-react';

export default function TenantMaintenanceSection({
  tickets = [],
  setTicketForm,
  setCancelConfirmId,
  ticketStatusColor,
  formatDate
}) {
  return (
    <div className="bg-surface/30 backdrop-blur-md border border-border rounded-[24px] p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Maintenance Reports</h2>
          <p className="text-xs text-muted mt-1">Report plumbing, electrical or structural issues.</p>
        </div>
        <button 
          onClick={() => setTicketForm(f => ({ ...f, open: true }))} 
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
        >
          <Plus size={14} /> New Ticket
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center py-12">
          <Wrench size={40} className="text-slate-700 mx-auto mb-3" />
          <p className="text-xs text-muted">No active maintenance logs.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(t => (
            <div 
              key={t._id} 
              className="bg-background/40 border border-border p-5 rounded-2xl flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:border-border transition duration-300"
            >
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xs font-bold text-foreground truncate">{t.title}</h4>
                  <span className={`text-xs font-extrabold uppercase px-2 py-0.5 rounded-full ${ticketStatusColor(t.status)}`}>
                    {t.status?.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed break-words">{t.description}</p>
                <div className="flex items-center gap-2 text-xs text-muted flex-wrap">
                  <span>Priority:</span>
                  <span className={`font-bold capitalize ${
                    t.priority === 'urgent' ? 'text-red-400' : t.priority === 'high' ? 'text-amber-400' : 'text-muted'
                  }`}>
                    {t.priority}
                  </span>
                  <span>·</span>
                  <span>Reported: {formatDate(t.created_at || t.createdAt)}</span>
                </div>
              </div>

              {(t.status === 'open' || t.status === 'in_progress') && (
                <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                  <button
                    onClick={() => setTicketForm({ open: true, editId: t._id, title: t.title, description: t.description, priority: t.priority || 'medium' })}
                    className="px-2.5 py-1 bg-surface hover:bg-background border border-border text-muted text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 size={10} /> Edit
                  </button>
                  <button
                    onClick={() => setCancelConfirmId(t._id)}
                    className="px-2.5 py-1 bg-red-500/10 hover:bg-red-950/40 border border-red-500/20 text-red-400 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <Ban size={10} /> Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
