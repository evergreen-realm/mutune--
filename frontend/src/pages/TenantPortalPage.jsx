import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  fetchCustomerCareNumber, autoInitiatePayment, initiateBankPayment, updateUserRole,
  requestLeaseSigningOTP, verifyAndSignLease, fetchLeaseSignatureStatus, generateLegalPDF,
  purchasePrepaidToken
} from '../lib/api';
import ImageUpload from '../components/ImageUpload';
import SplatViewerModal from '../components/SplatViewerModal';
import BuildingPreview3D from '../components/BuildingPreview3D';
import TenantRentSection from '../components/TenantRentSection';
import TenantUtilitySection from '../components/TenantUtilitySection';
import TenantLeaseSection from '../components/TenantLeaseSection';
import TenantMaintenanceSection from '../components/TenantMaintenanceSection';
import {
  Home, Wallet, Wrench, FileText, Bell, ChevronRight,
  CheckCircle2, AlertTriangle, Clock, TrendingUp, Star,
  Phone, Mail, MapPin, Calendar, CreditCard, Activity,
  ArrowUpRight, Plus, X, ZoomIn, Receipt, Edit2, Ban, Loader2, LogOut,
  Users, Building, Landmark, ShieldCheck, Key, FileCheck, Download,
  Zap, Copy
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

function RentCountdownTimer({ dueDay = 5 }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const now = new Date();
    let target = new Date(now.getFullYear(), now.getMonth(), dueDay);
    if (target < now) {
      target = new Date(now.getFullYear(), now.getMonth() + 1, dueDay);
    }

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
    <div className="bg-slate-900/60 dark:bg-slate-950/65 backdrop-blur-md border border-slate-800/40 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
      <div>
        <span className="text-[10px] text-blue-400 font-extrabold uppercase tracking-widest block mb-1">Rent Payment Countdown</span>
        <h3 className="text-base font-black text-white">Time Remaining Until Next Cycle</h3>
        <p className="text-[11px] text-slate-400 mt-1 font-semibold">Please settle current balances before the countdown reaches zero to avoid late penalty interest fees.</p>
      </div>
      <div className="flex items-center gap-2 md:gap-3 text-center flex-shrink-0">
        <div className="bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 min-w-[55px] shadow-[0_0_15px_rgba(59,130,246,0.15)]">
          <div className="font-mono text-lg font-black text-blue-400" style={{ textShadow: '0 0 8px rgba(59, 130, 246, 0.6)' }}>{timeLeft.days}</div>
          <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Days</div>
        </div>
        <div className="text-slate-500 font-bold">:</div>
        <div className="bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 min-w-[55px] shadow-[0_0_15px_rgba(59,130,246,0.15)]">
          <div className="font-mono text-lg font-black text-blue-400" style={{ textShadow: '0 0 8px rgba(59, 130, 246, 0.6)' }}>{timeLeft.hours}</div>
          <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Hrs</div>
        </div>
        <div className="text-slate-500 font-bold">:</div>
        <div className="bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 min-w-[55px] shadow-[0_0_15px_rgba(59,130,246,0.15)]">
          <div className="font-mono text-lg font-black text-blue-400" style={{ textShadow: '0 0 8px rgba(59, 130, 246, 0.6)' }}>{timeLeft.minutes}</div>
          <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Mins</div>
        </div>
        <div className="text-slate-500 font-bold">:</div>
        <div className="bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 min-w-[55px] shadow-[0_0_15px_rgba(244,63,94,0.15)]">
          <div className="font-mono text-lg font-black text-rose-500" style={{ textShadow: '0 0 8px rgba(244, 63, 94, 0.6)' }}>{timeLeft.seconds}</div>
          <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Secs</div>
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
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/20 blur-[120px] pointer-events-none" />
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
  const [splatViewerOpen, setSplatViewerOpen] = useState(false);

  const [notifOpen,  setNotifOpen]  = useState(false);
  const [ticketForm, setTicketForm] = useState({ open: false, editId: null, title: '', description: '', priority: 'medium', category: 'other', photos: [] });
  const [propertyCardTab, setPropertyCardTab] = useState('lease'); // 'lease' | 'property' | '3d'
  const [submitting, setSubmitting] = useState(false);
  const [cancelConfirmId, setCancelConfirmId] = useState(null);

  const [tenantCode, setTenantCode] = useState('');
  const [submittingCode, setSubmittingCode] = useState(false);

  const [customerCare, setCustomerCare] = useState('254700000000');
  const [paying, setPaying] = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  // Digital Lease E-Signing State (Phase 4)
  const [leaseSignature, setLeaseSignature] = useState(null);
  const [signingOtp, setSigningOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [signingLoading, setSigningLoading] = useState(false);

  // KPLC Prepaid Token Vending State (Phase 6)
  const [tokenMeter, setTokenMeter] = useState('');
  const [tokenAmount, setTokenAmount] = useState(500);
  const [tokenPaymentMethod, setTokenPaymentMethod] = useState('mpesa'); // 'mpesa' | 'bank'
  const [vendedTokenResult, setVendedTokenResult] = useState(null);
  const [buyingToken, setBuyingToken] = useState(false);

  const handlePurchaseToken = async (e) => {
    e.preventDefault();
    if (!tokenMeter) {
      toast.error('Please enter your KPLC Prepaid Meter number');
      return;
    }
    if (!tokenAmount || tokenAmount < 50) {
      toast.error('Minimum token purchase is KES 50');
      return;
    }

    setBuyingToken(true);
    const toastId = toast.loading(`Vending KPLC token for meter ${tokenMeter}...`);
    try {
      const res = await purchasePrepaidToken({
        meter_number: tokenMeter.trim(),
        amount_kes: Number(tokenAmount),
        payment_method: tokenPaymentMethod,
        tenant_id: profile?._id,
        unit_id: profile?.current_unit_id,
        property_id: profile?.current_property_id?._id
      });

      if (res?.data?.success) {
        toast.update(toastId, { render: 'KPLC token vended successfully! ✓', type: 'success', isLoading: false, autoClose: 5000 });
        setVendedTokenResult(res.data.data);
      } else {
        toast.update(toastId, { render: res?.data?.error?.message || 'Token vending failed', type: 'error', isLoading: false, autoClose: 5000 });
      }
    } catch (err) {
      toast.update(toastId, { render: err?.response?.data?.error?.message || err?.message || 'Error vending token', type: 'error', isLoading: false, autoClose: 5000 });
    } finally {
      setBuyingToken(false);
    }
  };

  const handlePayRent = async () => {
    setPaying(true);
    const toastId = toast.loading('Initiating rent payment STK push...');
    try {
      const res = await autoInitiatePayment();
      if (res?.success) {
        toast.update(toastId, { render: 'Payment request sent! Please enter your PIN on your handset.', type: 'success', isLoading: false, autoClose: 5000 });
        setShowSuccessOverlay(true);
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

  const handlePayBank = async () => {
    if (!profile?._id) {
      toast.error('Tenant profile not loaded');
      return;
    }
    setPaying(true);
    const toastId = toast.loading('Opening Multi-Bank & Card payment gateway...');
    try {
      const amountToPay = unitRent || rent || 10000;
      const res = await initiateBankPayment({
        tenant_id: profile._id,
        amount_kes: amountToPay,
        payment_type: 'rent'
      });
      if (res?.data?.data?.checkout_url) {
        toast.update(toastId, { render: 'Redirecting to secure bank gateway...', type: 'success', isLoading: false, autoClose: 2000 });
        window.location.href = res.data.data.checkout_url;
      } else {
        toast.update(toastId, { render: 'Bank checkout session created successfully', type: 'success', isLoading: false, autoClose: 4000 });
      }
    } catch (err) {
      toast.update(toastId, { render: err?.response?.data?.error || err?.message || 'Bank payment gateway error', type: 'error', isLoading: false, autoClose: 5000 });
    } finally {
      setPaying(false);
    }
  };

  const handleRequestSigningOTP = async () => {
    if (!profile?._id) return;
    setSigningLoading(true);
    try {
      const res = await requestLeaseSigningOTP(profile._id);
      if (res?.data?.success) {
        setOtpRequested(true);
        toast.success(res.data.message || 'Signing OTP sent to your phone');
      } else {
        toast.error(res?.data?.error?.message || 'Failed to send signing OTP');
      }
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Error requesting signing OTP');
    } finally {
      setSigningLoading(false);
    }
  };

  const handleVerifyAndSign = async (e) => {
    e.preventDefault();
    if (!signingOtp || signingOtp.length !== 6) {
      toast.error('Please enter the 6-digit OTP received via SMS');
      return;
    }
    setSigningLoading(true);
    try {
      const res = await verifyAndSignLease({
        tenant_id: profile._id,
        otp_code: signingOtp.trim()
      });
      if (res?.data?.success) {
        toast.success('Lease agreement digitally signed & verified ✓');
        setLeaseSignature(res.data.data);
        setOtpRequested(false);
        setSigningOtp('');
      } else {
        toast.error(res?.data?.error?.message || 'Signing verification failed');
      }
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Error verifying signing code');
    } finally {
      setSigningLoading(false);
    }
  };

  const handleDownloadSignedLease = async () => {
    try {
      const response = await generateLegalPDF('lease_agreement', {
        tenant_name: tenantName,
        tenant_code: profile?.tenant_code,
        tenant_phone: profile?.phone,
        property_name: propertyName,
        unit_number: unitNumber,
        rent_amount_kes: unitRent,
        deposit_amount_kes: profile?.deposit_kes || unitRent,
        lease_duration_months: 12,
        is_digitally_signed: true,
        signature_hash: leaseSignature?.verification_hash || 'SHA256-MUTUNE-SECURE-LEAD-9988',
        signed_at: leaseSignature?.signed_at || new Date().toISOString()
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Signed_Lease_${profile?.tenant_code || 'Tenancy'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Downloaded signed lease agreement ✓');
    } catch (err) {
      toast.error('Failed to download signed lease');
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
        const prof = p.value?.data || null;
        setProfile(prof);
        if (prof?._id) {
          try {
            const sigRes = await fetchLeaseSignatureStatus(prof._id);
            if (sigRes?.data?.data?.signing_status) {
              setLeaseSignature(sigRes.data.data);
            }
          } catch (sigErr) {
            // quiet signature lookup
          }
        }
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
    const propId = profile?.current_property_id?._id || profile?.current_property_id;
    const unitId = profile?.current_unit_id?._id || profile?.current_unit_id;
    if (!propId || !unitId) {
      toast.error('No linked property/unit found. Link your tenancy first.');
      return;
    }
    setSubmitting(true);
    try {
      if (ticketForm.editId) {
        await updateMaintenanceTicket(ticketForm.editId, {
          title: ticketForm.title.trim(),
          description: ticketForm.description.trim(),
          priority: ticketForm.priority,
          category: ticketForm.category || 'other',
          photos: ticketForm.photos || []
        });
        toast.success('Request updated!');
      } else {
        await createMaintenanceTicket({
          title: ticketForm.title.trim(),
          description: ticketForm.description.trim(),
          priority: ticketForm.priority,
          category: ticketForm.category || 'other',
          property_id: propId,
          unit_id: unitId,
          photos: ticketForm.photos || []
        });
        toast.success('Maintenance request submitted!');
      }
      setTicketForm({ open: false, editId: null, title: '', description: '', priority: 'medium', category: 'other', photos: [] });
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
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

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
    { key: 'lease',     label: 'Lease & E-Sign', icon: <FileCheck size={14} /> },
    { key: 'tickets',   label: 'Maintenance',icon: <Wrench size={14} /> },
    { key: 'notices',   label: 'Notices',    icon: <Bell size={14} /> }
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
          className="absolute top-[-10%] right-[-10%] w-[550px] h-[550px] rounded-full bg-blue-900/10 blur-[130px]" 
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
              className="bg-gradient-to-r from-emerald-500/10 to-blue-500/5 backdrop-blur-xl border border-emerald-500/25 rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-emerald-950/20 overflow-hidden"
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

        {/* Countdown timer card render */}
        <div className="mb-6">
          <RentCountdownTimer dueDay={profile?.rent_due_day || 5} />
        </div>

        {/* HERO PROPERTY LEASE CARD - ZILLOW STYLE */}
        <div className="bg-surface/30 backdrop-blur-xl border border-border rounded-[32px] overflow-hidden shadow-2xl mb-8">
          {/* Top Panel: Photo and Mini Map side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border-b border-border/40">
            {/* House Photo/Map/3D Tab Card */}
            <div className="relative rounded-2xl overflow-hidden aspect-[16/9] md:aspect-auto md:h-80 group shadow-lg border border-border/20">
              {propertyCardTab === 'lease' && (
                propertyPhoto ? (
                  <img 
                    src={propertyPhoto} 
                    alt={propertyName} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-950/80 to-emerald-950/80 flex flex-col items-center justify-center text-muted gap-2">
                    <Home size={48} className="text-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider">No Property Photo Available</span>
                  </div>
                )
              )}

              {propertyCardTab === 'property' && (
                <div className="relative w-full h-full bg-slate-950 flex items-center justify-center">
                  <img 
                    src="/assets/voxel_floorplan.png" 
                    alt="Property Plan Layout" 
                    className="w-full h-full object-contain p-2 hover:scale-[1.02] transition-transform duration-500" 
                  />
                  <div className="absolute bottom-4 right-4 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                    3D Floorplan Layout
                  </div>
                </div>
              )}

              {propertyCardTab === '3d' && (
                <div className="relative w-full h-full bg-slate-950 flex items-center justify-center">
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                    {profile?.current_property_id?.splatUrl || profile?.current_property_id?.assets?.some(a => a.type === 'splat') ? (
                      <div className="text-center z-20">
                        <p className="text-slate-400 mb-4 text-sm font-medium">A high-resolution 3D scan is available for this property.</p>
                        <button
                          onClick={() => setSplatViewerOpen(true)}
                          className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg transition-colors cursor-pointer"
                        >
                          Launch 3D Splat Viewer
                        </button>
                      </div>
                    ) : (
                      <Suspense fallback={<div className="animate-pulse text-slate-500 font-bold tracking-widest text-sm uppercase">Loading 3D model...</div>}>
                        <div className="w-full h-full z-10" style={{ pointerEvents: 'auto' }}>
                          <BuildingPreview3D 
                            property={profile?.current_property_id} 
                            theme="dark" 
                          />
                        </div>
                      </Suspense>
                    )}
                  </div>
                  <div className="absolute bottom-4 right-4 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 text-[10px] font-bold text-purple-400 uppercase tracking-widest pointer-events-none z-30">
                    Interactive 3D View
                  </div>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/40 pointer-events-none" />
              
              {/* Badges overlay / Tab selectors */}
              <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-10">
                <button 
                  onClick={() => setPropertyCardTab('lease')}
                  className={`backdrop-blur-md text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-lg border transition-all shadow-md cursor-pointer ${
                    propertyCardTab === 'lease'
                      ? 'bg-emerald-600/90 text-white border-emerald-500/30'
                      : 'bg-slate-900/60 hover:bg-slate-900/80 text-slate-300 border-slate-700/30'
                  }`}
                >
                  Active Lease
                </button>
                <button 
                  onClick={() => setPropertyCardTab('property')}
                  className={`backdrop-blur-md text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-lg border transition-all shadow-md cursor-pointer ${
                    propertyCardTab === 'property'
                      ? 'bg-blue-600/90 text-white border-blue-500/30'
                      : 'bg-slate-900/60 hover:bg-slate-900/80 text-slate-300 border-slate-700/30'
                  }`}
                >
                  {profile?.current_property_id?.type?.replace('_', ' ') || 'Property Plan'}
                </button>
                <button 
                  onClick={() => setPropertyCardTab('3d')}
                  className={`backdrop-blur-md text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-lg border transition-all shadow-md cursor-pointer ${
                    propertyCardTab === '3d'
                      ? 'bg-purple-600/90 text-white border-purple-500/30'
                      : 'bg-slate-900/60 hover:bg-slate-900/80 text-slate-300 border-slate-700/30'
                  }`}
                >
                  3D View
                </button>
              </div>

              {arrears > 0 && (
                <span className="absolute top-4 right-4 bg-red-600/95 backdrop-blur-md text-white text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-lg border border-red-500/30 shadow-lg shadow-red-950/40 animate-pulse z-10">
                  Arrears: {FMT_KES(arrears)}
                </span>
              )}

              {/* Bottom detail text overlay */}
              <div className="absolute bottom-4 left-4 right-4 pointer-events-none">
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
                    <span className="font-semibold text-blue-400">KES 2,500</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-950/30 to-slate-900/50 backdrop-blur-md border border-blue-500/20 rounded-2xl p-5 min-w-[280px] lg:max-w-xs space-y-4 shadow-xl self-start">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Users size={20} />
                </div>
                <div>
                  <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Property Agent</p>
                  <p className="text-xs font-black text-foreground">{profile?.current_property_id?.agent_ids?.[0]?.full_name || 'Mutune Estate Agent'}</p>
                </div>
              </div>
              
              <div className="space-y-2 pt-1">
                <a 
                  href={`tel:${formatPhoneHref(agentPhone)}`}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer text-center"
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left Column (2/3 width on desktop) */}
                <div className="lg:col-span-2 space-y-5">
                  {/* Rent Payment Card */}
                  <div className="bg-surface/30 backdrop-blur-md border border-border rounded-2xl p-5 shadow-xl">
                    <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
                      <div>
                        <h2 className="text-xs text-muted font-extrabold uppercase tracking-wider">Rent Payment</h2>
                        <p className="text-[10px] text-muted mt-0.5">Current rent amount due</p>
                      </div>
                      <span className="bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg">
                        Current due
                      </span>
                    </div>

                    <div className="py-3">
                      <div className="text-3xl font-black text-foreground font-mono tracking-tight">
                        {FMT_KES(unitRent || rent)}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        onClick={handlePayRent}
                        disabled={paying}
                        className="py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
                      >
                        <CreditCard size={14} /> {paying ? 'Connecting...' : 'M-Pesa STK'}
                      </button>
                      <button
                        onClick={handlePayBank}
                        disabled={paying}
                        className="py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
                      >
                        <Landmark size={14} /> {paying ? 'Connecting...' : 'Bank / Card Pay'}
                      </button>
                    </div>
                  </div>

                  {/* Payment History Card */}
                  <div className="bg-surface/30 backdrop-blur-md border border-border rounded-2xl p-5 shadow-xl">
                    <h3 className="text-xs font-extrabold text-foreground uppercase tracking-wider mb-3">Payment History</h3>
                    {payments.length === 0 ? (
                      <p className="text-xs text-muted py-5 text-center">No payment history found.</p>
                    ) : (
                      <div className="space-y-3">
                        {payments.slice(0, 5).map((p) => (
                          <div key={p._id} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0 last:pb-0">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/25">
                                <CheckCircle2 size={14} />
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
                <div className="space-y-5">
                  {/* Maintenance Request Card */}
                  <div className="bg-surface/30 backdrop-blur-md border border-border rounded-2xl p-5 shadow-xl space-y-3.5">
                    <h3 className="text-xs font-extrabold text-foreground uppercase tracking-wider border-b border-border pb-2.5">
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
                        <label className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Category</label>
                        <select
                          value={ticketForm.category}
                          onChange={(e) => setTicketForm(f => ({ ...f, category: e.target.value }))}
                          className="w-full bg-background/50 border border-border rounded-xl px-3 py-2.5 text-xs focus:border-primary focus:outline-none transition"
                        >
                          <option value="plumbing">Plumbing</option>
                          <option value="electrical">Electrical</option>
                          <option value="structural">Structural</option>
                          <option value="security">Security</option>
                          <option value="appliance">Appliance</option>
                          <option value="pest_control">Pest Control</option>
                          <option value="cleaning">Cleaning</option>
                          <option value="other">Other</option>
                        </select>
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
                        <ImageUpload
                          value={ticketForm.photos || []}
                          onChange={(urls) => setTicketForm(f => ({ ...f, photos: urls }))}
                          multiple={true}
                          label="Upload Issue Photos"
                        />
                      </div>

                      <button
                        onClick={submitTicket}
                        disabled={submitting}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition uppercase tracking-wider shadow-md"
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
                        <div className="w-full h-full bg-gradient-to-br from-blue-950/40 to-slate-900/40 flex items-center justify-center text-muted">
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
                        <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">{profile?.current_property_id?.landlord_id ? 'Landlord Contact' : 'Agency Contact'}</span>
                        <p className="font-bold text-foreground">{profile?.current_property_id?.landlord_id?.email || profile?.current_property_id?.landlord_id?.full_name || 'Mutune Estate Agency'}</p>
                        {(profile?.current_property_id?.landlord_id?.phone || customerCare) && (
                          <p className="text-[10px] text-muted mt-0.5">{profile?.current_property_id?.landlord_id?.phone || customerCare}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PAYMENTS & UTILITY TAB */}
            {activeTab === 'payments' && (
              <div className="space-y-6">
                <TenantUtilitySection profile={profile} />
                <TenantRentSection
                  payments={payments}
                  paying={paying}
                  onPayRent={handlePayRent}
                  profile={profile}
                />
              </div>
            )}

            {/* MAINTENANCE TAB */}
            {activeTab === 'tickets' && (
              <TenantMaintenanceSection
                tickets={tickets}
                setTicketForm={setTicketForm}
                setCancelConfirmId={setCancelConfirmId}
                ticketStatusColor={ticketStatusColor}
                formatDate={FMT_DATE}
              />
            )}

            {/* LEASE AGREEMENT & DIGITAL E-SIGNING TAB */}
            {activeTab === 'lease' && (
              <TenantLeaseSection
                profile={profile}
                leaseSignature={leaseSignature}
                setLeaseSignature={setLeaseSignature}
                signingOtp={signingOtp}
                setSigningOtp={setSigningOtp}
                otpRequested={otpRequested}
                setOtpRequested={setOtpRequested}
                signingLoading={signingLoading}
                setSigningLoading={setSigningLoading}
              />
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
             <div className="fixed inset-0 z-[301] overflow-y-auto p-4 sm:p-6 flex items-center justify-center pointer-events-none">
               <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-sm bg-surface border border-border rounded-3xl p-6 shadow-2xl text-center space-y-4 pointer-events-auto"
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
           </div>
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
            <div className="fixed inset-0 z-[201] overflow-y-auto p-4 sm:p-6 flex items-center justify-center pointer-events-none">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-md bg-surface border border-border rounded-[32px] p-6 sm:p-8 shadow-2xl space-y-6 pointer-events-auto"
              >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-md font-black text-foreground">
                  {ticketForm.editId ? 'Edit Maintenance Request' : 'New Maintenance Request'}
                </h3>
                <button 
                  onClick={() => setTicketForm({ open: false, editId: null, title: '', description: '', priority: 'medium', category: 'other' })} 
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Category</label>
                  <select 
                    value={ticketForm.category} 
                    onChange={e => setTicketForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-emerald-500 transition-all"
                  >
                    <option value="plumbing" className="bg-surface text-foreground">Plumbing</option>
                    <option value="electrical" className="bg-surface text-foreground">Electrical</option>
                    <option value="structural" className="bg-surface text-foreground">Structural</option>
                    <option value="security" className="bg-surface text-foreground">Security</option>
                    <option value="appliance" className="bg-surface text-foreground">Appliance</option>
                    <option value="pest_control" className="bg-surface text-foreground">Pest Control</option>
                    <option value="cleaning" className="bg-surface text-foreground">Cleaning</option>
                    <option value="other" className="bg-surface text-foreground">Other</option>
                  </select>
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
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Photos</label>
                  <ImageUpload
                    value={ticketForm.photos || []}
                    onChange={(urls) => setTicketForm(f => ({ ...f, photos: urls }))}
                    multiple={true}
                    label="Upload Issue Photos"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setTicketForm({ open: false, editId: null, title: '', description: '', priority: 'medium', category: 'other', photos: [] })}
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
           </div>
          </>
        )}
      </AnimatePresence>

      {/* 3D Confirmation Success Overlay Modal */}
      {showSuccessOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-[32px] shadow-2xl p-6 relative text-center">
            <div className="w-20 h-20 mx-auto mb-4 flex items-center justify-center bg-emerald-500/10 border border-emerald-500/25 rounded-full animate-bounce">
              <CheckCircle2 size={36} className="text-emerald-450 drop-shadow-[0_0_12px_rgba(16,185,129,0.6)]" />
            </div>
            
            <h3 className="text-white text-base font-black uppercase tracking-wider mb-2">STK Push Triggered</h3>
            <p className="text-slate-300 text-xs leading-relaxed mb-6 font-semibold">
              We have dispatched an M-Pesa STK Push prompt to your phone. Settle rent by inputting your M-Pesa PIN.
            </p>
            
            <button
              onClick={() => setShowSuccessOverlay(false)}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer border-none shadow-md shadow-emerald-950/40 active:scale-95"
            >
              Okay, Settle Rent
            </button>
          </div>
        </div>
      )}
      {/* Splat Viewer Modal */}
      <SplatViewerModal 
        isOpen={splatViewerOpen}
        onClose={() => setSplatViewerOpen(false)}
        splatUrl={profile?.current_property_id?.splatUrl || profile?.current_property_id?.assets?.find(a => a.type === 'splat')?.url}
        title={`3D Scan: ${profile?.current_property_id?.name || 'Property'}`}
      />

    </div>
  );
}
