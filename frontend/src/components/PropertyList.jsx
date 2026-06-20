import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Search, Building2, SlidersHorizontal } from 'lucide-react';

export default function PropertyList({ properties = [] }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');


  const areas = [...new Set(properties.map(p => p.address?.area).filter(Boolean))];

  const filtered = properties.filter(p => {
    const matchesArea = filter === 'all' || p.address?.area === filter;
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                          p.property_code.toLowerCase().includes(search.toLowerCase()) ||
                          (p.address?.area && p.address.area.toLowerCase().includes(search.toLowerCase()));
    return matchesArea && matchesSearch;
  });

  if (!properties.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-500 shadow-sm flex flex-col items-center gap-3">
        <Building2 size={36} className="text-gray-300" />
        <div>
          <p className="font-semibold text-gray-700">No properties registered</p>
          <p className="text-sm text-gray-400 mt-1">Connect to backend API to populate your dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Property Directory</h2>
          <p className="text-xs text-gray-400 mt-0.5">Filter, search, and manage your property directory.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Search bar */}
          <div className="relative w-full sm:w-60">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Search properties..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:bg-white transition-all text-gray-800"
            />
          </div>
        </div>
      </div>

      {/* Pill buttons for Area filtering */}
      <div className="px-5 py-3 bg-gray-50/50 border-b border-gray-100 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="text-xs text-gray-400 flex items-center gap-1 font-medium mr-1 uppercase tracking-wider">
          <SlidersHorizontal size={12} /> Area:
        </span>
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            filter === 'all'
              ? 'bg-green-600 text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          All Areas
        </button>
        {areas.map(a => (
          <button
            key={a}
            onClick={() => setFilter(a)}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              filter === a
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      {/* Table grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-gray-50/50 text-gray-500 uppercase text-xs font-bold tracking-wider">
            <tr>
              <th className="p-4 pl-6">Code</th>
              <th className="p-4">Property Name</th>
              <th className="p-4">Location</th>
              <th className="p-4 text-center">Total Units</th>
              <th className="p-4 text-right pr-6">Occupancy Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(p => {
              const total = p.units?.length || 0;
              const occ = p.units?.filter(u => u.status === 'occupied').length || 0;
              const rate = total ? Math.round((occ / total) * 100) : 0;
              return (
                <tr 
                  key={p._id} 
                  onClick={() => navigate(`/properties/${p._id}`)}
                  className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                >
                  <td className="p-4 pl-6 font-mono text-xs font-semibold text-gray-400">{p.property_code}</td>
                  <td className="p-4 font-semibold text-gray-800">{p.name}</td>
                  <td className="p-4">
                    <span className="flex items-center gap-1.5 text-gray-500 text-xs font-medium">
                      <MapPin size={14} className="text-gray-400" />
                      {p.address?.area}, {p.address?.city || 'Mombasa'}
                    </span>
                  </td>
                  <td className="p-4 text-center font-medium text-gray-700">{total}</td>
                  <td className="p-4 text-right pr-6">
                    <div className="flex items-center justify-end gap-3">
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            rate > 75 ? 'bg-green-500' : rate > 40 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-700 w-8">{rate}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-400 text-xs">
                  No properties match your filter/search criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
