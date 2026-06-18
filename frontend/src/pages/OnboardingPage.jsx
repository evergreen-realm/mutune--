import React, { useState, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Building2, Shield, Users, UserCheck, Briefcase,
  Phone, Award, MapPin, Home, RefreshCw, AlertCircle,
  UploadCloud, CheckCircle2, FileText, X, Info
} from 'lucide-react';
import { updateUserRole, fetchVacantUnits, uploadDoc, fetchMe, checkTenantEmail } from '../lib/api';
import ImageUpload from '../components/ImageUpload';

const AVAILABLE_AREAS = [
  'Nyali', 'Bamburi', 'Tudor', 'Kisauni',
  'Ganjoni', 'Mombasa Island', 'Shanzu', 'Likoni'
];

export default function OnboardingPage() {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut } = useClerk();

  const navigate = useNavigate();
  const [role, setRole] = useState('');

  useEffect(() => {
    const checkExistingUser = async () => {
      try {
        const res = await fetchMe();
        const user = res.data;
        if (user && user.role) {
          const isApproved =
            ['admin', 'super_admin', 'accountant', 'tenant'].includes(user.role) ||
            (user.role === 'agent' && user.agent_approval_status === 'approved') ||
            (user.role === 'landlord' && user.landlord_approval_status === 'approved');

          if (isApproved) {
            if (user.role === 'admin' || user.role === 'super_admin') {
              navigate('/admin');
            } else if (user.role === 'agent') {
              navigate('/properties');
            } else if (user.role === 'landlord') {
              navigate('/properties');
            } else if (user.role === 'tenant') {
              navigate('/tenant');
            }
          }
        }
      } catch (err) {
        // No existing user -> show onboarding
      }
    };
    if (isLoaded && clerkUser) {
      checkExistingUser();
    }
  }, [isLoaded, clerkUser, navigate]);

  const [phone,            setPhone]            = useState('');
  const [earbLicense,      setEarbLicense]      = useState('');
  const [earbDocUrl,       setEarbDocUrl]       = useState('');
  const [landlordDocUrl,   setLandlordDocUrl]   = useState('');
  const [assignedAreas,    setAssignedAreas]    = useState([]);
  const [tenantCode,       setTenantCode]       = useState('');
  const [selectedUnitId,   setSelectedUnitId]   = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [tenantRegMethod,  setTenantRegMethod]  = useState('code');
  const [submitting,       setSubmitting]       = useState(false);

  // Pre-populate phone number from Clerk user profile on load
  useEffect(() => {
    if (isLoaded && clerkUser && !phone) {
      const primaryPhone = clerkUser.primaryPhoneNumber?.phoneNumber;
      if (primaryPhone) {
        setPhone(primaryPhone.replace('+', ''));
      }
    }
  }, [isLoaded, clerkUser, phone]);

  // Tenant email pre-registration check state
  const [tenantEmailStatus, setTenantEmailStatus] = useState(null); // { exists, tenant_code, has_account, tenant_name }
  const [emailCheckDone,    setEmailCheckDone]    = useState(false);

  // Fetch vacant units only when tenant role is selected
  const { data: vacantData, isLoading: unitsLoading } = useQuery({
    queryKey: ['vacantUnits'],
    queryFn: fetchVacantUnits,
    enabled: role === 'tenant',
    retry: 1
  });

  const vacantUnits = vacantData?.data || [];

  // Check if tenant email is pre-registered when user selects tenant role
  useEffect(() => {
    if (role === 'tenant' && clerkUser && !emailCheckDone) {
      const email = clerkUser.primaryEmailAddress?.emailAddress;
      if (email) {
        checkTenantEmail(email)
          .then(res => {
            if (res?.data?.exists) {
              setTenantEmailStatus(res.data);
              if (res.data.has_account) {
                toast.warning(`This email is already linked to active tenant code ${res.data.tenant_code}. If you need to re-register, contact your property agent.`);
              } else if (res.data.tenant_code) {
                setTenantCode(res.data.tenant_code);
                setTenantRegMethod('code');
                toast.success(`Pre-registered tenant record found for ${email}! Your Tenant Code has been auto-filled. Please verify and complete registration.`);
              } else {
                toast.info(`Pre-registered tenant record found for ${email}. Please enter your Tenant Code to claim your account.`);
              }
            } else {
              toast.info(`No pre-registered tenant record found for ${email}. You can choose a property & unit manually, or enter a tenant code if you have one.`);
            }
            setEmailCheckDone(true);
          })
          .catch(() => {
            setEmailCheckDone(true);
          });
      } else {
        setEmailCheckDone(true);
      }
    }
  }, [role, clerkUser, emailCheckDone]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 bg-green-600 rounded-xl flex items-center justify-center animate-pulse">
            <Building2 size={20} className="text-white" />
          </div>
          <p className="text-sm text-slate-400 font-medium">Loading details…</p>
        </div>
      </div>
    );
  }

  const handleRoleSelect = (newRole) => {
    setRole(newRole);
    setSelectedUnitId('');
    setSelectedPropertyId('');
    // Reset email check when switching roles
    if (newRole !== 'tenant') {
      setTenantEmailStatus(null);
      setEmailCheckDone(false);
    }
  };

  const handleAreaToggle = (area) => {
    setAssignedAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  const handleUnitSelect = (unitId) => {
    const unit = vacantUnits.find(u => u.unitId.toString() === unitId);
    setSelectedUnitId(unitId);
    setSelectedPropertyId(unit?.propertyId || '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!role) {
      toast.error('Please select a role to get started.');
      return;
    }
    if (!phone) {
      toast.error('Phone number is required.');
      return;
    }
    if (role === 'agent') {
      if (!earbLicense.trim()) {
        toast.error('EARB License number is required for Agents.');
        return;
      }
      if (!earbDocUrl) {
        toast.error('Please upload your verification document before submitting.');
        return;
      }
      if (!assignedAreas || assignedAreas.length === 0) {
        toast.error('Please select at least one assigned operational area.');
        return;
      }
    }
    if (role === 'landlord') {
      if (!landlordDocUrl) {
        toast.error('Please upload your property ownership verification document before submitting.');
        return;
      }
    }
    if (role === 'tenant') {
      if (tenantRegMethod === 'code') {
        if (!tenantCode.trim()) {
          toast.error('Tenant Code is required.');
          return;
        }
      } else {
        if (!selectedPropertyId) {
          toast.error('Please select a property.');
          return;
        }
        if (!selectedUnitId) {
          toast.error('Please select a unit.');
          return;
        }
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

      if (role === 'landlord') {
        payload.landlord_verification_doc_url = landlordDocUrl;
      }

      if (role === 'tenant') {
        if (tenantRegMethod === 'code') {
          payload.tenant_code = tenantCode.trim();
        } else {
          payload.property_id = selectedPropertyId;
          payload.unit_id = selectedUnitId;
        }
      }

      await updateUserRole(payload);

      // Reload Clerk user profile to capture the updated publicMetadata.role
      await clerkUser.reload();

      toast.success('Welcome to MutuneRent Pro! Your account is ready.');

      // Redirect to appropriate dashboard
      navigate('/');
    } catch (err) {
      toast.error(err?.error?.message || err.message || 'Onboarding failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const roleCards = [
    {
      id: 'agent',
      label: 'Estate Agent',
      icon: Briefcase,
      desc: 'Manage listings, check-in properties, generate and issue notices.'
    },
    {
      id: 'landlord',
      label: 'Landlord',
      icon: UserCheck,
      desc: 'View your properties, analyze occupancy rates, and monitor payouts.'
    },
    {
      id: 'tenant',
      label: 'Tenant',
      icon: Users,
      desc: 'Pay rent via M-Pesa, log maintenance tickets, and view lease documents.'
    },
    {
      id: 'admin',
      label: 'Agency Administrator',
      icon: Shield,
      desc: 'Full management access over properties, agents, billing, and reports.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative">
        {/* Glow Effects */}
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
            {/* Role Selection Cards */}
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
                {/* Phone */}
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-2">
                    Phone Number (M-Pesa format: 254XXXXXXXXX)
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

                {/* Agent fields */}
                {role === 'agent' && (
                  <div className="space-y-4">
                    {/* EARB License */}
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

                    {/* Verification Document — Drag & Drop */}
                    <ImageUpload
                      value={earbDocUrl ? [earbDocUrl] : []}
                      onChange={(urls) => setEarbDocUrl(urls[0] || '')}
                      multiple={false}
                      label="Verification Document (EARB License)"
                    />

                    {/* Assigned Areas */}
                    <div>
                      <label className="block text-slate-300 text-xs font-semibold mb-2">Assigned Operational Areas</label>
                      <div className="flex flex-wrap gap-2">
                        {AVAILABLE_AREAS.map(area => {
                          const isSelected = assignedAreas.includes(area);
                          return (
                            <button
                              key={area}
                              type="button"
                              onClick={() => handleAreaToggle(area)}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                                isSelected
                                  ? 'bg-green-600/20 border-green-500 text-green-400'
                                  : 'bg-slate-950/30 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              {area}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Landlord fields */}
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

                {/* Tenant: toggle between code link or vacant units list selection */}
                {role === 'tenant' && (
                  <div className="space-y-4">
                    {/* Pre-registration alert */}
                    {tenantEmailStatus?.exists && (
                      <div className={`p-4 rounded-2xl border ${
                        tenantEmailStatus.has_account
                          ? 'bg-amber-500/10 border-amber-500/30'
                          : 'bg-emerald-500/10 border-emerald-500/30'
                      }`}>
                        <div className="flex items-start gap-3">
                          <Info className={`w-5 h-5 flex-shrink-0 mt-0.5 ${tenantEmailStatus.has_account ? 'text-amber-400' : 'text-emerald-400'}`} />
                          <div>
                            {tenantEmailStatus.has_account ? (
                              <>
                                <p className="text-amber-300 text-xs font-bold">Account Already Registered</p>
                                <p className="text-amber-200/70 text-xs mt-1">
                                  Your email is already linked to tenant <span className="font-mono font-bold text-amber-300">{tenantEmailStatus.tenant_code}</span>
                                  {tenantEmailStatus.tenant_name && <> ({tenantEmailStatus.tenant_name})</>}.
                                  This code belongs to another account. Contact your property agent if you believe this is an error.
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-emerald-300 text-xs font-bold">Pre-registered Tenant Found!</p>
                                <p className="text-emerald-200/70 text-xs mt-1">
                                  Your email matches a pre-registered tenant record. Your code <span className="font-mono font-bold text-emerald-300">{tenantEmailStatus.tenant_code}</span> has been auto-filled below.
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex rounded-xl bg-slate-950/40 p-1 border border-slate-800/85 mb-2">
                      <button
                        type="button"
                        onClick={() => { setTenantRegMethod('code'); setSelectedPropertyId(''); setSelectedUnitId(''); }}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                          tenantRegMethod === 'code'
                            ? 'bg-green-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Use Tenant Code
                      </button>
                      <button
                        type="button"
                        onClick={() => { setTenantRegMethod('select'); setTenantCode(''); }}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                          tenantRegMethod === 'select'
                            ? 'bg-green-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Select Property & Unit
                      </button>
                    </div>

                    {tenantRegMethod === 'code' ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Home className="w-4 h-4 text-green-400" />
                          <label className="block text-slate-300 text-xs font-semibold">
                            Enter Tenant Code <span className="text-red-400">*</span>
                          </label>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Please enter the Tenant Code (e.g. TNT-MOM-0001) provided by your property agent to link your account.
                        </p>
                        <div className="relative">
                          <input
                            type="text"
                            value={tenantCode}
                            onChange={e => setTenantCode(e.target.value.toUpperCase())}
                            placeholder="TNT-MOM-XXXX"
                            className="w-full bg-slate-950/50 border border-slate-800 focus:border-green-500/50 focus:ring-1 focus:ring-green-500 text-white placeholder:text-slate-600 rounded-xl px-4 py-3 text-sm outline-none transition uppercase font-mono"
                            required
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Home className="w-4 h-4 text-green-400" />
                          <label className="block text-slate-300 text-xs font-semibold">
                            Choose Property and Unit
                          </label>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Select from the list of currently registered properties and vacant units.
                        </p>

                        <div>
                          <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Select Property</label>
                          <select
                            value={selectedPropertyId}
                            onChange={(e) => {
                              setSelectedPropertyId(e.target.value);
                              setSelectedUnitId('');
                            }}
                            className="w-full bg-slate-950/50 border border-slate-800 focus:border-green-500/50 focus:ring-1 focus:ring-green-500 text-white rounded-xl px-4 py-3 text-sm outline-none transition appearance-none"
                          >
                            <option value="" className="bg-slate-900 text-white">Choose property...</option>
                            {(() => {
                              const seen = new Set();
                              const propsList = [];
                              vacantUnits.forEach(u => {
                                if (!seen.has(u.propertyId)) {
                                  seen.add(u.propertyId);
                                  propsList.push({ id: u.propertyId, name: u.propertyName, code: u.propertyCode, area: u.area });
                                }
                              });
                              return propsList.map(p => (
                                <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                                  {p.name} ({p.code}) — {p.area}
                                </option>
                              ));
                            })()}
                          </select>
                        </div>

                        {selectedPropertyId && (
                          <div>
                            <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Select Unit</label>
                            <select
                              value={selectedUnitId}
                              onChange={(e) => setSelectedUnitId(e.target.value)}
                              className="w-full bg-slate-950/50 border border-slate-800 focus:border-green-500/50 focus:ring-1 focus:ring-green-500 text-white rounded-xl px-4 py-3 text-sm outline-none transition appearance-none"
                            >
                              <option value="" className="bg-slate-900 text-white">Choose unit...</option>
                              {vacantUnits
                                .filter(u => u.propertyId === selectedPropertyId)
                                .map(u => (
                                  <option key={u.unitId} value={u.unitId} className="bg-slate-900 text-white">
                                    Unit {u.unitNumber} — {u.type} (KES {u.rentAmount ? Number(u.rentAmount).toLocaleString() : 'N/A'})
                                  </option>
                                ))
                              }
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
              <button
                type="button"
                onClick={() => signOut()}
                className="px-5 py-3 rounded-xl text-xs font-bold bg-slate-800/40 text-slate-400 hover:bg-slate-800 border border-slate-700/50 transition"
              >
                Sign Out / Back
              </button>

              <button
                id="btn-complete-onboarding"
                type="submit"
                disabled={submitting || !role}
                className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3 rounded-xl text-xs transition shadow-lg shadow-green-900/20 flex items-center justify-center gap-2"
              >
                {submitting
                  ? <><RefreshCw size={14} className="animate-spin" /> Setting up account…</>
                  : 'Complete Registration'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
