import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import posthog from 'posthog-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  RedirectToSignIn,
  useUser,
  useClerk
} from '@clerk/clerk-react';


// Pages — route-level code splitting via React.lazy
const DashboardPage           = React.lazy(() => import('./pages/DashboardPage'));
const TenantsPage             = React.lazy(() => import('./pages/TenantsPage'));
const PaymentsPage            = React.lazy(() => import('./pages/PaymentsPage'));
const AddPropertyPage         = React.lazy(() => import('./pages/AddPropertyPage'));
const AdminDashboardPage      = React.lazy(() => import('./pages/AdminDashboardPage'));
const TenantPortalPage        = React.lazy(() => import('./pages/TenantPortalPage'));
const NoticesPage             = React.lazy(() => import('./pages/NoticesPage'));
const LoginPage               = React.lazy(() => import('./pages/LoginPage'));
const SignUpPage              = React.lazy(() => import('./pages/SignUpPage'));
const PropertiesPage          = React.lazy(() => import('./pages/PropertiesPage'));
const PropertyDetailPage      = React.lazy(() => import('./pages/PropertyDetailPage'));
const OnboardingPage          = React.lazy(() => import('./pages/OnboardingPage'));
const MaintenancePage         = React.lazy(() => import('./pages/MaintenancePage'));
const LandlordDashboardPage   = React.lazy(() => import('./pages/LandlordDashboardPage'));
const LandlordAddPropertyPage = React.lazy(() => import('./pages/LandlordAddPropertyPage'));
const AgentPerformancePage    = React.lazy(() => import('./pages/AgentPerformancePage'));
const AdminUserManagementPage = React.lazy(() => import('./pages/AdminUserManagementPage'));
const AdminInventoryPage      = React.lazy(() => import('./pages/AdminInventoryPage'));
const TasksPage               = React.lazy(() => import('./pages/TasksPage'));

import { useThemeStore } from './store/themeStore';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Layout components
import AppShellLayout from './layouts/AppShell';

// Components
import ChatAssistant from './components/ChatAssistant';
import AdminPasswordGuard from './components/AdminPasswordGuard';
import RoleIdVerification from './components/RoleIdVerification';
import CinematicPreloader from './components/CinematicPreloader';
import { syncClerk } from './lib/api';
import { Sentry } from './lib/sentry';

