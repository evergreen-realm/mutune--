import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useThemeStore } from '../store/themeStore';
import gsap from 'gsap';
import {
  Plus, Building2, AlertCircle, Search, Filter, MapPin,
  Home, CheckCircle2, Clock, Users, Eye, BarChart3, List, Grid, X
} from 'lucide-react';
import { fetchProperties, approveProperty, rejectProperty } from '../lib/api';
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
  active:                  { bg: 'bg-emerald-500/10 border-emerald-500/20',  color: 'text-emerald-400', label: 'Active' },
  pending_admin_approval:  { bg: 'bg-amber-500/10 border-amber-500/20',  color: 'text-amber-400', label: 'Pending' },
  rejected:                { bg: 'bg-red-500/10 border-red-500/20',   color: 'text-red-400', label: 'Rejected' },
  inactive:                { bg: 'bg-slate-500/10 border-slate-500/20', color: 'text-slate-400', label: 'Inactive' },
};

export default function PropertiesPage({ dbUser }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme } = useThemeStore();
  const gridRef = useRef(null);

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

  // GSAP Entrance animation
  useEffect(() => {
    if (!isLoading && properties.length > 0 && viewMode === 'cards' && gridRef.current) {
      const cards = gridRef.current.children;
      gsap.fromTo(cards,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out', overwrite: 'auto' }
      );
    }
  }, [isLoading, properties.length, viewMode]);

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
      toast.success('Property approved successfully ✓');
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
      toast.success('Property rejected successfully ✓');
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
          <div className="h-8 w-48 bg-surface-bright rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-surface-bright rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-surface-bright rounded-xl animate-pulse" />)}
        </div>
        <TableSkeleton rows={8} cols={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center border border-dashed border-red-500/30 rounded-xl bg-red-500/5 p-8 text-center text-foreground">
        <div className="flex flex-col items-center gap-2">
          <AlertCircle className="text-red-500 w-8 h-8" />
          <div className="text-red-500 font-bold">Failed to retrieve properties directory</div>
          <p className="text-xs text-muted font-mono">{error.error?.message || error.message || 'Connection refused.'}</p>
          <button onClick={() => refetch()} className="mt-2 text-xs font-bold text-primary underline cursor-pointer">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 text-foreground">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3 border-b border-border/40 pb-5">
        <div>
          <span className="text-[10px] text-primary font-extrabold uppercase tracking-widest block mb-1">Listings</span>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Building2 className="text-primary" size={24} /> Properties Directory
          </h1>
          <p className="text-xs text-muted mt-0.5">
            {allProperties.length} properties · {totalUnits} total units · {pending > 0 ? `${pending} pending approval` : 'all clear'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode(v => v === 'cards' ? 'table' : 'cards')}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface hover:bg-surface-bright text-foreground rounded-xl text-xs font-bold transition border border-border cursor-pointer active:scale-95"
          >
            {viewMode === 'cards' ? <List size={14} /> : <Grid size={14} />}
            {viewMode === 'cards' ? 'Table View' : 'Card View'}
          </button>
          {canAdd && (
            <button
              onClick={() => navigate(role === 'landlord' ? '/properties/add-landlord' : '/properties/add')}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-550 text-white rounded-xl text-xs font-bold transition duration-200 shadow-md cursor-pointer active:scale-95"
            >
              <Plus size={16} /> Add Property
            </button>
          )}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Properties', value: allProperties.length, icon: <Building2 size={16} className="text-indigo-400" />, border: 'border-indigo-500/20' },
          { label: 'Occupied Units',   value: `${occupied} / ${totalUnits}`, icon: <Home size={16} className="text-emerald-400" />, border: 'border-emerald-500/20' },
          { label: 'Pending Approval', value: pending, icon: <Clock size={16} className="text-amber-400" />, border: 'border-amber-500/20' },
          { label: 'Monthly Revenue',  value: `KES ${totalRevenue.toLocaleString('en-KE')}`, icon: <BarChart3 size={16} className="text-pink-400" />, border: 'border-pink-500/20' },
        ].map((kpi, i) => (
          <div key={i} className={`p-4 rounded-xl border ${kpi.border} bg-surface/30 backdrop-blur-md flex items-center gap-3 shadow-sm`}>
            <div className="p-2 bg-background border border-border rounded-lg shadow-xs">{kpi.icon}</div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{kpi.label}</p>
              <p className="text-base font-black text-foreground">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex gap-3 flex-wrap items-center bg-surface/35 backdrop-blur-md p-3 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search property name or area…"
            className="w-full pl-8 pr-3 py-2.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:border-primary/50 text-foreground transition"
          />
        </div>
        <select
          value={areaFilter}
          onChange={e => setArea(e.target.value)}
          className="text-xs bg-background border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-primary/50 text-foreground font-bold cursor-pointer"
        >
          {MOMBASA_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatus(e.target.value)}
          className="text-xs bg-background border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-primary/50 text-foreground font-bold cursor-pointer"
        >
          {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {(search || areaFilter !== 'All Areas' || statusFilter) && (
          <button
            onClick={() => { setSearch(''); setArea('All Areas'); setStatus(''); }}
            className="p-2.5 bg-background border border-border rounded-lg text-muted hover:text-foreground transition cursor-pointer"
          >
            <X size={14} />
          </button>
        )}
        {canShowAllAreasToggle && (
          <button
            onClick={() => setShowAllAreas(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
              showAllAreas
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                : 'bg-background border-border text-muted hover:bg-surface'
            }`}
          >
            🌐 {showAllAreas ? 'All Areas (Active)' : 'Show All Areas'}
          </button>
        )}
      </div>

      {/* Property Grid / Table */}
      {properties.length === 0 ? (
        <div className="flex h-64 items-center justify-center border border-dashed border-border rounded-xl bg-surface/30 text-center">
          <div>
            <Building2 size={32} className="text-muted mx-auto mb-3" />
            <p className="text-xs text-muted">No properties match your filters</p>
            <button onClick={() => { setSearch(''); setArea('All Areas'); setStatus(''); }} className="mt-2 text-xs text-primary font-bold underline cursor-pointer">
              Clear filters
            </button>
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {properties.map(prop => {
            const propUnits  = prop.units?.length || 0;
            const propOcc    = prop.units?.filter(u => u.status === 'occupied').length || 0;
            const occRate    = propUnits > 0 ? Math.round((propOcc / propUnits) * 100) : 0;
            const monthlyRev = prop.units?.filter(u => u.status === 'occupied').reduce((s, u) => s + (u.rent_kes || 0), 0) || 0;
            const badge      = STATUS_BADGE[prop.status] || STATUS_BADGE.inactive;
            const photo      = prop.photos?.[0] || null;

            return (
              <div
                key={prop._id}
                onClick={() => navigate(`/properties/${prop._id}`)}
                className="bg-surface/30 border border-border hover:border-primary/40 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group flex flex-col justify-between"
              >
                {/* Photo Header */}
                <div className="relative h-40 bg-slate-950 overflow-hidden">
                  {photo ? (
                    <img
                      src={photo}
                      alt={prop.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-950/20 to-slate-900/20 flex items-center justify-center text-muted">
                      <Building2 size={36} />
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 border rounded-full ${badge.bg} ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">{prop.name}</h3>
                    <p className="text-[10px] text-muted font-mono tracking-wider mt-0.5">{prop.property_code}</p>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] text-muted">
                    <MapPin size={11} className="text-red-400" />
                    <span>{prop.address?.area}, {prop.address?.city} · {prop.type?.replace('_', ' ')}</span>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 bg-background/50 rounded-lg border border-border">
                      <p className="text-xs font-black text-foreground">{propUnits}</p>
                      <p className="text-[9px] text-muted font-bold uppercase tracking-wider mt-0.5">Units</p>
                    </div>
                    <div className="text-center p-2 bg-background/50 rounded-lg border border-border">
                      <p className="text-xs font-black text-emerald-400">{occRate}%</p>
                      <p className="text-[9px] text-muted font-bold uppercase tracking-wider mt-0.5">Occupied</p>
                    </div>
                    <div className="text-center p-2 bg-background/50 rounded-lg border border-border">
                      <p className="text-xs font-black text-primary font-mono truncate">
                        {monthlyRev > 0 ? `${(monthlyRev / 1000).toFixed(0)}k` : '—'}
                      </p>
                      <p className="text-[9px] text-muted font-bold uppercase tracking-wider mt-0.5">Rev/mo</p>
                    </div>
                  </div>

                  {/* Occupancy bar */}
                  <div>
                    <div className="flex justify-between items-center text-[9px] font-bold text-muted uppercase mb-1">
                      <span>Occupancy</span>
                      <span>{occRate}%</span>
                    </div>
                    <div className="h-1 bg-background border border-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-indigo-600 rounded-full transition-all"
                        style={{ width: `${occRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-surface/30 backdrop-blur-md border border-border rounded-2xl overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-background/30 text-muted uppercase tracking-wider font-extrabold">
                  <th className="p-4">Property / Code</th>
                  <th className="p-4">Location / Type</th>
                  <th className="p-4 text-center">Units</th>
                  <th className="p-4 text-center">Occupancy</th>
                  <th className="p-4 text-right">Revenue (mo)</th>
                  <th className="p-4">Status</th>
                  {canApprove && <th className="p-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {properties.map(prop => {
                  const propUnits  = prop.units?.length || 0;
                  const propOcc    = prop.units?.filter(u => u.status === 'occupied').length || 0;
                  const occRate    = propUnits > 0 ? Math.round((propOcc / propUnits) * 100) : 0;
                  const monthlyRev = prop.units?.filter(u => u.status === 'occupied').reduce((s, u) => s + (u.rent_kes || 0), 0) || 0;
                  const badge      = STATUS_BADGE[prop.status] || STATUS_BADGE.inactive;

                  return (
                    <tr
                      key={prop._id}
                      onClick={() => navigate(`/properties/${prop._id}`)}
                      className="hover:bg-background/25 transition cursor-pointer"
                    >
                      <td className="p-4">
                        <div className="font-bold text-foreground">{prop.name}</div>
                        <div className="text-[10px] text-muted font-mono tracking-wider mt-1">{prop.property_code}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-foreground">{prop.address?.area}, {prop.address?.city}</div>
                        <div className="text-[10px] text-muted mt-1 capitalize">{prop.type?.replace('_', ' ')}</div>
                      </td>
                      <td className="p-4 text-center font-bold text-foreground">{propUnits}</td>
                      <td className="p-4">
                        <div className="flex flex-col items-center justify-center">
                          <span className="font-bold text-emerald-400 mb-1">{occRate}%</span>
                          <div className="w-16 h-1 bg-background border border-border rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${occRate}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-foreground">
                        {monthlyRev > 0 ? FMT_KES(monthlyRev) : '—'}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 border rounded-full text-[10px] font-black uppercase tracking-wider ${badge.bg} ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      {canApprove && (
                        <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {prop.status === 'pending_admin_approval' && (
                              <>
                                <button
                                  onClick={(e) => handleApprove(prop._id, e)}
                                  disabled={working[prop._id] !== null && working[prop._id] !== undefined}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold uppercase transition"
                                >
                                  {working[prop._id] === 'approve' ? 'Approving...' : 'Approve'}
                                </button>
                                <button
                                  onClick={(e) => handleReject(prop._id, e)}
                                  disabled={working[prop._id] !== null && working[prop._id] !== undefined}
                                  className="px-2.5 py-1 bg-red-650 hover:bg-red-500 text-white rounded-lg text-[10px] font-bold uppercase transition"
                                >
                                  {working[prop._id] === 'reject' ? 'Rejecting...' : 'Reject'}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
