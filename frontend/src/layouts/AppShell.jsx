import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchNotifications, markNotifRead, markAllNotifsRead } from '../lib/api';
import {
  LayoutDashboard, Building2, Users2, WalletCards,
  Wrench, ShieldCheck, Home, PlusCircle, BarChart3,
  Menu, X, Bell, Settings, LogOut, MapPin, FileText,
  Sun, Moon, ChevronRight, ChevronLeft, CheckCheck
} from 'lucide-react';

// ── Role-based nav config ──────────────────────────────────────────────────────
const NAV_ITEMS = [
  { path: '/',            label: 'Dashboard',   icon: LayoutDashboard, roles: ['admin','super_admin','landlord','agent'] },
  { path: '/tenant',      label: 'My Portal',   icon: Home,            roles: ['tenant'] },
  { path: '/properties',  label: 'Properties',  icon: Building2,       roles: ['admin','super_admin','landlord','agent'] },
  { path: '/tenants',     label: 'Tenants',      icon: Users2,          roles: ['admin','super_admin','landlord','agent'] },
  { path: '/payments',    label: 'Payments',     icon: WalletCards,     roles: ['admin','super_admin','landlord','agent','tenant'] },
  { path: '/maintenance', label: 'Maintenance',  icon: Wrench,          roles: ['admin','super_admin','landlord','agent','tenant'] },
  { path: '/notices',     label: 'Notices',      icon: FileText,        roles: ['admin','super_admin','landlord','agent','tenant'] },
  { path: '/admin',       label: 'Admin Panel',  icon: ShieldCheck,     roles: ['admin','super_admin'] },
  { path: '/admin/users', label: 'User Mgmt',    icon: Users2,          roles: ['admin','super_admin'] },
  { path: '/admin/inventory', label: 'Inventory', icon: BarChart3,     roles: ['admin','super_admin'] },
];

const ROLE_LABELS = {
  admin: 'Admin',
  super_admin: 'Super Admin',
  landlord: 'Landlord',
  agent: 'Estate Agent',
  tenant: 'Tenant',
};

const ROLE_COLORS = {
  admin: 'bg-red-500/15 text-red-400 border-red-500/20',
  super_admin: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  landlord: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  agent: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  tenant: 'bg-green-500/15 text-green-400 border-green-500/20',
};

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({ role, dbUser, sidebarOpen, setSidebarOpen, mobileOpen, setMobileOpen, onLogout }) {
  const location = useLocation();
  const filteredNav = NAV_ITEMS.filter(item => !role || item.roles.includes(role));

  const NavLink = ({ item, collapsed }) => {
    const isActive = location.pathname === item.path ||
      (item.path !== '/' && item.path !== '/tenant' && location.pathname.startsWith(item.path));
    const Icon = item.icon;
    return (
      <Link
        to={item.path}
        onClick={() => setMobileOpen(false)}
        title={collapsed ? item.label : undefined}
        className={`
          group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
          ${isActive
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
          }
        `}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-400 rounded-r-full" />
        )}
        <Icon size={18} className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
        {!collapsed && (
          <span className="truncate">{item.label}</span>
        )}
        {collapsed && (
          <div className="absolute left-full ml-3 px-2 py-1 bg-slate-800 text-slate-100 text-xs rounded-lg border border-slate-700 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
            {item.label}
          </div>
        )}
      </Link>
    );
  };

  const SidebarContent = ({ collapsed = false }) => (
    <div className="flex flex-col h-full">
      {/* Logo / Brand */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-slate-800/60 ${collapsed ? 'justify-center' : ''}`}>
        <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-600/30">
          <Building2 size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-100 leading-tight">MutuneRent</p>
            <p className="text-[10px] text-slate-500 font-medium">Pro</p>
          </div>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5 scrollbar-thin">
        {filteredNav.map(item => (
          <NavLink key={item.path} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Footer: user info + logout */}
      <div className={`border-t border-slate-800/60 p-3 ${collapsed ? 'flex flex-col items-center gap-2' : ''}`}>
        {!collapsed && dbUser && (
          <div className="flex items-center gap-2.5 px-2 py-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-400 text-xs font-bold">
                {(dbUser.full_name || 'U')[0].toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-200 truncate">{dbUser.full_name || 'User'}</p>
              <p className="text-[10px] text-slate-500 truncate">{dbUser.email}</p>
            </div>
          </div>
        )}
        {role && (
          <div className={`${collapsed ? '' : 'px-2 mb-2'}`}>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${ROLE_COLORS[role] || ROLE_COLORS.tenant}`}>
              {collapsed ? (role[0].toUpperCase()) : ROLE_LABELS[role] || role}
            </span>
          </div>
        )}
        <button
          onClick={() => onLogout()}
          title="Sign Out"
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut size={14} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: sidebarOpen ? 240 : 72 }}
        transition={{ type: 'spring', stiffness: 300, damping: 35 }}
        className="hidden lg:flex flex-col bg-slate-950 border-r border-slate-800/60 flex-shrink-0 relative overflow-hidden"
        style={{ minHeight: '100vh' }}
      >
        <SidebarContent collapsed={!sidebarOpen} />
        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-5 -right-3 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-all z-10 shadow-md"
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>
      </motion.aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 35 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-64 bg-slate-950 border-r border-slate-800/60 z-50 flex flex-col shadow-2xl"
            >
              <SidebarContent collapsed={false} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Topbar ─────────────────────────────────────────────────────────────────────
