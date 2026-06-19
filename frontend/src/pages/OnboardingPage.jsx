import React, { useState, useEffect, useRef } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Building2, Shield, Users, UserCheck, Briefcase,
  Phone, Award, MapPin, Home, RefreshCw, AlertCircle,
  CheckCircle2, X, Info, Lock, ArrowLeft, Key
} from 'lucide-react';
import { updateUserRole, fetchVacantUnits, uploadDoc, fetchMe, checkTenantEmail } from '../lib/api';
import ImageUpload from '../components/ImageUpload';

const AVAILABLE_AREAS = [
  'Nyali', 'Bamburi', 'Tudor', 'Kisauni',
  'Ganjoni', 'Mombasa Island', 'Shanzu', 'Likoni'
];

// Onboarding "steps" for tenant pre-registration flow
// 'roles'       → role picker (default for agent/landlord/admin)
// 'tenant-confirm' → auto-routed here when Gmail matches a pre-registered tenant record
// 'tenant-fields'  → standard tenant fields after confirmation or manual role pick

export default function OnboardingPage() {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  // ── page state ─────────────────────────────────────────────────────────────
  const [step, setStep]  = useState('roles'); // 'roles' | 'tenant-confirm' | 'details'
  const [role, setRole]  = useState('');

  // pre-reg check
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);
  const [emailCheckDone,    setEmailCheckDone]    = useState(false);
  const [tenantEmailStatus, setTenantEmailStatus] = useState(null);
  const didAutoCheck = useRef(false);

  // form fields
  const [phone,            setPhone]          = useState('');
  const [earbLicense,      setEarbLicense]    = useState('');
  const [earbDocUrl,       setEarbDocUrl]     = useState('');
  const [landlordDocUrl,   setLandlordDocUrl] = useState('');
  const [assignedAreas,    setAssignedAreas]  = useState([]);
  const [tenantCode,       setTenantCode]     = useState('');
  const [selectedUnitId,   setSelectedUnitId] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [tenantRegMethod,  setTenantRegMethod] = useState('code');
  const [submitting,       setSubmitting]     = useState(false);

  // ── redirect if already onboarded ─────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !clerkUser) return;
    const check = async () => {
      try {
        const res = await fetchMe();
        const user = res.data;
        if (!user?.role) return;
        const approved =
          ['admin', 'super_admin', 'accountant', 'tenant'].includes(user.role) ||
          (user.role === 'agent'    && user.agent_approval_status    === 'approved') ||
          (user.role === 'landlord' && user.landlord_approval_status === 'approved');
        if (!approved) return;
        if (['admin', 'super_admin'].includes(user.role)) navigate('/admin');
        else if (user.role === 'tenant') navigate('/tenant');
        else navigate('/properties');
      } catch { /* not onboarded yet */ }
    };
    check();
  }, [isLoaded, clerkUser, navigate]);

  // ── auto-detect tenant by Gmail on mount ──────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !clerkUser || didAutoCheck.current || emailCheckDone) return;
    didAutoCheck.current = true;

    const email = clerkUser.primaryEmailAddress?.emailAddress;
    if (!email) { setEmailCheckDone(true); return; }

    setEmailCheckLoading(true);
    checkTenantEmail(email)
      .then(res => {
        const data = res?.data;
        setEmailCheckDone(true);

        if (data?.exists) {
          setTenantEmailStatus(data);

          if (data.has_account) {
            // Already fully registered tenant — show warning on roles page
            toast.warning(
              `This Gmail is already linked to tenant code ${data.tenant_code}. If you need help, contact your agent.`,
              { autoClose: 8000 }
            );
          } else {
            // Pre-registered, not yet claimed → auto-route to confirmation step
            setRole('tenant');
            if (data.tenant_code) setTenantCode(data.tenant_code);
            setTenantRegMethod('code');
            setStep('tenant-confirm');
            // No toast — the confirmation screen itself communicates the state
          }
        }
        // If no match → stay on roles page, user picks their role normally
      })
      .catch(() => { setEmailCheckDone(true); })
      .finally(() => setEmailCheckLoading(false));
  }, [isLoaded, clerkUser, emailCheckDone]);

  // ── pre-populate phone ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoaded && clerkUser && !phone) {
      const p = clerkUser.primaryPhoneNumber?.phoneNumber;
      if (p) setPhone(p.replace('+', ''));
    }
  }, [isLoaded, clerkUser, phone]);

  // ── vacant units (only needed for manual tenant pick) ─────────────────────
  const { data: vacantData, isLoading: unitsLoading } = useQuery({
    queryKey: ['vacantUnits'],
    queryFn: fetchVacantUnits,
    enabled: role === 'tenant' && step === 'details' && tenantRegMethod === 'select',
    retry: 1
  });
  const vacantUnits = vacantData?.data || [];

  // ── loading screen ─────────────────────────────────────────────────────────
  if (!isLoaded || emailCheckLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 bg-green-600 rounded-xl flex items-center justify-center animate-pulse">
          <Building2 size={20} className="text-white" />
        </div>
        <p className="text-sm text-slate-400 font-medium">
          {emailCheckLoading ? 'Checking your account…' : 'Loading…'}
        </p>
      </div>
    </div>
  );

  // ── handlers ───────────────────────────────────────────────────────────────
  const handleRoleSelect = (newRole) => {
    setRole(newRole);
    setSelectedUnitId('');
    setSelectedPropertyId('');
    if (newRole !== 'tenant') {
      setTenantEmailStatus(null);
    }
    // When manually selecting tenant from role picker, go to details step
    if (newRole === 'tenant') {
      setStep('details');
      // Run email check if not yet done (shouldn't happen normally, but safety net)
      if (!emailCheckDone) {
        const email = clerkUser?.primaryEmailAddress?.emailAddress;
        if (email) {
          checkTenantEmail(email).then(res => {
            if (res?.data?.exists && !res.data.has_account) {
              setTenantEmailStatus(res.data);
              if (res.data.tenant_code) {
                setTenantCode(res.data.tenant_code);
                setTenantRegMethod('code');
              }
            }
            setEmailCheckDone(true);
          }).catch(() => setEmailCheckDone(true));
        }
      }
    } else {
      setStep('details');
    }
  };

  const handleAreaToggle = (area) =>
    setAssignedAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);

  const handleUnitSelect = (unitId) => {
    const unit = vacantUnits.find(u => u.unitId.toString() === unitId);
    setSelectedUnitId(unitId);
    setSelectedPropertyId(unit?.propertyId || '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!role) { toast.error('Please select a role.'); return; }
    if (!phone) { toast.error('Phone number is required.'); return; }

    if (role === 'agent') {
      if (!earbLicense.trim()) { toast.error('EARB License number is required.'); return; }
      if (!earbDocUrl)         { toast.error('Please upload your EARB verification document.'); return; }
      if (!assignedAreas.length){ toast.error('Select at least one operational area.'); return; }
    }
    if (role === 'landlord') {
      if (!landlordDocUrl) { toast.error('Please upload your property ownership document.'); return; }
    }
    if (role === 'tenant') {
      if (tenantRegMethod === 'code' && !tenantCode.trim()) { toast.error('Tenant Code is required.'); return; }
      if (tenantRegMethod === 'select' && (!selectedPropertyId || !selectedUnitId)) {
        toast.error('Please select a property and unit.'); return;
      }
    }

    setSubmitting(true);
    try {
      const payload = { role, phone: phone.trim() };
      if (role === 'agent') {
        payload.earb_license = earbLicense.trim();
        payload.earb_verification_doc_url = earbDocUrl;
        payload.assigned_areas = assignedAreas;
      }
      if (role === 'landlord') payload.landlord_verification_doc_url = landlordDocUrl;
      if (role === 'tenant') {
        if (tenantRegMethod === 'code') payload.tenant_code = tenantCode.trim();
        else { payload.property_id = selectedPropertyId; payload.unit_id = selectedUnitId; }
      }

      await updateUserRole(payload);
      await clerkUser.reload();
      toast.success('Welcome to MutuneRent Pro! Your account is ready.');
      navigate('/');
    } catch (err) {
      toast.error(err?.error?.message || err.message || 'Onboarding failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const roleCards = [
    { id: 'agent',    label: 'Estate Agent',          icon: Briefcase, desc: 'Manage listings, check-in properties, generate and issue notices.' },
    { id: 'landlord', label: 'Landlord',               icon: UserCheck, desc: 'View your properties, analyze occupancy rates, and monitor payouts.' },
    { id: 'tenant',   label: 'Tenant',                 icon: Users,     desc: 'Pay rent via M-Pesa, log maintenance tickets, and view lease documents.' },
    { id: 'admin',    label: 'Agency Administrator',   icon: Shield,    desc: 'Full management access over properties, agents, billing, and reports.' },
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // STEP: TENANT CODE CONFIRMATION
  // Shown when Gmail auto-matches a pre-registered tenant record
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'tenant-confirm') {
    const alreadyLinked = tenantEmailStatus?.has_account;
    const autoCode      = tenantEmailStatus?.tenant_code;
    const tenantName    = tenantEmailStatus?.tenant_name;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg ${alreadyLinked ? 'bg-amber-600/20 shadow-amber-900/30' : 'bg-green-600 shadow-green-900/30'}`}>
                {alreadyLinked
                  ? <AlertCircle className="w-8 h-8 text-amber-400" />
                  : <Key className="w-8 h-8 text-white" />
                }
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                {alreadyLinked ? 'Account Already Exists' : 'Confirm Your Tenant Code'}
              </h1>
              <p className="text-slate-400 text-sm mt-2 max-w-sm">
                {alreadyLinked
                  ? `Your Gmail is already linked to an active tenant record.`
                  : `We found a pre-registered tenant record for your Gmail. Verify the code below to claim your account.`
                }
              </p>
            </div>

            {/* Email badge */}
            <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 mb-6">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-green-300 text-sm font-semibold truncate">
                {clerkUser?.primaryEmailAddress?.emailAddress}
              </span>
              <span className="ml-auto text-slate-500 text-xs">Gmail Verified</span>
            </div>

            {alreadyLinked ? (
              /* ── Already-linked blocking state ── */
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mb-6 text-center">
                <p className="text-amber-300 text-sm font-bold mb-1">Tenant Code: <span className="font-mono">{autoCode}</span></p>
                {tenantName && <p className="text-amber-200/70 text-xs">Registered under: {tenantName}</p>}
                <p className="text-amber-200/60 text-xs mt-3 leading-relaxed">
                  This code is already linked to an active account. If you believe this is an error, contact your property agent or the MutuneRent admin.
                </p>
              </div>
            ) : (
              /* ── Claim flow ── */
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Tenant name if available */}
                {tenantName && (
                  <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3 flex items-center gap-3">
                    <Users className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="text-emerald-300 text-xs font-bold">Tenant Name on Record</p>
                      <p className="text-white text-sm font-semibold">{tenantName}</p>
                    </div>
                  </div>
                )}

                {/* Auto-filled code field */}
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-2 flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-green-400" />
                    Tenant Code
                    {autoCode && <span className="ml-auto flex items-center gap-1 text-green-400"><Lock className="w-3 h-3" /> Auto-filled</span>}
                  </label>
                  <input
                    type="text"
                    value={tenantCode}
                    onChange={e => setTenantCode(e.target.value.toUpperCase())}
                    placeholder="TNT-MOM-XXXX"
                    className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition uppercase font-mono text-white placeholder:text-slate-600 ${
                      autoCode
                        ? 'bg-emerald-950/40 border-emerald-500/40 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500'
                        : 'bg-slate-950/50 border-slate-800 focus:border-green-500/50 focus:ring-1 focus:ring-green-500'
                    }`}
                    required
                  />
                  {autoCode && (
                    <p className="text-emerald-400/70 text-xs mt-1.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Code was auto-filled from your pre-registered record. You may edit it if it looks incorrect.
                    </p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-2">
                    Phone Number (M-Pesa format: 254XXXXXXXXX) <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="254700000000"
                      className="w-full bg-slate-950/50 border border-slate-800 focus:border-green-500/50 focus:ring-1 focus:ring-green-500 text-white placeholder:text-slate-600 rounded-xl px-4 py-3 pl-11 text-sm outline-none transition"
                      required
                    />
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-3 pt-2 border-t border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => { setStep('roles'); setRole(''); setTenantCode(''); setTenantEmailStatus(null); }}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold bg-slate-800/40 text-slate-400 hover:bg-slate-800 border border-slate-700/50 transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <button
                    id="btn-confirm-tenant-code"
                    type="submit"
                    disabled={submitting || !tenantCode.trim() || !phone.trim()}
                    className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3 rounded-xl text-sm transition shadow-lg shadow-green-900/20 flex items-center justify-center gap-2"
                  >
                    {submitting
                      ? <><RefreshCw size={14} className="animate-spin" /> Linking account…</>
                      : <><CheckCircle2 size={14} /> Confirm &amp; Complete Registration</>
                    }
                  </button>
                </div>
              </form>
            )}

            {/* Sign out */}
            {alreadyLinked && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => signOut()}
                  className="text-slate-500 text-xs hover:text-slate-300 transition underline"
                >
                  Sign out and use a different account
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP: ROLE PICKER + ROLE DETAILS (agent / landlord / admin / manual tenant)
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-green-900/30">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">Welcome Onboard</h1>
            <p className="text-slate-400 text-sm mt-2 max-w-md">
              MutuneRent Pro — Mutune Estate Agency, Mombasa. Select your role to set up your workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Role cards */}
            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-3">Select Your Role</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {roleCards.map(({ id, label, icon: Icon, desc }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleRoleSelect(id)}
                    className={`flex items-start gap-4 p-4 rounded-2xl text-left transition-all duration-200 border ${
                      role === id
                        ? 'bg-green-600/10 border-green-500 shadow-md shadow-green-950/20 scale-[1.01]'
                        : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/60 hover:border-slate-600'
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl flex-shrink-0 transition-colors duration-200 ${role === id ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">{label}</h3>
                      <p className="text-slate-400 text-xs mt-1">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Role-specific fields */}
            {role && (
              <div className="space-y-4 pt-4 border-t border-slate-800/60">
                {/* Phone — always shown */}
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-2">
                    Phone Number (M-Pesa format: 254XXXXXXXXX) <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="254700000000"
                      className="w-full bg-slate-950/50 border border-slate-800 focus:border-green-500/50 focus:ring-1 focus:ring-green-500 text-white placeholder:text-slate-600 rounded-xl px-4 py-3 pl-11 text-sm outline-none transition"
                      required
                    />
                  </div>
                </div>

                {/* ── AGENT FIELDS ── */}
                {role === 'agent' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-slate-300 text-xs font-semibold mb-2">
                        EARB License Number <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <Award className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={earbLicense}
                          onChange={e => setEarbLicense(e.target.value)}
                          placeholder="EARB-XXXXX"
                          className="w-full bg-slate-950/50 border border-slate-800 focus:border-green-500/50 focus:ring-1 focus:ring-green-500 text-white placeholder:text-slate-600 rounded-xl px-4 py-3 pl-11 text-sm outline-none transition"
                          required
                        />
                      </div>
                    </div>
                    <ImageUpload
                      value={earbDocUrl ? [earbDocUrl] : []}
                      onChange={(urls) => setEarbDocUrl(urls[0] || '')}
                      multiple={false}
                      label="Verification Document (EARB License)"
                    />
                    <div>
                      <label className="block text-slate-300 text-xs font-semibold mb-2">Assigned Operational Areas</label>
                      <div className="flex flex-wrap gap-2">
                        {AVAILABLE_AREAS.map(area => {
                          const sel = assignedAreas.includes(area);
                          return (
                            <button key={area} type="button" onClick={() => handleAreaToggle(area)}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                                sel ? 'bg-green-600/20 border-green-500 text-green-400' : 'bg-slate-950/30 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}>
                              <MapPin className="w-3.5 h-3.5" />{area}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── LANDLORD FIELDS ── */}
                {role === 'landlord' && (
                  <div className="space-y-4">
                    <ImageUpload
                      value={landlordDocUrl ? [landlordDocUrl] : []}
                      onChange={(urls) => setLandlordDocUrl(urls[0] || '')}
                      multiple={false}
                      label="Property Ownership Verification Document"
                    />
                  </div>
                )}

                {/* ── MANUAL TENANT FIELDS (shown when user manually picks Tenant role) ── */}
                {role === 'tenant' && step === 'details' && (
                  <div className="space-y-4">
                    {/* Pre-reg alert if found after manual pick */}
                    {tenantEmailStatus?.exists && !tenantEmailStatus?.has_account && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3">
                        <Info className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-emerald-300 text-xs font-bold">Pre-registered Record Found!</p>
                          <p className="text-emerald-200/70 text-xs mt-1">
                            Code <span className="font-mono font-bold text-emerald-300">{tenantEmailStatus.tenant_code}</span> has been auto-filled below.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Toggle: code vs pick property */}
                    <div className="flex rounded-xl bg-slate-950/40 p-1 border border-slate-800/85">
                      <button type="button"
                        onClick={() => { setTenantRegMethod('code'); setSelectedPropertyId(''); setSelectedUnitId(''); }}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${tenantRegMethod === 'code' ? 'bg-green-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
                        Use Tenant Code
                      </button>
                      <button type="button"
                        onClick={() => { setTenantRegMethod('select'); setTenantCode(''); }}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${tenantRegMethod === 'select' ? 'bg-green-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
                        Select Property &amp; Unit
                      </button>
                    </div>

                    {tenantRegMethod === 'code' ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Home className="w-4 h-4 text-green-400" />
                          <label className="text-slate-300 text-xs font-semibold">Enter Tenant Code <span className="text-red-400">*</span></label>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Enter the Tenant Code (e.g. TNT-MOM-0001) provided by your property agent.
                        </p>
                        <input
                          type="text"
                          value={tenantCode}
                          onChange={e => setTenantCode(e.target.value.toUpperCase())}
                          placeholder="TNT-MOM-XXXX"
                          className="w-full bg-slate-950/50 border border-slate-800 focus:border-green-500/50 focus:ring-1 focus:ring-green-500 text-white placeholder:text-slate-600 rounded-xl px-4 py-3 text-sm outline-none transition uppercase font-mono"
                          required
                        />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Home className="w-4 h-4 text-green-400" />
                          <label className="text-slate-300 text-xs font-semibold">Choose Property and Unit</label>
                        </div>
                        <p className="text-xs text-slate-400">Select from registered properties and vacant units.</p>
                        <div>
                          <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Select Property</label>
                          <select value={selectedPropertyId}
                            onChange={e => { setSelectedPropertyId(e.target.value); setSelectedUnitId(''); }}
                            className="w-full bg-slate-950/50 border border-slate-800 focus:border-green-500/50 text-white rounded-xl px-4 py-3 text-sm outline-none transition appearance-none">
                            <option value="" className="bg-slate-900">Choose property...</option>
                            {(() => {
                              const seen = new Set(), list = [];
                              vacantUnits.forEach(u => { if (!seen.has(u.propertyId)) { seen.add(u.propertyId); list.push(u); } });
                              return list.map(u => (
                                <option key={u.propertyId} value={u.propertyId} className="bg-slate-900">
                                  {u.propertyName} ({u.propertyCode}) — {u.area}
                                </option>
                              ));
                            })()}
                          </select>
                        </div>
                        {selectedPropertyId && (
                          <div>
                            <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Select Unit</label>
                            <select value={selectedUnitId} onChange={e => setSelectedUnitId(e.target.value)}
                              className="w-full bg-slate-950/50 border border-slate-800 focus:border-green-500/50 text-white rounded-xl px-4 py-3 text-sm outline-none transition appearance-none">
                              <option value="" className="bg-slate-900">Choose unit...</option>
                              {vacantUnits.filter(u => u.propertyId === selectedPropertyId).map(u => (
                                <option key={u.unitId} value={u.unitId} className="bg-slate-900">
                                  Unit {u.unitNumber} — {u.type} (KES {u.rentAmount ? Number(u.rentAmount).toLocaleString() : 'N/A'})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-800/60">
              <button type="button" onClick={() => signOut()}
                className="px-5 py-3 rounded-xl text-xs font-bold bg-slate-800/40 text-slate-400 hover:bg-slate-800 border border-slate-700/50 transition">
                Sign Out / Back
              </button>
              <button id="btn-complete-onboarding" type="submit"
                disabled={submitting || !role}
                className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3 rounded-xl text-xs transition shadow-lg shadow-green-900/20 flex items-center justify-center gap-2">
                {submitting
                  ? <><RefreshCw size={14} className="animate-spin" /> Setting up account…</>
                  : 'Complete Registration'
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
