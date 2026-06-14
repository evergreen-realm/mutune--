import React, { useState, useRef, useCallback } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Building2, Shield, Users, UserCheck, Briefcase,
  Phone, Award, MapPin, Home, RefreshCw, AlertCircle,
  UploadCloud, CheckCircle2, FileText, X
} from 'lucide-react';
import { updateUserRole, fetchVacantUnits, uploadDoc } from '../lib/api';
import ImageUpload from '../components/ImageUpload';

const AVAILABLE_AREAS = [
  'Nyali', 'Bamburi', 'Tudor', 'Kisauni',
  'Ganjoni', 'Mombasa Island', 'Shanzu', 'Likoni'
];

// Verification document uploader replaced with unified ImageUpload component

export default function OnboardingPage() {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const [role,             setRole]             = useState('');
  const [phone,            setPhone]            = useState('');
  const [earbLicense,      setEarbLicense]      = useState('');
  const [earbDocUrl,       setEarbDocUrl]       = useState('');
  const [landlordDocUrl,   setLandlordDocUrl]   = useState('');
  const [assignedAreas,    setAssignedAreas]    = useState([]);
  const [selectedUnitId,   setSelectedUnitId]   = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [propertySearch,   setPropertySearch]   = useState('');
  const [submitting,       setSubmitting]       = useState(false);

  // Fetch vacant units only when tenant role is selected
  const { data: vacantData, isLoading: unitsLoading } = useQuery({
    queryKey: ['vacantUnits'],
    queryFn: fetchVacantUnits,
    enabled: role === 'tenant',
    retry: 1
  });

  const vacantUnits = vacantData?.data || [];

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
    }
    if (role === 'landlord') {
      if (!landlordDocUrl) {
        toast.error('Please upload your property ownership verification document before submitting.');
        return;
      }
    }
    if (role === 'tenant') {
      if (!selectedPropertyId || !selectedUnitId) {
        toast.error('Property and unit selection are required for Tenants.');
        return;
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
        payload.unit_id = selectedUnitId;
        payload.property_id = selectedPropertyId;
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
      <div className="w-full max-w-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
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
                    onClick={() => { setRole(id); setSelectedUnitId(''); setSelectedPropertyId(''); }}
                    className={`flex items-start gap-4 p-4 rounded-2xl text-left transition-all border ${
                      role === id
                        ? 'bg-green-600/10 border-green-500 shadow-md shadow-green-950/20'
                        : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/60 hover:border-slate-600'
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${role === id ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
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

                {/* Tenant: searchable Property select + Unit select */}
                {role === 'tenant' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Home className="w-4 h-4 text-green-400" />
                      <label className="block text-slate-300 text-xs font-semibold">
                        Select Property and Unit <span className="text-red-400">*</span>
                      </label>
                    </div>

                    {unitsLoading ? (
                      <div className="flex items-center gap-2 text-slate-400 text-xs py-3">
                        <RefreshCw size={14} className="animate-spin" /> Loading available units…
                      </div>
                    ) : vacantUnits.length === 0 ? (
                      <div className="flex items-center gap-2 p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-amber-400 text-xs">
                        <AlertCircle size={14} className="flex-shrink-0" />
                        No vacant units available right now. Please contact the administrator.
                      </div>
                    ) : (
                      <>
                        {/* Searchable Property Input */}
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 font-medium">Search Property</span>
                          <input
                            type="text"
                            placeholder="Type property name or code..."
                            value={propertySearch}
                            onChange={(e) => {
                              setPropertySearch(e.target.value);
                              setSelectedPropertyId('');
                              setSelectedUnitId('');
                            }}
                            className="w-full bg-slate-950/50 border border-slate-800 focus:border-green-500/50 focus:ring-1 focus:ring-green-500 text-white placeholder:text-slate-600 rounded-xl px-4 py-3 text-sm outline-none transition"
                          />
                          {propertySearch && !selectedPropertyId && (
                            <div className="max-h-40 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl mt-1 p-2 space-y-1 z-20 relative">
                              {Array.from(new Map(vacantUnits.map(u => [u.propertyId, { id: u.propertyId, name: u.propertyName, code: u.propertyCode }])).values())
                                .filter(p => p.name.toLowerCase().includes(propertySearch.toLowerCase()) || p.code.toLowerCase().includes(propertySearch.toLowerCase()))
                                .map(p => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedPropertyId(p.id);
                                      setPropertySearch(`${p.name} (${p.code})`);
                                      setSelectedUnitId('');
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
                                  >
                                    {p.name} <span className="text-slate-500 font-mono text-[10px]">[{p.code}]</span>
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>

                        {/* Select Unit (Filtered) */}
                        {selectedPropertyId && (
                          <div className="space-y-1 animate-fade-in">
                            <span className="text-[10px] text-slate-400 font-medium">Select Vacant Unit</span>
                            <select
                              id="onboarding-unit-select"
                              value={selectedUnitId}
                              onChange={e => setSelectedUnitId(e.target.value)}
                              className="w-full bg-slate-950/50 border border-slate-800 focus:border-green-500/50 focus:ring-1 focus:ring-green-500 text-white rounded-xl px-4 py-3 text-sm outline-none transition"
                              required
                            >
                              <option value="">— Select Unit —</option>
                              {vacantUnits
                                .filter(u => u.propertyId === selectedPropertyId)
                                .map(u => (
                                  <option key={u.unitId} value={u.unitId}>
                                    Unit {u.unitNumber} {u.bedrooms ? `(${u.bedrooms} Bed)` : ''} — KES {u.rentAmount?.toLocaleString()}/mo
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}
                      </>
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
