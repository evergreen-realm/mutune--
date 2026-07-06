import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { fetchProperties, fetchTenants, fetchPayments } from '../lib/api';
import { useThemeStore } from '../store/themeStore';
import {
  Building2, Users2, TrendingUp, DollarSign, Home, PlusCircle,
  ArrowUpRight, BarChart3, CheckCircle2, Clock, AlertTriangle, Eye, UserPlus
} from 'lucide-react';

const FMT_KES = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;

export default function LandlordDashboardPage() {
  const { user: clerkUser } = useUser();
  const { theme } = useThemeStore();
  
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants]       = useState([]);
  const [payments, setPayments]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activePropertyIndex, setActivePropertyIndex] = useState(0);

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

  // Derived metrics
  const totalUnits    = properties.reduce((s, p) => s + (p.units?.length || 0), 0);
  const occupiedUnits = properties.reduce((s, p) => s + (p.units?.filter(u => u.status === 'occupied').length || 0), 0);
  const vacantUnits   = totalUnits - occupiedUnits;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
  
  const monthlyRevenue = payments.filter(p => {
    const d = new Date(p.created_at);
    const now = new Date();
    return p.status === 'confirmed' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, p) => s + Number(p.amount_kes || 0), 0);

  // Revenue by month for simple sparkline (last 6 months)
  const revenueByMonth = (() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const total = payments.filter(p => {
        return p.status === 'confirmed' && p.created_at?.startsWith(key);
      }).reduce((s, p) => s + Number(p.amount_kes || 0), 0);
      months.push({ label: d.toLocaleString('en-KE', { month: 'short' }), total });
    }
    return months;
  })();

  const maxRev = Math.max(...revenueByMonth.map(m => m.total), 1);

  const cards = [
    { label: 'Properties Under Management', value: properties.length, icon: <Building2 size={22} />, color: 'primary', sub: `${properties.filter(p => p.status === 'pending_admin_approval').length} pending approval` },
    { label: 'Total Units', value: totalUnits, icon: <Home size={22} />, color: 'success', sub: `${vacantUnits} vacant` },
    { label: 'Occupancy Rate', value: `${occupancyRate}%`, icon: <BarChart3 size={22} />, color: 'warning', sub: `${occupiedUnits} of ${totalUnits} occupied` },
    { label: 'Monthly Revenue', value: FMT_KES(monthlyRevenue), icon: <DollarSign size={22} />, color: 'pink', sub: 'Confirmed this month' }
  ];

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-3 border-primary/30 border-t-primary animate-spin mx-auto mb-4" />
          <p className="text-muted text-xs font-semibold">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  const activeProperty = properties[activePropertyIndex] || null;

  return (
    <div className="relative overflow-hidden pb-12">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-900/10 blur-[130px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[450px] h-[450px] rounded-full bg-emerald-950/10 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto px-2 sm:px-4 pt-2">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4 border-b border-border/40 pb-5">
          <div>
            <span className="text-[10px] text-primary font-extrabold uppercase tracking-widest block mb-1">Overview</span>
            <h1 className="text-slate-900 dark:text-slate-100 text-2xl sm:text-3xl font-black tracking-tight mb-1">
              Landlord Dashboard
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              Welcome back, {clerkUser?.fullName?.split(' ')[0] || 'Landlord'} — Mombasa, KE
            </p>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <Link to="/properties/add" className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-550 text-white rounded-xl text-xs font-bold transition shadow-lg uppercase tracking-wider cursor-pointer active:scale-95">
              <PlusCircle size={14} /> Add Property
            </Link>
            <Link to="/tenants" className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold transition hover:bg-emerald-500/15 uppercase tracking-wider cursor-pointer active:scale-95">
              <UserPlus size={14} /> Add Tenant
            </Link>
          </div>
        </div>

        {/* ── Welcome Property Photo Slider (Zillow Style) ─────────────────── */}
        {properties.length > 0 && (
          <div className="bg-surface/30 backdrop-blur-md border border-border rounded-[24px] overflow-hidden shadow-xl mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
              {/* Photo Side */}
              <div className="lg:col-span-2 relative rounded-2xl overflow-hidden aspect-[16/10] md:h-72 border border-border/20 shadow-md bg-slate-950">
                {activeProperty?.photos?.[0] ? (
                  <img
                    src={activeProperty.photos[0]}
                    alt={activeProperty.name}
                    className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-950/50 to-slate-900/50 flex flex-col items-center justify-center text-muted gap-2">
                    <Building2 size={40} className="text-primary animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">No Photo Available</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-4 left-4">
                  <span className="bg-primary/95 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-primary/20 shadow-md">
                    {activeProperty?.type?.replace('_', ' ')}
                  </span>
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-tight mt-2">
                    {activeProperty?.name}
                  </h2>
                  <p className="text-xs text-slate-300 font-medium mt-1">
                    {activeProperty?.address?.street}, {activeProperty?.address?.area}
                  </p>
                </div>
              </div>

              {/* Side controls & facts */}
              <div className="flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">Portfolio Properties</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {properties.map((p, idx) => (
                      <button
                        key={p._id}
                        onClick={() => setActivePropertyIndex(idx)}
                        className={`w-full p-3 rounded-xl border text-left transition duration-300 flex items-center justify-between gap-3 ${
                          idx === activePropertyIndex
                            ? 'bg-primary/10 border-primary/45 text-primary'
                            : 'bg-background/40 border-border/60 hover:bg-background/70 text-foreground'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{p.name}</p>
                          <p className="text-[10px] text-muted truncate mt-0.5">{p.address?.area} · {p.units?.length || 0} Units</p>
                        </div>
                        <ChevronRight size={14} className="text-muted flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                {activeProperty && (
                  <div className="border-t border-border/40 pt-4 flex gap-4 text-center">
                    <div className="flex-1 bg-background/30 p-2.5 rounded-xl border border-border">
                      <span className="text-lg font-black text-foreground">{activeProperty.units?.length || 0}</span>
                      <span className="text-[9px] text-muted font-bold uppercase tracking-wider block mt-0.5">Units</span>
                    </div>
                    <div className="flex-1 bg-background/30 p-2.5 rounded-xl border border-border">
                      <span className="text-lg font-black text-emerald-400">
                        {activeProperty.units?.filter(u => u.status === 'occupied').length || 0}
                      </span>
                      <span className="text-[9px] text-muted font-bold uppercase tracking-wider block mt-0.5">Occupied</span>
                    </div>
                    <Link
                      to={`/properties/${activeProperty._id}`}
                      className="flex-1 bg-primary/15 hover:bg-primary/20 border border-primary/30 text-primary rounded-xl flex flex-col items-center justify-center gap-1 font-bold text-[10px] uppercase tracking-wider no-underline transition"
                    >
                      <Eye size={16} /> View Detail
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {cards.map((card, i) => {
            const isSuccess = card.color === 'success';
            const isWarning = card.color === 'warning';
            const isPink    = card.color === 'pink';

            const borderTint = isSuccess ? 'border-emerald-500/20' 
                             : isWarning ? 'border-amber-500/20'
                             : isPink ? 'border-pink-500/20'
                             : 'border-primary/20';

            const textClass = isSuccess ? 'text-emerald-400' 
                            : isWarning ? 'text-amber-400'
                            : isPink ? 'text-pink-400'
                            : 'text-primary';

            return (
              <div key={i} className={`bg-surface/30 backdrop-blur-md border ${borderTint} rounded-2xl p-6 relative overflow-hidden shadow-md`}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] text-muted font-bold uppercase tracking-wider">{card.label}</p>
                  <div className={`w-10 h-10 rounded-xl bg-background/40 border border-border flex items-center justify-center ${textClass}`}>
                    {card.icon}
                  </div>
                </div>
                <p className="text-slate-900 dark:text-slate-100 text-2xl font-black tracking-tight mb-1">{card.value}</p>
                <p className="text-slate-400 dark:text-slate-500 text-xs font-semibold">{card.sub}</p>
              </div>
            );
          })}
        </div>

        {/* Revenue chart + properties */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
          {/* Revenue chart */}
          <div className="lg:col-span-2 bg-surface/30 backdrop-blur-md border border-border rounded-2xl p-6 shadow-md flex flex-col justify-between">
            <div>
              <h3 className="text-foreground text-xs font-bold uppercase tracking-wider mb-1">6-Month Revenue Trend</h3>
              <p className="text-[10px] text-muted mb-6">Confirmed collections KES</p>
            </div>
            <div className="flex items-end gap-2 h-[140px] pt-4">
              {revenueByMonth.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div className="relative w-full group">
                    <div
                      style={{ height: `${Math.max((m.total / maxRev) * 110, 6)}px` }}
                      className={`w-full rounded-t-lg transition-all duration-500 ${
                        i === 5
                          ? 'bg-gradient-to-t from-primary to-indigo-600 shadow-lg shadow-primary/30'
                          : 'bg-primary/25 hover:bg-primary/45'
                      }`}
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-slate-950 text-white text-[9px] font-bold px-1.5 py-0.5 rounded border border-border pointer-events-none">
                      {FMT_KES(m.total)}
                    </div>
                  </div>
                  <span className="text-muted text-[10px] font-bold uppercase tracking-wider">{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Properties list */}
          <div className="lg:col-span-3 bg-surface/30 backdrop-blur-md border border-border rounded-2xl p-6 shadow-md">
            <div className="flex items-center justify-between mb-4 border-b border-border/40 pb-3">
              <h3 className="text-foreground text-xs font-bold uppercase tracking-wider">Your Properties</h3>
              <Link to="/properties" className="text-primary text-xs font-bold no-underline flex items-center gap-1 hover:text-indigo-400 transition">
                View All <ArrowUpRight size={14} />
              </Link>
            </div>
            {properties.length === 0 ? (
              <div className="text-center py-8">
                <Building2 size={36} className="text-muted mx-auto mb-2.5" />
                <p className="text-muted text-xs mb-1">No properties yet</p>
                <Link to="/properties/add" className="text-primary text-xs font-bold">Add your first property →</Link>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {properties.slice(0, 4).map(prop => {
                  const propUnits = prop.units?.length || 0;
                  const propOccupied = prop.units?.filter(u => u.status === 'occupied').length || 0;
                  const occ = propUnits > 0 ? Math.round((propOccupied / propUnits) * 100) : 0;
                  const propPhoto = (prop.photos || [])[0] || null;
                  return (
                    <div key={prop._id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                          {propPhoto ? (
                            <img src={propPhoto} alt={prop.name} className="w-full h-full object-cover" />
                          ) : (
                            <Building2 size={18} className="text-primary" />
                          )}
                        </div>
                        <div>
                          <p className="text-foreground text-xs font-bold mb-0.5">{prop.name}</p>
                          <p className="text-muted text-[10px] font-medium">{prop.address?.area} · {propUnits} units · {propOccupied} occupied</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        {prop.status === 'pending_admin_approval' ? (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">Pending</span>
                        ) : (
                          <div className="text-right min-w-[48px]">
                            <p className="text-foreground text-xs font-bold">{occ}%</p>
                            <p className="text-[9px] text-muted font-bold uppercase tracking-wider mt-0.5">Occupancy</p>
                          </div>
                        )}
                        <Link to={`/properties/${prop._id}`} className="bg-background hover:bg-surface border border-border text-muted hover:text-foreground rounded-lg px-2.5 py-1 text-xs font-bold no-underline flex items-center gap-1 flex-shrink-0 transition">
                          <Eye size={12} /> View
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Tenants list */}
        <div className="bg-surface/30 backdrop-blur-md border border-border rounded-2xl p-6 shadow-md mb-8">
          <div className="flex items-center justify-between mb-4 border-b border-border/40 pb-3">
            <h3 className="text-foreground text-xs font-bold uppercase tracking-wider">
              Active Tenants ({tenants.filter(t => t.tenancy_status === 'active').length})
            </h3>
            <Link to="/tenants" className="text-primary text-xs font-bold no-underline flex items-center gap-1 hover:text-indigo-400 transition">
              Manage Tenants <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {tenants.filter(t => t.tenancy_status === 'active').slice(0, 6).map(t => (
              <div key={t._id} className="bg-background/40 border border-border rounded-xl p-4 flex flex-col justify-between hover:border-primary/40 transition duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white font-extrabold text-xs flex-shrink-0 shadow-md">
                    {t.full_name?.charAt(0) || 'T'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground text-xs font-bold truncate">{t.full_name}</p>
                    <p className="text-muted text-[10px] font-medium truncate mt-0.5">
                      Code: {t.tenant_code} · <span className="font-bold text-foreground">{FMT_KES(t.rent_amount_kes)}/mo</span>
                    </p>
                  </div>
                </div>
                {t.arrears_kes > 0 && (
                  <div className="mt-3 px-2.5 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-1.5">
                    <AlertTriangle size={12} className="text-red-400" />
                    <span className="text-red-400 text-[10px] font-black uppercase tracking-wider">Arrears: {FMT_KES(t.arrears_kes)}</span>
                  </div>
                )}
              </div>
            ))}
            {tenants.filter(t => t.tenancy_status === 'active').length === 0 && (
              <p className="text-muted text-xs col-span-full text-center py-6">No active tenants found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
