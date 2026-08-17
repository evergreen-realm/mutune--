import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useThemeStore } from '../store/themeStore';
import gsap from 'gsap';
import {
  Building2, AlertCircle, Home, Users, CheckCircle2, Clock, MapPin
} from 'lucide-react';
import { fetchProperties, approveProperty, rejectProperty } from '../lib/api';
import { TableSkeleton } from '../components/SkeletonLoader';
import PropertyFilters from '../components/PropertyFilters';
import PropertyGrid from '../components/PropertyGrid';
import PropertyMap from '../components/PropertyMap';

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

export default function PropertiesPage({ dbUser }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme } = useThemeStore();
  const gridRef = useRef(null);

  const [search, setSearch]       = useState('');
  const [areaFilter, setArea]     = useState('All Areas');
  const [statusFilter, setStatus] = useState('');
  const [viewMode, setViewMode]   = useState('cards'); // 'cards' | 'table' | 'map'
  const [working, setWorking]     = useState({});
  const [showAllAreas, setShowAllAreas] = useState(false);
  const [showMap, setShowMap]     = useState(false);

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

  const handleApprove = async (propId) => {
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

  const handleReject = async (propId) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    setWorking(w => ({ ...w, [propId]: 'reject' }));
    try {
      await rejectProperty(propId, reason);
      toast.info('Property rejected');
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    } catch (err) {
      toast.error(err?.error?.message || 'Rejection failed');
    } finally {
      setWorking(w => ({ ...w, [propId]: null }));
    }
  };

  if (isLoading) return <TableSkeleton rows={6} cols={4} />;

  if (error) return (
    <div className="flex h-96 items-center justify-center border border-dashed border-red-500/30 rounded-2xl bg-red-500/5 p-8">
      <div className="text-center">
        <AlertCircle className="mx-auto text-red-500 mb-3" size={32} />
        <div className="text-red-500 font-bold text-sm">Failed to load properties</div>
        <p className="text-xs text-red-400 mt-1">{error?.error?.message || error?.message}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-xl">
        <div>
          <span className="text-[10px] text-blue-400 font-extrabold uppercase tracking-widest block mb-1">Portfolio & Estate Registry</span>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Building2 className="text-blue-400" size={22} /> Managed Real Estate Assets
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Mombasa real estate portfolio, Plus Code spatial verification, and 3D digital twins.
          </p>
        </div>

        <button
          onClick={() => setShowMap(!showMap)}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border self-start sm:self-auto ${showMap ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`}
        >
          <MapPin size={14} /> {showMap ? 'Hide Map View' : 'Show Spatial Map'}
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 backdrop-blur-xl">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Properties</span>
          <span className="text-2xl font-black text-white font-mono">{allProperties.length}</span>
        </div>
        <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 backdrop-blur-xl">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Units</span>
          <span className="text-2xl font-black text-blue-400 font-mono">{totalUnits}</span>
        </div>
        <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 backdrop-blur-xl">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Occupied Units</span>
          <span className="text-2xl font-black text-emerald-400 font-mono">{occupied}</span>
        </div>
        <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 backdrop-blur-xl">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Pending Review</span>
          <span className="text-2xl font-black text-amber-400 font-mono">{pending}</span>
        </div>
      </div>

      {/* Map view (toggleable) */}
      {showMap && (
        <PropertyMap
          properties={properties}
          onSelectProperty={(id) => navigate(`/properties/${id}`)}
        />
      )}

      {/* Search & Filters */}
      <PropertyFilters
        search={search}
        setSearch={setSearch}
        areaFilter={areaFilter}
        setAreaFilter={setArea}
        statusFilter={statusFilter}
        setStatusFilter={setStatus}
        areasList={MOMBASA_AREAS}
        statusesList={STATUS_OPTS}
        viewMode={viewMode}
        setViewMode={setViewMode}
        canAdd={canAdd}
        onAddClick={() => navigate(role === 'landlord' ? '/landlord/add-property' : '/properties/add')}
        canShowAllAreasToggle={canShowAllAreasToggle}
        showAllAreas={showAllAreas}
        setShowAllAreas={setShowAllAreas}
      />

      {/* Property Grid or Table */}
      <PropertyGrid
        properties={properties}
        viewMode={viewMode}
        canApprove={canApprove}
        working={working}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
}
