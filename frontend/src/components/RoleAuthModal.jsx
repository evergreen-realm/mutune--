import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../store/themeStore';
import {
  X, ShieldCheck, UserPlus, LogIn, Building2, Key,
  Briefcase, Shield, ArrowRight, CheckCircle2, Sparkles,
  Zap, Compass
} from 'lucide-react';

const ROLES = [
  {
    id: 'landlord',
    title: 'Landlord / Property Owner',
    icon: Building2,
    badge: 'KRA Tax Automated',
    color: 'from-blue-600 to-indigo-600',
    description: 'Track multi-family rent income, automated 7.5% MRI & 10% WHT tax statements, M-Pesa payouts.',
    features: ['Auto KRA Tax Reports', 'M-Pesa Direct Payouts', 'Lease Approvals']
  },
  {
    id: 'tenant',
    title: 'Tenant / Resident',
    icon: Key,
    badge: 'Instant M-Pesa STK',
    color: 'from-emerald-600 to-teal-600',
    description: '1-click M-Pesa STK Push rent payments, 3D unit blueprints, digital lease receipts & maintenance tickets.',
    features: ['1-Click Rent Pay', '3D Floor Plan', 'Digital Notice Board']
  },
  {
    id: 'agent',
    title: 'Property Agent / Field Manager',
    icon: Briefcase,
    badge: 'EARB Compliant',
    color: 'from-amber-600 to-orange-600',
    description: 'Perform unit audits, manage tenant check-ins, issue legal digital notices, track performance metrics.',
    features: ['EARB License Verify', 'Unit Inspection App', 'Notice Generator']
  },
  {
    id: 'admin',
    title: 'System Admin / Manager',
    icon: Shield,
    badge: 'Full Oversight',
    color: 'from-purple-600 to-pink-600',
    description: 'Full system audit logs, user role approvals, inventory auctions, financial reconciliation.',
    features: ['Global Audit Logs', 'Role Management', 'Auction Manager']
  }
];

export default function RoleAuthModal({ isOpen, onClose, defaultMode = 'new' }) {
  const navigate = useNavigate();
  const { theme } = useThemeStore();
  const isLight = theme === 'light';

  // 'status' = step 1 (New vs Existing)
  // 'role'   = step 2 (Select Role)
  const [step, setStep] = useState('status');
  const [userStatus, setUserStatus] = useState(defaultMode); // 'new' | 'existing'
  const [selectedRole, setSelectedRole] = useState('landlord');

  useEffect(() => {
    if (isOpen) {
      setUserStatus(defaultMode);
      setStep('status');
    }
  }, [isOpen, defaultMode]);

  if (!isOpen) return null;

  const handleStatusSelect = (status) => {
    setUserStatus(status);
    setStep('role');
  };

  const handleProceed = () => {
    onClose();
    if (userStatus === 'new') {
      // Direct to signup or onboarding with selected role
      navigate(`/onboarding?role=${selectedRole}`);
    } else {
      // Direct to login
      navigate(`/login?role=${selectedRole}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in">
      {/* Backdrop blur overlay */}
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Glassmorphic Modal Window */}
      <div className={`relative w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden transition-all z-10 ${
        isLight 
          ? 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-900/10' 
          : 'bg-slate-900/90 border-white/10 text-white shadow-blue-500/10 backdrop-blur-2xl'
      }`}>
        
        {/* Top Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight">
                {step === 'status' ? 'Welcome to MutuneRent Pro' : userStatus === 'new' ? 'Create Your Account' : 'Sign In to Your Portal'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {step === 'status' 
                  ? 'Identify your status to access the coastal property portal'
                  : userStatus === 'new'
                    ? 'Select your role to start onboarding'
                    : 'Select your role to sign in to your dashboard'
                }
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6">

          {/* STEP 1: STATUS SELECTION */}
          {step === 'status' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option A: New User */}
              <button
                onClick={() => handleStatusSelect('new')}
                className={`group relative text-left p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                  isLight 
                    ? 'bg-slate-50 hover:bg-blue-50/50 border-slate-200 hover:border-blue-500/50' 
                    : 'bg-slate-950/60 hover:bg-slate-800/80 border-slate-800 hover:border-blue-500/50'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <UserPlus className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 bg-blue-500/10 px-2.5 py-1 rounded-full">
                      New Lead / User
                    </span>
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
                      Register New Account
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      First time visiting? Set up a new Landlord, Tenant, or Agent profile with instant Google Sign-Up.
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex items-center text-xs font-bold text-blue-500 group-hover:translate-x-1 transition-transform">
                  <span>Start Onboarding</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </div>
              </button>

              {/* Option B: Existing User */}
              <button
                onClick={() => handleStatusSelect('existing')}
                className={`group relative text-left p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                  isLight 
                    ? 'bg-slate-50 hover:bg-emerald-50/50 border-slate-200 hover:border-emerald-500/50' 
                    : 'bg-slate-950/60 hover:bg-slate-800/80 border-slate-800 hover:border-emerald-500/50'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <LogIn className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                      Already Registered
                    </span>
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">
                      Sign In to Dashboard
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Already registered? Continue to your role-specific dashboard with Google SSO & Role ID verification.
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex items-center text-xs font-bold text-emerald-500 group-hover:translate-x-1 transition-transform">
                  <span>Sign In Now</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </div>
              </button>
            </div>
          )}

          {/* STEP 2: ROLE SELECTION */}
          {step === 'role' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Select Your Account Role:
                </span>
                <button
                  onClick={() => setStep('status')}
                  className="text-xs font-semibold text-blue-500 hover:underline flex items-center gap-1"
                >
                  Change Status ({userStatus === 'new' ? 'New User' : 'Registered User'})
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
                {ROLES.map((r) => {
                  const Icon = r.icon;
                  const isSelected = selectedRole === r.id;
                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedRole(r.id)}
                      className={`relative text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? isLight
                            ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20'
                            : 'bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/30'
                          : isLight
                            ? 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                            : 'bg-slate-950/50 hover:bg-slate-800/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${r.color} text-white shadow-md`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        {isSelected ? (
                          <CheckCircle2 className="w-5 h-5 text-blue-500" />
                        ) : (
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            {r.badge}
                          </span>
                        )}
                      </div>

                      <h5 className="font-bold text-sm text-slate-900 dark:text-white">
                        {r.title}
                      </h5>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {r.description}
                      </p>

                      <div className="flex flex-wrap gap-1 mt-3">
                        {r.features.map((f, idx) => (
                          <span key={idx} className="text-[9px] px-2 py-0.5 rounded-md bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Submit */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                <button
                  onClick={() => setStep('status')}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Back
                </button>

                <button
                  onClick={handleProceed}
                  className="flex-1 max-w-xs py-3 px-6 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-blue-500/25 transition-all transform active:scale-98 flex items-center justify-center gap-2"
                >
                  <span>
                    {userStatus === 'new' ? 'Continue to Google Sign-Up' : 'Continue to Google Sign-In'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
