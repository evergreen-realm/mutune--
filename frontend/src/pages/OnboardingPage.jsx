import React, { useState, useEffect, useRef } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useThemeStore } from '../store/themeStore';
import {
  Building2, Shield, Users, UserCheck, Briefcase,
  Phone, Award, MapPin, Home, RefreshCw, AlertCircle,
  CheckCircle2, Info, Lock, ArrowLeft, Key, Sun, Moon
} from 'lucide-react';
import { updateUserRole, fetchVacantUnits, fetchMe, checkTenantEmail } from '../lib/api';
import ImageUpload from '../components/ImageUpload';

const AVAILABLE_AREAS = [
  'Nyali', 'Bamburi', 'Tudor', 'Kisauni',
  'Ganjoni', 'Mombasa Island', 'Shanzu', 'Likoni'
];

export default function OnboardingPage() {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useThemeStore();
  const isLight = theme === 'light';

  // 'roles' = show role picker + details inline (default)
  // 'tenant-confirm' = dedicated screen for pre-registered tenant auto-detected by Gmail
  const [screen, setScreen] = useState('roles');
  const [role, setRole] = useState('');

  // email check
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailCheckDone, setEmailCheckDone] = useState(false);
  const [tenantEmailStatus, setTenantEmailStatus] = useState(null);
  const didAutoCheck = useRef(false);

  // form fields
  const [phone, setPhone] = useState('');
  const [earbLicense, setEarbLicense] = useState('');
  const [earbDocUrl, setEarbDocUrl] = useState('');
  const [landlordDocUrl, setLandlordDocUrl] = useState('');
  const [assignedAreas, setAssignedAreas] = useState([]);
  const [tenantCode, setTenantCode] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [tenantRegMethod, setTenantRegMethod] = useState('code');
  const [submitting, setSubmitting] = useState(false);

  // ── redirect already-onboarded users ────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !clerkUser) return;
    fetchMe()
      .then(res => {
        const user = res?.data;
        if (!user?.role) return;
        const ok =
          ['admin', 'super_admin', 'accountant', 'tenant'].includes(user.role) ||
          (user.role === 'agent' && user.agent_approval_status === 'approved') ||
          (user.role === 'landlord' && user.landlord_approval_status === 'approved');
        if (!ok) return;
        if (['admin', 'super_admin'].includes(user.role)) navigate('/admin');
        else if (user.role === 'tenant') navigate('/tenant');
        else navigate('/dashboard');
      })
      .catch(() => {});
  }, [isLoaded, clerkUser, navigate]);

  // ── auto-detect pre-registered tenant Gmail on mount ────────────────────────
  useEffect(() => {
    if (!isLoaded || !clerkUser || didAutoCheck.current) return;
    didAutoCheck.current = true;

    const email = clerkUser.primaryEmailAddress?.emailAddress;
    if (!email) { setEmailCheckDone(true); return; }

    setEmailChecking(true);
    checkTenantEmail(email)
      .then(res => {
        const data = res?.data;
        if (data?.exists) {
          setTenantEmailStatus(data);
          if (data.has_account) {
            toast.warning(
              `This Gmail is already linked to tenant code ${data.tenant_code}. Contact your agent if you need help.`,
              { autoClose: 8000 }
            );
          } else {
            setRole('tenant');
            if (data.tenant_code) setTenantCode(data.tenant_code);
            setTenantRegMethod('code');
            setScreen('tenant-confirm');
          }
        }
      })
      .catch(() => {})
      .finally(() => { setEmailChecking(false); setEmailCheckDone(true); });
  }, [isLoaded, clerkUser]);

  // ── pre-fill phone from Clerk ────────────────────────────────────────────────
  useEffect(() => {
    if (isLoaded && clerkUser && !phone) {
      const p = clerkUser.primaryPhoneNumber?.phoneNumber;
      if (p) setPhone(p.replace('+', ''));
    }
  }, [isLoaded, clerkUser, phone]);

  // ── vacant units (manual tenant path only) ───────────────────────────────────
  const { data: vacantData } = useQuery({
    queryKey: ['vacantUnits'],
    queryFn: fetchVacantUnits,
    enabled: role === 'tenant' && tenantRegMethod === 'select',
    retry: 1
  });
  const vacantUnits = vacantData?.data || [];

  // ── full page loading (only while Clerk initialises) ─────────────────────────
  if (!isLoaded) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center animate-pulse">
          <Building2 size={20} className="text-white" />
        </div>
        <p className="text-sm text-slate-400 font-medium">Loading…</p>
      </div>
    </div>
  );

  // ── handlers ─────────────────────────────────────────────────────────────────
  const handleRoleSelect = (newRole) => {
    setRole(newRole);
    setSelectedUnitId('');
    setSelectedPropertyId('');
    if (newRole !== 'tenant') setTenantEmailStatus(null);
  };

  const handleAreaToggle = (area) =>
    setAssignedAreas(p => p.includes(area) ? p.filter(a => a !== area) : [...p, area]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!role) { toast.error('Please select a role.'); return; }
    if (!phone) { toast.error('Phone number is required.'); return; }

    if (role === 'agent') {
      if (!earbLicense.trim()) { toast.error('EARB License number is required.'); return; }
      if (!earbDocUrl) { toast.error('Please upload your EARB verification document.'); return; }
      if (!assignedAreas.length) { toast.error('Select at least one operational area.'); return; }
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

      const dest = role === 'tenant' ? '/tenant'
        : ['admin', 'super_admin'].includes(role) ? '/admin'
        : '/dashboard';
      setTimeout(() => { window.location.href = dest; }, 300);
    } catch (err) {
      toast.error(err?.error?.message || err?.message || 'Onboarding failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const roleCards = [
    { id: 'agent', label: 'Estate Agent', icon: Briefcase, desc: 'Manage listings, check-in properties, generate and issue notices.' },
    { id: 'landlord', label: 'Landlord', icon: UserCheck, desc: 'Restricted: Landlord accounts must be created by an agent or admin.', disabled: true },
    { id: 'tenant', label: 'Tenant', icon: Users, desc: 'Pay rent via M-Pesa, log maintenance tickets, and view lease documents.' },
    { id: 'admin', label: 'Agency Administrator', icon: Shield, desc: 'Restricted: Administrators are pre-configured in environment.', disabled: true },
  ];

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${isLight ? 'bg-slate-50' : 'bg-slate-950'}`}>
      {/* Theme switcher */}
      <button 
        onClick={toggleTheme}
        className={`absolute top-4 right-4 p-2.5 rounded-xl border transition-all duration-200 z-50 ${
          isLight 
            ? 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 shadow-sm' 
            : 'bg-slate-900 border-slate-800 text-white hover:bg-slate-800 shadow-md'
        }`}
        aria-label="Toggle Theme"
      >
        {isLight ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
      </button>

      {/* Left Column: Visual Showcase (Hidden on Mobile) */}
      <div className="hidden md:flex md:w-1/2 relative bg-slate-950 items-center justify-center overflow-hidden">
        {/* Background Image showing high-fidelity isometric villa building */}
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-10000 ease-out hover:scale-105"
          style={{ backgroundImage: `url('/assets/onboarding_page_prototype.png')` }}
        />
        {/* Dark Overlay with Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-slate-950/40 flex flex-col justify-between p-12">
          {/* Top Branding */}
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-white font-bold tracking-tight text-sm">MutuneRent <span className="text-blue-500 font-semibold">Pro</span></span>
              <p className="text-[10px] text-white/40 tracking-[0.2em] font-semibold -mt-0.5">MOMBASA</p>
            </div>
          </div>

          {/* Bottom Pitch */}
          <div className="max-w-md bg-slate-950/60 backdrop-blur-md border border-white/5 p-6 rounded-2xl">
            <span className="text-blue-400 text-[10px] font-bold tracking-[0.2em] uppercase">Interactive Blueprint Workspace</span>
            <h2 className="text-3xl font-light text-white mt-1 leading-tight">
              Select Your <span className="font-semibold text-blue-500">Workspace Portal</span>
            </h2>
            <p className="text-white/60 mt-3 text-xs leading-relaxed">
              Step into a premium, responsive real-estate operations suite. Choose your portal card on the right to link your clerk profile and configure live agency credentials.
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: Onboarding Form */}
      <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-6 md:p-12 relative overflow-y-auto max-h-screen">
        {/* Mobile branding */}
        <div className="md:hidden flex flex-col items-center mb-6">
          <div className="flex items-center justify-center w-12 h-12 bg-blue-600 rounded-2xl mb-2 shadow-lg shadow-blue-500/20">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <span className={`font-bold text-lg tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
            MutuneRent <span className="text-blue-600 font-semibold">Pro</span>
          </span>
          <p className="text-[9px] text-slate-500 tracking-[0.2em] uppercase">Mombasa</p>
        </div>

        {/* Form Card */}
        <div className={`w-full max-w-xl rounded-3xl border p-8 transition-all duration-300 ${
          isLight 
            ? "bg-white border-slate-200 text-slate-800 shadow-xl" 
            : "bg-slate-900/90 border-slate-800 text-white backdrop-blur-md shadow-2xl"
        }`}>
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-3">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              {emailChecking && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center">
                  <RefreshCw size={10} className="text-blue-500 animate-spin" />
                </div>
              )}
            </div>
            <h1 className={`text-2xl font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>Welcome Onboard</h1>
            <p className={`text-xs mt-1 max-w-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Select your role to claim credentials or verify your tenant code.
            </p>
          </div>

          {/* SCREEN: TENANT CODE CONFIRMATION (auto-detected Gmail) */}
          {screen === 'tenant-confirm' ? (
            <div>
              {/* Gmail badge */}
              <div className={`flex items-center gap-2 border rounded-xl px-4 py-3 mb-6 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-850'
              }`}>
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className={`text-sm font-semibold truncate ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                  {clerkUser?.primaryEmailAddress?.emailAddress}
                </span>
                <span className="ml-auto text-slate-500 text-xs whitespace-nowrap">Gmail Verified</span>
              </div>

              {tenantEmailStatus?.has_account ? (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mb-6 text-center space-y-2">
                  <p className="text-amber-500 text-sm font-bold">
                    Tenant Code: <span className="font-mono">{tenantEmailStatus?.tenant_code}</span>
                  </p>
                  {tenantEmailStatus?.tenant_name && (
                    <p className="text-slate-500 text-xs">Registered as: {tenantEmailStatus.tenant_name}</p>
                  )}
                  <p className="text-slate-500 text-xs leading-relaxed">
                    This code is linked to an existing account. Contact your property agent if you need assistance.
                  </p>
                  <button
                    onClick={() => signOut()}
                    className="mt-3 text-blue-600 text-xs hover:underline block mx-auto font-semibold"
                  >
                    Sign out and use a different account
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {tenantEmailStatus?.tenant_name && (
                    <div className="bg-blue-600/10 border border-blue-500/25 rounded-xl px-4 py-3 flex items-center gap-3">
                      <Users className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <div>
                        <p className="text-blue-500 text-[10px] font-bold uppercase tracking-wider">Tenant Name on Record</p>
                        <p className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{tenantEmailStatus.tenant_name}</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="flex items-center gap-2 text-xs font-semibold mb-2">
                      <Key className="w-3.5 h-3.5 text-blue-500" />
                      Tenant Code *
                    </label>
                    <input
                      type="text"
                      value={tenantCode}
                      onChange={e => setTenantCode(e.target.value.toUpperCase())}
                      placeholder="TNT-MOM-XXXX"
                      className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition uppercase font-mono ${
                        isLight 
                          ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500' 
                          : 'bg-slate-950/50 border-slate-800 text-white placeholder:text-slate-650 focus:border-blue-500/50'
                      }`}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-2">
                      Phone Number (M-Pesa: 254XXXXXXXXX) <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="254700000000"
                        className={`w-full border rounded-xl px-4 py-3 pl-11 text-sm outline-none transition ${
                          isLight 
                            ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500' 
                            : 'bg-slate-950/50 border-slate-800 text-white placeholder:text-slate-650 focus:border-blue-500/50'
                        }`}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-4 border-t border-slate-800/10 dark:border-slate-800/60">
                    <button
                      type="button"
                      onClick={() => { setScreen('roles'); setRole(''); setTenantCode(''); setTenantEmailStatus(null); }}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition ${
                        isLight 
                          ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50' 
                          : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back
                    </button>
                    <button
                      id="btn-confirm-tenant-code"
                      type="submit"
                      disabled={submitting || !tenantCode.trim() || !phone.trim()}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                    >
                      {submitting
                        ? <><RefreshCw size={14} className="animate-spin" /> Linking account…</>
                        : <><CheckCircle2 size={14} /> Confirm &amp; Complete Registration</>
                      }
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* SCREEN: ROLE PICKER + INLINE ROLE FIELDS */
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold mb-3">Select Your Role</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {roleCards.map(({ id, label, icon: Icon, desc, disabled }) => (
                    <button
                      key={id}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleRoleSelect(id)}
                      className={`flex items-start gap-4 p-4 rounded-2xl text-left transition-all duration-200 border ${
                        disabled
                          ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-850 bg-slate-100/50 dark:bg-slate-900/20'
                          : role === id
                          ? 'bg-blue-600/10 border-blue-500 dark:border-blue-500 shadow-md shadow-blue-500/10 scale-[1.01]'
                          : 'bg-slate-100/30 border-slate-200 dark:bg-slate-800/40 dark:border-slate-800 hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className={`p-2.5 rounded-xl flex-shrink-0 transition-colors ${
                        disabled 
                          ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-500' 
                          : role === id 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className={`font-bold text-sm ${isLight ? 'text-slate-800' : 'text-white'}`}>{label}</h3>
                        <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {role && (
                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800/60 animate-in fade-in duration-200">
                  {/* Phone — always required */}
                  <div>
                    <label className="block text-xs font-semibold mb-2">
                      Phone Number (M-Pesa format: 254XXXXXXXXX) <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="254700000000"
                        className={`w-full border rounded-xl px-4 py-3 pl-11 text-sm outline-none transition ${
                          isLight 
                            ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500' 
                            : 'bg-slate-950/50 border-slate-800 text-white placeholder:text-slate-650 focus:border-blue-500/50'
                        }`}
                        required
                      />
                    </div>
                  </div>

                  {/* AGENT */}
                  {role === 'agent' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold mb-2">
                          EARB License Number <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                          <Award className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={earbLicense}
                            onChange={e => setEarbLicense(e.target.value)}
                            placeholder="EARB-XXXXX"
                            className={`w-full border rounded-xl px-4 py-3 pl-11 text-sm outline-none transition ${
                              isLight 
                                ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500' 
                                : 'bg-slate-950/50 border-slate-800 text-white placeholder:text-slate-650 focus:border-blue-500/50'
                            }`}
                          />
                        </div>
                      </div>
                      <ImageUpload
                        value={earbDocUrl ? [earbDocUrl] : []}
                        onChange={urls => setEarbDocUrl(urls[0] || '')}
                        multiple={false}
                        label="Verification Document (EARB License) *"
                      />
                      <div>
                        <label className="block text-xs font-semibold mb-2">
                          Assigned Operational Areas *
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {AVAILABLE_AREAS.map(area => (
                            <button
                              key={area}
                              type="button"
                              onClick={() => handleAreaToggle(area)}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                                assignedAreas.includes(area)
                                  ? 'bg-blue-600/10 border-blue-500 text-blue-600 dark:bg-blue-600/20 dark:text-blue-400'
                                  : isLight
                                  ? 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                  : 'bg-slate-950/30 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <MapPin className="w-3.5 h-3.5" />{area}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LANDLORD */}
                  {role === 'landlord' && (
                    <ImageUpload
                      value={landlordDocUrl ? [landlordDocUrl] : []}
                      onChange={urls => setLandlordDocUrl(urls[0] || '')}
                      multiple={false}
                      label="Property Ownership Verification Document *"
                    />
                  )}

                  {/* TENANT (manual select path) */}
                  {role === 'tenant' && (
                    <div className="space-y-4">
                      {tenantEmailStatus?.exists && !tenantEmailStatus.has_account && (
                        <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
                          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-blue-500 text-xs font-bold font-mono">Pre-registered Record Found!</p>
                            <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                              Code <span className="font-mono font-bold text-blue-500">{tenantEmailStatus.tenant_code}</span> has been auto-filled.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className={`flex rounded-xl p-1 border ${
                        isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950/40 border-slate-850'
                      }`}>
                        <button
                          type="button"
                          onClick={() => { setTenantRegMethod('code'); setSelectedPropertyId(''); setSelectedUnitId(''); }}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            tenantRegMethod === 'code' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Use Tenant Code
                        </button>
                        <button
                          type="button"
                          onClick={() => { setTenantRegMethod('select'); setTenantCode(''); }}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            tenantRegMethod === 'select' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Select Property &amp; Unit
                        </button>
                      </div>

                      {tenantRegMethod === 'code' ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Home className="w-4 h-4 text-blue-500" />
                            <label className="text-xs font-semibold">
                              Tenant Code <span className="text-red-400">*</span>
                            </label>
                          </div>
                          <input
                            type="text"
                            value={tenantCode}
                            onChange={e => setTenantCode(e.target.value.toUpperCase())}
                            placeholder="TNT-MOM-XXXX"
                            className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition uppercase font-mono ${
                              isLight 
                                ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500' 
                                : 'bg-slate-950/50 border-slate-800 text-white placeholder:text-slate-650 focus:border-blue-500/50'
                            }`}
                          />
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider mb-2">Select Property</label>
                            <select
                              value={selectedPropertyId}
                              onChange={e => { setSelectedPropertyId(e.target.value); setSelectedUnitId(''); }}
                              className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition appearance-none ${
                                isLight 
                                  ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500' 
                                  : 'bg-slate-950/50 border-slate-800 text-white focus:border-blue-500/50'
                              }`}
                            >
                              <option value="" className="bg-slate-900">Choose property…</option>
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
                              <label className="block text-xs font-bold uppercase tracking-wider mb-2">Select Unit</label>
                              <select
                                value={selectedUnitId}
                                onChange={e => setSelectedUnitId(e.target.value)}
                                className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition appearance-none ${
                                  isLight 
                                    ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500' 
                                    : 'bg-slate-950/50 border-slate-800 text-white focus:border-blue-500/50'
                                }`}
                              >
                                <option value="" className="bg-slate-900">Choose unit…</option>
                                {vacantUnits
                                  .filter(u => u.propertyId === selectedPropertyId)
                                  .map(u => (
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

                  {/* ADMIN */}
                  {role === 'admin' && (
                    <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
                      <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                        Administrator access requires pre-approval and assignment by a system owner. Your request will queue for manual review.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Submit row */}
              <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800/60">
                <button
                  type="button"
                  onClick={() => signOut()}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold border transition ${
                    isLight 
                      ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm' 
                      : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  Sign Out / Back
                </button>
                <button
                  id="btn-complete-onboarding"
                  type="submit"
                  disabled={submitting || !role}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  {submitting
                    ? <><RefreshCw size={14} className="animate-spin" /> Setting up account…</>
                    : 'Complete Registration'
                  }
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
