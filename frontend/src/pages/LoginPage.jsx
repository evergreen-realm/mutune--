import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { useThemeStore } from '../store/themeStore';
import { Sun, Moon, Building2 } from 'lucide-react';

export default function LoginPage() {
  const { theme, toggleTheme } = useThemeStore();
  const isLight = theme === 'light';

  const clerkAppearance = {
    elements: {
      rootBox: "mx-auto w-full max-w-sm",
      card: `shadow-2xl rounded-3xl border transition-all duration-300 p-6 ${
        isLight 
          ? "bg-white border-slate-200 text-slate-800" 
          : "bg-slate-900/90 border-slate-800 text-white backdrop-blur-md"
      }`,
      headerTitle: `font-bold tracking-tight text-xl ${isLight ? "text-slate-900" : "text-white"}`,
      headerSubtitle: `${isLight ? "text-slate-500" : "text-slate-400"} text-xs`,
      formFieldLabel: `text-xs font-semibold ${isLight ? "text-slate-700" : "text-slate-300"}`,
      formFieldInput: `rounded-xl text-sm border focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 ${
        isLight 
          ? "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400" 
          : "bg-slate-950 border-slate-800/80 text-white placeholder-slate-600"
      }`,
      footerActionLink: "text-blue-600 hover:text-blue-500 font-semibold",
      footer: "bg-transparent",
      footerAction: "bg-transparent",
      footerActionText: isLight ? "text-slate-600" : "text-slate-400",
      primaryButton: "bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl py-2.5 transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30",
      socialButtonsBlockButton: `border transition-all duration-200 rounded-xl ${
        isLight 
          ? "bg-white border-slate-200 text-slate-800 hover:bg-slate-50" 
          : "bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
      }`,
      dividerLine: isLight ? "bg-slate-200" : "bg-slate-800",
      dividerText: isLight ? "text-slate-400" : "text-slate-500",
      formFieldInputShowPasswordButton: isLight ? "text-slate-400 hover:text-slate-600" : "text-slate-500 hover:text-slate-300"
    }
  };

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
        {/* Background Image showing floating spheres */}
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-10000 ease-out hover:scale-105"
          style={{ backgroundImage: `url('/assets/log_in.jpg')` }}
        />
        {/* Dark Overlay with Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-slate-950/50 flex flex-col justify-between p-12">
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
          <div className="max-w-md bg-slate-900/40 backdrop-blur-md border border-white/5 p-6 rounded-2xl">
            <span className="text-blue-400 text-[10px] font-bold tracking-[0.2em] uppercase">Premium Coastal Portal</span>
            <h2 className="text-3xl font-light text-white mt-1 leading-tight">
              High-Fidelity <span className="font-semibold text-blue-500">Property Management</span>
            </h2>
            <p className="text-white/60 mt-3 text-xs leading-relaxed">
              Experience the future of property interactions with 3D voxel blueprints, automated KRA tax reporting, instant M-Pesa STK rent payments, and secure digital leases.
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: Clerk Form */}
      <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-6 relative">
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

        {/* Form Container */}
        <div className="w-full max-w-sm">
          <SignIn 
            routing="path" 
            path="/login"
            signUpUrl="/sign-up"
            fallbackRedirectUrl="/"
            appearance={clerkAppearance}
          />
        </div>
      </div>
    </div>
  );
}
