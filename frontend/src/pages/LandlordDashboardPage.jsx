import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { fetchProperties, fetchTenants, fetchPayments } from '../lib/api';
import {
  Building2, Users2, TrendingUp, DollarSign, Home, PlusCircle,
  ArrowUpRight, BarChart3, CheckCircle2, Clock, AlertTriangle, Eye, UserPlus
} from 'lucide-react';

const FMT_KES = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;

export default function LandlordDashboardPage() {
  const { user: clerkUser } = useUser();
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants]       = useState([]);
  const [payments, setPayments]     = useState([]);
  const [loading, setLoading]       = useState(true);

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
    { label: 'Properties Under Management', value: properties.length, icon: <Building2 size={22} />, color: '#2563EB', sub: `${properties.filter(p => p.status === 'pending_admin_approval').length} pending approval` },
    { label: 'Total Units', value: totalUnits, icon: <Home size={22} />, color: '#10b981', sub: `${vacantUnits} vacant` },
    { label: 'Occupancy Rate', value: `${occupancyRate}%`, icon: <BarChart3 size={22} />, color: '#f59e0b', sub: `${occupiedUnits} of ${totalUnits} occupied` },
    { label: 'Monthly Revenue', value: FMT_KES(monthlyRevenue), icon: <DollarSign size={22} />, color: '#ec4899', sub: 'Confirmed this month' }
  ];

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(37,99,235,0.3)', borderTop: '3px solid #2563EB', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p className="text-slate-500 dark:text-slate-400 text-xs">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/20 dark:from-slate-950 dark:to-slate-900 text-slate-900 dark:text-slate-100 p-7 relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -right-[5%] w-[500px] h-[500px] rounded-full bg-blue-500/10 dark:bg-blue-500/5 blur-[40px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1 className="text-slate-900 dark:text-slate-100 text-2xl sm:text-3xl font-black tracking-tight mb-1">
              Landlord Dashboard
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              Welcome back, {clerkUser?.fullName?.split(' ')[0] || 'Landlord'} — Mombasa, KE
            </p>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <Link to="/properties/add" style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px',
              background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', color: '#fff',
              borderRadius: 14, textDecoration: 'none', fontSize: 14, fontWeight: 700,
              boxShadow: '0 8px 24px rgba(37,99,235,0.4)'
            }}>
              <PlusCircle size={16} /> Add Property
            </Link>
            <Link to="/tenants" style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px',
              background: 'rgba(16,185,129,0.15)', color: '#34d399',
              borderRadius: 14, textDecoration: 'none', fontSize: 14, fontWeight: 700,
              border: '1px solid rgba(16,185,129,0.3)'
            }}>
              <UserPlus size={16} /> Add Tenant
            </Link>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {cards.map((card, i) => (
            <div key={i} className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-6 relative overflow-hidden">
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${card.color}88, ${card.color}22)` }} />
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${card.color}22`, border: `1px solid ${card.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <span style={{ color: card.color }}>{card.icon}</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">{card.label}</p>
              <p className="text-slate-900 dark:text-slate-100 text-2xl font-black tracking-tight mb-1">{card.value}</p>
              <p className="text-slate-450 dark:text-slate-400 text-xs">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Revenue chart + properties */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
          {/* Revenue chart */}
          <div className="lg:col-span-2 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h3 className="text-slate-900 dark:text-slate-100 text-sm font-extrabold mb-5">6-Month Revenue</h3>
            <div className="flex items-end gap-2 h-[120px]">
              {revenueByMonth.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div style={{
                    width: '100%', background: i === 5 ? 'linear-gradient(180deg, #2563EB, #1D4ED8)' : 'rgba(37,99,235,0.3)',
                    borderRadius: '6px 6px 2px 2px', height: `${Math.max((m.total / maxRev) * 90, 4)}px`,
                    boxShadow: i === 5 ? '0 4px 16px rgba(37,99,235,0.4)' : 'none',
                    transition: 'height 0.5s ease'
                  }} />
                  <span className="text-slate-400 dark:text-slate-500 text-xs font-semibold">{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Properties list */}
          <div className="lg:col-span-3 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-900 dark:text-slate-100 text-sm font-extrabold">Your Properties</h3>
              <Link to="/properties" className="text-blue-600 dark:text-blue-400 text-xs font-bold no-underline flex items-center gap-1">
                View All <ArrowUpRight size={14} />
              </Link>
            </div>
            {properties.length === 0 ? (
              <div className="text-center py-8">
                <Building2 size={36} className="text-slate-300 dark:text-slate-700 mx-auto mb-2.5" />
                <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">No properties yet</p>
                <Link to="/properties/add" className="text-blue-600 dark:text-blue-400 text-xs font-bold">Add your first property →</Link>
              </div>
            ) : properties.slice(0, 5).map(prop => {
              const propUnits = prop.units?.length || 0;
              const propOccupied = prop.units?.filter(u => u.status === 'occupied').length || 0;
              const occ = propUnits > 0 ? Math.round((propOccupied / propUnits) * 100) : 0;
              const propPhoto = (prop.photos || [])[0] || null;
              return (
                <div key={prop._id} className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-slate-800/60 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {propPhoto
                        ? <img src={propPhoto} alt={prop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <Building2 size={18} className="text-blue-600 dark:text-blue-500" />}
                    </div>
                    <div>
                      <p className="text-slate-900 dark:text-slate-100 text-xs font-bold mb-0.5">{prop.name}</p>
                      <p className="text-slate-500 dark:text-slate-400 text-xs">{prop.address?.area} · {propUnits} units · {propOccupied} occupied</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {prop.status === 'pending_admin_approval' ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">Pending</span>
                    ) : (
                      <div className="text-right min-w-[48px]">
                        <p className="text-slate-900 dark:text-slate-100 text-xs font-bold">{occ}%</p>
                        <p className="text-slate-400 dark:text-slate-500 text-xs">Occupancy</p>
                      </div>
                    )}
                    <Link to={`/properties/${prop._id}`} className="bg-blue-100 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-450 rounded-lg px-2.5 py-1 text-xs font-bold no-underline flex items-center gap-1 flex-shrink-0">
                      <Eye size={12} /> View
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tenants */}
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-900 dark:text-slate-100 text-sm font-extrabold">Active Tenants ({tenants.filter(t => t.tenancy_status === 'active').length})</h3>
            <Link to="/tenants" className="text-blue-600 dark:text-blue-400 text-xs font-bold no-underline flex items-center gap-1">
              Manage <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {tenants.filter(t => t.tenancy_status === 'active').slice(0, 6).map(t => (
              <div key={t._id} className="bg-slate-100/50 dark:bg-slate-900/40 rounded-xl p-4 border border-slate-200/60 dark:border-slate-800/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-extrabold text-xs flex-shrink-0">
                    {t.full_name?.charAt(0) || 'T'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-900 dark:text-slate-100 text-xs font-bold truncate">{t.full_name}</p>
                    <p className="text-slate-500 dark:text-slate-400 text-xs">{t.tenant_code} · {FMT_KES(t.rent_amount_kes)}/mo</p>
                  </div>
                </div>
                {t.arrears_kes > 0 && (
                  <div className="mt-2.5 px-2.5 py-1.5 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg flex items-center gap-1.5">
                    <AlertTriangle size={12} className="text-red-500 dark:text-red-400" />
                    <span className="text-red-600 dark:text-red-400 text-xs font-semibold">Arrears: {FMT_KES(t.arrears_kes)}</span>
                  </div>
                )}
              </div>
            ))}
            {tenants.filter(t => t.tenancy_status === 'active').length === 0 && (
              <p className="text-slate-500 dark:text-slate-400 text-xs col-span-full text-center py-6">No active tenants</p>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
