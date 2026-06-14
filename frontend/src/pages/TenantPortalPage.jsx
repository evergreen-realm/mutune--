import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  fetchMyProfile, fetchMyPayments, fetchMyNotices,
  createMaintenanceTicket, fetchMyTickets,
  fetchNotifications, markNotifRead, markAllNotifsRead,
  fetchCustomerCareNumber, autoInitiatePayment
} from '../lib/api';
import {
  Home, Wallet, Wrench, FileText, Bell, ChevronRight,
  CheckCircle2, AlertTriangle, Clock, TrendingUp, Star,
  Phone, Mail, MapPin, Calendar, CreditCard, Activity,
  ArrowUpRight, Plus, X, ZoomIn
} from 'lucide-react';

const FMT_KES = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
const FMT_DATE = (d) => d ? new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const statusColor = (s) => ({
  confirmed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  pending:   'bg-amber-500/15 text-amber-400 border-amber-500/20',
  failed:    'bg-red-500/15 text-red-400 border-red-500/20'
}[s] || 'bg-slate-500/15 text-slate-400 border-slate-500/20');

const ticketStatusColor = (s) => ({
  open:        'bg-blue-500/15 text-blue-400',
  in_progress: 'bg-amber-500/15 text-amber-400',
  resolved:    'bg-emerald-500/15 text-emerald-400',
  closed:      'bg-slate-500/15 text-slate-400'
}[s] || 'bg-slate-500/15 text-slate-400');

