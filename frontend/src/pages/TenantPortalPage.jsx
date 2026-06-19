import React, { useState, useEffect, useCallback } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  fetchMyProfile, fetchMyPayments, fetchMyNotices,
  createMaintenanceTicket, updateMaintenanceTicket, fetchMyTickets,
  fetchNotifications, markNotifRead, markAllNotifsRead,
  fetchCustomerCareNumber, autoInitiatePayment, updateUserRole
} from '../lib/api';
import {
  Home, Wallet, Wrench, FileText, Bell, ChevronRight,
  CheckCircle2, AlertTriangle, Clock, TrendingUp, Star,
  Phone, Mail, MapPin, Calendar, CreditCard, Activity,
  ArrowUpRight, Plus, X, ZoomIn, Receipt, Edit2, Ban
} from 'lucide-react';

const FMT_KES = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
const FMT_DATE = (d) => d ? new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const formatPhoneHref = (number) => {
  if (!number) return '';
  const clean = number.trim().replace(/\s+/g, '');
  if (clean.startsWith('+')) return clean;
  if (clean.startsWith('254')) return `+${clean}`;
  if (clean.startsWith('0')) return `+254${clean.slice(1)}`;
  return `+254${clean}`; // Default fallback
};

const statusColor = (s) => ({
  confirmed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  pending:   'bg-amber-500/15 text-amber-400 border-amber-500/20',
  failed:    'bg-red-500/15 text-red-400 border-red-500/20'
}[s] || 'bg-slate-500/15 text-slate-400 border-slate-500/20');

const ticketStatusColor = (s) => ({
  open:        'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  in_progress: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  resolved:    'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  closed:      'bg-slate-500/15 text-slate-400 border border-slate-500/30'
}[s] || 'bg-slate-500/15 text-slate-400 border border-slate-500/30');

// Skeleton loader component for portal
function PortalSkeleton() {
  return (
    <div className="min-h-screen p-6" style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' }}>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Hero skeleton */}
        <div className="rounded-3xl bg-white/5 border border-white/10 p-8 animate-pulse">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-white/10" />
            <div className="space-y-3 flex-1">
              <div className="h-4 w-32 bg-white/10 rounded-full" />
              <div className="h-8 w-48 bg-white/10 rounded-full" />
              <div className="h-4 w-40 bg-white/10 rounded-full" />
            </div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-20 bg-white/10 rounded-2xl" />)}
          </div>
        </div>
        {/* Cards skeleton */}
        <div className="grid grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-white/5 border border-white/10 rounded-2xl animate-pulse" />)}
        </div>
        {/* Table skeleton */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-pulse space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-12 bg-white/10 rounded-xl" />)}
        </div>
      </div>
    </div>
  );
}

