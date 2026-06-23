import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { Building2 } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Background accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-900/20">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">MutuneRent</h1>
          <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mt-0.5">PRO · MOMBASA</p>
          <p className="text-slate-400 mt-2 text-xs">Property Management System · Powered by Clerk</p>
        </div>
        
        <SignIn 
          routing="path" 
          path="/login"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/"
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "bg-slate-800 border border-slate-700 shadow-2xl rounded-3xl",
              headerTitle: "text-white font-bold",
              headerSubtitle: "text-slate-400 text-xs",
              formFieldLabel: "text-slate-300 text-xs font-semibold",
              formFieldInput: "bg-slate-900/50 border-slate-700 text-white rounded-xl text-sm focus:ring-blue-500",
              footerActionLink: "text-blue-400 hover:text-blue-300",
              primaryButton: "bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl",
              socialButtonsBlockButton: "bg-slate-700 border-slate-600 text-white hover:bg-slate-600",
              dividerLine: "bg-slate-700",
              dividerText: "text-slate-500",
              formFieldInputShowPasswordButton: "text-slate-400 hover:text-slate-200"
            }
          }}
        />
      </div>
    </div>
  );
}