export default function TenantPortalPage() {
  const { user: clerkUser } = useUser();

  const [profile,    setProfile]    = useState(null);
  const [payments,   setPayments]   = useState([]);
  const [notices,    setNotices]    = useState([]);
  const [tickets,    setTickets]    = useState([]);
  const [notifs,     setNotifs]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState('overview');
  const [notifOpen,  setNotifOpen]  = useState(false);
  const [ticketForm, setTicketForm] = useState({ open: false, title: '', description: '', priority: 'medium' });
  const [submitting, setSubmitting] = useState(false);

  const [customerCare, setCustomerCare] = useState('254700000000');
  const [paying, setPaying] = useState(false);

  const handlePayRent = async () => {
    setPaying(true);
    const toastId = toast.loading('Initiating rent payment STK push...');
    try {
      const res = await autoInitiatePayment();
      if (res?.success) {
        toast.update(toastId, { render: 'Payment request sent! Please enter your PIN on your handset.', type: 'success', isLoading: false, autoClose: 5000 });
      } else {
        toast.update(toastId, { render: res?.message || 'STK Push failed to initiate.', type: 'error', isLoading: false, autoClose: 5000 });
      }
      load();
    } catch (err) {
      toast.update(toastId, { render: err?.error?.message || 'Failed to initiate payment.', type: 'error', isLoading: false, autoClose: 5000 });
    } finally {
      setPaying(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, pay, n, t, notif, cc] = await Promise.allSettled([
        fetchMyProfile(),
        fetchMyPayments(),
        fetchMyNotices(),
        fetchMyTickets(),
        fetchNotifications(),
        fetchCustomerCareNumber()
      ]);
      if (p.status === 'fulfilled') setProfile(p.value?.data || null);
      if (pay.status === 'fulfilled') setPayments(Array.isArray(pay.value?.data) ? pay.value.data : []);
      if (n.status === 'fulfilled') setNotices(Array.isArray(n.value?.data) ? n.value.data : []);
      if (t.status === 'fulfilled') setTickets(Array.isArray(t.value?.data) ? t.value.data : []);
      if (notif.status === 'fulfilled') setNotifs(Array.isArray(notif.value?.data) ? notif.value.data : []);
      if (cc.status === 'fulfilled' && cc.value?.number) {
        setCustomerCare(cc.value.number);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const lastPayment = payments.find(p => p.status === 'confirmed') || payments[0] || null;
  const arrears     = Number(profile?.arrears_kes || 0);
  const rent        = Number(profile?.rent_amount_kes || 0);
  const unread      = notifs.filter(n => !n.read_by?.includes(clerkUser?.id)).length;

  const handleMarkAllRead = async () => {
    await markAllNotifsRead().catch(() => {});
    setNotifs(prev => prev.map(n => ({ ...n, read_by: [...(n.read_by || []), clerkUser?.id] })));
  };

  const handleNotifClick = async (notif) => {
    if (!notif.read_by?.includes(clerkUser?.id)) {
      await markNotifRead(notif._id).catch(() => {});
      setNotifs(prev => prev.map(n => n._id === notif._id ? { ...n, read_by: [...(n.read_by || []), clerkUser?.id] } : n));
    }
  };

  const submitTicket = async () => {
    if (!ticketForm.title.trim() || !ticketForm.description.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    setSubmitting(true);
    try {
      await createMaintenanceTicket({
        title: ticketForm.title.trim(),
        description: ticketForm.description.trim(),
        priority: ticketForm.priority
      });
      toast.success('Maintenance request submitted!');
      setTicketForm({ open: false, title: '', description: '', priority: 'medium' });
      load();
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            border: '3px solid rgba(99,102,241,0.3)',
            borderTop: '3px solid #6366f1',
            animation: 'spin 1s linear infinite', margin: '0 auto 16px'
          }} />
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Loading your portal…</p>
        </div>
      </div>
    );
  }

  const unitNumber = profile?.unit_number || profile?.unit_id || 'N/A';
  const propertyName = profile?.current_property_id?.name || 'Your Property';
  const propertyArea = profile?.current_property_id?.address?.area || 'Mombasa';
  const tenantName = profile?.full_name || clerkUser?.fullName || 'Tenant';

  const tabs = [
    { key: 'overview',  label: 'Overview',   icon: <Home size={14} /> },
    { key: 'payments',  label: 'Payments',   icon: <CreditCard size={14} /> },
    { key: 'tickets',   label: 'Maintenance',icon: <Wrench size={14} /> },
    { key: 'notices',   label: 'Notices',    icon: <FileText size={14} /> }
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)', position: 'relative' }}>
      {/* Animated background orbs */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', top: '40%', left: '40%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, padding: '24px', maxWidth: 1100, margin: '0 auto' }}>

        {/* ── HERO HERO CARD ── */}
        <div style={{
          borderRadius: 24, overflow: 'hidden', marginBottom: 28,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(139,92,246,0.2) 50%, rgba(16,185,129,0.15) 100%)',
          backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 32px 64px rgba(0,0,0,0.4)'
        }}>
          {/* Building top band */}
          <div style={{ background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #10b981 100%)', height: 6 }} />

          <div style={{ padding: '32px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              {/* Building silhouette icon */}
              <div style={{
                width: 80, height: 80, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.4), rgba(139,92,246,0.4))',
                border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
                flexShrink: 0
              }}>
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                  <rect x="4" y="10" width="36" height="34" rx="3" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
                  <rect x="8" y="14" width="6" height="6" rx="1" fill="rgba(16,185,129,0.7)"/>
                  <rect x="18" y="14" width="6" height="6" rx="1" fill="rgba(16,185,129,0.7)"/>
                  <rect x="28" y="14" width="6" height="6" rx="1" fill="rgba(16,185,129,0.5)"/>
                  <rect x="8" y="24" width="6" height="6" rx="1" fill="rgba(255,255,255,0.3)"/>
                  <rect x="18" y="24" width="6" height="6" rx="1" fill="rgba(99,102,241,0.8)"/>
                  <rect x="28" y="24" width="6" height="6" rx="1" fill="rgba(255,255,255,0.3)"/>
                  <rect x="16" y="34" width="10" height="10" rx="2" fill="rgba(16,185,129,0.6)"/>
                  <rect x="10" y="2" width="24" height="10" rx="2" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
                </svg>
              </div>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  {propertyArea} · {propertyName}
                </p>
                <h1 style={{ color: '#fff', fontSize: 32, fontWeight: 900, lineHeight: 1, marginBottom: 6, letterSpacing: '-0.02em' }}>
                  Unit <span style={{ background: 'linear-gradient(135deg, #a78bfa, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{unitNumber}</span>
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: 500 }}>
                  Welcome back, {tenantName.split(' ')[0]} 👋
                </p>
              </div>
            </div>

            {/* Unit badge & quick stats */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {/* Rent amount */}
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.1)', minWidth: 130 }}>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Monthly Rent</p>
                <p style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{FMT_KES(rent)}</p>
                <p style={{ color: arrears > 0 ? '#f87171' : '#34d399', fontSize: 11, fontWeight: 600, marginTop: 2 }}>
                  {arrears > 0 ? `Arrears: ${FMT_KES(arrears)}` : '✓ All Clear'}
                </p>
              </div>

              {/* Last payment */}
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.1)', minWidth: 130 }}>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Last Payment</p>
                <p style={{ color: '#34d399', fontSize: 13, fontWeight: 700 }}>
                  {lastPayment ? FMT_KES(lastPayment.amount_kes) : '—'}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
                  {lastPayment ? FMT_DATE(lastPayment.created_at) : 'No payments yet'}
                </p>
              </div>

              {/* Lease end */}
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.1)', minWidth: 130 }}>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Lease End</p>
                <p style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>
                  {FMT_DATE(profile?.lease_end_date)}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
                  Status: <span style={{ color: profile?.tenancy_status === 'active' ? '#34d399' : '#f87171', fontWeight: 700, textTransform: 'capitalize' }}>{profile?.tenancy_status || 'Active'}</span>
                </p>
              </div>
            </div>

            {/* Notification bell */}
            <button onClick={() => setNotifOpen(true)} style={{
              position: 'relative', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 12, padding: 12, cursor: 'pointer', color: '#fff',
              transition: 'all 0.2s'
            }}>
              <Bell size={20} />
              {unread > 0 && (
                <span style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #1a1a2e' }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
          </div>

          {/* Tab bar */}
          <div style={{ padding: '0 36px 20px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, transition: 'all 0.2s',
                background: activeTab === tab.key ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.06)',
                color: activeTab === tab.key ? '#fff' : 'rgba(255,255,255,0.5)',
                boxShadow: activeTab === tab.key ? '0 4px 16px rgba(99,102,241,0.4)' : 'none'
              }}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── TAB CONTENT ── */}

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {/* Quick Actions */}
            {[
              { label: 'Pay Rent', desc: paying ? 'Initiating...' : 'M-Pesa STK push', icon: <Wallet size={20} />, color: '#10b981', action: handlePayRent },
              { label: 'Maintenance', desc: 'Submit a request', icon: <Wrench size={20} />, color: '#6366f1', action: () => setTicketForm(f => ({ ...f, open: true })) },
              { label: 'View Notices', desc: `${notices.length} notices`, icon: <FileText size={20} />, color: '#f59e0b', action: () => setActiveTab('notices') },
              { label: 'Contact Agent', desc: customerCare, icon: <Phone size={20} />, color: '#ec4899', href: `tel:${customerCare}` }
            ].map((item, i) => {
              const cardStyle = {
                background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 20, padding: 24, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none',
                width: '100%', boxSizing: 'border-box'
              };
              const content = (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${item.color}22`, border: `1px solid ${item.color}44` }}>
                    <span style={{ color: item.color }}>{item.icon}</span>
                  </div>
                  <div>
                    <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{item.label}</p>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{item.desc}</p>
                  </div>
                </div>
              );

              if (item.href) {
                return (
                  <a key={i} href={item.href} style={cardStyle}>
                    {content}
                    <ChevronRight size={18} style={{ color: 'rgba(255,255,255,0.3)' }} />
                  </a>
                );
              }

              return (
                <button key={i} onClick={item.action} disabled={item.label === 'Pay Rent' && paying} style={{ ...cardStyle, opacity: (item.label === 'Pay Rent' && paying) ? 0.6 : 1 }}>
                  {content}
                  <ChevronRight size={18} style={{ color: 'rgba(255,255,255,0.3)' }} />
                </button>
              );
            })}

            {/* Recent payments */}
            <div style={{ gridColumn: '1/-1', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Recent Payments</h3>
                <button onClick={() => setActiveTab('payments')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  View All <ArrowUpRight size={14} />
                </button>
              </div>
              {payments.slice(0, 4).length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No payment records found</p>
              ) : payments.slice(0, 4).map(p => (
                <div key={p._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle2 size={16} style={{ color: '#6366f1' }} />
                    </div>
                    <div>
                      <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{FMT_KES(p.amount_kes)}</p>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{FMT_DATE(p.created_at)}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 100, border: '1px solid', ...Object.fromEntries(Object.entries(statusColor(p.status)).map(([k]) => [k, ''])) }} className={statusColor(p.status)}>
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PAYMENTS TAB */}
        {activeTab === 'payments' && (
          <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>Payment History</h2>
              <button
                onClick={handlePayRent}
                disabled={paying}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px',
                  background: paying ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: paying ? 'not-allowed' : 'pointer',
                  boxShadow: paying ? 'none' : '0 4px 14px rgba(16,185,129,0.4)',
                  transition: 'all 0.2s'
                }}
              >
                <Wallet size={15} /> {paying ? 'Initiating STK Push…' : 'Pay Rent Now'}
              </button>
            </div>
            {payments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <CreditCard size={40} style={{ color: 'rgba(255,255,255,0.2)', margin: '0 auto 12px' }} />
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>No payment records yet</p>
              </div>
            ) : (
              <div>
                {payments.map(p => (
                  <div key={p._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: p.status === 'confirmed' ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)'
                      }}>
                        {p.status === 'confirmed' ? <CheckCircle2 size={20} style={{ color: '#10b981' }} /> : <Clock size={20} style={{ color: '#6366f1' }} />}
                      </div>
                      <div>
                        <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{FMT_KES(p.amount_kes)}</p>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                          {p.mpesa_code ? `M-Pesa: ${p.mpesa_code}` : 'Manual entry'} · {FMT_DATE(p.created_at)}
                        </p>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 100, textTransform: 'capitalize', background: p.status === 'confirmed' ? 'rgba(16,185,129,0.2)' : 'rgba(251,191,36,0.2)', color: p.status === 'confirmed' ? '#34d399' : '#fbbf24', border: `1px solid ${p.status === 'confirmed' ? 'rgba(52,211,153,0.3)' : 'rgba(251,191,36,0.3)'}` }}>
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MAINTENANCE TAB */}
        {activeTab === 'tickets' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>Maintenance Requests</h2>
              <button onClick={() => setTicketForm(f => ({ ...f, open: true }))} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 700
              }}>
                <Plus size={15} /> New Request
              </button>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, overflow: 'hidden' }}>
              {tickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <Wrench size={40} style={{ color: 'rgba(255,255,255,0.2)', margin: '0 auto 12px' }} />
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>No maintenance requests</p>
                </div>
              ) : tickets.map(t => (
                <div key={t._id} style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{t.title}</p>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 8 }}>{t.description}</p>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{FMT_DATE(t.created_at)}</p>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 100, whiteSpace: 'nowrap' }}
                    className={ticketStatusColor(t.status)}>
                    {t.status?.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NOTICES TAB */}
        {activeTab === 'notices' && (
          <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 24 }}>
            <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Official Notices</h2>
            {notices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <FileText size={40} style={{ color: 'rgba(255,255,255,0.2)', margin: '0 auto 12px' }} />
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>No notices at this time</p>
              </div>
            ) : notices.map(n => (
              <div key={n._id} style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{n.title}</p>
                  <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 100, background: n.type === 'urgent' ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)', color: n.type === 'urgent' ? '#f87171' : '#a78bfa', fontWeight: 700 }}>
                    {n.type || 'General'}
                  </span>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{n.body || n.content}</p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 6 }}>{FMT_DATE(n.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── NOTIFICATIONS DRAWER ── */}
      {notifOpen && (
        <>
          <div onClick={() => setNotifOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, backdropFilter: 'blur(4px)' }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, zIndex: 101,
            background: 'linear-gradient(180deg, #1a1a3e 0%, #0f0c29 100%)',
            border: '1px solid rgba(255,255,255,0.1)', borderRight: 'none',
            display: 'flex', flexDirection: 'column', boxShadow: '-32px 0 64px rgba(0,0,0,0.5)'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 800 }}>Notifications</h3>
                {unread > 0 && <p style={{ color: '#6366f1', fontSize: 12, fontWeight: 600 }}>{unread} unread</p>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {unread > 0 && <button onClick={handleMarkAllRead} style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)', color: '#a78bfa', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Mark all read</button>}
                <button onClick={() => setNotifOpen(false)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
              {notifs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 24px' }}>
                  <Bell size={32} style={{ color: 'rgba(255,255,255,0.15)', margin: '0 auto 12px' }} />
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No notifications yet</p>
                </div>
              ) : notifs.map(n => {
                const isRead = n.read_by?.includes(clerkUser?.id);
                return (
                  <div key={n._id} onClick={() => handleNotifClick(n)} style={{
                    padding: '14px 24px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: isRead ? 'transparent' : 'rgba(99,102,241,0.06)',
                    borderLeft: isRead ? '3px solid transparent' : '3px solid #6366f1',
                    transition: 'all 0.2s'
                  }}>
                    <p style={{ color: isRead ? 'rgba(255,255,255,0.7)' : '#fff', fontSize: 13, fontWeight: isRead ? 400 : 700, marginBottom: 4 }}>{n.title}</p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 1.5 }}>{n.message}</p>
                    <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 6 }}>{FMT_DATE(n.created_at)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── TICKET MODAL ── */}
      {ticketForm.open && (
        <>
          <div onClick={() => setTicketForm(f => ({ ...f, open: false }))} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: '90%', maxWidth: 480, zIndex: 201,
            background: 'linear-gradient(135deg, #1a1a3e, #0f0c29)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: 32,
            boxShadow: '0 32px 64px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>New Maintenance Request</h3>
              <button onClick={() => setTicketForm(f => ({ ...f, open: false }))} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Issue Title</label>
                <input value={ticketForm.title} onChange={e => setTicketForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Water leak in bathroom"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</label>
                <textarea value={ticketForm.description} onChange={e => setTicketForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the issue in detail..."
                  rows={4}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Priority</label>
                <select value={ticketForm.priority} onChange={e => setTicketForm(f => ({ ...f, priority: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}>
                  <option value="low" style={{ background: '#1a1a3e' }}>Low</option>
                  <option value="medium" style={{ background: '#1a1a3e' }}>Medium</option>
                  <option value="high" style={{ background: '#1a1a3e' }}>High</option>
                  <option value="urgent" style={{ background: '#1a1a3e' }}>Urgent 🚨</option>
                </select>
              </div>
              <button onClick={submitTicket} disabled={submitting} style={{
                padding: '14px', background: submitting ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 8px 24px rgba(99,102,241,0.4)', marginTop: 4
              }}>
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        button:hover { opacity: 0.85; }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