export default function TenantPortalPage() {
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();

  const [profile,    setProfile]    = useState(null);
  const [payments,   setPayments]   = useState([]);
  const [notices,    setNotices]    = useState([]);
  const [tickets,    setTickets]    = useState([]);
  const [notifs,     setNotifs]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState('overview');
  const [notifOpen,  setNotifOpen]  = useState(false);
  const [ticketForm, setTicketForm] = useState({ open: false, editId: null, title: '', description: '', priority: 'medium' });
  const [submitting, setSubmitting] = useState(false);
  const [cancelConfirmId, setCancelConfirmId] = useState(null);

  const [tenantCode, setTenantCode] = useState('');
  const [submittingCode, setSubmittingCode] = useState(false);

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
      toast.update(toastId, { render: err?.error?.message || err?.message || 'Failed to initiate payment.', type: 'error', isLoading: false, autoClose: 5000 });
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
      if (p.status === 'fulfilled') {
        setProfile(p.value?.data || null);
      } else {
        // Only show error toast if the API actually failed (not just 404 no profile)
        const errCode = p.reason?.error?.code;
        if (errCode && errCode !== 'NO_TENANT_PROFILE') {
          toast.error(p.reason?.error?.message || 'Failed to load profile');
        }
      }
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

  // Auto-refresh every 10s for real-time M-Pesa payment status updates
  useEffect(() => {
    const interval = setInterval(() => { load(); }, 10000);
    return () => clearInterval(interval);
  }, [load]);

  const lastPayment = payments.find(p => p.status === 'confirmed') || payments[0] || null;
  const arrears     = Number(profile?.arrears_kes || 0);
  const rent        = Number(profile?.rent_amount_kes || 0);
  const myDbUserId  = profile?.user_id;
  const unread      = notifs.filter(n => !n.read_by?.includes(myDbUserId)).length;

  const approvedPropertyNotifs = notifs.filter(n => {
    if (n.type !== 'property_approval') return false;
    if (n.recipient_role !== 'tenant') return false;

    const tenantArea = profile?.current_property_id?.address?.area;
    const tenantTierName = profile?.current_property_id?.tier_id?.name;
    
    const matchArea = tenantArea && n.property_area && tenantArea.toLowerCase() === n.property_area.toLowerCase();
    const matchTier = tenantTierName && n.property_tier_name && tenantTierName.toLowerCase() === n.property_tier_name.toLowerCase();
    
    return matchArea || matchTier;
  });

  const handleMarkAllRead = async () => {
    await markAllNotifsRead().catch(() => {});
    if (myDbUserId) {
      setNotifs(prev => prev.map(n => ({ ...n, read_by: [...(n.read_by || []), myDbUserId] })));
    }
  };

  const handleNotifClick = async (notif) => {
    if (myDbUserId && !notif.read_by?.includes(myDbUserId)) {
      await markNotifRead(notif._id).catch(() => {});
      setNotifs(prev => prev.map(n => n._id === notif._id ? { ...n, read_by: [...(n.read_by || []), myDbUserId] } : n));
    }
  };

  const submitTicket = async () => {
    if (!ticketForm.title.trim() || !ticketForm.description.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    setSubmitting(true);
    try {
      if (ticketForm.editId) {
        await updateMaintenanceTicket(ticketForm.editId, {
          title: ticketForm.title.trim(),
          description: ticketForm.description.trim(),
          priority: ticketForm.priority
        });
        toast.success('Request updated!');
      } else {
        await createMaintenanceTicket({
          title: ticketForm.title.trim(),
          description: ticketForm.description.trim(),
          priority: ticketForm.priority
        });
        toast.success('Maintenance request submitted!');
      }
      setTicketForm({ open: false, editId: null, title: '', description: '', priority: 'medium' });
      load();
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelTicket = async (ticketId) => {
    try {
      await updateMaintenanceTicket(ticketId, { status: 'closed' });
      toast.success('Ticket cancelled');
      setCancelConfirmId(null);
      load();
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to cancel ticket');
    }
  };

  if (loading) return <PortalSkeleton />;

  // No profile found — friendly state instead of error
  const handleLinkTenantCode = async (e) => {
    e.preventDefault();
    if (!tenantCode.trim()) {
      toast.error('Please enter a valid Tenant Code');
      return;
    }
    setSubmittingCode(true);
    try {
      const res = await updateUserRole({ role: 'tenant', tenant_code: tenantCode.trim() });
      if (res?.success) {
        toast.success('Tenant profile linked successfully!');
        setTenantCode('');
        load();
      } else {
        toast.error(res?.error?.message || 'Failed to link tenant profile');
      }
    } catch (err) {
      toast.error(err?.error?.message || err?.message || 'An error occurred while linking your profile');
    } finally {
      setSubmittingCode(false);
    }
  };

  // No profile found — display input form for Tenant Code
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-white relative overflow-hidden">
        {/* Modern glowing background accents */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-green-600/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-600/10 blur-[120px]" />

        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
          <div className="mx-auto w-16 h-16 bg-green-600/10 rounded-2xl flex items-center justify-center border border-green-600/20 text-green-500">
            <Home className="w-8 h-8" />
          </div>
          
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Link Your Tenancy</h1>
            <p className="text-sm text-slate-400">
              Please enter your unique Tenant Code below to link your account to your lease.
            </p>
          </div>

          <form onSubmit={handleLinkTenantCode} className="space-y-4">
            <div>
              <label htmlFor="tenantCode" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Tenant Code
              </label>
              <input
                id="tenantCode"
                type="text"
                value={tenantCode}
                onChange={(e) => setTenantCode(e.target.value)}
                placeholder="e.g., TEN-XXXX-XXXX"
                disabled={submittingCode}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20 transition-all font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={submittingCode}
              className="w-full py-3 bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-2"
            >
              {submittingCode ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Linking Tenancy...
                </>
              ) : (
                'Link Tenancy'
              )}
            </button>
          </form>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex gap-3">
            <Phone className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-300">Need Help or Don't Have a Code?</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Contact Mutune Estate Agency customer care via Call or WhatsApp at{' '}
                <a href={`tel:+${customerCare}`} className="text-green-500 hover:text-green-400 font-bold underline transition-colors">
                  {customerCare}
                </a>{' '}
                to get your unique code.
              </p>
            </div>
          </div>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => { if (clerkUser) { signOut(); } }}
              className="text-xs font-bold text-slate-500 hover:text-slate-400 transition-colors uppercase tracking-wider"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pending verification check
  if (profile?.tenancy_status === 'pending') {
    const matchedUnit = profile?.current_property_id?.units?.find(
      u => u._id?.toString() === profile?.current_unit_id?.toString()
    );
    const unitNo = matchedUnit ? matchedUnit.unit_number : 'N/A';
    const propertyName = profile?.current_property_id?.name || 'Your Property';
    const propertyCode = profile?.current_property_id?.property_code || 'N/A';
    const tierName = profile?.current_property_id?.tier_id?.name || 'Standard';
    
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-white"
        style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' }}>
        <div className="w-full max-w-xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6 relative overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="mx-auto w-16 h-16 bg-amber-500/15 rounded-2xl flex items-center justify-center border border-amber-500/30">
            <Clock className="w-8 h-8 text-amber-400 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Registration Awaiting Approval</h1>
            <p className="text-sm text-slate-400">
              Your tenant profile has been submitted and is currently pending verification.
            </p>
          </div>

          <div className="border border-slate-800 rounded-2xl bg-slate-950/40 p-5 text-left space-y-3.5">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lease Details Summary</h2>
            <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
              <div>
                <span className="text-slate-500 block">Tenant Code</span>
                <span className="text-white font-mono font-bold">{profile.tenant_code}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Assigned Rent</span>
                <span className="text-white font-bold">{FMT_KES(profile.rent_amount_kes)} / month</span>
              </div>
              <div>
                <span className="text-slate-500 block">Property & Unit</span>
                <span className="text-white font-bold">{propertyName} — Unit {unitNo}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Property Code & Tier</span>
                <span className="text-white font-bold">{propertyCode} ({tierName})</span>
              </div>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 text-left flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-amber-300">Next Steps</p>
              <p className="text-xs text-slate-300 leading-relaxed">
                Once Mutune Estate Agency approves your tenancy, you will receive a registration email at <strong className="text-white">{profile.email || clerkUser?.emailAddresses?.[0]?.emailAddress}</strong> instructing you to make your rent payment of <strong className="text-white">{FMT_KES(profile.rent_amount_kes)}</strong> via the portal.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => { if (clerkUser) { signOut(); } }}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all uppercase tracking-wider"
            >
              Sign Out / Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Resolve real unit details from the server-computed _matched_unit or units array
  const matchedUnit = profile?._matched_unit ||
    (profile?.current_property_id?.units || []).find(
      u => u._id?.toString() === profile?.current_unit_id?.toString()
    ) || null;
  const unitNumber = matchedUnit?.unit_number || profile?.unit_number || 'N/A';
  const unitRent   = matchedUnit?.rent_kes || profile?.rent_amount_kes || 0;
  const propertyName = profile?.current_property_id?.name || 'Your Property';
  const propertyArea = profile?.current_property_id?.address?.area || 'Mombasa';
  const tenantName = profile?.full_name || clerkUser?.fullName || 'Tenant';
  const propertyPhoto = (profile?.current_property_id?.photos || [])[0] || null;
  // Agent phone: try the property's agent list first, then customer care
  const agentPhone = customerCare;

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

        {/* ── NEW PROPERTY ALERTS ── */}
        {myDbUserId && approvedPropertyNotifs.filter(n => !n.read_by?.includes(myDbUserId)).map(n => (
          <div key={n._id} style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(99,102,241,0.15) 100%)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 16,
            padding: '16px 24px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 8px 32px rgba(16,185,129,0.15)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'rgba(16,185,129,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <Star size={18} style={{ color: '#34d399' }} />
              </div>
              <p style={{ color: '#fff', fontSize: 13, fontWeight: 500, margin: 0 }}>
                New property listed: <strong style={{ color: '#34d399' }}>{n.property_name}</strong> in <strong>{n.property_area}</strong> – Tier: <strong>{n.property_tier_name}</strong> – Rent: <strong>{FMT_KES(n.property_rent)}</strong>
              </p>
            </div>
            <button onClick={() => handleNotifClick(n)} style={{
              background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.6)',
              borderRadius: 8, padding: 6, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', flexShrink: 0
            }} title="Dismiss">
              <X size={16} />
            </button>
          </div>
        ))}

        {/* ── ARREARS / LATE FEE WARNING BANNER ── */}
        {arrears > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(245,158,11,0.15) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: 16, padding: '16px 24px',
            marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            boxShadow: '0 8px 32px rgba(239,68,68,0.15)'
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={20} style={{ color: '#f87171' }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: '#fca5a5', fontSize: 13, fontWeight: 800, marginBottom: 2 }}>⚠ Rent Arrears Outstanding</p>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                You have <strong style={{ color: '#fbbf24' }}>{FMT_KES(arrears)}</strong> in outstanding arrears. Late fees may apply. Please settle your balance promptly to avoid service interruption.
              </p>
            </div>
            <button
              onClick={handlePayRent}
              disabled={paying}
              style={{
                padding: '8px 18px', background: paying ? 'rgba(239,68,68,0.3)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700,
                cursor: paying ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                boxShadow: '0 4px 14px rgba(239,68,68,0.4)'
              }}
            >
              {paying ? 'Initiating…' : 'Pay Now (M-Pesa)'}
            </button>
          </div>
        )}

        {/* ── HERO CARD ── */}
        <div style={{
          borderRadius: 24, overflow: 'hidden', marginBottom: 28,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(139,92,246,0.2) 50%, rgba(16,185,129,0.15) 100%)',
          backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 32px 64px rgba(0,0,0,0.4)'
        }}>
          {/* Property photo banner or gradient band */}
          {propertyPhoto ? (
            <div style={{ height: 140, overflow: 'hidden', position: 'relative' }}>
              <img src={propertyPhoto} alt={propertyName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(15,12,41,0.85) 100%)' }} />
              {arrears > 0 && (
                <span style={{ position: 'absolute', top: 12, right: 16, background: 'rgba(239,68,68,0.9)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 100 }}>
                  ⚠ Arrears: {FMT_KES(arrears)}
                </span>
              )}
            </div>
          ) : (
            <div style={{ background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #10b981 100%)', height: 6 }} />
          )}

          <div style={{ padding: '32px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              {/* Building silhouette icon */}
              <div style={{
                width: 80, height: 80, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: propertyPhoto ? 'rgba(0,0,0,0.4)' : 'linear-gradient(135deg, rgba(99,102,241,0.4), rgba(139,92,246,0.4))',
                border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
                flexShrink: 0, overflow: 'hidden'
              }}>
                {propertyPhoto ? (
                  <img src={propertyPhoto} alt={propertyName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
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
                )}
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
                <p style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{FMT_KES(unitRent || rent)}</p>
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
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Lease</p>
                <p style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>
                  {FMT_DATE(profile?.lease_start)} –
                </p>
                <p style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>
                  {FMT_DATE(profile?.lease_end)}
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
              { label: 'Pay Rent', desc: paying ? 'Initiating...' : `${FMT_KES(unitRent || rent)} via M-Pesa`, icon: <Wallet size={20} />, color: '#10b981', action: handlePayRent },
              { label: 'Maintenance', desc: `${tickets.filter(t => t.status === 'open').length} open requests`, icon: <Wrench size={20} />, color: '#6366f1', action: () => setTicketForm(f => ({ ...f, open: true })) },
              { label: 'View Notices', desc: `${notices.length} notice${notices.length !== 1 ? 's' : ''}`, icon: <FileText size={20} />, color: '#f59e0b', action: () => setActiveTab('notices') },
              { label: 'Contact Agent', desc: agentPhone, icon: <Phone size={20} />, color: '#ec4899', href: `tel:${formatPhoneHref(agentPhone)}` }
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
                {payments.map(p => {
                  const receipt = p.mpesa_receipt || p.mpesa_code || null;
                  const ref = p.transaction_id || null;
                  const isMpesa = p.channel === 'mpesa_stk' || p.channel === 'mpesa_c2b';
                  return (
                    <div key={p._id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          background: p.status === 'confirmed' ? 'rgba(16,185,129,0.2)' : p.status === 'failed' ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)'
                        }}>
                          {p.status === 'confirmed'
                            ? <CheckCircle2 size={20} style={{ color: '#10b981' }} />
                            : p.status === 'failed'
                              ? <X size={20} style={{ color: '#ef4444' }} />
                              : <Clock size={20} style={{ color: '#6366f1' }} />}
                        </div>
                        <div>
                          <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{FMT_KES(p.amount_kes)}</p>
                          {receipt && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                              <Receipt size={12} style={{ color: '#34d399', flexShrink: 0 }} />
                              <span style={{ color: '#34d399', fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>{receipt}</span>
                            </div>
                          )}
                          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 3 }}>
                            {isMpesa ? 'M-Pesa' : (p.channel || 'Payment')} · {FMT_DATE(p.created_at)}
                            {!receipt && ref && ` · Ref: ${ref.slice(0, 18)}`}
                          </p>
                          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textTransform: 'capitalize' }}>{p.payment_type || 'rent'}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 100, textTransform: 'capitalize',
                          background: p.status === 'confirmed' ? 'rgba(16,185,129,0.2)' : p.status === 'failed' ? 'rgba(239,68,68,0.2)' : 'rgba(251,191,36,0.2)',
                          color: p.status === 'confirmed' ? '#34d399' : p.status === 'failed' ? '#f87171' : '#fbbf24',
                          border: `1px solid ${p.status === 'confirmed' ? 'rgba(52,211,153,0.3)' : p.status === 'failed' ? 'rgba(239,68,68,0.3)' : 'rgba(251,191,36,0.3)'}` }}>
                          {p.status === 'confirmed' ? '✓ Confirmed' : p.status === 'failed' ? '✗ Failed' : p.status}
                        </span>
                        {p.status === 'confirmed' && (
                          <button
                            title="Download Receipt"
                            onClick={() => {
                              const content = [
                                'MutuneRent Pro — Payment Receipt',
                                '='.repeat(40),
                                `Date:        ${FMT_DATE(p.created_at)}`,
                                `Amount:      ${FMT_KES(p.amount_kes)}`,
                                `M-Pesa Receipt: ${receipt || 'N/A'}`,
                                `Ref:         ${ref || 'N/A'}`,
                                `Type:        ${p.payment_type || 'Rent'}`,
                                `Channel:     ${p.channel || 'N/A'}`,
                                `Status:      CONFIRMED ✓`,
                                `Unit:        ${propertyName} — Unit ${unitNumber}`,
                                `Tenant:      ${tenantName}`,
                                '',
                                'This is an official payment receipt from Mutune Estate Agency.',
                                'For queries: mutunerentz@gmail.com'
                              ].join('\n');
                              const blob = new Blob([content], { type: 'text/plain' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `MutuneRent_Receipt_${receipt || p._id?.slice(-6) || 'pay'}.txt`;
                              document.body.appendChild(a); a.click(); a.remove();
                              URL.revokeObjectURL(url);
                              toast.success('Receipt downloaded!');
                            }}
                            style={{
                              background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)',
                              color: '#34d399', borderRadius: 8, padding: '5px 10px',
                              fontSize: 11, fontWeight: 700, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 4,
                              transition: 'all 0.2s'
                            }}
                          >
                            ↓ Receipt
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{t.title}</p>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 100, whiteSpace: 'nowrap', flexShrink: 0 }}
                        className={ticketStatusColor(t.status)}>
                        {t.status?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 6 }}>{t.description}</p>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
                      Priority: <span style={{ textTransform: 'capitalize', color: t.priority === 'urgent' ? '#f87171' : t.priority === 'high' ? '#fb923c' : 'rgba(255,255,255,0.4)' }}>{t.priority}</span>
                      {' · '}{FMT_DATE(t.created_at)}
                    </p>
                  </div>
                  {(t.status === 'open' || t.status === 'in_progress') && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        title="Edit request"
                        onClick={() => setTicketForm({ open: true, editId: t._id, title: t.title, description: t.description, priority: t.priority || 'medium' })}
                        style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a78bfa', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Edit2 size={11} /> Edit
                      </button>
                      <button
                        title="Cancel request"
                        onClick={() => setCancelConfirmId(t._id)}
                        style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Ban size={11} /> Cancel
                      </button>
                    </div>
                  )}
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
                const isRead = myDbUserId && n.read_by?.includes(myDbUserId);
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

      {/* ── CANCEL TICKET CONFIRMATION ── */}
      {cancelConfirmId && (
        <>
          <div onClick={() => setCancelConfirmId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, backdropFilter: 'blur(4px)' }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: '90%', maxWidth: 380, zIndex: 301,
            background: 'linear-gradient(135deg, #1a1a3e, #0f0c29)',
            border: '1px solid rgba(239,68,68,0.3)', borderRadius: 20, padding: 28,
            boxShadow: '0 32px 64px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ color: '#f87171', fontSize: 16, fontWeight: 800 }}>Cancel Request?</h3>
              <button onClick={() => setCancelConfirmId(null)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 20 }}>
              This will mark the maintenance request as closed. Are you sure?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setCancelConfirmId(null)}
                style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Keep It
              </button>
              <button onClick={() => handleCancelTicket(cancelConfirmId)}
                style={{ flex: 1, padding: '10px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Yes, Cancel
              </button>
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
              <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>
                {ticketForm.editId ? 'Edit Request' : 'New Maintenance Request'}
              </h3>
              <button onClick={() => setTicketForm({ open: false, editId: null, title: '', description: '', priority: 'medium' })} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Issue Title <span style={{ color: '#f87171' }}>*</span></label>
                <input value={ticketForm.title} onChange={e => setTicketForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Water leak in bathroom"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description <span style={{ color: '#f87171' }}>*</span></label>
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
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setTicketForm({ open: false, editId: null, title: '', description: '', priority: 'medium' })}
                  style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={submitTicket} disabled={submitting} style={{
                  flex: 2, padding: '12px', background: submitting ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 8px 24px rgba(99,102,241,0.4)'
                }}>
                  {submitting ? 'Saving…' : ticketForm.editId ? 'Update Request' : 'Submit Request'}
                </button>
              </div>
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
