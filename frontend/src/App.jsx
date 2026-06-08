import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuthStore } from './store/authStore';

// Pages
import Dashboard     from './pages/Dashboard';
import Login         from './pages/Login';
import Tenants       from './pages/Tenants';
import Payments      from './pages/Payments';
import AddProperty   from './pages/AddProperty';
import AdminDashboard from './pages/AdminDashboard';
import TenantPortal  from './pages/TenantPortal';
import Notices       from './pages/Notices';

// Components
import PropertyList  from './components/PropertyList';
import ChatAssistant from './components/ChatAssistant';

// Icons
import {
  LayoutDashboard, Building2, Users2, WalletCards,
  Wrench, ShieldCheck, Home, PlusCircle, BarChart3,
  Menu, X, Bell, Settings, LogOut, MapPin, FileText
} from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: false }
  }
});

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
}

function AppShell() {
  const { user, logout, isAuthenticated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const location = useLocation();

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  if (!isAuthenticated()) return null;

  const isAdmin  = ['admin', 'super_admin'].includes(user?.role);
  const isTenant = user?.role === 'tenant';
  const isAgent  = user?.role === 'agent';

  // ── Nav definition ────────────────────────────────────────────────────────
  const navItems = [
    // Everyone sees Dashboard
    {
      path: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} />,
      show: true
    },
    // Admin-only analytics
    {
      path: '/admin', label: 'Analytics', icon: <BarChart3 size={18} />,
      show: isAdmin
    },
    // Properties — admin + agent
    {
      path: '/properties', label: 'Properties', icon: <Building2 size={18} />,
      show: !isTenant
    },
    // Add Property — admin + agent
    {
      path: '/properties/add', label: 'Add Property', icon: <PlusCircle size={18} />,
      show: isAdmin || isAgent
    },
    // Tenants — admin + agent
    {
      path: '/tenants', label: 'Tenants', icon: <Users2 size={18} />,
      show: !isTenant
    },
    // Payments — admin + agent + accountant + landlord
    {
      path: '/payments', label: 'Rent Payments', icon: <WalletCards size={18} />,
      show: !isTenant
    },
    // Tenant portal — tenant only
    {
      path: '/tenant', label: 'My Portal', icon: <Home size={18} />,
      show: isTenant
    },
    // Maintenance — coming Phase 3 full board (placeholder, now tenant-only via portal)
    {
      path: '/maintenance', label: 'Maintenance', icon: <Wrench size={18} />,
      show: isAdmin, disabled: true, badge: 'Phase 3'
    },
    // Notices — Phase 3: admin + agent + tenant
    {
      path: '/notices', label: 'Notices', icon: <FileText size={18} />,
      show: isAdmin || isAgent || isTenant
    }
  ].filter((item) => item.show);

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
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto scrollbar-thin">
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
            {user?.full_name?.charAt(0) ?? 'A'}
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate text-slate-100">{user?.full_name ?? 'Agent Account'}</p>
              <p className="text-[10px] text-slate-400 truncate capitalize">{user?.role}</p>
            </div>
          )}
        </div>
        {sidebarOpen && (
          <button
            id="logout-btn"
            onClick={logout}
            className="mt-3 flex w-full items-center justify-center gap-2 px-3 py-1.5 border border-slate-800 hover:border-red-900 rounded-lg text-[10px] font-bold text-slate-400 hover:text-red-400 transition-colors uppercase tracking-wider"
          >
            <LogOut size={12} /> Log Out
          </button>
        )}
      </div>
    </aside>
  );

  return (
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
            <button
              id="notifications-btn"
              className="relative p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
            <button
              id="settings-btn"
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Settings size={18} />
            </button>
            <div className="h-8 w-px bg-gray-100" />
            <div className="text-xs font-bold text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 font-mono">
              {new Date().toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 page-enter">
          <Routes>
            {/* Core */}
            <Route path="/"            element={<Dashboard />} />
            <Route path="/properties"  element={<ProtectedRoute><PropertyList /></ProtectedRoute>} />
            <Route path="/properties/add" element={<ProtectedRoute><AddProperty /></ProtectedRoute>} />
            <Route path="/tenants"     element={<ProtectedRoute><Tenants /></ProtectedRoute>} />
            <Route path="/payments"    element={<ProtectedRoute><Payments /></ProtectedRoute>} />

            {/* Phase 2 */}
            <Route path="/admin"       element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="/tenant"      element={<ProtectedRoute><TenantPortal /></ProtectedRoute>} />

            {/* Phase 3 */}
            <Route path="/notices"     element={<ProtectedRoute><Notices user={user} /></ProtectedRoute>} />

            {/* Fallback */}
            <Route path="*"            element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* AI Chat Assistant — persistent across all pages */}
        <ChatAssistant user={user} />
      </div>
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={
            isAuthenticated() ? <Navigate to="/" replace /> : <Login />
          } />
          <Route path="/*" element={
            isAuthenticated() ? <AppShell /> : <Navigate to="/login" replace />
          } />
        </Routes>
      </BrowserRouter>

      {/* Global toast container — positioned top-right, slim design */}
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
  );
}
