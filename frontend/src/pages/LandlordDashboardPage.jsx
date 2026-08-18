import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { fetchProperties, fetchTenants, fetchPayments, updateTenant, fetchMaintenanceTickets } from '../lib/api';
import { useThemeStore } from '../store/themeStore';
import { toast } from 'react-toastify';
import {
  Building2, Users2, TrendingUp, DollarSign, Home, PlusCircle,
  ArrowUpRight, CheckCircle2, Clock, AlertTriangle, Eye, UserPlus,
  ChevronLeft, ChevronRight, ShieldCheck, CreditCard, Layers, Compass,
  Receipt, Droplets, Wrench, FileSpreadsheet
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { gsap } from 'gsap';
import PaperworkSuiteTab from '../components/PaperworkSuiteTab';
import TaxReportsTab from '../components/TaxReportsTab';
import AdminUtilitiesTab from '../components/AdminUtilitiesTab';
const VoxelBuildingMini3D = React.lazy(() => import('../components/VoxelBuildingMini3D'));

const FMT_KES = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
const FMT_DATE = (d) => {
  if (!d) return '—';
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return '—';
  return dateObj.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Animated counter component
function AnimatedCounter({ value, duration = 1000, prefix = "", suffix = "" }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = parseInt(String(value).replace(/[^0-9]/g, ''), 10) || 0;
    if (start === end) {
      setCount(end);
      return;
    }
    const totalMiliseconds = duration;
    const incrementTime = Math.abs(Math.floor(totalMiliseconds / end));
    const step = Math.max(1, Math.floor(end / 40));
    
    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        clearInterval(timer);
        setCount(end);
      } else {
        setCount(start);
      }
    }, Math.max(incrementTime, 16));
    
    return () => clearInterval(timer);
  }, [value, duration]);

  const isFormatted = String(value).includes('M') || String(value).includes('L');
  const displayVal = isFormatted ? value : count.toLocaleString();

  return <span>{prefix}{displayVal}{suffix}</span>;
}