// Icons (only those still used directly in App.jsx)
import {
  Building2, ShieldCheck, X, LogOut,
} from 'lucide-react';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: false }
  }
});

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('[MutuneRent ErrorBoundary]', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4 max-w-lg mx-auto mt-12 text-white">
          <div className="h-12 w-12 mx-auto bg-red-500/10 rounded-2xl flex items-center justify-center">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold">Something went wrong</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            An error occurred while rendering this page: {this.state.error?.message || "Unknown error"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all uppercase tracking-wider"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppShell() {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { theme, toggleTheme } = useThemeStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [isSynced,    setIsSynced]    = useState(false);
  const [dbUser,      setDbUser]      = useState(null);
  const [isRoleVerified, setIsRoleVerified] = useState(false);
  const [preloaderDone, setPreloaderDone] = useState(false);
  // stabilising: true for 1.5s after sync completes to prevent flash-redirect
  // during the onboarding→dashboard transition
  const [stabilising, setStabilising] = useState(false);
  const derivedRole = dbUser?.role || undefined;
  const location = useLocation();

  useEffect(() => {
    if (import.meta.env.VITE_POSTHOG_KEY) {
      posthog.capture('$pageview');
    }
  }, [location]);

  const handleLogout = (options = {}) => {
    setPreloaderDone(false);
    // Clear all verification keys from both storages (OWASP A01 - clean logout)
    ['sessionStorage', 'localStorage'].forEach(storeName => {
      const store = window[storeName];
      const keysToRemove = [];
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (key && (key.startsWith('mutunerent_verified_id_') || key.startsWith('role_verified_') || key.startsWith('mutunet_') || key.startsWith('mutune_admin'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => store.removeItem(k));
    });
    signOut(options);
  };

  useEffect(() => {
    if (derivedRole) {
      const isVerifiableRole = ['agent', 'landlord', 'tenant'].includes(derivedRole);
      const isAdmin = ['admin', 'super_admin'].includes(derivedRole);
      if (isVerifiableRole && dbUser) {
        const key = `mutunerent_verified_id_${dbUser._id}`;
        setIsRoleVerified(localStorage.getItem(key) === 'true' || sessionStorage.getItem(`role_verified_${dbUser._id}`) === 'true');
      } else if (isAdmin) {
        setIsRoleVerified(sessionStorage.getItem('mutunet_admin_verified') === 'true');
      } else {
        setIsRoleVerified(true);
      }
    } else {
      setIsRoleVerified(false);
    }
  }, [derivedRole, dbUser]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (isLoaded && clerkUser) {
      const syncUser = async () => {
        try {
          const email = clerkUser.primaryEmailAddress?.emailAddress;
          const phone = clerkUser.primaryPhoneNumber?.phoneNumber || '254700000000';
          let cleanPhone = phone.replace('+', '');
          if (!cleanPhone.startsWith('254')) cleanPhone = '254700000000';

          const prevRole = dbUser?.role;
          
          const res = await syncClerk({
            clerk_id: clerkUser.id,
            email: email,
            full_name: clerkUser.fullName || clerkUser.username || email,
            phone: cleanPhone
          });
          if (res?.success && res.data) {
            setDbUser(res.data);

            // If Clerk publicMetadata doesn't have a role yet but the DB does,
            // the backend just backfilled it. Reload the Clerk user so that
            // publicMetadata.role is fresh BEFORE we set isSynced = true.
            if (!clerkUser.publicMetadata?.role && res.data?.role) {
              try {
                await clerkUser.reload();
              } catch (reloadErr) {
                console.warn('[MutuneRent] Clerk user reload failed:', reloadErr?.message);
              }
            }

            // ── Anti-glitch stabiliser ────────────────────────────────────────
            // If the user just gained a role (fresh registration transition),
            // hold the loading screen for 1.5s so React Router doesn't
            // evaluate needsOnboarding mid-state and flash-redirect back to /onboarding.
            if (!prevRole && res.data?.role) {
              setStabilising(true);
              setTimeout(() => setStabilising(false), 2500);
            }
          }
          if (import.meta.env.VITE_SENTRY_DSN) {
            Sentry.setUser({
              id: clerkUser.id,
              email: email,
              username: clerkUser.fullName || clerkUser.username || email,
              role: clerkUser.publicMetadata?.role
            });
          }
          setIsSynced(true);
        } catch (err) {
          console.error('Failed to sync user with backend:', err);
          setIsSynced(true);
        }
      };
      syncUser();
    } else if (isLoaded && !clerkUser) {
      setIsSynced(true);
    }
  }, [isLoaded, clerkUser?.id, clerkUser?.publicMetadata?.role]);


  if (isLoaded && clerkUser && !preloaderDone) {
    return <CinematicPreloader onComplete={() => setPreloaderDone(true)} duration={2000} />;
  }

  if (!isLoaded || !isSynced || stabilising) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 bg-primary/20 rounded-xl flex items-center justify-center animate-pulse">
            <Building2 size={20} className="text-primary" />
          </div>
          <p className="text-xs text-muted font-medium">
            {stabilising ? 'Setting up your workspace…' : 'Verifying account…'}
          </p>
        </div>
      </div>
    );
  }

  // needsOnboarding: user has no role at all.
  // NOTE: Do NOT check current_property_id/current_unit_id here — those fields
  // live on the Tenant model, not on the User model, so they are always
  // undefined on dbUser and would cause an infinite onboarding redirect loop.
  const needsOnboarding = !derivedRole && !stabilising;

  if (needsOnboarding) {
    if (location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
    }
  } else {
    // User has a role — if they land on /onboarding, send them home
    if (location.pathname === '/onboarding') {
      const homeRoute =
        ['admin','super_admin'].includes(derivedRole) ? '/admin' :
        derivedRole === 'tenant'   ? '/tenant' :
        derivedRole === 'landlord' ? '/dashboard' :
        '/dashboard';
      return <Navigate to={homeRoute} replace />;
    }
  }

  if (location.pathname === '/onboarding') {
    return (
      <>
        <OnboardingPage />
        <ChatAssistant key={dbUser?._id || 'onboarding'} user={dbUser} />
      </>
    );
  }
  const fullName = clerkUser?.fullName || clerkUser?.username || 'Property Owner';
  const user = { role: derivedRole, full_name: fullName };

  const isAdmin  = ['admin', 'super_admin'].includes(derivedRole);
  const isTenant = derivedRole === 'tenant';
  const isAgent  = derivedRole === 'agent';

  if (derivedRole === 'agent' && dbUser) {
    if (dbUser.agent_approval_status === 'pending') {
      return (
        <>
          <div className="flex h-screen items-center justify-center bg-slate-950 px-4 text-white relative overflow-hidden">
            <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-500/10 blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-blue-500/10 blur-[120px]" />
            
            <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-2xl relative z-10 text-center animate-fade-in">
              <div className="h-16 w-16 mx-auto bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 text-blue-400 mb-6">
                <ShieldCheck size={32} className="animate-pulse" />
              </div>
              
              <h1 className="text-xl font-extrabold tracking-tight mb-2 text-slate-100 font-sans">
                Verification Pending
              </h1>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                Your Estate Agent registration is undergoing review. The admin team at Mutune Estate Agency is verifying your uploaded verification document.
              </p>

              <div className="bg-slate-950/40 border border-slate-800/50 p-4 rounded-2xl mb-8 text-left font-mono">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="text-slate-500 font-medium">Full Name:</span>
                  <span className="text-slate-300 font-semibold">{dbUser.full_name}</span>
                </div>
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="text-slate-500 font-medium">Email Address:</span>
                  <span className="text-slate-300 font-semibold">{dbUser.email}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Verification Doc:</span>
                  <span className={`font-semibold text-xs ${dbUser.earb_verification_doc_url ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {dbUser.earb_verification_doc_url ? '✓ Submitted' : '⚠ Not uploaded'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-8 font-medium">
                We'll send an email to <span className="text-slate-400">{dbUser.email}</span> as soon as your account is approved.
              </p>

              <button
                onClick={() => handleLogout()}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700/50 hover:border-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-slate-300"
              >
                <LogOut size={14} /> Log Out of Account
              </button>
            </div>
          </div>
          <ChatAssistant key={dbUser._id + '-agent-pending'} user={dbUser} />
        </>
      );
    }

    if (dbUser.agent_approval_status === 'rejected') {
      return (
        <>
          <div className="flex h-screen items-center justify-center bg-slate-950 px-4 text-white relative overflow-hidden">
            <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-red-500/10 blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-orange-500/10 blur-[120px]" />
            
            <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-2xl relative z-10 text-center animate-fade-in">
              <div className="h-16 w-16 mx-auto bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 text-red-400 mb-6">
                <X size={32} />
              </div>
              
              <h1 className="text-xl font-extrabold tracking-tight mb-2 text-slate-100 font-sans">
                Application Rejected
              </h1>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                Unfortunately, your Estate Agent application could not be approved by the admin team.
              </p>

              <div className="bg-red-500/5 border border-red-500/10 p-5 rounded-2xl mb-8 text-left">
                <p className="text-xs uppercase font-bold text-red-400 tracking-wider mb-1">Reason for Rejection:</p>
                <p className="text-xs text-slate-300 italic">
                  "{dbUser.agent_rejection_reason || 'No specific reason was provided. Please contact support.'}"
                </p>
              </div>

              <p className="text-xs text-slate-500 mb-8 font-medium">
                You can contact management or sign out to register using a different role.
              </p>

              <button
                onClick={() => handleLogout({ redirectUrl: '/sign-up' })}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700/50 hover:border-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-slate-300"
              >
                <LogOut size={14} /> Sign Out & Register New Account
              </button>
            </div>
          </div>
          <ChatAssistant key={dbUser._id + '-agent-rejected'} user={dbUser} />
        </>
      );
    }
  }

  if (derivedRole === 'landlord' && dbUser) {
    if (dbUser.landlord_approval_status === 'pending') {
      return (
        <>
          <div className="flex h-screen items-center justify-center bg-slate-950 px-4 text-white relative overflow-hidden">
            <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-500/10 blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-blue-500/10 blur-[120px]" />
            
            <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-2xl relative z-10 text-center animate-fade-in">
              <div className="h-16 w-16 mx-auto bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 text-blue-400 mb-6">
                <ShieldCheck size={32} className="animate-pulse" />
              </div>
              
              <h1 className="text-xl font-extrabold tracking-tight mb-2 text-slate-100 font-sans">
                Landlord Verification Pending
              </h1>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                Your Landlord registration is undergoing review. The admin team at Mutune Estate Agency is verifying your uploaded verification documents.
              </p>

              <div className="bg-slate-950/40 border border-slate-800/50 p-4 rounded-2xl mb-8 text-left font-mono">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="text-slate-500 font-medium">Full Name:</span>
                  <span className="text-slate-300 font-semibold">{dbUser.full_name}</span>
                </div>
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="text-slate-500 font-medium">Email Address:</span>
                  <span className="text-slate-300 font-semibold">{dbUser.email}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Verification Doc:</span>
                  <span className={`font-semibold text-xs ${dbUser.landlord_verification_doc_url ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {dbUser.landlord_verification_doc_url ? '✓ Submitted' : '⚠ Not uploaded'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-8 font-medium">
                We'll send an email to <span className="text-slate-400">{dbUser.email}</span> as soon as your account is approved.
              </p>

              <button
                onClick={() => handleLogout()}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700/50 hover:border-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-slate-300"
              >
                <LogOut size={14} /> Log Out of Account
              </button>
            </div>
          </div>
          <ChatAssistant key={dbUser._id + '-landlord-pending'} user={dbUser} />
        </>
      );
    }

    if (dbUser.landlord_approval_status === 'rejected') {
      return (
        <>
          <div className="flex h-screen items-center justify-center bg-slate-950 px-4 text-white relative overflow-hidden">
            <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-red-500/10 blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-orange-500/10 blur-[120px]" />
            
            <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-2xl relative z-10 text-center animate-fade-in">
              <div className="h-16 w-16 mx-auto bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 text-red-400 mb-6">
                <X size={32} />
              </div>
              
              <h1 className="text-xl font-extrabold tracking-tight mb-2 text-slate-100 font-sans">
                Landlord Registration Rejected
              </h1>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                Unfortunately, your Landlord registration could not be approved by the admin team.
              </p>

              <div className="bg-red-500/5 border border-red-500/10 p-5 rounded-2xl mb-8 text-left">
                <p className="text-xs uppercase font-bold text-red-400 tracking-wider mb-1">Status details:</p>
                <p className="text-xs text-slate-300 italic">
                  Please contact support for more details regarding your registration.
                </p>
              </div>

              <p className="text-xs text-slate-500 mb-8 font-medium">
                You can contact management or sign out to register using a different role.
              </p>

              <button
                onClick={() => handleLogout({ redirectUrl: '/sign-up' })}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700/50 hover:border-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-slate-300"
              >
                <LogOut size={14} /> Sign Out & Register New Account
              </button>
            </div>
          </div>
          <ChatAssistant key={dbUser._id + '-landlord-rejected'} user={dbUser} />
        </>
      );
    }
  }

  // 🔐 Role‑specific verification gate
  if (!isRoleVerified) {
    if (['agent', 'landlord', 'tenant'].includes(derivedRole)) {
      if (dbUser) {
        return (
          <>
            <RoleIdVerification user={dbUser} dbUser={dbUser} onVerified={() => setIsRoleVerified(true)} />
            <ChatAssistant key={dbUser._id + '-role-verify'} user={dbUser} />
          </>
        );
      }
    } else if (derivedRole === 'admin' || derivedRole === 'super_admin') {
      return (
        <>
          <AdminPasswordGuard onVerified={() => setIsRoleVerified(true)} />
          <ChatAssistant key="admin-pw-guard" user={dbUser || user} />
        </>
      );
    }
  }

  return (
    <AppShellLayout
      theme={theme}
      onToggleTheme={toggleTheme}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      mobileOpen={mobileOpen}
      setMobileOpen={setMobileOpen}
      role={derivedRole}
      dbUser={dbUser}
      isRoleVerified={isRoleVerified}
      isSynced={isSynced}
      clerkUserId={clerkUser?.id}
      onLogout={handleLogout}
    >
      <ErrorBoundary>
        <React.Suspense fallback={
          <div className="flex-1 flex items-center justify-center min-h-[60vh]">
            <span className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
        <Routes>
          <Route path="/" element={
            derivedRole === 'tenant' ? <TenantPortalPage /> :
            derivedRole === 'landlord' ? <LandlordDashboardPage dbUser={dbUser} /> :
            derivedRole === 'agent' ? <AgentPerformancePage dbUser={dbUser} /> :
            (derivedRole === 'admin' || derivedRole === 'super_admin') ? <AdminDashboardPage dbUser={dbUser} /> :
            <DashboardPage />
          } />
          <Route path="/properties"     element={<PropertiesPage dbUser={dbUser} />} />
          <Route path="/properties/add" element={
            derivedRole === 'landlord' ? <LandlordAddPropertyPage dbUser={dbUser} /> :
            <AddPropertyPage dbUser={dbUser} />
          } />
          <Route path="/properties/add-landlord" element={<LandlordAddPropertyPage dbUser={dbUser} />} />
          <Route path="/properties/:id" element={<PropertyDetailPage dbUser={dbUser} />} />
          <Route path="/tenants"        element={<TenantsPage dbUser={dbUser} />} />
          <Route path="/payments"       element={<PaymentsPage dbUser={dbUser} />} />
          <Route path="/maintenance"    element={<MaintenancePage dbUser={dbUser} />} />
          <Route path="/tasks"          element={<TasksPage dbUser={dbUser} />} />
          <Route path="/admin"          element={<Navigate to="/" replace />} />
          <Route path="/admin/users"    element={<AdminUserManagementPage />} />
          <Route path="/admin/inventory" element={<AdminInventoryPage />} />
          <Route path="/tenant"         element={<TenantPortalPage />} />
          <Route path="/dashboard"      element={
            derivedRole === 'tenant'   ? <TenantPortalPage /> :
            derivedRole === 'landlord' ? <LandlordDashboardPage dbUser={dbUser} /> :
            derivedRole === 'agent'    ? <AgentPerformancePage dbUser={dbUser} /> :
            (derivedRole === 'admin' || derivedRole === 'super_admin') ? <AdminDashboardPage dbUser={dbUser} /> :
            <DashboardPage />
          } />
          <Route path="/notices"        element={<NoticesPage user={user} />} />
          <Route path="*"              element={<Navigate to="/" replace />} />
        </Routes>
        </React.Suspense>
      </ErrorBoundary>

      {/* AI Chat Assistant — pass dbUser so session keys are user-specific */}
      <ChatAssistant user={dbUser || user} />
    </AppShellLayout>
  );
}

export default function App() {
  const { theme } = useThemeStore();

  React.useEffect(() => {
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
    };
  }, []);
  if (!PUBLISHABLE_KEY) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center p-8">
          <div className="text-red-400 text-lg font-bold mb-2">Configuration Error</div>
          <p className="text-slate-400 text-sm">VITE_CLERK_PUBLISHABLE_KEY is not set.</p>
          <p className="text-slate-500 text-xs mt-2">Set it in your Vercel environment variables.</p>
        </div>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} signInUrl="/login" signUpUrl="/sign-up" afterSignOutUrl="/">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login/*" element={<LoginPage />} />
            <Route path="/sign-up/*" element={<SignUpPage />} />
            <Route path="/*" element={
              <>
                <SignedIn>
                  <AppShell />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
              </>
            } />
          </Routes>
        </BrowserRouter>

        <ToastContainer
          position="top-right"
          autoClose={4000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnHover
          theme={theme}
          toastClassName="text-sm font-medium shadow-lg rounded-xl"
        />
      </QueryClientProvider>
    </ClerkProvider>
  );
}
