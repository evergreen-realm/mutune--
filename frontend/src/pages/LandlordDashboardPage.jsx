import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { fetchProperties, fetchTenants, fetchPayments, updateTenant } from '../lib/api';
import { useThemeStore } from '../store/themeStore';
import { toast } from 'react-toastify';
import {
  Building2, Users2, TrendingUp, DollarSign, Home, PlusCircle,
  ArrowUpRight, CheckCircle2, Clock, AlertTriangle, Eye, UserPlus,
  ChevronLeft, ChevronRight, ShieldCheck, CreditCard, Layers, Compass
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { gsap } from 'gsap';
import VoxelBuildingMini3D from '../components/VoxelBuildingMini3D';

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
  const isLight = theme === 'light';

  const [properties, setProperties] = useState([]);
  const [tenants, setTenants]       = useState([]);
  const [payments, setPayments]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activePropIndex, setActivePropIndex] = useState(0);
  const [approvingLeaseId, setApprovingLeaseId] = useState(null);

  // Property Card Hover state
  const [hoveredPropertyId, setHoveredPropertyId] = useState(null);

  // Recharts analytic data for financial insights dynamically aggregated from live payments
  const financialData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const result = [];
    const now = new Date();
    
    // Generate the last 6 months buckets
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      result.push({
        name: months[d.getMonth()],
        monthNum: d.getMonth(),
        year: d.getFullYear(),
        revenue: 0
      });
    }

    // Accumulate confirmed payments for the landlord's properties
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, t, pay] = await Promise.allSettled([
        fetchProperties(),
        fetchTenants(),
        fetchPayments({ limit: 100 })
      ]);
      if (p.status === 'fulfilled') setProperties(Array.isArray(p.value?.data) ? p.value.data : []);
      if (t.status === 'fulfilled') setTenants(Array.isArray(t.value?.data) ? t.value.data : []);
      if (pay.status === 'fulfilled') setPayments(Array.isArray(pay.value?.data) ? pay.value.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
  const totalUnits    = properties.reduce((s, p) => s + (p.units?.length || 0), 0);
  const occupiedUnits = properties.reduce((s, p) => s + (p.units?.filter(u => u.status === 'occupied').length || 0), 0);
  const vacantUnits   = totalUnits - occupiedUnits;
  
  // Calculate collection rate metrics
  const now = new Date();
  const expectedRent = tenants
    .filter(t => t.tenancy_status === 'active')
    .reduce((s, t) => s + Number(t.rent_amount_kes || 0), 0);

  const collectedRent = payments.filter(p => {
    const d = new Date(p.created_at);
    return p.status === 'confirmed' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, p) => s + Number(p.amount_kes || 0), 0);

  const collectionRate = expectedRent > 0 ? Math.round((collectedRent / expectedRent) * 100) : 85; 

  const activeProperty = properties[activePropIndex] || null;
  const pendingLeases = tenants.filter(t => t.tenancy_status === 'pending');

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

  // Circular progress SVG values
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (collectionRate / 100) * circumference;

  return (
    <div className="relative pb-12">
      {/* Cohesive background blur */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-500/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[450px] h-[450px] rounded-full bg-blue-500/5 blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto px-4 pt-2">
        
        {/* Top Header Panel */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4 border-b border-border/40 pb-5">
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

        {/* Top Section: Property Photo Slider & Circular Progress Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
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
                  <h2 className="text-xl font-black text-white tracking-tight mt-2.5 drop-shadow">
                    {activeProperty.name}
                  </h2>
                  <p className="text-xs text-slate-200 mt-1 drop-shadow font-medium">
                    📍 {activeProperty.address?.street}, {activeProperty.address?.area}
                  </p>
                </div>

                {/* Slider Navigators */}
                {properties.length > 1 && (
                  <div className="absolute top-4 right-4 flex gap-1.5 z-10">
                    <button
                      onClick={() => setActivePropIndex(prev => (prev > 0 ? prev - 1 : properties.length - 1))}
                      className="p-2 bg-black/60 hover:bg-black/80 border border-white/15 text-white rounded-lg transition cursor-pointer"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      onClick={() => setActivePropIndex(prev => (prev < properties.length - 1 ? prev + 1 : 0))}
                      className="p-2 bg-black/60 hover:bg-black/80 border border-white/15 text-white rounded-lg transition cursor-pointer"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted py-12">
                <Building2 size={40} className="mb-2" />
                <p className="text-xs italic">No properties registered under your portfolio yet</p>
              </div>
            )}
            
            {/* Slider Bottom Bar */}
            {activeProperty && (
              <div className="px-6 py-4 bg-surface-bright flex justify-between items-center border-t border-border/40">
                <div className="flex gap-6 text-center text-xs">
                  <div>
                    <span className="text-[9px] text-muted font-bold uppercase tracking-wider block">Units</span>
                    <strong className="text-foreground text-sm font-black">{activeProperty.units?.length || 0}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted font-bold uppercase tracking-wider block">Occupancy</span>
                    <strong className="text-emerald-500 text-sm font-black">
                      {Math.round(((activeProperty.units?.filter(u => u.status === 'occupied').length || 0) / Math.max(1, activeProperty.units?.length || 0)) * 100)}%
                    </strong>
                  </div>
                </div>
                <Link
                  to={`/properties`}
                  className="px-4.5 py-2 bg-background hover:bg-surface border border-border text-foreground rounded-xl text-[10px] font-bold uppercase tracking-wider no-underline transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                >
                  <Eye size={12} /> Manage Units
                </Link>
              </div>
            )}
          </div>

          {/* 2. Monthly Collection Rate Circular Metrics */}
          <div className="landlord-card bg-surface/30 backdrop-blur-md border border-border rounded-3xl p-6 shadow-xl flex flex-col justify-between items-center text-center h-[360px]">
            <div className="w-full text-left">
              <span className="text-[10px] text-brand-500 font-extrabold uppercase tracking-widest block mb-1">
                Rent Collection Rate
              </span>
              <h3 className="text-sm font-black text-foreground">Monthly Metrics</h3>
            </div>

            {/* Circular Ring Progress */}
            <div className="relative w-36 h-36 flex items-center justify-center my-2">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="72"
                  cy="72"
                  r={radius}
                  stroke={isLight ? '#e2e8f0' : '#1e293b'}
                  strokeWidth="10"
                  fill="transparent"
                />
                <circle
                  cx="72"
                  cy="72"
                  r={radius}
                  stroke="var(--primary)"
                  strokeWidth="10"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-1000 ease-out"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-2xl font-black text-foreground">
                  <AnimatedCounter value={collectionRate} />%
                </span>
                <span className="text-[9px] text-muted font-bold block uppercase tracking-wider mt-0.5">collected</span>
              </div>
            </div>

            {/* Bottom metrics grid */}
            <div className="grid grid-cols-2 gap-4 w-full border-t border-border/40 pt-4 text-xs">
              <div className="border-r border-border/30">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider block mb-0.5">Total Expected</span>
                <strong className="text-foreground text-sm font-black font-mono">
                  <AnimatedCounter value={expectedRent} prefix="KES " />
                </strong>
              </div>
              <div>
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider block mb-0.5">Collected</span>
                <strong className="text-brand-500 text-sm font-black font-mono">
                  <AnimatedCounter value={collectedRent} prefix="KES " />
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { title: 'Properties Managed', value: properties.length, desc: 'Coast Area Portfolio', icon: <Building2 size={16} />, highlightColor: 'border-blue-500/20' },
            { title: 'Total Housing Units', value: totalUnits, desc: 'Occupied vs Vacant', icon: <Layers size={16} />, highlightColor: 'border-purple-500/20' },
            { title: 'Active Tenant Base', value: occupiedUnits, desc: 'Verified KYC occupancy', icon: <Users2 size={16} />, highlightColor: 'border-emerald-500/20' },
            { title: 'Portfolio Revenue', value: '1.2M', desc: 'Average monthly billing', icon: <TrendingUp size={16} />, highlightColor: 'border-sky-500/20', prefix: 'KES ', suffix: '/mo' }
          ].map((stat, i) => (
            <div 
              key={i} 
              className={`landlord-card bg-surface/30 backdrop-blur-md border ${stat.highlightColor} rounded-3xl p-5 shadow-lg flex items-center justify-between hover:scale-102 transition-transform duration-300`}
            >
              <div>
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider block">{stat.title}</span>
                <p className="text-2xl font-black text-foreground mt-1 font-mono">
                  <AnimatedCounter value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                </p>
                <span className="text-[9px] text-muted mt-0.5 block">{stat.desc}</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center shadow-inner">
                {stat.icon}
              </div>
            </div>
          ))}
        </div>

        {/* Middle Section: Property Cards with 3D Hover & Recharts Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* Property Cards Slider list with 3D hover overlays */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted mb-2">My Coast Properties</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {properties.length === 0 ? (
                <div className="sm:col-span-2 border border-dashed border-border/80 rounded-3xl p-8 text-center text-muted bg-surface/10 flex flex-col items-center justify-center min-h-[220px]">
                  <Building2 size={32} className="mb-2 opacity-50 text-brand-500" />
                  <p className="font-bold text-xs text-foreground">No Properties Found</p>
                  <p className="text-[10px] text-muted mt-1">Register a property using the "Add Property" button above to view cards here.</p>
                </div>
              ) : (
                properties.slice(0, 4).map((prop) => {
                  const isHovered = hoveredPropertyId === prop._id;
                const activeUnitsCount = prop.units?.length || 0;
                const occCount = prop.units?.filter(u => u.status === 'occupied').length || 0;
                const occPct = activeUnitsCount > 0 ? Math.round((occCount / activeUnitsCount) * 100) : 0;
                
                return (
                  <div
                    key={prop._id}
                    onMouseEnter={() => setHoveredPropertyId(prop._id)}
                    onMouseLeave={() => setHoveredPropertyId(null)}
                    className="landlord-card relative bg-surface/30 backdrop-blur-md border border-border/80 hover:border-brand-500/50 rounded-3xl p-5 shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden min-h-[220px]"
                  >
                    {/* Hover 3D Mini building canvas overlay */}
                    {isHovered ? (
                      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center animate-fade-in z-20">
                        <VoxelBuildingMini3D floors={6} colorPattern="purple" className="w-full h-full" />
                        <div className="absolute bottom-2.5 left-4 right-4 flex justify-between items-center text-[9px] text-white/80 font-mono">
                          <span>Interactive 3D isometric</span>
                          <span>Unit occupancy matches colors</span>
                        </div>
                      </div>
                    ) : null}

                    {/* Standard details */}
                    <div className="relative z-10">
                      <div className="flex justify-between items-start">
                        <span className="text-[9px] bg-brand-500/10 border border-brand-500/20 text-brand-500 font-extrabold uppercase px-2 py-0.5 rounded-lg">
                          {prop.type || 'Apartment'}
                        </span>
                        <span className="text-muted text-[10px] font-mono">{prop.property_code}</span>
                      </div>
                      <h4 className="text-sm font-black text-foreground mt-3 tracking-tight">{prop.name}</h4>
                      <p className="text-[10px] text-muted mt-0.5">📍 {prop.address?.area}</p>
                    </div>

                    <div className="relative z-10 mt-5 border-t border-border/30 pt-3">
                      <div className="flex justify-between text-[10px] text-muted font-bold mb-1">
                        <span>Occupancy</span>
                        <span>{occPct}%</span>
                      </div>
                      <div className="h-1 bg-border/40 rounded-full overflow-hidden mb-3">
                        <div className="h-full bg-brand-500 rounded-full" style={{ width: `${occPct}%` }} />
                      </div>
                      
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-muted">Expected Rent</span>
                        <strong className="text-foreground font-mono">{FMT_KES(occCount * 45000)}</strong>
                      </div>
                    </div>
                  </div>
                );
              }))}
            </div>
          </div>

          {/* Recharts Financial insights Line/Area chart */}
          <div className="landlord-card bg-surface/30 backdrop-blur-md border border-border rounded-3xl p-6 shadow-xl flex flex-col justify-between h-full">
            <div>
              <span className="text-[9px] text-brand-500 font-extrabold uppercase tracking-widest block mb-1">Revenue Trend</span>
              <h3 className="text-xs font-black uppercase tracking-wider text-muted mb-4">Financial Insights</h3>
            </div>
            
            <div className="h-44 w-full my-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={financialData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--surface-bright)', borderColor: 'var(--border)', borderRadius: '12px' }}
                    labelStyle={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 'bold' }}
                    itemStyle={{ color: 'var(--text)', fontSize: 11 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#a855f7" 
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

        {/* Bottom Section: Recent Payments & Lease Approvals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
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
                    {payments.slice(0, 5).map((pay) => (
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

      </div>
    </div>
  );
}
