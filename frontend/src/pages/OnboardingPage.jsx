import React, { useState } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Building2, Shield, Users, UserCheck, Briefcase, Phone, Award, MapPin } from 'lucide-react';
import { updateUserRole } from '../lib/api';

const AVAILABLE_AREAS = [
  'Nyali',
  'Bamburi',
  'Tudor',
  'Kisauni',
  'Ganjoni',
  'Mombasa Island',
  'Shanzu',
  'Likoni'
];

export default function OnboardingPage() {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [earbLicense, setEarbLicense] = useState('');
  const [assignedAreas, setAssignedAreas] = useState([]);
  const [submitting, setSubmitting] = useState(false);

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
    if (assignedAreas.includes(area)) {
      setAssignedAreas(assignedAreas.filter(a => a !== area));
    } else {
      setAssignedAreas([...assignedAreas, area]);
    }
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

    setSubmitting(true);
    try {
      const payload = {
        role,
        phone: phone.trim()
      };

      if (role === 'agent') {
        if (!earbLicense.trim()) {
          toast.error('EARB License number is required for Agents.');
          setSubmitting(false);
          return;
        }
        payload.earb_license = earbLicense.trim();
        payload.assigned_areas = assignedAreas;
      }

      await updateUserRole(payload);
      
      // Reload Clerk user profile to capture the updated publicMetadata.role
      await clerkUser.reload();
      
      toast.success('Onboarding completed successfully!');
      
      // Redirect to home (which will route according to the new role)
      navigate('/');
    } catch (err) {
      console.error('Onboarding failed:', err);
      toast.error(err.response?.data?.error?.message || err.message || 'Onboarding failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-green-900/30">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">Onboarding</h1>
            <p className="text-slate-400 text-sm mt-2 max-w-md">
              Welcome to MutuneRent Pro! Please select your role and fill in your details to set up your account workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Role Selection Cards */}
            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-3">Select Your Role</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Agent Option */}
                <button
                  type="button"
                  onClick={() => setRole('agent')}
                  className={`flex items-start gap-4 p-4 rounded-2xl text-left transition-all border ${
                    role === 'agent'
                      ? 'bg-green-600/10 border-green-500 shadow-md shadow-green-950/20'
                      : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/60 hover:border-slate-600'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl ${role === 'agent' ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Estate Agent</h3>
                    <p className="text-slate-400 text-xs mt-1">Manage listings, check-in properties, generate and issue notices.</p>
                  </div>
                </button>

                {/* Landlord Option */}
                <button
                  type="button"
                  onClick={() => setRole('landlord')}
                  className={`flex items-start gap-4 p-4 rounded-2xl text-left transition-all border ${
                    role === 'landlord'
                      ? 'bg-green-600/10 border-green-500 shadow-md shadow-green-950/20'
                      : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/60 hover:border-slate-600'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl ${role === 'landlord' ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Landlord</h3>
                    <p className="text-slate-400 text-xs mt-1">View your properties, analyze occupancy rates, and monitor payouts.</p>
                  </div>
                </button>

                {/* Tenant Option */}
                <button
                  type="button"
                  onClick={() => setRole('tenant')}
                  className={`flex items-start gap-4 p-4 rounded-2xl text-left transition-all border ${
                    role === 'tenant'
                      ? 'bg-green-600/10 border-green-500 shadow-md shadow-green-950/20'
                      : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/60 hover:border-slate-600'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl ${role === 'tenant' ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Tenant</h3>
                    <p className="text-slate-400 text-xs mt-1">Pay rent via M-Pesa, log tickets, and view official lease documents.</p>
                  </div>
                </button>

                {/* Admin Option */}
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`flex items-start gap-4 p-4 rounded-2xl text-left transition-all border ${
                    role === 'admin'
                      ? 'bg-green-600/10 border-green-500 shadow-md shadow-green-950/20'
                      : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/60 hover:border-slate-600'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl ${role === 'admin' ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Agency Administrator</h3>
                    <p className="text-slate-400 text-xs mt-1">Full management access over properties, agents, billing, and reports.</p>
                  </div>
                </button>
              </div>
            </div>

            {/* General Fields */}
            {role && (
              <div className="space-y-4 pt-4 border-t border-slate-800/60 transition-all duration-300">
                {/* Phone Number */}
                <div>
                  <label className="block text-slate-300 text-xs font-semibold mb-2">Phone Number (M-Pesa sync format)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="254700000000"
                      className="w-full bg-slate-950/50 border border-slate-800 focus:border-green-500/50 focus:ring-1 focus:ring-green-500 text-white placeholder:text-slate-600 rounded-xl px-4 py-3 pl-11 text-sm outline-none transition"
                      required
                    />
                  </div>
                </div>

                {/* Agent Specific Fields */}
                {role === 'agent' && (
                  <div className="space-y-4 animate-fadeIn">
                    <div>
                      <label className="block text-slate-300 text-xs font-semibold mb-2">EARB License Number</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">
                          <Award className="w-4 h-4" />
                        </span>
                        <input
                          type="text"
                          value={earbLicense}
                          onChange={(e) => setEarbLicense(e.target.value)}
                          placeholder="EARB-XXXXX"
                          className="w-full bg-slate-950/50 border border-slate-800 focus:border-green-500/50 focus:ring-1 focus:ring-green-500 text-white placeholder:text-slate-600 rounded-xl px-4 py-3 pl-11 text-sm outline-none transition"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 text-xs font-semibold mb-2">Assigned Operational Areas</label>
                      <div className="flex flex-wrap gap-2">
                        {AVAILABLE_AREAS.map((area) => {
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
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-800/60">
              <button
                type="button"
                onClick={() => signOut()}
                className="px-5 py-3 rounded-xl text-xs font-bold bg-slate-800/40 text-slate-400 hover:bg-slate-800 border border-slate-700/50 transition duration-200"
              >
                Sign Out / Back
              </button>

              <button
                type="submit"
                disabled={submitting || !role}
                className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3 rounded-xl text-xs transition duration-200 shadow-lg shadow-green-900/20"
              >
                {submitting ? 'Setting up account...' : 'Complete Registration'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
