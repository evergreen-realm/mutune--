import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Eye, EyeOff, XCircle, LogOut } from 'lucide-react';
import { verifyAdminPassword } from '../lib/api';
import { toast } from 'react-toastify';
import { useClerk } from '@clerk/clerk-react';
import CinematicPreloader from './CinematicPreloader';


export default function AdminPasswordGuard({ children, onVerified }) {
  const { signOut } = useClerk();
  const [password, setPassword] = useState('');
  const [isVerified, setIsVerified] = useState(() => {
    return sessionStorage.getItem('mutunet_admin_verified') === 'true';
  });
  const [showPreloader, setShowPreloader] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isVerified) {
    return <>{children}</>;
  }

  if (showPreloader) {
    return <CinematicPreloader onComplete={() => {
      setIsVerified(true);
      toast.success('Admin authorization approved');
      if (onVerified) onVerified();
    }} />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await verifyAdminPassword(password);
      if (res?.success) {
        sessionStorage.setItem('mutunet_admin_verified', 'true');
        setShowPreloader(true);
      } else {
        setError(res?.error?.message || 'Verification failed. Incorrect admin password.');
      }
    } catch (err) {
      setError(err?.error?.message || 'Verification failed. Incorrect admin password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 px-4 text-white">
      {/* Background radial glow */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-red-500/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-blue-500/10 blur-[120px]" />

      <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-2xl relative z-10 animate-fade-in">
        <div className="h-16 w-16 mx-auto bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 text-red-400 mb-6">
          <Lock size={32} />
        </div>

        <h1 className="text-2xl font-black text-center tracking-tight mb-2 text-slate-100 font-sans">
          Admin Authorization
        </h1>
        <p className="text-xs text-slate-400 text-center mb-6 leading-relaxed">
          Please enter the secure admin password to access this management area.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Admin Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full bg-slate-950/50 border border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl pl-4 pr-12 py-3 text-sm font-sans text-slate-200 outline-none transition-all placeholder-slate-600"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl text-xs text-red-400 leading-normal animate-shake">
              <XCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-700 active:bg-red-700 rounded-xl text-xs font-bold transition-all text-white uppercase tracking-wider shadow-lg shadow-red-900/20"
          >
            {loading ? 'Authorizing...' : 'Authorize Access'}
          </button>
        </form>

        <div className="relative flex py-4 items-center">
          <div className="flex-grow border-t border-slate-800/60"></div>
          <span className="flex-shrink mx-4 text-xs text-slate-500 font-bold uppercase tracking-wider">or</span>
          <div className="flex-grow border-t border-slate-800/60"></div>
        </div>

        <button
          onClick={() => signOut()}
          className="w-full py-3 bg-slate-800/60 hover:bg-slate-700/60 active:bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-slate-300"
        >
          <LogOut size={14} /> Cancel & Sign Out
        </button>
      </div>
    </div>
  );
}
