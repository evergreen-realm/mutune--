import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import Dashboard from './pages/Dashboard';
import PropertyList from './components/PropertyList';
import { 
  LayoutDashboard, 
  Building2, 
  Users2, 
  WalletCards, 
  Wrench, 
  MessageSquareCode, 
  Menu, 
  X, 
  Bell, 
  Settings, 
  LogOut,
  MapPin
} from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: false } }
});

function NavigationContent() {
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { path: '/properties', label: 'Properties', icon: <Building2 size={18} /> },
    { path: '/tenants', label: 'Tenants', icon: <Users2 size={18} />, disabled: true },
    { path: '/payments', label: 'Rent Payments', icon: <WalletCards size={18} />, disabled: true },
    { path: '/maintenance', label: 'Maintenance', icon: <Wrench size={18} />, disabled: true },
    { path: '/chat', label: 'AI Assistant', icon: <MessageSquareCode size={18} />, disabled: true }
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      {/* Sidebar Container */}
      <aside 
        className={`fixed inset-y-0 left-0 z-20 flex flex-col bg-slate-900 text-white transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        } lg:static`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-green-600 rounded-lg text-white font-bold flex-shrink-0">
              MR
            </div>
            {sidebarOpen && (
              <span className="font-extrabold text-sm tracking-wider uppercase transition-all duration-200">
                MutuneRent <span className="text-green-500 font-medium lowercase">Pro</span>
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

        {/* Navigation links */}
        <nav className="flex-1 space-y-1.5 px-3 py-4 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            if (item.disabled) {
              return (
                <div
                  key={item.label}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-500 cursor-not-allowed select-none opacity-60`}
                  title="Coming soon in Phase 2"
                >
                  {item.icon}
                  {sidebarOpen && (
                    <div className="flex items-center justify-between w-full">
                      <span>{item.label}</span>
                      <span className="bg-slate-800 text-slate-400 px-1 py-0.5 rounded text-[8px] scale-90">Phase 2</span>
                    </div>
                  )}
                </div>
              );
            }

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

        {/* User Profile / Footer Section */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-green-500 border border-slate-700 uppercase flex-shrink-0">
              {user ? user.full_name?.charAt(0) : 'A'}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate text-slate-100">{user?.full_name || 'Agent Account'}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.email || 'agent@mutune.test'}</p>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <button 
              onClick={logout}
              className="mt-3 flex w-full items-center justify-center gap-2 px-3 py-1.5 border border-slate-800 hover:border-red-900 rounded-lg text-[10px] font-bold text-slate-400 hover:text-red-400 transition-colors uppercase tracking-wider"
            >
              <LogOut size={12} /> Log Out
            </button>
          )}
        </div>
      </aside>

      {/* Main Panel Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header bar */}
        <header className="h-16 bg-white border-b border-gray-100 px-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 font-semibold flex items-center gap-1">
              <MapPin size={14} className="text-red-500" /> Mombasa, KE
            </span>
            <span className="hidden sm:inline text-xs text-gray-200">|</span>
            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider text-green-600 bg-green-50 px-2 py-0.5 rounded">
              Lipa Na M-Pesa Sandbox Active
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
              <Settings size={18} />
            </button>
            <div className="h-8 w-px bg-gray-100" />
            <div className="text-xs font-bold text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 font-mono">
              {new Date().toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </header>

        {/* Dashboard Main Container */}
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/properties" element={<PropertyList />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <NavigationContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
