import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Building2, Users2, WalletCards,
  Wrench, ShieldCheck, Home, PlusCircle, FileText,
  Menu, X, LogOut,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbUser {
  _id: string;
  full_name: string;
  role: string;
  email?: string;
  phone?: string;
}

export interface SidebarProps {
  role: string | undefined;
  dbUser: DbUser | null;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  isRoleVerified: boolean;
  onLogout: (options?: Record<string, string>) => void;
}

// ─── Nav item definition ──────────────────────────────────────────────────────

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  show: boolean;
  disabled?: boolean;
  badge?: string;
}

// ─── Sidebar panel (shared between desktop & mobile) ─────────────────────────

function SidebarPanel({
  role,
  dbUser,
  sidebarOpen,
  setSidebarOpen,
  onLogout,
  navItems,
}: {
  role: string | undefined;
  dbUser: DbUser | null;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  onLogout: (options?: Record<string, string>) => void;
  navItems: NavItem[];
}) {
  const location = useLocation();
  const fullName = dbUser?.full_name || 'Property Owner';

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarOpen ? 240 : 72 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="fixed inset-y-0 left-0 z-30 flex flex-col bg-slate-900 text-white overflow-hidden"
    >
      {/* ── Brand ───────────────────────────────────────────────────────────── */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-2 bg-blue-600 rounded-lg text-white font-black flex-shrink-0 text-xs select-none">
            MR
          </div>
          <AnimatePresence initial={false}>
            {sidebarOpen && (
              <motion.span
                key="brand-text"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="font-extrabold text-sm tracking-wider uppercase whitespace-nowrap"
              >
                MutuneRent{' '}
                <span className="text-blue-500 font-medium normal-case">Pro</span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="hidden lg:flex p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
      </div>

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <nav className="flex-1 space-y-0.5 px-2 py-4 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          if (item.disabled) {
            return (
              <div
                key={item.label}
                title={sidebarOpen ? undefined : item.label}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold text-slate-500 cursor-not-allowed opacity-50"
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <AnimatePresence initial={false}>
                  {sidebarOpen && (
                    <motion.div
                      key="label"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      className="flex items-center justify-between w-full min-w-0"
                    >
                      <span className="truncate">{item.label}</span>
                      {item.badge && (
                        <span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-xs font-bold flex-shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }

          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              title={sidebarOpen ? undefined : item.label}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all relative',
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white',
              ].join(' ')}
            >
              {/* Active left-border indicator */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-300 rounded-r-full" />
              )}
              <span className="flex-shrink-0">{item.icon}</span>
              <AnimatePresence initial={false}>
                {sidebarOpen && (
                  <motion.span
                    key="nav-label"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className="truncate"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* ── User footer ─────────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex-shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-blue-500 border border-slate-700 uppercase flex-shrink-0 text-sm select-none">
            {fullName.charAt(0)}
          </div>
          <AnimatePresence initial={false}>
            {sidebarOpen && (
              <motion.div
                key="user-info"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="flex-1 min-w-0"
              >
                <p className="text-xs font-bold truncate text-slate-100">{fullName}</p>
                <p className="text-xs text-slate-400 truncate capitalize">{role}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.button
              key="logout-btn"
              id="logout-btn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              onClick={() => onLogout()}
              className="mt-3 flex w-full items-center justify-center gap-2 px-3 py-1.5 border border-slate-800 hover:border-red-900 rounded-lg text-xs font-bold text-slate-400 hover:text-red-400 transition-colors uppercase tracking-wider"
            >
              <LogOut size={12} />
              Log Out
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}

// ─── Public Sidebar component ─────────────────────────────────────────────────

export default function Sidebar({
  role,
  dbUser,
  sidebarOpen,
  setSidebarOpen,
  mobileOpen,
  setMobileOpen,
  isRoleVerified,
  onLogout,
}: SidebarProps) {
  const isAdmin  = role === 'admin' || role === 'super_admin';
  const isTenant = role === 'tenant';
  const isAgent  = role === 'agent';

  const navItems: NavItem[] = [
    { path: '/',                label: 'Dashboard',            icon: <LayoutDashboard size={18} />, show: true },
    { path: '/admin/users',     label: 'Verification Queue',   icon: <ShieldCheck size={18} />,     show: isAdmin },
    { path: '/admin/inventory', label: 'Auctions & Inventory', icon: <Building2 size={18} />,       show: isAdmin },
    { path: '/properties',      label: 'Properties',           icon: <Building2 size={18} />,       show: !isTenant },
    { path: '/properties/add',  label: 'Add Property',         icon: <PlusCircle size={18} />,      show: isAdmin || isAgent || role === 'landlord' },
    { path: '/tenants',         label: 'Tenants',              icon: <Users2 size={18} />,          show: !isTenant },
    { path: '/payments',        label: 'Rent Payments',        icon: <WalletCards size={18} />,     show: !isTenant },
    { path: '/maintenance',     label: 'Maintenance',          icon: <Wrench size={18} />,          show: true },
    { path: '/notices',         label: 'Notices',              icon: <FileText size={18} />,        show: isAdmin || isAgent || isTenant },
  ].filter((item) => item.show);

  const sharedProps = { role, dbUser, sidebarOpen, setSidebarOpen, onLogout, navItems };

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <SidebarPanel {...sharedProps} />
      </div>

      {/* Mobile overlay + drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="mobile-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-20 bg-black/50 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <div className="lg:hidden">
              <SidebarPanel {...sharedProps} />
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
