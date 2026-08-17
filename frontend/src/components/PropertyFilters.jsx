import React from 'react';
import { Search, Filter, Plus, Grid, List, Building2 } from 'lucide-react';

export default function PropertyFilters({
  search,
  setSearch,
  areaFilter,
  setAreaFilter,
  statusFilter,
  setStatusFilter,
  areasList,
  statusesList,
  viewMode,
  setViewMode,
  canAdd,
  onAddClick,
  canShowAllAreasToggle,
  showAllAreas,
  setShowAllAreas
}) {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800 backdrop-blur-xl">
      <div className="flex flex-1 flex-wrap items-center gap-3 w-full">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search properties by name, code, or area..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
          />
        </div>

        {/* Area dropdown */}
        <div className="min-w-[130px]">
          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-blue-500 font-bold"
          >
            {areasList.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {/* Status dropdown */}
        <div className="min-w-[130px]">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-blue-500 font-bold"
          >
            {statusesList.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* All areas toggle for permitted agents */}
        {canShowAllAreasToggle && (
          <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800">
            <input
              type="checkbox"
              checked={showAllAreas}
              onChange={(e) => setShowAllAreas(e.target.checked)}
              className="rounded accent-blue-600"
            />
            Show All Areas
          </label>
        )}
      </div>

      {/* View Toggle & Add Button */}
      <div className="flex items-center gap-2 w-full md:w-auto justify-end">
        <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setViewMode('cards')}
            className={`p-1.5 rounded-lg transition ${viewMode === 'cards' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            title="Card Grid View"
          >
            <Grid size={15} />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-lg transition ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            title="Table View"
          >
            <List size={15} />
          </button>
        </div>

        {canAdd && (
          <button
            onClick={onAddClick}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-blue-600/20 whitespace-nowrap"
          >
            <Plus size={14} /> Add Property
          </button>
        )}
      </div>
    </div>
  );
}