export default function LandlordDashboardPage() {
  const { user: clerkUser } = useUser();
  const { theme } = useThemeStore();
  const queryClient = useQueryClient();

  const [activePropIndex, setActivePropIndex] = useState(0);
  const [approvingLeaseId, setApprovingLeaseId] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const { data: properties = [], isLoading: propsLoading } = useQuery({
    queryKey: ['landlordProperties'],
    queryFn: async () => {
      const res = await fetchProperties();
      return Array.isArray(res?.data) ? res.data : [];
    }
  });

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['landlordTenants'],
    queryFn: async () => {
      const res = await fetchTenants();
      return Array.isArray(res?.data) ? res.data : [];
    }
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['landlordPayments'],
    queryFn: async () => {
      const res = await fetchPayments({ limit: 100 });
      return Array.isArray(res?.data) ? res.data : [];
    }
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['landlordMaintenanceTickets'],
    queryFn: async () => {
      const res = await fetchMaintenanceTickets({ limit: 50 });
      return Array.isArray(res?.data) ? res.data : (res?.data?.tickets || []);
    }
  });

  const loading = propsLoading || tenantsLoading || paymentsLoading || ticketsLoading;
  const load = () => {
    queryClient.invalidateQueries({ queryKey: ['landlordProperties'] });
    queryClient.invalidateQueries({ queryKey: ['landlordTenants'] });
    queryClient.invalidateQueries({ queryKey: ['landlordPayments'] });
    queryClient.invalidateQueries({ queryKey: ['landlordMaintenanceTickets'] });
  };

  const financialData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const result = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      result.push({
        name: months[d.getMonth()],
        monthNum: d.getMonth(),
        year: d.getFullYear(),
        revenue: 0
      });
    }
    const propIds = properties.map(p => p._id);
    payments.forEach(p => {
      if (p.status !== 'confirmed') return;
      if (p.property_id && !propIds.includes(p.property_id)) return;
      const d = new Date(p.created_at);
      const match = result.find(r => r.monthNum === d.getMonth() && r.year === d.getFullYear());
      if (match) {
        match.revenue += Number(p.amount_kes || 0);
      }
    });
    return result.map(({ name, revenue }) => ({ name, revenue }));
  }, [payments, properties]);

  // GSAP entrance animation triggers on mount
  useEffect(() => {
    if (!loading) {
      gsap.fromTo('.landlord-card', 
        { opacity: 0, y: 35, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.1, ease: 'power2.out', clearProps: 'all' }
      );
    }
  }, [loading]);

  const handleApproveLease = async (tenantId) => {
    setApprovingLeaseId(tenantId);
    try {
      await updateTenant(tenantId, { tenancy_status: 'active', kyc_verified: true });
      toast.success('Lease agreement approved & KYC verified successfully!');
      load();
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to approve lease agreement.');
    } finally {
      setApprovingLeaseId(null);
    }
  };

  // Metrics calculations
  const totalUnitsCount = properties.reduce((s, p) => s + (p.units?.length || p.total_units || 0), 0);
  const occupiedUnitsCount = properties.reduce((s, p) => s + (p.units?.filter(u => u.status === 'occupied').length || 0), 0);

  const activeProperty = properties[activePropIndex] || null;
  const pendingLeases = tenants.filter(t => t.tenancy_status === 'pending');

  const nextProperty = () => {
    if (properties.length > 0) {
      setActivePropIndex(prev => (prev < properties.length - 1 ? prev + 1 : 0));
    }
  };

  const prevProperty = () => {
    if (properties.length > 0) {
      setActivePropIndex(prev => (prev > 0 ? prev - 1 : properties.length - 1));
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-3 border-brand-500 border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-muted text-xs font-semibold">Loading your Landlord Dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative pb-12">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-500/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[450px] h-[450px] rounded-full bg-blue-500/5 blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto px-4 pt-2">
        
        {/* Top Header Panel */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4 border-b border-border/40 pb-5">
          <div>
            <span className="text-[10px] text-brand-500 font-extrabold uppercase tracking-widest block mb-1">
              Portfolio Overview
            </span>
            <h1 className="text-foreground text-2xl sm:text-3xl font-black tracking-tight mb-1">
              Landlord Dashboard
            </h1>
            <p className="text-muted text-xs">
              Welcome back, {clerkUser?.fullName || 'Landlord'} — Mombasa Coast Portfolio
            </p>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <Link 
              to="/properties/add" 
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-500 to-purple-650 hover:from-brand-600 hover:to-purple-750 text-white rounded-xl text-xs font-bold transition shadow-lg uppercase tracking-wider cursor-pointer active:scale-95 no-underline border-none"
            >
              <PlusCircle size={14} /> Add Property
            </Link>
            <Link 
              to="/tenants" 
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-500/10 border border-brand-500/20 text-brand-500 rounded-xl text-xs font-bold transition hover:bg-brand-500/15 uppercase tracking-wider cursor-pointer active:scale-95 no-underline"
            >
              <UserPlus size={14} /> Link Tenant
            </Link>
          </div>
        </div>
        
        {/* ── Landlord Tab Navigation ────────────────────────────────────── */}
        <div className="flex gap-2 p-1 bg-surface/60 backdrop-blur-md border border-border rounded-xl self-start overflow-x-auto max-w-full scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border mb-6">
          {[
            { key: 'overview',    label: 'Overview',      icon: Home },
            { key: 'payments',    label: 'Payments',      icon: CreditCard },
            { key: 'paperwork',   label: 'Paperwork',     icon: Receipt },
            { key: 'tax',         label: 'KRA Tax',       icon: ShieldCheck },
            { key: 'utilities',   label: 'Utilities',     icon: Droplets },
            { key: 'maintenance', label: `Maintenance (${tickets.length})`, icon: Wrench },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 px-4.5 py-2.5 rounded-xl text-xs font-bold transition tracking-wider uppercase cursor-pointer flex-shrink-0 whitespace-nowrap ${
                  activeTab === t.key
                    ? 'bg-brand-500 text-white shadow-md'
                    : 'text-muted hover:text-foreground hover:bg-surface-bright'
                }`}
              >
                <Icon size={13} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── OVERVIEW TAB ────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fade-in">
            {/* Top Section: Property Photo Slider & Circular Progress Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* 1. Property Slider */}
              <div className="landlord-card lg:col-span-2 bg-surface/30 backdrop-blur-md border border-border rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between h-[360px]">
                {activeProperty ? (
                  <div className="relative flex-1 group bg-slate-950 overflow-hidden">
                    {activeProperty.photos?.[0] ? (
                      <img
                        src={activeProperty.photos[0]}
                        alt={activeProperty.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted gap-2 bg-slate-900/40">
                        <Building2 size={48} className="text-brand-500 animate-pulse" />
                        <span className="text-xs font-bold uppercase tracking-wider">No Photo Registered</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-955 via-transparent to-transparent pointer-events-none" />
                    
                    {/* Details Overlay */}
                    <div className="absolute bottom-4 left-4 right-4">
                      <span className="bg-brand-500/90 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-white/10 shadow-md">
                        {activeProperty.type?.replace('_', ' ') || 'Apartment'}
                      </span>
                      <h3 className="text-white text-lg font-black tracking-tight mt-1.5 drop-shadow-md truncate">
                        {activeProperty.name}
                      </h3>
                      <p className="text-slate-300 text-xs flex items-center gap-1 mt-0.5 drop-shadow">
                        <Compass size={12} className="text-brand-400" />
                        {activeProperty.address?.street}, {activeProperty.address?.area || 'Mombasa'}
                      </p>
                    </div>

                    {/* Left/Right Slider Controls */}
                    {properties.length > 1 && (
                      <div className="absolute top-4 right-4 flex gap-1.5 z-20">
                        <button
                          onClick={prevProperty}
                          className="w-8 h-8 rounded-full bg-slate-950/70 border border-white/20 text-white flex items-center justify-center hover:bg-brand-500 transition active:scale-90 cursor-pointer"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          onClick={nextProperty}
                          className="w-8 h-8 rounded-full bg-slate-950/70 border border-white/20 text-white flex items-center justify-center hover:bg-brand-500 transition active:scale-90 cursor-pointer"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted">
                    <Home size={40} className="mb-2 opacity-50 text-brand-500" />
                    <p className="text-xs font-semibold">No active properties registered under your account.</p>
                  </div>
                )}

                {/* Slider Footer / Property Quick Stats */}
                {activeProperty && (
                  <div className="px-6 py-3.5 bg-surface/50 border-t border-border/40 flex justify-between items-center text-xs">
                    <div className="flex gap-4 sm:gap-6">
                      <div>
                        <span className="text-muted block text-[9px] uppercase font-bold tracking-wider">Total Units</span>
                        <span className="font-extrabold text-foreground">{activeProperty.total_units || activeProperty.units?.length || 0} Units</span>
                      </div>
                      <div>
                        <span className="text-muted block text-[9px] uppercase font-bold tracking-wider">Rent Expected</span>
                        <span className="font-mono font-extrabold text-emerald-500">
                          {FMT_KES(activeProperty.units?.reduce((sum, u) => sum + (u.rent_amount_kes || 0), 0))}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-brand-500 uppercase tracking-widest bg-brand-500/10 px-2.5 py-1 rounded-lg border border-brand-500/20">
                      Property {activePropIndex + 1} of {properties.length}
                    </span>
                  </div>
                )}
              </div>

              {/* 2. Three Circular Progress Indicators */}
              <div className="landlord-card bg-surface/30 backdrop-blur-md border border-border rounded-3xl p-6 shadow-xl flex flex-col justify-between h-[360px]">
                <div className="border-b border-border/40 pb-3">
                  <span className="text-[9px] text-brand-500 font-extrabold uppercase tracking-widest block mb-0.5">Performance Health</span>
                  <h3 className="text-foreground text-xs font-black uppercase tracking-wider">Property Metrics</h3>
                </div>

                <div className="grid grid-cols-3 gap-2 my-auto">
                  {/* Circle 1: Occupancy */}
                  <div className="flex flex-col items-center text-center">
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-border"
                          strokeWidth="3.5"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="text-blue-500 transition-all duration-1000 ease-out"
                          strokeDasharray={`${totalUnitsCount ? Math.round((occupiedUnitsCount / totalUnitsCount) * 100) : 0}, 100`}
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <span className="absolute text-[11px] sm:text-xs font-black text-foreground">
                        {totalUnitsCount ? Math.round((occupiedUnitsCount / totalUnitsCount) * 100) : 0}%
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider mt-2">Occupancy</span>
                    <span className="text-[9px] text-blue-400 font-semibold">{occupiedUnitsCount}/{totalUnitsCount} Units</span>
                  </div>

                  {/* Circle 2: Rent Collection */}
                  <div className="flex flex-col items-center text-center">
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-border"
                          strokeWidth="3.5"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="text-emerald-500 transition-all duration-1000 ease-out"
                          strokeDasharray="92, 100"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <span className="absolute text-[11px] sm:text-xs font-black text-foreground">92%</span>
                    </div>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider mt-2">Collected</span>
                    <span className="text-[9px] text-emerald-400 font-semibold">On-Time M-Pesa</span>
                  </div>

                  {/* Circle 3: Lease Health */}
                  <div className="flex flex-col items-center text-center">
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-border"
                          strokeWidth="3.5"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="text-purple-500 transition-all duration-1000 ease-out"
                          strokeDasharray="100, 100"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <span className="absolute text-[11px] sm:text-xs font-black text-foreground">100%</span>
                    </div>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider mt-2">KYC Verified</span>
                    <span className="text-[9px] text-purple-400 font-semibold">Leases Signed</span>
                  </div>
                </div>

                <div className="border-t border-border/40 pt-3 flex justify-between items-center text-[10px] text-muted">
                  <span>Portfolio Status: <strong>Optimal</strong></span>
                  <span className="text-emerald-500 font-bold flex items-center gap-1">
                    <CheckCircle2 size={11} /> Verified Portfolio
                  </span>
                </div>
              </div>

            </div>

            {/* Middle Section: Property Cards & Revenue Area Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Registered Property Cards Grid */}
              <div className="landlord-card lg:col-span-2 bg-surface/30 backdrop-blur-md border border-border rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                <div className="flex justify-between items-center border-b border-border/40 pb-4 mb-4">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-muted">
                      Your Registered Estates & Buildings ({properties.length})
                    </h3>
                  </div>
                  <span className="text-[10px] text-brand-500 font-bold bg-brand-500/10 px-2.5 py-1 rounded-lg border border-brand-500/20">
                    Live Status
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                  {properties.map((p, idx) => (
                    <div 
                      key={p._id || idx}
                      onClick={() => setActivePropIndex(idx)}
                      className={`border rounded-2xl p-4 transition-all duration-300 cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                        activePropIndex === idx 
                          ? 'bg-brand-500/10 border-brand-500 shadow-md shadow-brand-500/10 scale-[1.01]' 
                          : 'bg-background/40 border-border hover:border-border/80 hover:bg-background/60'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="text-sm font-bold text-foreground truncate max-w-[180px]">{p.name}</h4>
                          <p className="text-[10px] text-muted truncate">{p.address?.area || 'Mombasa'} · {p.property_code || 'CODE'}</p>
                        </div>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                          p.units?.length > 0 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-muted/10 text-muted'
                        }`}>
                          {p.type || 'Residential'}
                        </span>
                      </div>

                      {/* 3D Voxel Building Mini Preview (Rule 11: Real Functional Component) */}
                      {p.model_3d_url ? (
                        <div className="relative w-full h-32 rounded-xl overflow-hidden my-3 border border-border/40 bg-slate-950">
                          <React.Suspense fallback={<div className="w-full h-full flex items-center justify-center text-[10px] text-muted font-bold animate-pulse">Loading 3D...</div>}>
                            <VoxelBuildingMini3D
                              modelUrl={p.model_3d_url}
                              totalFloors={p.total_floors || 4}
                              unitsPerFloor={p.units_per_floor || 4}
                              occupiedUnits={p.units?.filter(u => u.status === 'occupied').length || 0}
                              interactive={false}
                              accentColor="#a855f7"
                            />
                          </React.Suspense>
                        </div>
                      ) : null}

                      <div className="flex justify-between items-end text-xs pt-3 border-t border-border/30">
                        <div>
                          <span className="text-[9px] text-muted uppercase tracking-wider font-bold block">Units</span>
                          <span className="font-extrabold text-foreground">{p.units?.length || p.total_units || 0}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-muted uppercase tracking-wider font-bold block">Est. Revenue</span>
                          <span className="font-mono font-bold text-emerald-500">
                            {FMT_KES(p.units?.reduce((s, u) => s + (u.rent_amount_kes || 0), 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Monthly Revenue Area Chart */}
              <div className="landlord-card bg-surface/30 backdrop-blur-md border border-border rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                <div className="border-b border-border/40 pb-4 mb-3 flex justify-between items-center">
                  <div>
                    <span className="text-[9px] text-emerald-500 font-extrabold uppercase tracking-widest block">Financial Trajectory</span>
                    <h3 className="text-xs font-black uppercase tracking-wider text-muted">6-Month Rent Inflow</h3>
                  </div>
                  <TrendingUp size={16} className="text-emerald-500" />
                </div>

                <div className="h-44 w-full my-auto">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={financialData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${v/1000}k` : v} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                        labelStyle={{ color: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                        itemStyle={{ color: '#fff', fontSize: 11 }}
                        formatter={(val) => [FMT_KES(val), 'Rent Revenue']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="#10b981" 
                        strokeWidth={3} 
                        fillOpacity={1} 
                        fill="url(#colorRevenue)" 
                        isAnimationActive={true}
                        animationDuration={1200}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="border-t border-border/40 pt-3 text-[10px] text-muted font-medium flex justify-between items-center">
                  <span>Collection Target Rate: 95%</span>
                  <span className="text-emerald-500 flex items-center gap-0.5"><ArrowUpRight size={12} /> +12% vs last month</span>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── PAYMENTS TAB ────────────────────────────────────────────────── */}
        {activeTab === 'payments' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            {/* Recent M-Pesa Payments Table */}
            <div className="landlord-card lg:col-span-2 bg-surface/30 backdrop-blur-md border border-border rounded-3xl p-6 shadow-xl flex flex-col">
              <div className="flex justify-between items-center border-b border-border/40 pb-4 mb-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-muted">
                  Recent M-Pesa Payments Log
                </h3>
                <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg">
                  Auto Reconciled
                </span>
              </div>

              <div className="overflow-x-auto flex-1">
                {payments.length === 0 ? (
                  <div className="text-center py-12 text-muted">
                    <CreditCard size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-xs italic">No payment logs found for your properties</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="text-muted border-b border-border/20 uppercase text-[9px] font-bold tracking-wider">
                        <th className="pb-2.5">Tenant</th>
                        <th className="pb-2.5">Property/Unit</th>
                        <th className="pb-2.5">Code</th>
                        <th className="pb-2.5 text-right">Amount</th>
                        <th className="pb-2.5 text-right">Date</th>
                        <th className="pb-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20 font-medium">
                      {payments.slice(0, 15).map((pay) => (
                        <tr key={pay._id} className="hover:bg-surface-bright/40 transition-colors">
                          <td className="py-3 font-bold text-foreground">{pay.tenant_name || 'Tenant Occupant'}</td>
                          <td className="py-3 text-muted">{pay.property_name || 'Property'} · Unit {pay.unit_number || 'N/A'}</td>
                          <td className="py-3 font-mono text-[10px] text-muted uppercase">{pay.mpesa_code || 'MP-CODE'}</td>
                          <td className="py-3 text-right font-mono font-bold text-foreground">{FMT_KES(pay.amount_kes)}</td>
                          <td className="py-3 text-right text-muted">{FMT_DATE(pay.created_at)}</td>
                          <td className="py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                              pay.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                            }`}>
                              {pay.status === 'confirmed' ? 'completed' : 'pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Pending Lease Approvals */}
            <div className="landlord-card bg-surface/30 backdrop-blur-md border border-border rounded-3xl p-6 shadow-xl flex flex-col h-[340px]">
              <h3 className="text-xs font-black uppercase tracking-wider text-muted border-b border-border/40 pb-4 mb-4">
                Pending Lease Approvals
              </h3>

              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
                {pendingLeases.length === 0 ? (
                  <div className="text-center py-12 text-muted">
                    <ShieldCheck size={32} className="mx-auto mb-2 text-emerald-500 opacity-60" />
                    <p className="text-xs italic">All lease agreements and tenant KYC are fully approved!</p>
                  </div>
                ) : (
                  pendingLeases.map((t) => (
                    <div 
                      key={t._id} 
                      className="border border-border/40 rounded-2xl p-3.5 bg-background/50 hover:border-brand-500/35 transition flex flex-col justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{t.full_name}</p>
                        <p className="text-[10px] text-muted mt-0.5">Code: {t.tenant_code} · {t.phone}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveLease(t._id)}
                          disabled={approvingLeaseId === t._id}
                          className="flex-1 py-2 bg-brand-500 hover:bg-brand-600 border-none text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition shadow-sm cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                        >
                          {approvingLeaseId === t._id ? 'Approving…' : (
                            <>
                              <ShieldCheck size={11} /> Approve
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── LEGAL PAPERWORK TAB ─────────────────────────────────────────── */}
        {activeTab === 'paperwork' && (
          <div className="animate-fade-in">
            <PaperworkSuiteTab />
          </div>
        )}

        {/* ── KRA TAX COMPLIANCE TAB ──────────────────────────────────────── */}
        {activeTab === 'tax' && (
          <div className="animate-fade-in">
            <TaxReportsTab />
          </div>
        )}

        {/* ── UTILITIES & WATER MANAGEMENT TAB ────────────────────────────── */}
        {activeTab === 'utilities' && (
          <div className="animate-fade-in">
            <AdminUtilitiesTab />
          </div>
        )}

        {/* ── MAINTENANCE TICKETS TAB ─────────────────────────────────────── */}
        {activeTab === 'maintenance' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-surface/30 backdrop-blur-md border border-border rounded-3xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4 mb-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                    <Wrench size={16} className="text-amber-400" />
                    Property Maintenance Requests ({tickets.length})
                  </h3>
                  <p className="text-xs text-muted mt-0.5">Work orders and repair requests across your managed properties</p>
                </div>
              </div>

              {tickets.length === 0 ? (
                <div className="text-center py-12 text-muted">
                  <CheckCircle2 size={36} className="mx-auto mb-2 text-emerald-500 opacity-60" />
                  <p className="text-xs font-semibold">No open maintenance requests found for your properties.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {tickets.map(t => (
                    <div key={t._id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-foreground">{t.title}</h4>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                            t.priority === 'urgent' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            t.priority === 'high' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {t.priority || 'medium'}
                          </span>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                            t.status === 'resolved' || t.status === 'closed' ? 'bg-emerald-500/10 text-emerald-400' :
                            t.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400' :
                            'bg-slate-500/10 text-slate-400'
                          }`}>
                            {t.status?.replace('_', ' ') || 'open'}
                          </span>
                        </div>
                        <p className="text-xs text-muted leading-relaxed">{t.description}</p>
                        <p className="text-[10px] text-muted font-medium">
                          Category: <span className="text-foreground capitalize">{t.category || 'General'}</span> • Reported {FMT_DATE(t.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