function Topbar({ theme, onToggleTheme, dbUser, sidebarOpen, onToggleSidebar, onToggleMobile }) {
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const qc = useQueryClient();

  const { data: notifData, refetch: refetchNotifs } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 30000,
    enabled: !!dbUser,
    retry: 1,
  });

  const notifications = notifData?.data || [];
  const unreadCount = notifData?.unreadCount || 0;

  const markReadMutation = useMutation({
    mutationFn: markNotifRead,
    onSuccess: () => refetchNotifs(),
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotifsRead,
    onSuccess: () => refetchNotifs(),
  });

  // Close notif panel on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Breadcrumb from pathname
  const crumbs = location.pathname.split('/').filter(Boolean);
  const breadcrumb = crumbs.length > 0
    ? crumbs.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' › ')
    : 'Dashboard';

  return (
    <header className="h-14 flex items-center gap-3 px-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800/60 flex-shrink-0">
      {/* Mobile hamburger */}
      <button
        onClick={onToggleMobile}
        className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {/* Desktop sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        className="hidden lg:flex p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        aria-label="Toggle sidebar"
      >
        <Menu size={18} />
      </button>

      {/* Breadcrumbs */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
          {breadcrumb}
        </p>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1">
        {/* Date */}
        <span className="hidden sm:block text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg font-mono">
          {new Date().toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-yellow-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label="Toggle theme"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Notification bell */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setNotifOpen(o => !o)}
            className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Notifications"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllMutation.mutate()}
                      className="text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 hover:underline"
                    >
                      <CheckCheck size={12} /> Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto scrollbar-thin">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <Bell size={24} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                      <p className="text-xs text-slate-400 dark:text-slate-500">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map(n => (
                      <button
                        key={n._id}
                        onClick={() => { if (!n.read) markReadMutation.mutate(n._id); }}
                        className={`w-full text-left px-4 py-3 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition ${!n.read ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''}`}
                      >
                        <p className={`text-xs font-medium leading-snug ${!n.read ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
                          {n.message || n.title || 'New notification'}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-0.5">
                          {new Date(n.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

// ── AppShellLayout (default export) ───────────────────────────────────────────
export default function AppShellLayout({
  children,
  theme,
  onToggleTheme,
  sidebarOpen,
  setSidebarOpen,
  mobileOpen,
  setMobileOpen,
  role,
  dbUser,
  isRoleVerified,
  isSynced,
  clerkUserId,
  onLogout,
}) {
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar
        role={role}
        dbUser={dbUser}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onLogout={onLogout}
      />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          theme={theme}
          onToggleTheme={onToggleTheme}
          dbUser={dbUser}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(o => !o)}
          onToggleMobile={() => setMobileOpen(o => !o)}
        />

        {/* Animated page content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="h-full p-4 sm:p-6"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
