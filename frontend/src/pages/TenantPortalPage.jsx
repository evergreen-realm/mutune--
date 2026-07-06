import React, { useState, useEffect, useCallback } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
  ArrowUpRight, Plus, X, ZoomIn, Receipt, Edit2, Ban, Loader2, LogOut,
  Users
} from 'lucide-react';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const FMT_KES = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
const FMT_DATE = (d) => {
  if (!d) return '—';
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return '—';
  return dateObj.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
};

const estimateLocation = (property) => {
  if (property?.location?.coordinates?.length === 2) {
    return [property.location.coordinates[1], property.location.coordinates[0]];
  }
  const area = property?.address?.area?.toLowerCase() || '';
  if (area.includes('nyali')) return [-4.0298, 39.7118];
  if (area.includes('bamburi')) return [-4.0041, 39.7289];
  if (area.includes('tudor')) return [-4.0458, 39.6645];
  if (area.includes('ganjoni')) return [-4.0667, 39.6631];
  if (area.includes('likoni')) return [-4.0863, 39.6617];
  if (area.includes('shanzu')) return [-3.9749, 39.7547];
  if (area.includes('mombasa island') || area.includes('cbd')) return [-4.0547, 39.6636];
  return [-4.0435, 39.6682]; // Mombasa
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
}[s] || 'bg-muted/10 text-muted border-border');

const ticketStatusColor = (s) => ({
  open:        'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  in_progress: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  resolved:    'bg-green-500/10 text-green-400 border border-green-500/20',
  closed:      'bg-muted/10 text-muted border border-border'
}[s] || 'bg-muted/10 text-muted border border-border');

function RentCountdownTimer() {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const target = new Date();
    target.setDate(1);
    target.setMonth(target.getMonth() + 1);
    target.setHours(0, 0, 0, 0);

    const update = () => {
      const difference = target.getTime() - Date.now();
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);
      setTimeLeft({ days, hours, minutes, seconds });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900/40 to-slate-950/60 border border-indigo-500/20 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
      <div>
        <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest block mb-1">Rent Payment Countdown</span>
        <h3 className="text-base font-black text-foreground">Time Remaining Until Next Cycle</h3>
        <p className="text-[11px] text-muted mt-0.5">Please settle current balances before the countdown reaches zero to avoid late penalty interest fees.</p>
      </div>
      <div className="flex items-center gap-2 md:gap-3 text-center flex-shrink-0">
        <div className="bg-background/85 border border-border rounded-xl px-3 py-2.5 min-w-[50px] shadow-sm">
          <div className="font-mono text-lg font-black text-primary">{timeLeft.days}</div>
          <div className="text-[9px] text-muted uppercase font-bold tracking-wider">Days</div>
        </div>
        <div className="text-muted font-bold">:</div>
        <div className="bg-background/85 border border-border rounded-xl px-3 py-2.5 min-w-[50px] shadow-sm">
          <div className="font-mono text-lg font-black text-primary">{timeLeft.hours}</div>
          <div className="text-[9px] text-muted uppercase font-bold tracking-wider">Hrs</div>
        </div>
        <div className="text-muted font-bold">:</div>
        <div className="bg-background/85 border border-border rounded-xl px-3 py-2.5 min-w-[50px] shadow-sm">
          <div className="font-mono text-lg font-black text-primary">{timeLeft.minutes}</div>
          <div className="text-[9px] text-muted uppercase font-bold tracking-wider">Mins</div>
        </div>
        <div className="text-muted font-bold">:</div>
        <div className="bg-background/85 border border-border rounded-xl px-3 py-2.5 min-w-[50px] shadow-sm">
          <div className="font-mono text-lg font-black text-pink-500">{timeLeft.seconds}</div>
          <div className="text-[9px] text-muted uppercase font-bold tracking-wider">Secs</div>
        </div>
      </div>
    </div>
  );
}

