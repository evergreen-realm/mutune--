import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Plus, Building2, AlertCircle, Search, Filter, MapPin,
  Home, CheckCircle2, Clock, Users, Eye, BarChart3
} from 'lucide-react';
import { fetchProperties, approveProperty, rejectProperty } from '../lib/api';
import PropertyList from '../components/PropertyList';
import { TableSkeleton } from '../components/SkeletonLoader';

const MOMBASA_AREAS = [
  'All Areas', 'Nyali', 'Bamburi', 'Mtwapa', 'Tudor', 'Likoni',
  'Changamwe', 'Kisauni', 'Mvita', 'Mkomani', 'Shanzu', 'Kongowea',
  'Mikindani', 'Port Reitz'
];

const STATUS_OPTS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'pending_admin_approval', label: 'Pending Approval' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'inactive', label: 'Inactive' },
];

const STATUS_BADGE = {
  active:                  { bg: 'rgba(16,185,129,0.15)',  color: '#34d399', label: 'Active' },
  pending_admin_approval:  { bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24', label: 'Pending' },
  rejected:                { bg: 'rgba(239,68,68,0.15)',   color: '#f87171', label: 'Rejected' },
  inactive:                { bg: 'rgba(156,163,175,0.15)', color: '#9ca3af', label: 'Inactive' },
};

export default function PropertiesPage({ dbUser }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch]       = useState('');
  const [areaFilter, setArea]     = useState('All Areas');
  const [statusFilter, setStatus] = useState('');
  const [viewMode, setViewMode]   = useState('cards'); // 'cards' | 'table'
  const [working, setWorking]     = useState({});
  const [showAllAreas, setShowAllAreas] = useState(false);

  const role = dbUser?.role || 'admin';
  const isAgent = role === 'agent';
  const canShowAllAreasToggle = isAgent && dbUser?.agent_allow_all_areas;
  const canAdd  = ['admin', 'super_admin', 'agent', 'landlord'].includes(role);
  const canApprove = ['admin', 'super_admin'].includes(role);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['properties', showAllAreas],
    queryFn: () => fetchProperties(canShowAllAreasToggle && showAllAreas ? { all_areas: 'true' } : {})
  });

  const allProperties = data?.data || [];

  // Client-side filtering
  const properties = allProperties.filter(p => {
    if (search && !p.name?.toLowerCase().includes(search.toLowerCase()) &&
        !p.address?.area?.toLowerCase().includes(search.toLowerCase())) return false;
    if (areaFilter && areaFilter !== 'All Areas' && p.address?.area !== areaFilter) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    return true;
  });

  // KPI summary
  const totalUnits = allProperties.reduce((s, p) => s + (p.units?.length || 0), 0);
  const occupied   = allProperties.reduce((s, p) => s + (p.units?.filter(u => u.status === 'occupied').length || 0), 0);
  const pending    = allProperties.filter(p => p.status === 'pending_admin_approval').length;
  const totalRevenue = allProperties.reduce((s, p) =>
    s + (p.units?.filter(u => u.status === 'occupied').reduce((us, u) => us + (u.rent_kes || 0), 0) || 0), 0);

  const handleApprove = async (propId, e) => {
    e.stopPropagation();
    setWorking(w => ({ ...w, [propId]: 'approve' }));
    try {
      await approveProperty(propId);
      toast.success('Property approved!');
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    } catch (err) {
      toast.error(err?.error?.message || 'Approval failed');
    } finally {
      setWorking(w => ({ ...w, [propId]: null }));
    }
  };

  const handleReject = async (propId, e) => {
    e.stopPropagation();
    const reason = window.prompt('Rejection reason (required):');
    if (!reason?.trim()) return;
    setWorking(w => ({ ...w, [propId]: 'reject' }));
    try {
      await rejectProperty(propId, reason.trim());
      toast.success('Property rejected');
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    } catch (err) {
      toast.error(err?.error?.message || 'Rejection failed');
    } finally {
      setWorking(w => ({ ...w, [propId]: null }));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
        <TableSkeleton rows={8} cols={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center border border-dashed border-red-200 rounded-xl bg-red-50 p-8 text-center">
        <div className="flex flex-col items-center gap-2">
          <AlertCircle className="text-red-500 w-8 h-8" />
          <div className="text-red-600 font-semibold">Failed to retrieve properties directory</div>
          <p className="text-sm text-red-500 font-mono">{error.error?.message || error.message || 'Connection refused.'}</p>
          <button onClick={() => refetch()} className="mt-2 text-xs font-bold text-red-500 underline">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Building2 className="text-green-600" size={24} /> Properties Directory
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {allProperties.length} properties · {totalUnits} total units · {pending > 0 ? `${pending} pending approval` : 'all clear'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode(v => v === 'cards' ? 'table' : 'cards')}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
          >
            {viewMode === 'cards' ? <BarChart3 size={14} /> : <Building2 size={14} />}
            {viewMode === 'cards' ? 'Table View' : 'Card View'}
          </button>
          {canAdd && (
            <button
              onClick={() => navigate(role === 'landlord' ? '/properties/add-landlord' : '/properties/add')}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold transition duration-200 shadow-lg shadow-green-900/10"
            >
              <Plus size={16} /> Add Property
            </button>
          )}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Properties', value: allProperties.length, icon: <Building2 size={16} className="text-indigo-500" />, bg: 'bg-indigo-50 border-indigo-100' },
          { label: 'Occupied Units',   value: `${occupied} / ${totalUnits}`, icon: <Home size={16} className="text-green-500" />, bg: 'bg-green-50 border-green-100' },
          { label: 'Pending Approval', value: pending, icon: <Clock size={16} className="text-amber-500" />, bg: 'bg-amber-50 border-amber-100' },
          { label: 'Monthly Revenue',  value: `KES ${totalRevenue.toLocaleString('en-KE')}`, icon: <BarChart3 size={16} className="text-emerald-500" />, bg: 'bg-emerald-50 border-emerald-100' },
        ].map((kpi, i) => (
          <div key={i} className={`p-4 rounded-xl border ${kpi.bg} flex items-center gap-3`}>
            <div className="p-2 bg-white rounded-lg shadow-xs">{kpi.icon}</div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{kpi.label}</p>
              <p className="text-base font-black text-gray-900">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex gap-3 flex-wrap items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search property name or area…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400"
          />
        </div>
        <select
          value={areaFilter}
          onChange={e => setArea(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500/30 bg-white text-gray-700"
        >
          {MOMBASA_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatus(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500/30 bg-white text-gray-700"
        >
          {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {(search || areaFilter !== 'All Areas' || statusFilter) && (
          <button
            onClick={() => { setSearch(''); setArea('All Areas'); setStatus(''); }}
            className="text-xs text-gray-500 hover:text-gray-700 font-semibold underline"
          >
            Clear filters
          </button>
        )}
        {canShowAllAreasToggle && (
          <button
            onClick={() => setShowAllAreas(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition ${
              showAllAreas
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
            }`}
          >
            🌐 {showAllAreas ? 'All Areas (Active)' : 'Show All Areas'}
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400 font-medium">{properties.length} result{properties.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Property Grid / Table */}
      {properties.length === 0 ? (
        <div className="flex h-64 items-center justify-center border border-dashed border-gray-200 rounded-xl bg-gray-50 text-center">
          <div>
            <Building2 size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No properties match your filters</p>
            <button onClick={() => { setSearch(''); setArea('All Areas'); setStatus(''); }} className="mt-2 text-xs text-green-600 font-bold underline">
              Clear filters
            </button>
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {properties.map(prop => {
            const propUnits  = prop.units?.length || 0;
            const propOcc    = prop.units?.filter(u => u.status === 'occupied').length || 0;
            const occRate    = propUnits > 0 ? Math.round((propOcc / propUnits) * 100) : 0;
            const monthlyRev = prop.units?.filter(u => u.status === 'occupied').reduce((s, u) => s + (u.rent_kes || 0), 0) || 0;
            const badge      = STATUS_BADGE[prop.status] || STATUS_BADGE.inactive;

            return (
              <div
                key={prop._id}
                onClick={() => navigate(`/properties/${prop._id}`)}
                className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-green-200 transition-all duration-200 cursor-pointer group"
              >
                {/* Top */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-green-50 to-emerald-50 border border-green-100 flex items-center justify-center">
                      <Building2 size={18} className="text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 group-hover:text-green-700 transition-colors">{prop.name}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{prop.property_code}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: badge.bg, color: badge.color }}>
                    {badge.label}
                  </span>
                </div>

                {/* Location */}
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-4">
                  <MapPin size={11} className="text-red-400" />
                  {prop.address?.area}, {prop.address?.city} · {prop.type?.replace('_', ' ')}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center p-2 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs font-black text-gray-800">{propUnits}</p>
                    <p className="text-[9px] text-gray-400 uppercase font-semibold mt-0.5">Units</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs font-black text-green-700">{occRate}%</p>
                    <p className="text-[9px] text-gray-400 uppercase font-semibold mt-0.5">Occupied</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs font-black text-emerald-700 truncate">
                      {monthlyRev > 0 ? `${(monthlyRev / 1000).toFixed(0)}k` : '—'}
                    </p>
                    <p className="text-[9px] text-gray-400 uppercase font-semibold mt-0.5">Rev/mo</p>
                  </div>
                </div>

                {/* Occupancy bar */}
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all"
                    style={{ width: `${occRate}%` }}
                  />
                </div>

                {/* Action row */}
                <div className="flex justify-between items-center">
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/properties/${prop._id}`); }}
                    className="flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-green-600 transition-colors"
                  >
                    <Eye size={12} /> View Details
                  </button>

                  {canApprove && prop.status === 'pending_admin_approval' && (
                    <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={e => handleApprove(prop._id, e)}
                        disabled={!!working[prop._id]}
                        className="text-[10px] font-bold px-2.5 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg transition disabled:opacity-50 flex items-center gap-1"
                      >
                        <CheckCircle2 size={11} /> {working[prop._id] === 'approve' ? '…' : 'Approve'}
                      </button>
                      <button
                        onClick={e => handleReject(prop._id, e)}
                        disabled={!!working[prop._id]}
                        className="text-[10px] font-bold px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition disabled:opacity-50"
                      >
                        {working[prop._id] === 'reject' ? '…' : 'Reject'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table view */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Property', 'Area', 'Type', 'Units', 'Occupancy', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {properties.map(prop => {
                const propUnits = prop.units?.length || 0;
                const propOcc   = prop.units?.filter(u => u.status === 'occupied').length || 0;
                const occRate   = propUnits > 0 ? Math.round((propOcc / propUnits) * 100) : 0;
                const badge     = STATUS_BADGE[prop.status] || STATUS_BADGE.inactive;
                return (
                  <tr
                    key={prop._id}
                    className="border-b border-gray-50 hover:bg-green-50/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/properties/${prop._id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-bold text-gray-900 text-xs">{prop.name}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{prop.property_code}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      <span className="flex items-center gap-1"><MapPin size={10} className="text-red-400" />{prop.address?.area}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 capitalize">{prop.type?.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-700">{propUnits}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${occRate}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{occRate}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/properties/${prop._id}`)}
                          className="text-[10px] font-bold px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition flex items-center gap-1"
                        >
                          <Eye size={10} /> View
                        </button>
                        {canApprove && prop.status === 'pending_admin_approval' && (
                          <>
                            <button onClick={e => handleApprove(prop._id, e)} disabled={!!working[prop._id]} className="text-[10px] font-bold px-2 py-1 bg-green-600 text-white rounded-lg transition disabled:opacity-50">
                              {working[prop._id] === 'approve' ? '…' : '✓'}
                            </button>
                            <button onClick={e => handleReject(prop._id, e)} disabled={!!working[prop._id]} className="text-[10px] font-bold px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg transition disabled:opacity-50">
                              ✕
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
