import React from 'react';
import { Search, Filter, Download } from 'lucide-react';

export default function PaymentFilters({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  onExportCSV,
  paymentsCount
}) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800 backdrop-blur-xl">
      <div className="flex flex-1 items-center gap-3 w-full sm:w-auto">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by tenant name, receipt, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
          />
        </div>

        <div className="relative min-w-[140px]">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-blue-500 font-bold"
          >
            <option value="">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="manual_override">Manual Override</option>
            <option value="reversed">Reversed</option>
            <option value="processing">Processing</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
        <button
          onClick={onExportCSV}
          disabled={paymentsCount === 0}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-slate-700"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>
    </div>
  );
}
