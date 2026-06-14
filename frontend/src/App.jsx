import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
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

// Pages
import DashboardPage     from './pages/DashboardPage';
import TenantsPage       from './pages/TenantsPage';
import PaymentsPage      from './pages/PaymentsPage';
import AddPropertyPage   from './pages/AddPropertyPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import TenantPortalPage  from './pages/TenantPortalPage';
import NoticesPage       from './pages/NoticesPage';
import LoginPage         from './pages/LoginPage';
import SignUpPage        from './pages/SignUpPage';
import PropertiesPage    from './pages/PropertiesPage';
import PropertyDetailPage from './pages/PropertyDetailPage';
import OnboardingPage    from './pages/OnboardingPage';
import MaintenancePage   from './pages/MaintenancePage';
import LandlordDashboardPage from './pages/LandlordDashboardPage';
import LandlordAddPropertyPage from './pages/LandlordAddPropertyPage';
import AgentPerformancePage from './pages/AgentPerformancePage';
import AdminUserManagementPage from './pages/AdminUserManagementPage';
import AdminInventoryPage from './pages/AdminInventoryPage';



// Components
import PropertyList  from './components/PropertyList';
import ChatAssistant from './components/ChatAssistant';
import AdminPasswordGuard from './components/AdminPasswordGuard';
import RoleIdVerification from './components/RoleIdVerification';
import { syncClerk, fetchNotifications, markNotifRead, markAllNotifsRead } from './lib/api';
import { Sentry } from './lib/sentry';
import { toast } from 'react-toastify';

// Icons
import {
  LayoutDashboard, Building2, Users2, WalletCards,
  Wrench, ShieldCheck, Home, PlusCircle, BarChart3,
  Menu, X, Bell, Settings, LogOut, MapPin, FileText
} from 'lucide-react';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: false }
  }
});

