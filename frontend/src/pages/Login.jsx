import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Building2, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

/**
 * Sandbox login page. In production this is replaced by Clerk-hosted UI.
 * The form sets a mock token so ProtectedRoute lets the user through.
 */
export default function Login() {
  const { setUser, setToken } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const DEMO_ACCOUNTS = [
    { email: 'admin@mutune.test',    password: 'demo1234', role: 'admin',    full_name: 'Admin User' },
    { email: 'agent@mutune.test',    password: 'demo1234', role: 'agent',    full_name: 'Field Agent' },
    { email: 'landlord@mutune.test', password: 'demo1234', role: 'landlord', full_name: 'Property Owner' }
  ];

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const account = DEMO_ACCOUNTS.find(a => a.email === email && a.password === password);
      if (account) {
        const mockToken = `mock_${account.role}_${Date.now()}`;
        setToken(mockToken);
        setUser({ email: account.email, role: account.role, full_name: account.full_name });
      } else {
        setError('Invalid credentials. Use one of the demo accounts below.');
      }
      setLoading(false);
    }, 600);
  };

  const quickLogin = (account) => {
    setEmail(account.email);
    setPassword(account.password);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Background accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Brand card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="h-12 w-12 bg-green-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Building2 size={24} className="text-white" />
            </div>
            <div>
              <div className="text-white font-black text-xl tracking-tight">MutuneRent</div>
              <div className="text-green-400 text-xs font-bold uppercase tracking-widest">Pro · Mombasa</div>
            </div>
          </div>

          <h1 className="text-white text-lg font-bold text-center mb-1">Sign In to Dashboard</h1>
          <p className="text-slate-400 text-xs text-center mb-8">Property Management System · Powered by Clerk</p>

          {/* Error */}
          {error && (
            <div className="mb-4 flex items-center gap-2.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium px-4 py-3 rounded-xl">
              <AlertCircle size={14} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5" htmlFor="login-email">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agent@mutune.test"
                required
                className="w-full bg-white/5 border border-white/10 text-white placeholder:text-slate-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500/50 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5" htmlFor="login-password">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-white/5 border border-white/10 text-white placeholder:text-slate-600 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500/50 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-green-900/30 mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                  </svg>
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2"><Lock size={14} /> Sign In</span>
              )}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-[11px] text-slate-500 text-center uppercase tracking-wider font-bold mb-3">
              Demo Sandbox Accounts
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  id={`demo-${acc.role}`}
                  onClick={() => quickLogin(acc)}
                  className="flex flex-col items-center gap-1.5 p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all group"
                >
                  <div className="h-7 w-7 rounded-full bg-slate-700 group-hover:bg-green-700 flex items-center justify-center transition-colors text-[11px] font-bold text-white">
                    {acc.full_name.charAt(0)}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-400 group-hover:text-slate-200 transition-colors capitalize">
                    {acc.role}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-600 mt-6">
          Production deployments use Clerk.dev SSO · Free tier · Mombasa, KE
        </p>
      </div>
    </div>
  );
}
