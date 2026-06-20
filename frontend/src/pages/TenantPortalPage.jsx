import React, { useState, useEffect, useCallback } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
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
  ArrowUpRight, Plus, X, ZoomIn, Receipt, Edit2, Ban, Loader2, LogOut
} from 'lucide-react';

const FMT_KES = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
const FMT_DATE = (d) => {
  if (!d) return '—';
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return '—';
  return dateObj.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatPhoneHref = (number) => {
  if (!number) return '';
  const clean = number.trim().replace(/\s+/g, '');
  if (clean.startsWith('+')) return clean;
  if (clean.startsWith('254')) return `+${clean}`;
  if (clean.startsWith('0')) return `+254${clean.slice(1)}`;
  return `+254${clean}`; // Default fallback
};

const statusColor = (s) => ({
  confirmed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  pending:   'bg-amber-500/10 text-amber-400 border-amber-500/30',
  failed:    'bg-red-500/10 text-red-400 border-red-500/30'
}[s] || 'bg-slate-500/10 text-slate-400 border-slate-500/30');

const ticketStatusColor = (s) => ({
  open:        'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  in_progress: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  resolved:    'bg-green-500/10 text-green-400 border border-green-500/20',
  closed:      'bg-slate-500/10 text-slate-400 border border-slate-500/20'
}[s] || 'bg-slate-500/10 text-slate-400 border border-slate-500/20');

// Skeleton loader component for portal
function PortalSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 p-6 flex flex-col items-center justify-start relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-900/20 blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-5xl space-y-6 z-10">
        <div className="flex items-center justify-between border-b border-slate-900 pb-4">
          <div className="h-8 w-40 bg-slate-900 rounded-lg animate-pulse" />
          <div className="h-10 w-10 bg-slate-900 rounded-full animate-pulse" />
        </div>
        
        {/* Hero skeleton */}
        <div className="rounded-3xl bg-slate-900/40 border border-slate-800/80 p-8 space-y-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-slate-900 animate-pulse" />
            <div className="space-y-3 flex-1">
              <div className="h-4 w-32 bg-slate-900 rounded-full animate-pulse" />
              <div className="h-8 w-56 bg-slate-900 rounded-full animate-pulse" />
              <div className="h-4 w-44 bg-slate-900 rounded-full animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800/40">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-900/50 rounded-2xl border border-slate-800 animate-pulse" />)}
          </div>
        </div>
        
        {/* Grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-slate-900/40 border border-slate-800 rounded-2xl animate-pulse" />)}
        </div>
        
        {/* Table skeleton */}
        <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-6 space-y-4">
          <div className="h-6 w-32 bg-slate-900 rounded-full animate-pulse" />
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-slate-900/50 border border-slate-800/40 rounded-xl animate-pulse" />)}
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
        {/* Glowing background mesh */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-600/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-[32px] p-8 shadow-2xl relative z-10 space-y-6"
        >
          <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 text-emerald-400">
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
                className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-655 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={submittingCode}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
            >
              {submittingCode ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4" />
                  Linking Tenancy...
                </>
              ) : (
                'Link Tenancy'
              )}
            </button>
          </form>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex gap-3">
            <Phone className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-300">Need Help or Don't Have a Code?</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Contact Mutune Estate Agency customer care via Call or WhatsApp at{' '}
                <a href={`tel:+${customerCare}`} className="text-emerald-400 hover:text-emerald-350 font-bold underline transition-colors">
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
              className="text-xs font-bold text-slate-500 hover:text-slate-400 transition-colors uppercase tracking-wider flex items-center gap-1.5 justify-center mx-auto cursor-pointer"
            >
              <LogOut size={12} /> Sign Out
            </button>
          </div>
        </motion.div>
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
      <div className="min-h-screen flex items-center justify-center p-6 text-white bg-slate-950 relative overflow-hidden">
        {/* Glowing background mesh */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-slate-500/5 blur-[120px] pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-[32px] p-8 shadow-2xl text-center space-y-6 relative overflow-hidden"
        >
          <div className="mx-auto w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
            <Clock className="w-8 h-8 text-amber-400 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Registration Awaiting Approval</h1>
            <p className="text-sm text-slate-400">
              Your tenant profile has been submitted and is currently pending verification.
            </p>
          </div>

          <div className="border border-slate-800/80 rounded-2xl bg-slate-950/40 p-5 text-left space-y-3.5">
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

          <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-4 text-left flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-amber-400">Next Steps</p>
              <p className="text-xs text-slate-300 leading-relaxed">
                Once Mutune Estate Agency approves your tenancy, you will receive a registration email at <strong className="text-white">{profile.email || clerkUser?.emailAddresses?.[0]?.emailAddress}</strong> instructing you to make your rent payment of <strong className="text-white">{FMT_KES(profile.rent_amount_kes)}</strong> via the portal.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => { if (clerkUser) { signOut(); } }}
              className="px-6 py-3 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 rounded-xl text-xs font-bold transition-all uppercase tracking-wider flex items-center gap-2 justify-center mx-auto border border-slate-700/50 cursor-pointer"
            >
              <LogOut size={13} /> Sign Out / Back
            </button>
          </div>
        </motion.div>
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
  const agentPhone = customerCare;

  const tabs = [
    { key: 'overview',  label: 'Overview',   icon: <Home size={14} /> },
    { key: 'payments',  label: 'Payments',   icon: <CreditCard size={14} /> },
    { key: 'tickets',   label: 'Maintenance',icon: <Wrench size={14} /> },
    { key: 'notices',   label: 'Notices',    icon: <FileText size={14} /> }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden pb-12">
      {/* Background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div 
          animate={{
            x: [0, 80, -40, 0],
            y: [0, -50, 40, 0],
            scale: [1, 1.15, 0.9, 1]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] right-[-10%] w-[550px] h-[550px] rounded-full bg-indigo-900/10 blur-[130px]" 
        />
        <motion.div 
          animate={{
            x: [0, -60, 50, 0],
            y: [0, 40, -50, 0],
            scale: [1, 0.9, 1.1, 1]
          }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-900/8 blur-[120px]" 
        />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        
        {/* Top Header Row */}
        <header className="flex items-center justify-between border-b border-slate-900 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-emerald-500/15">
              MR
            </div>
            <div>
              <h2 className="text-md font-black tracking-tight text-white flex items-center gap-1">MutuneRent <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">PRO</span></h2>
              <p className="text-[10px] text-slate-555 tracking-wider uppercase font-semibold">Tenant Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setNotifOpen(true)} 
              className="relative p-2.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 rounded-xl cursor-pointer text-slate-300 transition"
            >
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute top-[-4px] right-[-4px] bg-emerald-500 text-slate-950 rounded-full w-5 h-5 text-[10px] font-black flex items-center justify-center border-2 border-slate-950">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            <button
              onClick={() => { if (clerkUser) { signOut(); } }}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900/80 hover:bg-slate-800 text-xs font-bold text-slate-300 border border-slate-800/80 rounded-xl transition cursor-pointer"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold tracking-wide uppercase mb-4">
          <span>My Portal</span>
          <ChevronRight size={10} />
          <span className="text-green-500 capitalize">{activeTab}</span>
        </div>

        {/* APPROVED PROPERTY ALERTS */}
        <AnimatePresence>
          {myDbUserId && approvedPropertyNotifs.filter(n => !n.read_by?.includes(myDbUserId)).map(n => (
            <motion.div 
              key={n._id}
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="bg-gradient-to-r from-emerald-500/10 to-indigo-500/5 backdrop-blur-xl border border-emerald-500/25 rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-emerald-950/20 overflow-hidden"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0 border border-emerald-500/25">
                  <Star size={16} className="text-emerald-400" />
                </div>
                <p className="text-xs text-slate-200">
                  New property listed: <strong className="text-emerald-400">{n.property_name}</strong> in <strong>{n.property_area}</strong> – Tier: <strong>{n.property_tier_name}</strong> – Rent: <strong>{FMT_KES(n.property_rent)}</strong>
                </p>
              </div>
              <button 
                onClick={() => handleNotifClick(n)} 
                className="p-1.5 bg-slate-900/50 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition flex-shrink-0 cursor-pointer"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* ARREARS WARNING BANNER */}
        <AnimatePresence>
          {arrears > 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-r from-red-500/10 to-amber-500/5 backdrop-blur-xl border border-red-500/30 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between shadow-lg shadow-red-950/20"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0 border border-red-500/20">
                  <AlertTriangle size={18} className="text-red-400 animate-pulse" />
                </div>
                <div>
                  <p className="text-xs font-black text-red-400 uppercase tracking-wider mb-0.5">Rent Arrears Outstanding</p>
                  <p className="text-xs text-slate-300">
                    You have <strong className="text-amber-400">{FMT_KES(arrears)}</strong> in outstanding arrears. Please settle your balance promptly to avoid late fees.
                  </p>
                </div>
              </div>
              <button
                onClick={handlePayRent}
                disabled={paying}
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-650 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all tracking-wider shadow-md shadow-red-950/50 uppercase cursor-pointer"
              >
                {paying ? 'Processing…' : 'Pay via M-Pesa'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HERO PROPERTY LEASE CARD */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-[32px] overflow-hidden shadow-2xl mb-8 relative">
          
          {propertyPhoto ? (
            <div className="h-44 overflow-hidden relative">
              <img src={propertyPhoto} alt={propertyName} className="w-full h-full object-cover filter brightness-75" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              {arrears > 0 && (
                <span className="absolute top-4 right-4 bg-red-500 text-slate-950 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-lg shadow-red-950/30">
                  Arrears: {FMT_KES(arrears)}
                </span>
              )}
            </div>
          ) : (
            <div className="h-6 bg-gradient-to-r from-emerald-500 via-indigo-500 to-violet-600" />
          )}

          <div className="p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/10 to-indigo-500/10 border border-slate-800/80 flex items-center justify-center flex-shrink-0 shadow-inner overflow-hidden">
                {propertyPhoto ? (
                  <img src={propertyPhoto} alt={propertyName} className="w-full h-full object-cover" />
                ) : (
                  <Home className="text-emerald-400 w-8 h-8" />
                )}
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
                  {propertyArea} · {propertyName}
                </p>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                  Unit <span className="bg-gradient-to-r from-emerald-400 to-indigo-400 bg-clip-text text-transparent">{unitNumber}</span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Welcome back, <span className="font-semibold text-slate-200">{tenantName}</span> 👋
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-2xl min-w-[130px]">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Monthly Rent</span>
                <p className="text-md font-black text-white">{FMT_KES(unitRent || rent)}</p>
                <span className={`text-[10px] font-bold mt-1 block ${arrears > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {arrears > 0 ? `Arrears: ${FMT_KES(arrears)}` : '✓ Account Clear'}
                </span>
              </div>

              <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-2xl min-w-[130px]">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Last Payment</span>
                <p className="text-md font-black text-emerald-400">{lastPayment ? FMT_KES(lastPayment.amount_kes) : '—'}</p>
                <span className="text-[10px] text-slate-550 mt-1 block truncate">
                  {lastPayment ? FMT_DATE(lastPayment.created_at) : 'No history'}
                </span>
              </div>

              <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-2xl min-w-[130px] col-span-2 sm:col-span-1">
                <span className="text-[9px] font-bold text-slate-505 uppercase tracking-widest block mb-1">Lease Period</span>
                <p className="text-xs font-bold text-slate-300">{FMT_DATE(profile?.lease_start)}</p>
                <span className="text-[10px] text-slate-500 mt-1 block truncate font-medium">
                  to {FMT_DATE(profile?.lease_end)}
                </span>
              </div>
            </div>
          </div>

          {/* Elegant Custom Sliding Tab Bar */}
          <div className="px-6 sm:px-8 pb-5 flex gap-2 overflow-x-auto scrollbar-none border-t border-slate-850/50 pt-4">
            {tabs.map(tab => (
              <button 
                key={tab.key} 
                onClick={() => setActiveTab(tab.key)} 
                className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl cursor-pointer text-xs font-bold tracking-wide transition duration-300 flex-shrink-0 ${
                  activeTab === tab.key ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {activeTab === tab.key && (
                  <motion.div 
                    layoutId="activeTabSlider"
                    className="absolute inset-0 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className={activeTab === tab.key ? 'text-emerald-400' : 'text-slate-500'}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* TAB CONTENTS */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
          >
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Lease details box */}
                <div className="md:col-span-3 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Home size={16} className="text-green-500" /> Lease Summary
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-2">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1">Property Name</span>
                      <p className="text-xs font-bold text-slate-200">{propertyName}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1">Unit</span>
                      <p className="text-xs font-bold text-slate-200">{unitNumber}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1">Monthly Rent</span>
                      <p className="text-xs font-bold text-slate-200">{FMT_KES(unitRent || rent)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1">Next Due Date</span>
                      <p className="text-xs font-bold text-green-500">
                        {profile?.rent_due_day ? `${profile.rent_due_day}th of every month` : '5th of every month'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick actions grid */}
                <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Pay Rent', desc: paying ? 'Initiating...' : `${FMT_KES(unitRent || rent)} via M-Pesa`, icon: <Wallet size={20} />, color: 'emerald', action: handlePayRent },
                    { label: 'Maintenance Request', desc: `${tickets.filter(t => t.status === 'open').length} open tickets`, icon: <Wrench size={20} />, color: 'indigo', action: () => setTicketForm(f => ({ ...f, open: true })) },
                    { label: 'Official Notices', desc: `${notices.length} active notice${notices.length !== 1 ? 's' : ''}`, icon: <FileText size={20} />, color: 'amber', action: () => setActiveTab('notices') },
                    { label: 'Contact Property Agent', desc: agentPhone, icon: <Phone size={20} />, color: 'violet', href: `tel:${formatPhoneHref(agentPhone)}` }
                  ].map((item, i) => {
                    const cardStyle = "bg-slate-900/30 hover:bg-slate-900/60 backdrop-blur-md border border-slate-850 hover:border-slate-800/85 p-5 rounded-2xl cursor-pointer text-left transition duration-300 flex items-center justify-between group";
                    const isEmerald = item.color === 'emerald';
                    const isIndigo = item.color === 'indigo';
                    const isAmber = item.color === 'amber';
                    
                    const badgeColor = isEmerald ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                      : isIndigo ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                                      : isAmber ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                      : 'bg-violet-500/10 border-violet-500/20 text-violet-400';

                    const content = (
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${badgeColor}`}>
                          {item.icon}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">{item.label}</p>
                          <p className="text-[11px] text-slate-500 mt-1">{item.desc}</p>
                        </div>
                      </div>
                    );

                    if (item.href) {
                      return (
                        <a key={i} href={item.href} className={cardStyle}>
                          {content}
                          <ChevronRight size={16} className="text-slate-600 group-hover:text-white transition" />
                        </a>
                      );
                    }

                    return (
                      <button key={i} onClick={item.action} disabled={item.label === 'Pay Rent' && paying} className={`${cardStyle} disabled:opacity-50`}>
                        {content}
                        <ChevronRight size={16} className="text-slate-600 group-hover:text-white transition animate-none" />
                      </button>
                    );
                  })}
                </div>

                {/* Recent Payments Section */}
                <div className="md:col-span-3 bg-slate-900/30 backdrop-blur-md border border-slate-850 rounded-[24px] p-6">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-850 pb-3">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Recent Transactions</h3>
                    <button onClick={() => setActiveTab('payments')} className="text-xs font-bold text-emerald-400 hover:text-emerald-355 transition flex items-center gap-1 cursor-pointer">
                      View Statement <ArrowUpRight size={14} />
                    </button>
                  </div>
                  {payments.slice(0, 3).length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">No payment history found.</p>
                  ) : (
                    <div className="divide-y divide-slate-850/50">
                      {payments.slice(0, 3).map(p => (
                        <div key={p._id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                              p.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400' : p.status === 'failed' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              <CreditCard size={15} />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white">{FMT_KES(p.amount_kes)}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">{FMT_DATE(p.created_at)}</p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 border rounded-full ${statusColor(p.status)}`}>
                            {p.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* PAYMENTS TAB */}
            {activeTab === 'payments' && (
              <div className="bg-slate-900/30 backdrop-blur-md border border-slate-850 rounded-[24px] p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-850 pb-4 gap-4">
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Statement of Accounts</h2>
                    <p className="text-[11px] text-slate-500 mt-1">Check verified transactions and receipts.</p>
                  </div>
                  <button
                    onClick={handlePayRent}
                    disabled={paying}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition tracking-wider shadow-lg shadow-emerald-950/40 uppercase active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Wallet size={14} /> {paying ? 'Connecting…' : 'Quick Rent Payment'}
                  </button>
                </div>

                {payments.length === 0 ? (
                  <div className="text-center py-12">
                    <CreditCard size={40} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-xs text-slate-500">No payment statement found for this account.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payments.map(p => {
                      const receipt = p.mpesa_receipt || p.mpesa_code || null;
                      const ref = p.transaction_id || null;
                      const isMpesa = p.channel === 'mpesa_stk' || p.channel === 'mpesa_c2b';
                      return (
                        <div 
                          key={p._id} 
                          className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-800 transition duration-300"
                        >
                          <div className="flex items-start gap-3.5">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              p.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400' : p.status === 'failed' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {p.status === 'confirmed' ? (
                                <CheckCircle2 size={18} />
                              ) : p.status === 'failed' ? (
                                <X size={18} />
                              ) : (
                                <Clock size={18} />
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-black text-white">{FMT_KES(p.amount_kes)}</p>
                              {receipt && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Receipt size={10} className="text-emerald-400" />
                                  <span className="text-[11px] text-emerald-400 font-mono font-bold tracking-wider">{receipt}</span>
                                </div>
                              )}
                              <p className="text-[10px] text-slate-500 mt-1">
                                {isMpesa ? 'M-Pesa Auto' : (p.channel || 'Internal Collection')} · {FMT_DATE(p.created_at)}
                                {!receipt && ref && ` · Ref: ${ref.slice(0, 14)}`}
                              </p>
                              <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider mt-0.5">{p.payment_type || 'rent'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <span className={`text-[10px] font-extrabold uppercase px-3 py-1 border rounded-full ${statusColor(p.status)}`}>
                              {p.status}
                            </span>
                            {p.status === 'confirmed' && (
                              <button
                                onClick={() => {
                                  const content = [
                                    'MutuneRent Pro — Payment Receipt',
                                    '========================================',
                                    `Date:           ${FMT_DATE(p.created_at)}`,
                                    `Amount:         ${FMT_KES(p.amount_kes)}`,
                                    `M-Pesa Receipt: ${receipt || 'N/A'}`,
                                    `Ref:            ${ref || 'N/A'}`,
                                    `Type:           ${p.payment_type || 'Rent'}`,
                                    `Channel:        ${p.channel || 'N/A'}`,
                                    `Status:         CONFIRMED ✓`,
                                    `Unit:           ${propertyName} — Unit ${unitNumber}`,
                                    `Tenant:         ${tenantName}`,
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
                                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-750 text-slate-350 hover:text-white rounded-lg px-2.5 py-1 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                              >
                                Download
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
              <div className="bg-slate-900/30 backdrop-blur-md border border-slate-850 rounded-[24px] p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Maintenance Reports</h2>
                    <p className="text-[11px] text-slate-500 mt-1">Report plumbing, electrical or structural issues.</p>
                  </div>
                  <button 
                    onClick={() => setTicketForm(f => ({ ...f, open: true }))} 
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <Plus size={14} /> New Ticket
                  </button>
                </div>

                {tickets.length === 0 ? (
                  <div className="text-center py-12">
                    <Wrench size={40} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-xs text-slate-500">No active maintenance logs.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tickets.map(t => (
                      <div 
                        key={t._id} 
                        className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:border-slate-800 transition duration-300"
                      >
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-bold text-white truncate">{t.title}</h4>
                            <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${ticketStatusColor(t.status)}`}>
                              {t.status?.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed break-words">{t.description}</p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-505 flex-wrap">
                            <span>Priority:</span>
                            <span className={`font-bold capitalize ${
                              t.priority === 'urgent' ? 'text-red-400' : t.priority === 'high' ? 'text-amber-400' : 'text-slate-400'
                            }`}>
                              {t.priority}
                            </span>
                            <span>·</span>
                            <span>Reported: {FMT_DATE(t.created_at)}</span>
                          </div>
                        </div>

                        {(t.status === 'open' || t.status === 'in_progress') && (
                          <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                            <button
                              onClick={() => setTicketForm({ open: true, editId: t._id, title: t.title, description: t.description, priority: t.priority || 'medium' })}
                              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-350 text-[10px] font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 size={10} /> Edit
                            </button>
                            <button
                              onClick={() => setCancelConfirmId(t._id)}
                              className="px-2.5 py-1 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 text-red-400 text-[10px] font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                            >
                              <Ban size={10} /> Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* NOTICES TAB */}
            {activeTab === 'notices' && (
              <div className="bg-slate-900/30 backdrop-blur-md border border-slate-850 rounded-[24px] p-6 space-y-6">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Estate Broadcasts</h2>
                  <p className="text-[11px] text-slate-500 mt-1">Official communications from Mutune Agency management.</p>
                </div>

                {notices.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText size={40} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-xs text-slate-500">No broadcasts at this time.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-850/50">
                    {notices.map(n => (
                      <div key={n._id} className="py-4 first:pt-0 last:pb-0 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-xs font-bold text-white">{n.title}</h4>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            n.type === 'urgent' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {n.type || 'General'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">{n.body || n.content}</p>
                        <p className="text-[10px] text-slate-500 font-semibold">{FMT_DATE(n.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* NOTIFICATIONS DRAWER */}
      <AnimatePresence>
        {notifOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNotifOpen(false)} 
              className="fixed inset-0 bg-slate-950/70 z-[100] backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-sm z-[101] bg-slate-900 border-l border-slate-850 flex flex-col shadow-2xl"
            >
              <div className="p-5 border-b border-slate-850 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Notifications</h3>
                  {unread > 0 && <p className="text-xs text-emerald-400 font-bold mt-0.5">{unread} unread updates</p>}
                </div>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button 
                      onClick={handleMarkAllRead} 
                      className="px-2.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold cursor-pointer transition"
                    >
                      Clear All
                    </button>
                  )}
                  <button 
                    onClick={() => setNotifOpen(false)} 
                    className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-850 rounded-lg text-slate-400 cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-850/50">
                {notifs.length === 0 ? (
                  <div className="text-center py-16">
                    <Bell size={28} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-xs text-slate-500">No alerts logged.</p>
                  </div>
                ) : (
                  notifs.map(n => {
                    const isRead = myDbUserId && n.read_by?.includes(myDbUserId);
                    return (
                      <div 
                        key={n._id} 
                        onClick={() => handleNotifClick(n)} 
                        className={`p-4 cursor-pointer transition duration-200 border-l-2 ${
                          isRead ? 'border-transparent bg-transparent opacity-60' : 'border-emerald-500 bg-emerald-500/[0.02]'
                        }`}
                      >
                        <p className={`text-xs font-bold ${isRead ? 'text-slate-300' : 'text-white'}`}>{n.title}</p>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{n.message}</p>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-2">{FMT_DATE(n.created_at)}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* CANCEL MAINTENANCE REQUEST DIALOG */}
      <AnimatePresence>
        {cancelConfirmId && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCancelConfirmId(null)} 
              className="fixed inset-0 bg-slate-950/80 z-[300] backdrop-blur-sm" 
            />
             <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: "-40%", x: "-50%" }}
              animate={{ opacity: 1, scale: 1, y: "-50%", x: "-50%" }}
              exit={{ opacity: 0, scale: 0.95, y: "-40%", x: "-50%" }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm z-[301] bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-4 relative"
            >
              <button 
                onClick={() => setCancelConfirmId(null)}
                className="absolute top-4 right-4 p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-850 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X size={14} />
              </button>
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-400 mx-auto">
                <Ban size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Cancel Request?</h3>
                <p className="text-xs text-slate-400">
                  Are you sure you want to cancel the ticket <strong className="text-white">"{tickets.find(t => t._id === cancelConfirmId)?.title || 'this ticket'}"</strong>? This will mark it as closed.
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setCancelConfirmId(null)}
                  className="flex-1 py-2.5 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-350 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Keep Open
                </button>
                <button 
                  onClick={() => handleCancelTicket(cancelConfirmId)}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Yes, Cancel
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* NEW/EDIT TICKET FORM MODAL */}
      <AnimatePresence>
        {ticketForm.open && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTicketForm(f => ({ ...f, open: false }))} 
              className="fixed inset-0 bg-slate-950/80 z-[200] backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: "-40%", x: "-50%" }}
              animate={{ opacity: 1, scale: 1, y: "-50%", x: "-50%" }}
              exit={{ opacity: 0, scale: 0.95, y: "-40%", x: "-50%" }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md z-[201] bg-slate-900 border border-slate-800 rounded-[32px] p-6 sm:p-8 shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                <h3 className="text-md font-black text-white">
                  {ticketForm.editId ? 'Edit Maintenance Request' : 'New Maintenance Request'}
                </h3>
                <button 
                  onClick={() => setTicketForm({ open: false, editId: null, title: '', description: '', priority: 'medium' })} 
                  className="p-1 bg-slate-950 hover:bg-slate-800 border border-slate-850 text-slate-400 rounded-lg cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Issue Title <span className="text-red-500">*</span></label>
                  <input 
                    value={ticketForm.title} 
                    onChange={e => setTicketForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Water leak in bathroom"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-655 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Detailed Description <span className="text-red-500">*</span></label>
                  <textarea 
                    value={ticketForm.description} 
                    onChange={e => setTicketForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Describe the issue in detail so agents can send the right contractor..."
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-655 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all resize-none font-sans" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Urgency / Priority</label>
                  <select 
                    value={ticketForm.priority} 
                    onChange={e => setTicketForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-all"
                  >
                    <option value="low" className="bg-slate-905 text-white">Low — No immediate action needed</option>
                    <option value="medium" className="bg-slate-905 text-white">Medium — Repair within a week</option>
                    <option value="high" className="bg-slate-905 text-white">High — Repair within 24-48h</option>
                    <option value="urgent" className="bg-slate-905 text-white">Urgent 🚨 — Severe or dangerous hazard</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setTicketForm({ open: false, editId: null, title: '', description: '', priority: 'medium' })}
                  className="flex-1 py-3 bg-slate-950 border border-slate-855 hover:bg-slate-800 text-slate-400 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={submitTicket} 
                  disabled={submitting} 
                  className="flex-[2] py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-650 text-white rounded-xl text-xs font-black transition tracking-wider shadow-lg shadow-emerald-950/40 uppercase cursor-pointer"
                >
                  {submitting ? 'Saving…' : ticketForm.editId ? 'Save Changes' : 'Submit Ticket'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