// Skeleton loader component for portal
function PortalSkeleton() {
  return (
    <div className="flex flex-col items-center justify-start relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-900/20 blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-5xl space-y-6 z-10">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="h-8 w-40 bg-muted/20 rounded-lg animate-pulse" />
          <div className="h-10 w-10 bg-muted/20 rounded-full animate-pulse" />
        </div>
        
        {/* Hero skeleton */}
        <div className="rounded-3xl bg-surface border border-border p-8 space-y-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-muted/20 animate-pulse" />
            <div className="space-y-3 flex-1">
              <div className="h-4 w-32 bg-muted/20 rounded-full animate-pulse" />
              <div className="h-8 w-56 bg-muted/20 rounded-full animate-pulse" />
              <div className="h-4 w-44 bg-muted/20 rounded-full animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border/40">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-surface border border-border animate-pulse" />)}
          </div>
        </div>
        
        {/* Grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-surface border border-border animate-pulse" />)}
        </div>
        
        {/* Table skeleton */}
        <div className="bg-surface border border-border rounded-3xl p-6 space-y-4">
          <div className="h-6 w-32 bg-muted/20 rounded-full animate-pulse" />
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-surface border border-border/40 rounded-xl animate-pulse" />)}
        </div>
      </div>
    </div>
  );
}

