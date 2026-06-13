import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { fetchProperties, fetchTenants, fetchPayments } from '../lib/api';
import {
  Building2, Users2, TrendingUp, DollarSign, Home, PlusCircle,
  ArrowUpRight, BarChart3, CheckCircle2, Clock, AlertTriangle, Eye
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
    { label: 'Total Properties', value: properties.length, icon: <Building2 size={22} />, color: '#6366f1', sub: `${properties.filter(p => p.status === 'pending_admin_approval').length} pending approval` },
    { label: 'Total Units', value: totalUnits, icon: <Home size={22} />, color: '#10b981', sub: `${vacantUnits} vacant` },
    { label: 'Occupancy Rate', value: `${occupancyRate}%`, icon: <BarChart3 size={22} />, color: '#f59e0b', sub: `${occupiedUnits} of ${totalUnits} occupied` },
    { label: 'Monthly Revenue', value: FMT_KES(monthlyRevenue), icon: <DollarSign size={22} />, color: '#ec4899', sub: 'Confirmed this month' }
  ];

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f0c29, #24243e)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.3)', borderTop: '3px solid #6366f1', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)', padding: '28px' }}>
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>
              Landlord Dashboard
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>
              Welcome back, {clerkUser?.fullName?.split(' ')[0] || 'Landlord'} — Mombasa, KE
            </p>
          </div>
          <Link to="/properties/landlord/add" style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
            borderRadius: 14, textDecoration: 'none', fontSize: 14, fontWeight: 700,
            boxShadow: '0 8px 24px rgba(99,102,241,0.4)'
          }}>
            <PlusCircle size={16} /> Add Property
          </Link>
        </div>

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 20, marginBottom: 32 }}>
          {cards.map((card, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 24,
              position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${card.color}88, ${card.color}22)` }} />
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${card.color}22`, border: `1px solid ${card.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <span style={{ color: card.color }}>{card.icon}</span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{card.label}</p>
              <p style={{ color: '#fff', fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>{card.value}</p>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Revenue chart + properties */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 24, marginBottom: 24 }}>
          {/* Revenue chart */}
          <div style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 24 }}>
            <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 800, marginBottom: 20 }}>6-Month Revenue</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
              {revenueByMonth.map((m, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: '100%', background: i === 5 ? 'linear-gradient(180deg, #6366f1, #8b5cf6)' : 'rgba(99,102,241,0.3)',
                    borderRadius: '6px 6px 2px 2px', height: `${Math.max((m.total / maxRev) * 90, 4)}px`,
                    boxShadow: i === 5 ? '0 4px 16px rgba(99,102,241,0.5)' : 'none',
                    transition: 'height 0.5s ease'
                  }} />
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: 600 }}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Properties list */}
          <div style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 800 }}>Your Properties</h3>
              <Link to="/properties" style={{ color: '#6366f1', fontSize: 12, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                View All <ArrowUpRight size={14} />
              </Link>
            </div>
            {properties.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <Building2 size={36} style={{ color: 'rgba(255,255,255,0.15)', margin: '0 auto 10px' }} />
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No properties yet</p>
                <Link to="/properties/landlord/add" style={{ color: '#6366f1', fontSize: 13, fontWeight: 700 }}>Add your first property →</Link>
              </div>
            ) : properties.slice(0, 5).map(prop => {
              const propUnits = prop.units?.length || 0;
              const propOccupied = prop.units?.filter(u => u.status === 'occupied').length || 0;
              const occ = propUnits > 0 ? Math.round((propOccupied / propUnits) * 100) : 0;
              return (
                <div key={prop._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Building2 size={18} style={{ color: '#6366f1' }} />
                    </div>
                    <div>
                      <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{prop.name}</p>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{prop.address?.area} · {propUnits} units</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {prop.status === 'pending_admin_approval' ? (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>Pending</span>
                    ) : (
                      <>
                        <p style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{occ}%</p>
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>Occupancy</p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tenants */}
        <div style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 800 }}>Active Tenants ({tenants.filter(t => t.tenancy_status === 'active').length})</h3>
            <Link to="/tenants" style={{ color: '#6366f1', fontSize: 12, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              Manage <ArrowUpRight size={14} />
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
            {tenants.filter(t => t.tenancy_status === 'active').slice(0, 6).map(t => (
              <div key={t._id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                    {t.full_name?.charAt(0) || 'T'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, truncate: true, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.full_name}</p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{t.tenant_code} · {FMT_KES(t.rent_amount_kes)}/mo</p>
                  </div>
                </div>
                {t.arrears_kes > 0 && (
                  <div style={{ marginTop: 10, padding: '6px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={12} style={{ color: '#f87171' }} />
                    <span style={{ color: '#f87171', fontSize: 11, fontWeight: 600 }}>Arrears: {FMT_KES(t.arrears_kes)}</span>
                  </div>
                )}
              </div>
            ))}
            {tenants.filter(t => t.tenancy_status === 'active').length === 0 && (
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, gridColumn: '1/-1', textAlign: 'center', padding: '24px 0' }}>No active tenants</p>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