function AppShell() {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [isSynced,    setIsSynced]    = useState(false);
  const [dbUser,      setDbUser]      = useState(null);
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isRoleVerified, setIsRoleVerified] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (dbUser) {
      const key = `mutunerent_verified_id_${dbUser._id}`;
      setIsRoleVerified(localStorage.getItem(key) === 'true');
    }
  }, [dbUser]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (isLoaded && clerkUser) {
      const syncUser = async () => {
        try {
          const email = clerkUser.primaryEmailAddress?.emailAddress;
          const phone = clerkUser.primaryPhoneNumber?.phoneNumber || '254700000000';
          let cleanPhone = phone.replace('+', '');
          if (!cleanPhone.startsWith('254')) cleanPhone = '254700000000';
          
          const res = await syncClerk({
            clerk_id: clerkUser.id,
            email: email,
            full_name: clerkUser.fullName || clerkUser.username || email,
            phone: cleanPhone
          });
          if (res?.success && res.data) {
            setDbUser(res.data);

            // ── CLERK METADATA RELOAD ─────────────────────────────────────────
            // If Clerk publicMetadata doesn't have a role yet but the DB does,
            // the backend just backfilled it. Reload the Clerk user so that
            // publicMetadata.role is fresh BEFORE we set isSynced = true.
            // This prevents approved agents/landlords from being wrongly
            // redirected to /onboarding on login.
            if (!clerkUser.publicMetadata?.role && res.data?.role) {
              try {
                await clerkUser.reload();
              } catch (reloadErr) {
                console.warn('[MutuneRent] Clerk user reload failed:', reloadErr?.message);
              }
            }
            // ─────────────────────────────────────────────────────────────────
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
          setIsSynced(true); // Fallback to avoid completely blocking the user in case of issues
        }
      };
      syncUser();
    } else if (isLoaded && !clerkUser) {
      setIsSynced(true);
    }
  }, [isLoaded, clerkUser]);

  // Fetch notifications scoped to the user
  const { data: notifData, refetch: refetchNotifs } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 30000,
    enabled: isSynced && !!clerkUser,
    retry: 1
  });

  const notifications = notifData?.data || [];
  const unreadCount = notifData?.unreadCount || 0;

  if (!isLoaded || !isSynced) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 bg-green-600 rounded-xl flex items-center justify-center animate-pulse">
            <Building2 size={20} className="text-white" />
          </div>
          <p className="text-sm text-gray-400 font-medium">Verifying account synchronization...</p>
        </div>
      </div>
    );
  }

  // ── ROLE DERIVATION ────────────────────────────────────────────────────────
  // Primary: Clerk publicMetadata.role (set during onboarding/backfill).
  // Fallback: DB role — but ONLY for users who demonstrably completed
  // registration (approved or uploaded docs). This prevents a brand-new
  // auto-created user (no docs, no approval) from skipping /onboarding.
  const hasCompletedRegistration = dbUser && (
    ['admin', 'super_admin', 'accountant'].includes(dbUser.role) ||
    dbUser.role === 'tenant' ||
    (dbUser.role === 'agent' && (
      dbUser.earb_license ||
      dbUser.agent_approval_status === 'approved'
    )) ||
    (dbUser.role === 'landlord' && (
      (dbUser.landlord_verification_doc_url &&
        !dbUser.landlord_verification_doc_url.includes('placeholder')) ||
      dbUser.landlord_approval_status === 'approved'
    ))
  );
  const role = clerkUser?.publicMetadata?.role ||
    (hasCompletedRegistration ? dbUser.role : undefined);
  // ──────────────────────────────────────────────────────────────────────────

  if (!role) {
    if (location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
    }
  } else {
    if (location.pathname === '/onboarding') {
      return <Navigate to="/" replace />;
    }
  }

  if (location.pathname === '/onboarding') {
    return <OnboardingPage />;
  }

  const derivedRole = role || 'landlord';
  const fullName = clerkUser?.fullName || clerkUser?.username || 'Property Owner';
  const user = { role: derivedRole, full_name: fullName };

  const isAdmin  = ['admin', 'super_admin'].includes(derivedRole);
  const isTenant = derivedRole === 'tenant';
  const isAgent  = derivedRole === 'agent';

  if (derivedRole === 'agent' && dbUser) {
    if (dbUser.agent_approval_status === 'pending') {
      return (
        <div className="flex h-screen items-center justify-center bg-slate-950 px-4 text-white relative overflow-hidden">
          <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-500/10 blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-blue-500/10 blur-[120px]" />
          
          <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-2xl relative z-10 text-center animate-fade-in">
            <div className="h-16 w-16 mx-auto bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 text-emerald-400 mb-6">
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

            <p className="text-[10px] text-slate-500 mb-8 font-medium">
              We'll send an email to <span className="text-slate-400">{dbUser.email}</span> as soon as your account is approved.
            </p>

            <button
              onClick={() => signOut()}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700/50 hover:border-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-slate-300"
            >
              <LogOut size={14} /> Log Out of Account
            </button>
          </div>
        </div>
      );
    }

    if (dbUser.agent_approval_status === 'rejected') {
      return (
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
              <p className="text-[10px] uppercase font-bold text-red-400 tracking-wider mb-1">Reason for Rejection:</p>
              <p className="text-xs text-slate-300 italic">
                "{dbUser.agent_rejection_reason || 'No specific reason was provided. Please contact support.'}"
              </p>
            </div>

            <p className="text-[10px] text-slate-500 mb-8 font-medium">
              You can contact management or sign out to register using a different role.
            </p>

            <button
              onClick={() => signOut({ redirectUrl: '/sign-up' })}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700/50 hover:border-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-slate-300"
            >
              <LogOut size={14} /> Sign Out & Register New Account
            </button>
          </div>
        </div>
      );
    }
  }

  if (derivedRole === 'landlord' && dbUser) {
    if (dbUser.landlord_approval_status === 'pending') {
      return (
        <div className="flex h-screen items-center justify-center bg-slate-950 px-4 text-white relative overflow-hidden">
          <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-500/10 blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-blue-500/10 blur-[120px]" />
          
          <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-2xl relative z-10 text-center animate-fade-in">
            <div className="h-16 w-16 mx-auto bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 text-emerald-400 mb-6">
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

            <p className="text-[10px] text-slate-500 mb-8 font-medium">
              We'll send an email to <span className="text-slate-400">{dbUser.email}</span> as soon as your account is approved.
            </p>

            <button
              onClick={() => signOut()}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700/50 hover:border-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-slate-300"
            >
              <LogOut size={14} /> Log Out of Account
            </button>
          </div>
        </div>
      );
    }

    if (dbUser.landlord_approval_status === 'rejected') {
      return (
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
              <p className="text-[10px] uppercase font-bold text-red-400 tracking-wider mb-1">Status details:</p>
              <p className="text-xs text-slate-300 italic">
                Please contact support for more details regarding your registration.
              </p>
            </div>

            <p className="text-[10px] text-slate-500 mb-8 font-medium">
              You can contact management or sign out to register using a different role.
            </p>

            <button
              onClick={() => signOut({ redirectUrl: '/sign-up' })}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700/50 hover:border-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-slate-300"
            >
              <LogOut size={14} /> Sign Out & Register New Account
            </button>
          </div>
        </div>
      );
    }
  }

  // Identity verification gatekeeper for landlords/agents
  if (dbUser && (derivedRole === 'landlord' || derivedRole === 'agent') && !isRoleVerified) {
    return <RoleIdVerification dbUser={dbUser} onVerified={() => setIsRoleVerified(true)} />;
  }


  const navItems = [
    { path: '/',               label: 'Dashboard',   icon: <LayoutDashboard size={18} />, show: true },
    { path: '/admin',          label: 'Analytics',   icon: <BarChart3 size={18} />,        show: isAdmin },
    { path: '/admin/users',    label: 'Manage Users', icon: <Users2 size={18} />,           show: isAdmin },
    { path: '/admin/inventory', label: 'Auctions & Inventory', icon: <Building2 size={18} />, show: isAdmin },
    { path: '/properties',     label: 'Properties',  icon: <Building2 size={18} />,        show: !isTenant },
    { path: '/properties/add', label: 'Add Property',icon: <PlusCircle size={18} />,       show: isAdmin || isAgent || derivedRole === 'landlord' },
    { path: '/tenants',        label: 'Tenants',     icon: <Users2 size={18} />,           show: !isTenant },
    { path: '/payments',       label: 'Rent Payments',icon: <WalletCards size={18} />,     show: !isTenant },
    { path: '/tenant',         label: 'My Portal',   icon: <Home size={18} />,             show: false },
    { path: '/maintenance',    label: 'Maintenance', icon: <Wrench size={18} />,           show: true },
    { path: '/notices',        label: 'Notices',     icon: <FileText size={18} />,         show: isAdmin || isAgent || isTenant }
  ].filter(item => item.show);

  const Sidebar = () => (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex flex-col bg-slate-900 text-white transition-all duration-300 ${
        sidebarOpen ? 'w-64' : 'w-20'
      }`}
    >
      {/* Brand */}
      <div className="flex h-16 items-center justify-between px-5 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-2 bg-green-600 rounded-lg text-white font-black flex-shrink-0 text-xs">MR</div>
          {sidebarOpen && (
            <span className="font-extrabold text-sm tracking-wider uppercase">
              MutuneRent <span className="text-green-500 font-medium normal-case">Pro</span>
            </span>
          )}
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="hidden lg:flex p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
        >
          {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navItems.map((item) => {
          if (item.disabled) {
            return (
              <div
                key={item.label}
                title="Coming soon"
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-500 cursor-not-allowed opacity-50"
              >
                {item.icon}
                {sidebarOpen && (
                  <div className="flex items-center justify-between w-full">
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[8px] font-bold">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          }

          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {item.icon}
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex-shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-green-500 border border-slate-700 uppercase flex-shrink-0 text-sm">
            {fullName.charAt(0)}
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate text-slate-100">{fullName}</p>
              <p className="text-[10px] text-slate-400 truncate capitalize">{role}</p>
            </div>
          )}
        </div>
        {sidebarOpen && (
          <button
            id="logout-btn"
            onClick={() => signOut()}
            className="mt-3 flex w-full items-center justify-center gap-2 px-3 py-1.5 border border-slate-800 hover:border-red-900 rounded-lg text-[10px] font-bold text-slate-400 hover:text-red-400 transition-colors uppercase tracking-wider"
          >
            <LogOut size={12} /> Log Out
          </button>
        )}
      </div>
    </aside>
  );

  const layout = (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-20 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="lg:hidden">
            <Sidebar />
          </div>
        </>
      )}

      {/* Main area */}
      <div
        className={`flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300 ${
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
        }`}
      >
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-gray-100 px-6 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <Menu size={18} />
            </button>
            <span className="text-xs text-gray-400 font-semibold flex items-center gap-1">
              <MapPin size={14} className="text-red-500" /> Mombasa, KE
            </span>
            <span className="hidden sm:inline text-xs text-gray-200">|</span>
            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider text-green-600 bg-green-50 px-2 py-0.5 rounded">
              Lipa Na M-Pesa Sandbox Active
            </span>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link
                to="/admin"
                title="Admin Analytics"
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <ShieldCheck size={18} />
              </Link>
            )}
            {/* Notifications Dropdown */}
            <div className="relative">
              <button
                id="notifications-btn"
                onClick={() => { setNotifOpen(!notifOpen); setSettingsOpen(false); }}
                className="relative p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors focus:outline-none"
                title="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white animate-ping" />
                )}
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                )}
              </button>
              
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 p-4 max-h-96 overflow-y-auto page-enter animate-fade-in">
                    <div className="flex items-center justify-between border-b border-gray-50 pb-2 mb-3">
                      <span className="text-xs font-bold text-gray-700">Notifications ({unreadCount} unread)</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={async () => {
                            try {
                              await markAllNotifsRead();
                              refetchNotifs();
                              toast.success('All notifications marked as read');
                            } catch (err) {
                              toast.error(err?.error?.message || 'Failed to update notifications');
                            }
                          }}
                          className="text-[10px] text-green-600 hover:text-green-500 font-bold uppercase tracking-wider transition-colors"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="text-center py-8 text-xs text-gray-400 font-medium">
                          All caught up! 🎉
                        </div>
                      ) : (
                        notifications.map((n) => {
                          const isRead = (dbUser && dbUser._id && n.read_by) 
                            ? n.read_by.some(uid => uid?.toString() === dbUser._id.toString()) 
                            : false;
                          return (
                            <div
                              key={n._id}
                              onClick={async () => {
                                if (!isRead) {
                                  try {
                                    await markNotifRead(n._id);
                                    refetchNotifs();
                                  } catch (err) {
                                    console.error(err);
                                  }
                                }
                              }}
                              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                isRead 
                                  ? 'bg-white border-gray-100/50 hover:bg-gray-50/50' 
                                  : 'bg-green-50/20 border-green-100/30 hover:bg-green-50/30'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className={`text-xs font-semibold ${isRead ? 'text-gray-700 font-medium' : 'text-slate-900 font-bold'}`}>
                                  {n.title}
                                </span>
                                {!isRead && (
                                  <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0 mt-1" />
                                )}
                              </div>
                              <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{n.message}</p>
                              <span className="text-[8px] text-gray-400 font-mono block mt-1.5">
                                {new Date(n.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Settings Dropdown */}
            <div className="relative">
              <button
                id="settings-btn"
                onClick={() => { setSettingsOpen(!settingsOpen); setNotifOpen(false); }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors focus:outline-none"
                title="Settings"
              >
                <Settings size={18} />
              </button>
              
              {settingsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 p-4 page-enter animate-fade-in">
                    <h3 className="text-xs font-bold text-gray-700 border-b border-gray-50 pb-2 mb-3">System Settings</h3>
                    <div className="space-y-3">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">User Profile</p>
                        <p className="text-xs font-bold text-slate-800 mt-1 truncate">{fullName}</p>
                        <p className="text-[10px] text-slate-500 capitalize">{derivedRole}</p>
                        {dbUser?.phone && <p className="text-[9px] text-slate-400 font-mono mt-1">{dbUser.phone}</p>}
                      </div>
                      
                      <div className="space-y-1.5 text-[10px] font-medium text-slate-500">
                        <div className="flex justify-between">
                          <span>Billing Currency:</span>
                          <span className="font-bold text-slate-700">KES (Shilling)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>M-Pesa Sandbox:</span>
                          <span className="font-bold text-green-600">Active</span>
                        </div>
                        <div className="flex justify-between">
                          <span>System Location:</span>
                          <span className="font-bold text-slate-700">Mombasa, KE</span>
                        </div>
                        <div className="flex justify-between">
                          <span>API Status:</span>
                          <span className="font-bold text-green-600">Connected</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => signOut()}
                        className="w-full mt-2 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-[10px] font-bold transition flex items-center justify-center gap-1.5 uppercase tracking-wider"
                      >
                        <LogOut size={12} /> Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="h-8 w-px bg-gray-100" />
            <div className="text-xs font-bold text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 font-mono">
              {new Date().toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 page-enter">
          <Routes>
            <Route path="/" element={
              derivedRole === 'tenant' ? <TenantPortalPage /> :
              derivedRole === 'landlord' ? <LandlordDashboardPage /> :
              derivedRole === 'agent' ? <AgentPerformancePage dbUser={dbUser} /> :
              <DashboardPage />
            } />
            <Route path="/properties"     element={<PropertiesPage />} />
            <Route path="/properties/add" element={
              derivedRole === 'landlord' ? <LandlordAddPropertyPage /> :
              <AddPropertyPage />
            } />
            <Route path="/properties/add-landlord" element={<LandlordAddPropertyPage />} />
            <Route path="/properties/:id" element={<PropertyDetailPage />} />
            <Route path="/tenants"        element={<TenantsPage />} />
            <Route path="/payments"       element={<PaymentsPage />} />
            <Route path="/maintenance"    element={<MaintenancePage />} />
            <Route path="/admin"          element={<AdminDashboardPage />} />
            <Route path="/admin/users"    element={<AdminUserManagementPage />} />
            <Route path="/admin/inventory" element={<AdminInventoryPage />} />
            <Route path="/tenant"         element={isTenant ? <Navigate to="/" replace /> : <TenantPortalPage />} />
            <Route path="/notices"        element={<NoticesPage user={user} />} />
            <Route path="*"              element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* AI Chat Assistant */}
        <ChatAssistant user={user} />
      </div>
    </div>
  );

  if (isAdmin) {
    return <AdminPasswordGuard>{layout}</AdminPasswordGuard>;
  }

  return layout;
}

export default function App() {
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
          theme="light"
          toastClassName="text-sm font-medium shadow-lg rounded-xl"
        />
      </QueryClientProvider>
    </ClerkProvider>
  );
}