export default function TenantPortalPage() {
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const { theme } = useThemeStore();

  const [profile,    setProfile]    = useState(null);
  const [payments,   setPayments]   = useState([]);
  const [notices,    setNotices]    = useState([]);
  const [tickets,    setTickets]    = useState([]);
  const [notifs,     setNotifs]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState('overview');
  const [timeLeft,   setTimeLeft]   = useState('00:00:00');

  useEffect(() => {
    const timer = setInterval(() => {
      const rentDueDay = profile?.rent_due_day || 5;
      const now = new Date();
      let dueDate = new Date(now.getFullYear(), now.getMonth(), rentDueDay);
      if (dueDate < now) {
        dueDate = new Date(now.getFullYear(), now.getMonth() + 1, rentDueDay);
      }
      const diff = dueDate.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft('00:00:00');
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(
        `${days.toString().padStart(2, '0')}d : ${hours.toString().padStart(2, '0')}h : ${minutes
          .toString()
          .padStart(2, '0')}m : ${seconds.toString().padStart(2, '0')}s`
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [profile]);
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
      <div className="flex items-center justify-center text-foreground relative overflow-hidden">
        {/* Glowing background mesh */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-600/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md bg-surface/60 backdrop-blur-xl border border-border rounded-[32px] p-8 shadow-2xl relative z-10 space-y-6"
        >
          <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 text-emerald-400">
            <Home className="w-8 h-8" />
          </div>
          
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-black text-foreground tracking-tight">Link Your Tenancy</h1>
            <p className="text-sm text-muted">
              Please enter your unique Tenant Code below to link your account to your lease.
            </p>
          </div>

          <form onSubmit={handleLinkTenantCode} className="space-y-4">
            <div>
              <label htmlFor="tenantCode" className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                Tenant Code
              </label>
              <input
                id="tenantCode"
                type="text"
                value={tenantCode}
                onChange={(e) => setTenantCode(e.target.value)}
                placeholder="e.g., TEN-XXXX-XXXX"
                disabled={submittingCode}
                className="w-full px-4 py-3 bg-background/80 border border-border rounded-xl text-sm text-foreground placeholder-slate-655 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono"
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

          <div className="bg-background/60 border border-border rounded-2xl p-4 flex gap-3">
            <Phone className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-muted">Need Help or Don't Have a Code?</p>
              <p className="text-xs text-muted leading-relaxed">
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
              className="text-xs font-bold text-muted hover:text-muted transition-colors uppercase tracking-wider flex items-center gap-1.5 justify-center mx-auto cursor-pointer"
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
      <div className="flex items-center justify-center text-foreground relative overflow-hidden">
        {/* Glowing background mesh */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-slate-500/5 blur-[120px] pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-xl bg-surface/60 backdrop-blur-xl border border-border rounded-[32px] p-8 shadow-2xl text-center space-y-6 relative overflow-hidden"
        >
          <div className="mx-auto w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
            <Clock className="w-8 h-8 text-amber-400 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-foreground tracking-tight">Registration Awaiting Approval</h1>
            <p className="text-sm text-muted">
              Your tenant profile has been submitted and is currently pending verification.
            </p>
          </div>

          <div className="border border-border rounded-2xl bg-background/40 p-5 text-left space-y-3.5">
            <h2 className="text-xs font-bold text-muted uppercase tracking-wider">Lease Details Summary</h2>
            <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
              <div>
                <span className="text-muted block">Tenant Code</span>
                <span className="text-foreground font-mono font-bold">{profile.tenant_code}</span>
              </div>
              <div>
                <span className="text-muted block">Assigned Rent</span>
                <span className="text-foreground font-bold">{FMT_KES(profile.rent_amount_kes)} / month</span>
              </div>
              <div>
                <span className="text-muted block">Property & Unit</span>
                <span className="text-foreground font-bold">{propertyName} — Unit {unitNo}</span>
              </div>
              <div>
                <span className="text-muted block">Property Code & Tier</span>
                <span className="text-foreground font-bold">{propertyCode} ({tierName})</span>
              </div>
            </div>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-4 text-left flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-amber-400">Next Steps</p>
              <p className="text-xs text-muted leading-relaxed">
                Once Mutune Estate Agency approves your tenancy, you will receive a registration email at <strong className="text-foreground">{profile.email || clerkUser?.emailAddresses?.[0]?.emailAddress}</strong> instructing you to make your rent payment of <strong className="text-foreground">{FMT_KES(profile.rent_amount_kes)}</strong> via the portal.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => { if (clerkUser) { signOut(); } }}
              className="px-6 py-3 bg-background/80 hover:bg-slate-700/80 text-muted rounded-xl text-xs font-bold transition-all uppercase tracking-wider flex items-center gap-2 justify-center mx-auto border border-border cursor-pointer"
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
    <div className="relative overflow-hidden pb-12">
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

      <div className="relative z-10 max-w-[1600px] mx-auto px-2 sm:px-4 pt-2">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-muted font-semibold tracking-wide uppercase mb-4">
          <span>My Portal</span>
          <ChevronRight size={10} />
          <span className="text-green-500 capitalize">{activeTab}</span>
        </div>

        {/* ── Welcome & Countdown Banner (Nano Banana Style) ─────────────────── */}
        <div className="bg-surface/70 border border-border backdrop-blur-md rounded-2xl p-6 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-foreground">
              Welcome back, <span className="text-primary">{tenantName}</span>
            </h1>
            <p className="text-xs text-muted mt-1 font-medium">
              Unit Number: <strong className="text-foreground">{unitNumber}</strong>
            </p>
          </div>
          <div className="flex flex-col md:items-end text-left md:text-right">
            <span className="text-[10px] text-muted font-extrabold uppercase tracking-wider block mb-1">
              Next Rent Due:{' '}
              <span className="text-foreground">
                {(() => {
                  const rentDueDay = profile?.rent_due_day || 5;
                  const now = new Date();
                  let dueDate = new Date(now.getFullYear(), now.getMonth(), rentDueDay);
                  if (dueDate < now) {
                    dueDate = new Date(now.getFullYear(), now.getMonth() + 1, rentDueDay);
                  }
                  return dueDate.toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });
                })()}
              </span>
            </span>
            <div className="text-lg font-black text-amber-500 font-mono tracking-widest mt-0.5">
              {timeLeft}
            </div>
          </div>
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
                <p className="text-xs text-foreground">
                  New property listed: <strong className="text-emerald-400">{n.property_name}</strong> in <strong>{n.property_area}</strong> – Tier: <strong>{n.property_tier_name}</strong> – Rent: <strong>{FMT_KES(n.property_rent)}</strong>
                </p>
              </div>
              <button 
                onClick={() => handleNotifClick(n)} 
                className="p-1.5 bg-surface/50 hover:bg-background border border-border rounded-lg text-muted hover:text-foreground transition flex-shrink-0 cursor-pointer"
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
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gradient-to-r from-red-500/10 to-amber-500/5 backdrop-blur-xl border border-red-500/30 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between shadow-lg shadow-red-950/20"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0 border border-red-500/20">
                  <AlertTriangle size={18} className="text-red-400 animate-pulse" />
                </div>
                <div>
                  <p className="text-xs font-black text-red-400 uppercase tracking-wider mb-0.5">Rent Arrears Outstanding</p>
                  <p className="text-xs text-muted">
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

        {/* HERO PROPERTY LEASE CARD - ZILLOW STYLE */}
        <div className="bg-surface/30 backdrop-blur-xl border border-border rounded-[32px] overflow-hidden shadow-2xl mb-8">
          {/* Top Panel: Photo and Mini Map side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border-b border-border/40">
            {/* House Photo Card */}
            <div className="relative rounded-2xl overflow-hidden aspect-[16/9] md:aspect-auto md:h-80 group shadow-lg border border-border/20">
              {propertyPhoto ? (
                <img 
                  src={propertyPhoto} 
                  alt={propertyName} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-950/80 to-emerald-950/80 flex flex-col items-center justify-center text-muted gap-2">
                  <Home size={48} className="text-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider">No Property Photo Available</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/40 pointer-events-none" />
              
              {/* Badges overlay */}
              <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                <span className="bg-emerald-600/90 backdrop-blur-md text-white text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-lg border border-emerald-500/30 shadow-md">
                  Active Lease
                </span>
                <span className="bg-indigo-950/90 backdrop-blur-md text-indigo-300 text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-lg border border-indigo-500/30 shadow-md">
                  {profile?.current_property_id?.type?.replace('_', ' ') || 'Property'}
                </span>
              </div>

              {arrears > 0 && (
                <span className="absolute top-4 right-4 bg-red-600/95 backdrop-blur-md text-white text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-lg border border-red-500/30 shadow-lg shadow-red-950/40 animate-pulse">
                  Arrears: {FMT_KES(arrears)}
                </span>
              )}

              {/* Bottom detail text overlay */}
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-xs text-emerald-400 font-extrabold tracking-widest uppercase mb-1">
                  MutuneRent Certified
                </p>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow">
                  {propertyName}
                </h2>
              </div>
            </div>

            {/* Mini Mombasa Map Card */}
            <div className="relative rounded-2xl overflow-hidden aspect-[16/9] md:aspect-auto md:h-80 border border-border/20 shadow-lg bg-slate-950">
              <div className="absolute top-3 left-3 z-[1000] bg-slate-950/90 backdrop-blur-md border border-border/40 rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-white pointer-events-none">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Estimated Mombasa Location</span>
              </div>
              
              {/* React Leaflet Map with estimated location */}
              {(() => {
                const mapCenter = estimateLocation(profile?.current_property_id);
                return (
                  <div className="w-full h-full relative" style={{ zIndex: 1 }}>
                    <MapContainer 
                      center={mapCenter} 
                      zoom={14} 
                      style={{ height: '100%', width: '100%' }} 
                      zoomControl={false}
                      scrollWheelZoom={false}
                      doubleClickZoom={false}
                      dragging={false}
                    >
                      <TileLayer 
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' 
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                      />
                      
                      <Circle 
                        center={mapCenter}
                        radius={150}
                        pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.15, weight: 1.5, dashArray: '4, 4' }}
                      />
                      
                      <Marker 
                        position={mapCenter}
                        icon={L.divIcon({
                          className: 'custom-tenant-marker',
                          html: `
                            <div class="relative flex items-center justify-center" style="transform: translate(-12px, -12px)">
                              <div class="absolute w-8 h-8 rounded-full bg-emerald-500/30 animate-ping"></div>
                              <div class="absolute w-6 h-6 rounded-full bg-emerald-500/50 animate-pulse"></div>
                              <div class="w-5 h-5 rounded-full bg-gradient-to-tr from-emerald-400 to-emerald-600 border border-white flex items-center justify-center shadow-lg">
                                <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
                              </div>
                            </div>
                          `,
                          iconSize: [24, 24],
                          iconAnchor: [12, 12]
                        })}
                      >
                        <Popup>
                          <div className="text-xs font-sans text-slate-800 p-1">
                            <p className="font-bold">{propertyName}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">Estimated Location</p>
                          </div>
                        </Popup>
                      </Marker>
                    </MapContainer>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Zillow home facts row */}
          <div className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-border/40 text-center bg-background/20">
            <div className="border-r border-border/30 last:border-0">
              <span className="text-lg sm:text-xl font-extrabold text-foreground">{matchedUnit?.bedrooms || 1}</span>
              <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mt-0.5">Beds</span>
            </div>
            <div className="border-r border-border/30 last:border-0">
              <span className="text-lg sm:text-xl font-extrabold text-foreground">{matchedUnit?.bathrooms || 1}</span>
              <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mt-0.5">Baths</span>
            </div>
            <div className="border-r border-border/30 last:border-0">
              <span className="text-lg sm:text-xl font-extrabold text-foreground">{matchedUnit?.size_sqft || 650}</span>
              <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mt-0.5">Sq Ft</span>
            </div>
            <div>
              <span className="text-lg sm:text-xl font-extrabold text-emerald-400 capitalize">{profile.tenancy_status || 'Active'}</span>
              <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mt-0.5">Status</span>
            </div>
          </div>

          {/* Main Details Section */}
          <div className="p-6 sm:p-8 flex flex-col lg:flex-row justify-between gap-6">
            <div className="space-y-6 flex-1">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-border/40 pb-5">
                <div>
                  <span className="text-[10px] font-extrabold text-muted uppercase tracking-widest block mb-1">
                    Mutune Rent Zestimate<sup>®</sup>
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-black text-white">{FMT_KES(unitRent || rent)}</span>
                    <span className="text-xs text-muted">/mo</span>
                  </div>
                  <p className="text-xs text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                    <TrendingUp size={12} /> Live market rate valuation for {propertyArea}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background/40 border border-border p-3 rounded-xl min-w-[120px]">
                    <span className="text-[9px] font-bold text-muted uppercase tracking-wider block mb-0.5">Last Payment</span>
                    <p className="text-xs font-black text-emerald-400">{lastPayment ? FMT_KES(lastPayment.amount_kes) : '—'}</p>
                    <span className="text-[9px] text-muted mt-0.5 block truncate">
                      {lastPayment ? FMT_DATE(lastPayment.created_at) : 'No history'}
                    </span>
                  </div>
                  <div className="bg-background/40 border border-border p-3 rounded-xl min-w-[120px]">
                    <span className="text-[9px] font-bold text-muted uppercase tracking-wider block mb-0.5">Lease End</span>
                    <p className="text-xs font-black text-foreground">{FMT_DATE(profile?.lease_end)}</p>
                    <span className="text-[9px] text-muted mt-0.5 block truncate font-medium">
                      Starts: {FMT_DATE(profile?.lease_start)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-background/20 border border-border/60 rounded-2xl p-4 max-w-xl">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">Estimated Monthly Costs</h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted">Base Rent</span>
                    <span className="font-semibold text-foreground">{FMT_KES(unitRent || rent)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border/20 pt-1.5">
                    <span className="text-muted">Service Charge (Inc.)</span>
                    <span className="font-semibold text-emerald-400">KES 0</span>
                  </div>
                  <div className="flex justify-between border-t border-border/20 pt-1.5">
                    <span className="text-muted">Utility Deposit (Reserve)</span>
                    <span className="font-semibold text-indigo-400">KES 2,500</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Agent Zillow-style widget */}
            <div className="bg-gradient-to-br from-indigo-950/30 to-slate-900/50 backdrop-blur-md border border-indigo-500/20 rounded-2xl p-5 min-w-[280px] lg:max-w-xs space-y-4 shadow-xl self-start">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Users size={20} />
                </div>
                <div>
                  <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Property Agent</p>
                  <p className="text-xs font-black text-foreground">{profile?.current_property_id?.agent_ids?.[0]?.full_name || 'Mutune Estate Agent'}</p>
                </div>
              </div>
              
              <div className="space-y-2 pt-1">
                <a 
                  href={`tel:${formatPhoneHref(agentPhone)}`}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer text-center"
                >
                  <Phone size={12} /> Call Agent
                </a>
                <a 
                  href={`https://wa.me/${formatPhoneHref(agentPhone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer text-center"
                >
                  <Mail size={12} /> WhatsApp Agent
                </a>
              </div>
            </div>
          </div>

          {/* Elegant Custom Sliding Tab Bar */}
          <div className="px-6 sm:px-8 pb-5 flex gap-2 overflow-x-auto scrollbar-none border-t border-border/50 pt-4">
            {tabs.map(tab => (
              <button 
                key={tab.key} 
                onClick={() => setActiveTab(tab.key)} 
                className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl cursor-pointer text-xs font-bold tracking-wide transition duration-300 flex-shrink-0 ${
                  activeTab === tab.key ? 'text-foreground' : 'text-muted hover:text-muted'
                }`}
              >
                {activeTab === tab.key && (
                  <motion.div 
                    layoutId="activeTabSlider"
                    className="absolute inset-0 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className={activeTab === tab.key ? 'text-emerald-400' : 'text-muted'}>
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
            {/* OVERVIEW TAB (Nano Banana 2b Layout) */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Full-width Welcome Countdown banner */}
                <div className="lg:col-span-3">
                  <RentCountdownTimer />
                </div>
                {/* Left Column (2/3 width on desktop) */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Rent Payment Card */}
                  <div className="bg-surface/30 backdrop-blur-md border border-border rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                      <div>
                        <h2 className="text-xs text-muted font-extrabold uppercase tracking-wider">Rent Payment</h2>
                        <p className="text-[10px] text-muted mt-0.5">Current rent amount due</p>
                      </div>
                      <span className="bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg">
                        Current due
                      </span>
                    </div>

                    <div className="py-4">
                      <div className="text-3xl font-black text-foreground font-mono tracking-tight">
                        {FMT_KES(unitRent || rent)}
                      </div>
                    </div>

                    <button
                      onClick={handlePayRent}
                      disabled={paying}
                      className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-primary hover:from-indigo-500 hover:to-primary/90 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
                    >
                      <CreditCard size={14} /> {paying ? 'Connecting...' : 'M-Pesa pay'}
                    </button>
                  </div>

                  {/* Payment History Card */}
                  <div className="bg-surface/30 backdrop-blur-md border border-border rounded-2xl p-6 shadow-xl">
                    <h3 className="text-xs font-extrabold text-foreground uppercase tracking-wider mb-4">Payment History</h3>
                    {payments.length === 0 ? (
                      <p className="text-xs text-muted py-6 text-center">No payment history found.</p>
                    ) : (
                      <div className="space-y-4">
                        {payments.slice(0, 5).map((p) => (
                          <div key={p._id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0 last:pb-0">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/25">
                                <CheckCircle2 size={16} />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-foreground">Current Payment</p>
                                <p className="text-[10px] text-muted mt-0.5">{FMT_DATE(p.created_at)}</p>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-foreground font-mono">
                              {FMT_KES(p.amount_kes)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column (1/3 width on desktop) */}
                <div className="space-y-6">
                  {/* Maintenance Request Card */}
                  <div className="bg-surface/30 backdrop-blur-md border border-border rounded-2xl p-6 shadow-xl space-y-4">
                    <h3 className="text-xs font-extrabold text-foreground uppercase tracking-wider border-b border-border pb-3">
                      Maintenance Request
                    </h3>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Issue Title</label>
                        <input
                          type="text"
                          placeholder="Enter issue title..."
                          value={ticketForm.title}
                          onChange={(e) => setTicketForm(f => ({ ...f, title: e.target.value }))}
                          className="w-full bg-background/50 border border-border rounded-xl px-3 py-2 text-xs focus:border-primary focus:outline-none transition"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Description</label>
                        <textarea
                          placeholder="Enter maintenance details here..."
                          value={ticketForm.description}
                          onChange={(e) => setTicketForm(f => ({ ...f, description: e.target.value }))}
                          className="w-full h-24 bg-background/50 border border-border rounded-xl px-3 py-2 text-xs focus:border-primary focus:outline-none transition resize-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Priority Level</label>
                        <select
                          value={ticketForm.priority}
                          onChange={(e) => setTicketForm(f => ({ ...f, priority: e.target.value }))}
                          className="w-full bg-background/50 border border-border rounded-xl px-3 py-2.5 text-xs focus:border-primary focus:outline-none transition"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="emergency">Emergency</option>
                        </select>
                      </div>

                      {/* Photo Upload area */}
                      <div>
                        <label className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Photos</label>
                        <div className="border border-dashed border-border/80 rounded-xl p-4 text-center hover:border-primary cursor-pointer transition">
                          <Plus size={20} className="text-muted mx-auto mb-1" />
                          <span className="text-[10px] text-muted font-semibold">Upload Photos</span>
                        </div>
                      </div>

                      <button
                        onClick={submitTicket}
                        disabled={submitting}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition uppercase tracking-wider shadow-md"
                      >
                        {submitting ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bottom Row - Active Lease Summary */}
                <div className="lg:col-span-3 bg-surface/30 backdrop-blur-md border border-border rounded-2xl p-6 shadow-xl">
                  <h3 className="text-xs font-extrabold text-foreground uppercase tracking-wider mb-4 border-b border-border pb-3 flex items-center gap-2">
                    <Home size={14} className="text-emerald-400" /> Active Lease Summary
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                    {/* Property Image */}
                    <div className="md:col-span-1 rounded-xl overflow-hidden aspect-[4/3] border border-border/30">
                      {propertyPhoto ? (
                        <img src={propertyPhoto} alt={propertyName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-950/40 to-slate-900/40 flex items-center justify-center text-muted">
                          <Home size={28} />
                        </div>
                      )}
                    </div>

                    {/* Lease details */}
                    <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-6 text-xs">
                      <div>
                        <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Start Date</span>
                        <p className="font-bold text-foreground">{FMT_DATE(profile?.lease_start)}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">End Date</span>
                        <p className="font-bold text-foreground">{FMT_DATE(profile?.lease_end)}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Landlord Contact</span>
                        <p className="font-bold text-foreground">{profile?.current_property_id?.landlord_id?.email || 'landlord@gmail.com'}</p>
                        <p className="text-[10px] text-muted mt-0.5">08123567879</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PAYMENTS TAB */}
            {activeTab === 'payments' && (
              <div className="bg-surface/30 backdrop-blur-md border border-border rounded-[24px] p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-4 gap-4">
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Statement of Accounts</h2>
                    <p className="text-xs text-muted mt-1">Check verified transactions and receipts.</p>
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
                    <p className="text-xs text-muted">No payment statement found for this account.</p>
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
                          className="bg-background/40 border border-border p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-border transition duration-300"
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
                              <p className="text-xs font-black text-foreground">{FMT_KES(p.amount_kes)}</p>
                              {receipt && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Receipt size={10} className="text-emerald-400" />
                                  <span className="text-xs text-emerald-400 font-mono font-bold tracking-wider">{receipt}</span>
                                </div>
                              )}
                              <p className="text-xs text-muted mt-1">
                                {isMpesa ? 'M-Pesa Auto' : (p.channel || 'Internal Collection')} · {FMT_DATE(p.created_at)}
                                {!receipt && ref && ` · Ref: ${ref.slice(0, 14)}`}
                              </p>
                              <p className="text-xs text-muted font-bold uppercase tracking-wider mt-0.5">{p.payment_type || 'rent'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <span className={`text-xs font-extrabold uppercase px-3 py-1 border rounded-full ${statusColor(p.status)}`}>
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
                                className="bg-surface hover:bg-background border border-border hover:border-slate-750 text-muted hover:text-foreground rounded-lg px-2.5 py-1 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
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
              <div className="bg-surface/30 backdrop-blur-md border border-border rounded-[24px] p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Maintenance Reports</h2>
                    <p className="text-xs text-muted mt-1">Report plumbing, electrical or structural issues.</p>
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
                    <p className="text-xs text-muted">No active maintenance logs.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tickets.map(t => (
                      <div 
                        key={t._id} 
                        className="bg-background/40 border border-border p-5 rounded-2xl flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:border-border transition duration-300"
                      >
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-bold text-foreground truncate">{t.title}</h4>
                            <span className={`text-xs font-extrabold uppercase px-2 py-0.5 rounded-full ${ticketStatusColor(t.status)}`}>
                              {t.status?.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-xs text-muted leading-relaxed break-words">{t.description}</p>
                          <div className="flex items-center gap-2 text-xs text-muted flex-wrap">
                            <span>Priority:</span>
                            <span className={`font-bold capitalize ${
                              t.priority === 'urgent' ? 'text-red-400' : t.priority === 'high' ? 'text-amber-400' : 'text-muted'
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
                              className="px-2.5 py-1 bg-surface hover:bg-background border border-border text-muted text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 size={10} /> Edit
                            </button>
                            <button
                              onClick={() => setCancelConfirmId(t._id)}
                              className="px-2.5 py-1 bg-red-500/10 hover:bg-red-950/40 border border-red-500/20 text-red-400 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
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
              <div className="bg-surface/30 backdrop-blur-md border border-border rounded-[24px] p-6 space-y-6">
                <div>
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Estate Broadcasts</h2>
                  <p className="text-xs text-muted mt-1">Official communications from Mutune Agency management.</p>
                </div>

                {notices.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText size={40} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-xs text-muted">No broadcasts at this time.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {notices.map(n => (
                      <div key={n._id} className="py-4 first:pt-0 last:pb-0 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-xs font-bold text-foreground">{n.title}</h4>
                          <span className={`text-xs font-black uppercase px-2 py-0.5 rounded-full ${
                            n.type === 'urgent' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-background text-muted'
                          }`}>
                            {n.type || 'General'}
                          </span>
                        </div>
                        <p className="text-xs text-muted leading-relaxed">{n.body || n.content}</p>
                        <p className="text-xs text-muted font-semibold">{FMT_DATE(n.created_at)}</p>
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
              className="fixed inset-0 bg-background/70 z-[100] backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-sm z-[101] bg-surface border-l border-border flex flex-col shadow-2xl"
            >
              <div className="p-5 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Notifications</h3>
                  {unread > 0 && <p className="text-xs text-emerald-400 font-bold mt-0.5">{unread} unread updates</p>}
                </div>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button 
                      onClick={handleMarkAllRead} 
                      className="px-2.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold cursor-pointer transition"
                    >
                      Clear All
                    </button>
                  )}
                  <button 
                    onClick={() => setNotifOpen(false)} 
                    className="p-1.5 bg-background hover:bg-background border border-border rounded-lg text-muted cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-border/50">
                {notifs.length === 0 ? (
                  <div className="text-center py-16">
                    <Bell size={28} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-xs text-muted">No alerts logged.</p>
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
                        <p className={`text-xs font-bold ${isRead ? 'text-muted' : 'text-foreground'}`}>{n.title}</p>
                        <p className="text-xs text-muted mt-1 leading-relaxed">{n.message}</p>
                        <p className="text-xs text-muted font-bold uppercase tracking-wider mt-2">{FMT_DATE(n.created_at)}</p>
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
              className="fixed inset-0 bg-background/80 z-[300] backdrop-blur-sm" 
            />
             <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: "-40%", x: "-50%" }}
              animate={{ opacity: 1, scale: 1, y: "-50%", x: "-50%" }}
              exit={{ opacity: 0, scale: 0.95, y: "-40%", x: "-50%" }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm z-[301] bg-surface border border-border rounded-3xl p-6 shadow-2xl text-center space-y-4 relative"
            >
              <button 
                onClick={() => setCancelConfirmId(null)}
                className="absolute top-4 right-4 p-1.5 bg-background hover:bg-background border border-border rounded-lg text-muted hover:text-foreground transition cursor-pointer"
              >
                <X size={14} />
              </button>
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-400 mx-auto">
                <Ban size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">Cancel Request?</h3>
                <p className="text-xs text-muted">
                  Are you sure you want to cancel the ticket <strong className="text-foreground">"{tickets.find(t => t._id === cancelConfirmId)?.title || 'this ticket'}"</strong>? This will mark it as closed.
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setCancelConfirmId(null)}
                  className="flex-1 py-2.5 bg-background border border-border hover:bg-background text-muted rounded-xl text-xs font-bold transition cursor-pointer"
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
              className="fixed inset-0 bg-background/80 z-[200] backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: "-40%", x: "-50%" }}
              animate={{ opacity: 1, scale: 1, y: "-50%", x: "-50%" }}
              exit={{ opacity: 0, scale: 0.95, y: "-40%", x: "-50%" }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md z-[201] bg-surface border border-border rounded-[32px] p-6 sm:p-8 shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-md font-black text-foreground">
                  {ticketForm.editId ? 'Edit Maintenance Request' : 'New Maintenance Request'}
                </h3>
                <button 
                  onClick={() => setTicketForm({ open: false, editId: null, title: '', description: '', priority: 'medium' })} 
                  className="p-1 bg-background hover:bg-background border border-border text-muted rounded-lg cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Issue Title <span className="text-red-500">*</span></label>
                  <input 
                    value={ticketForm.title} 
                    onChange={e => setTicketForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Water leak in bathroom"
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-slate-655 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Detailed Description <span className="text-red-500">*</span></label>
                  <textarea 
                    value={ticketForm.description} 
                    onChange={e => setTicketForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Describe the issue in detail so agents can send the right contractor..."
                    rows={4}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-slate-655 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all resize-none font-sans" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Urgency / Priority</label>
                  <select 
                    value={ticketForm.priority} 
                    onChange={e => setTicketForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-emerald-500 transition-all"
                  >
                    <option value="low" className="bg-surface text-foreground">Low — No immediate action needed</option>
                    <option value="medium" className="bg-surface text-foreground">Medium — Repair within a week</option>
                    <option value="high" className="bg-surface text-foreground">High — Repair within 24-48h</option>
                    <option value="urgent" className="bg-surface text-foreground">Urgent 🚨 — Severe or dangerous hazard</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setTicketForm({ open: false, editId: null, title: '', description: '', priority: 'medium' })}
                  className="flex-1 py-3 bg-background border border-border hover:bg-background text-muted rounded-xl text-xs font-bold transition cursor-pointer"
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
