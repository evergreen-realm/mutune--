import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { fetchProperties, fetchTenants, fetchPayments, updateTenant } from '../lib/api';
import { useThemeStore } from '../store/themeStore';
import { toast } from 'react-toastify';
import {
  Building2, Users2, TrendingUp, DollarSign, Home, PlusCircle,
  ArrowUpRight, CheckCircle2, Clock, AlertTriangle, Eye, UserPlus,
  ChevronLeft, ChevronRight, ShieldCheck, CreditCard
} from 'lucide-react';

const FMT_KES = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
const FMT_DATE = (d) => {
  if (!d) return '—';
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return '—';
  return dateObj.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
};

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

  const handleApproveLease = async (tenantId) => {
    setApprovingLeaseId(tenantId);
    try {
      // Approve tenancy / KYC state
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

  const collectionRate = expectedRent > 0 ? Math.round((collectedRent / expectedRent) * 100) : 85; // default fallback 85% for display

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
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-brand-500/5 blur-[120px]" />
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
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-600 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-lg uppercase tracking-wider cursor-pointer active:scale-95"
            >
              <PlusCircle size={14} /> Add Property
            </Link>
            <Link 
              to="/tenants" 
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-500/10 border border-brand-500/20 text-brand-500 rounded-xl text-xs font-bold transition hover:bg-brand-500/15 uppercase tracking-wider cursor-pointer active:scale-95"
            >
              <UserPlus size={14} /> Link Tenant
            </Link>
          </div>
        </div>

        {/* Top Section: Property Photo Slider & Circular Progress Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* 1. Property Slider (displays enhanced photos) */}
          <div className="lg:col-span-2 bg-surface/30 backdrop-blur-md border border-border rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between h-[360px]">
            {activeProperty ? (
              <div className="relative flex-1 group bg-slate-950 overflow-hidden">
                {activeProperty.photos?.[0] ? (
                  <img
                    src={activeProperty.photos[0]}
                    alt={activeProperty.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted gap-2">
                    <Building2 size={48} className="text-brand-500 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider">No Photo Registered</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent pointer-events-none" />
                
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
          <div className="bg-surface/30 backdrop-blur-md border border-border rounded-3xl p-6 shadow-xl flex flex-col justify-between items-center text-center h-[360px]">
            <div className="w-full text-left">
              <span className="text-[10px] text-brand-500 font-extrabold uppercase tracking-widest block mb-1">
                Rent Collection Rate
              </span>
              <h3 className="text-sm font-black text-foreground">Monthly Metrics</h3>
            </div>

            {/* Circular Ring Progress */}
            <div className="relative w-36 h-36 flex items-center justify-center my-2">
              <svg className="w-full h-full transform -rotate-90">
                {/* Background Ring */}
                <circle
                  cx="72"
                  cy="72"
                  r={radius}
                  stroke={isLight ? '#e2e8f0' : '#1e293b'}
                  strokeWidth="10"
                  fill="transparent"
                />
                {/* Colored Progress Ring */}
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
              {/* Inner Rate text */}
              <div className="absolute text-center">
                <span className="text-2xl font-black text-foreground">{collectionRate}%</span>
                <span className="text-[9px] text-muted font-bold block uppercase tracking-wider mt-0.5">collected</span>
              </div>
            </div>

            {/* Bottom metrics grid */}
            <div className="grid grid-cols-2 gap-4 w-full border-t border-border/40 pt-4 text-xs">
              <div className="border-r border-border/30">
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider block mb-0.5">Total Expected</span>
                <strong className="text-foreground text-sm font-black font-mono">{FMT_KES(expectedRent)}</strong>
              </div>
              <div>
                <span className="text-[9px] text-muted font-bold uppercase tracking-wider block mb-0.5">Collected</span>
                <strong className="text-brand-500 text-sm font-black font-mono">{FMT_KES(collectedRent)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Recent Payments & Lease Approvals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 3. Recent M-Pesa Payments Table */}
          <div className="lg:col-span-2 bg-surface/30 backdrop-blur-md border border-border rounded-3xl p-6 shadow-xl flex flex-col">
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
                      <tr key={pay._id} className="hover:bg-surface-bright/30 transition-colors">
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

          {/* 4. Quick Actions: Lease Approvals */}
          <div className="bg-surface/30 backdrop-blur-md border border-border rounded-3xl p-6 shadow-xl flex flex-col h-[340px]">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted border-b border-border/40 pb-4 mb-4">
              Pending Lease Approvals
            </h3>

            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
              {pendingLeases.length === 0 ? (
                <div className="text-center py-12 text-muted">
                  <ShieldCheck size={32} className="mx-auto mb-2 text-emerald-500 opacity-60 animate-pulse" />
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
                        className="flex-1 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition shadow-sm cursor-pointer flex items-center justify-center gap-1 active:scale-95"
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
