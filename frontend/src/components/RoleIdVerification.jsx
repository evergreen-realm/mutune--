import React, { useState, useEffect } from 'react';
import { LogOut, ShieldAlert, KeyRound } from 'lucide-react';
import { useClerk } from '@clerk/clerk-react';


export default function RoleIdVerification({ dbUser, user, onVerified }) {
  const { signOut } = useClerk();
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const currentUser = dbUser || user;
  const isLandlord = currentUser?.role === 'landlord';
  const isAgent = currentUser?.role === 'agent';

  // If user is neither, or if they are already verified, we shouldn't show this
  if (!isLandlord && !isAgent) {
    return null;
  }

  const expectedId = isLandlord ? currentUser?.landlord_id : currentUser?.user_code;
  const label = isLandlord ? '6-Digit Landlord ID' : 'Agent ID (e.g., AGT-MOM-XXX)';
  const storageKey = `mutunerent_verified_id_${currentUser?._id}`;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const cleanInput = inputValue.trim();
      if (!cleanInput) {
        setError('Please enter your ID code.');
        setLoading(false);
        return;
      }

      if (cleanInput.toLowerCase() === expectedId?.toLowerCase()) {
        localStorage.setItem(storageKey, 'true');
        sessionStorage.setItem(`role_verified_${currentUser?._id}`, 'true');
        setLoading(false);
        onVerified();
      } else {
        setError(`Incorrect ${isLandlord ? 'Landlord ID' : 'Agent ID'}. Please try again or contact administration.`);
        setLoading(false);
      }
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 px-4 text-white">
      {/* Background radial glow */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-blue-500/10 blur-[120px]" />

      <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-2xl relative z-10 animate-fade-in">
        <div className="h-16 w-16 mx-auto bg-green-500/10 rounded-2xl flex items-center justify-center border border-green-500/20 text-green-400 mb-6">
          <KeyRound size={32} />
        </div>

        <h1 className="text-2xl font-black text-center tracking-tight mb-2 text-slate-100 font-sans">
          Identity Verification
        </h1>
        <p className="text-xs text-slate-400 text-center mb-6 leading-relaxed">
          Please enter your unique ID to unlock your dashboard session.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              {label}
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={isLandlord ? "e.g. 100001" : "e.g. AGT-MOM-001"}
              className="w-full bg-slate-950/50 border border-slate-800 focus:border-green-500 focus:ring-1 focus:ring-green-500 rounded-xl px-4 py-3 text-sm font-mono text-slate-200 outline-none transition-all placeholder-slate-600"
              required
            />
          </div>

          {error && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl text-xs text-red-400 leading-normal">
              <ShieldAlert size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-green-700 active:bg-green-700 rounded-xl text-xs font-bold transition-all text-white uppercase tracking-wider shadow-lg shadow-green-900/20"
          >
            {loading ? 'Verifying...' : 'Verify Identity'}
          </button>
        </form>

        <div className="relative flex py-4 items-center">
          <div className="flex-grow border-t border-slate-800/60"></div>
          <span className="flex-shrink mx-4 text-[9px] text-slate-500 font-bold uppercase tracking-wider">or</span>
          <div className="flex-grow border-t border-slate-800/60"></div>
        </div>

        <button
          onClick={() => signOut()}
          className="w-full py-3 bg-slate-800/60 hover:bg-slate-700/60 active:bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-slate-300"
        >
          <LogOut size={14} /> Log Out
        </button>
      </div>
    </div>
  );
}
