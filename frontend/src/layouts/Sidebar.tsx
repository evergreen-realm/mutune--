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
      className="fixed inset-y-0 left-0 z-30 flex flex-col bg-surface text-foreground border-r border-border overflow-hidden"
    >
      {/* ── Brand ───────────────────────────────────────────────────────────── */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex-shrink-0 cursor-pointer select-none">
            <svg className="w-9 h-9 transform transition-transform duration-500 hover:rotate-[15deg] hover:scale-110 filter drop-shadow-[0_4px_6px_rgba(139,92,246,0.3)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="logo-grad-primary" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
                <linearGradient id="logo-grad-secondary" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ec4899" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
              {/* 3D Base Slab */}
              <path d="M15 65 L50 82.5 L85 65 L50 47.5 Z" fill="url(#logo-grad-primary)" opacity="0.4" />
              <path d="M15 65 L15 70 L50 87.5 L50 82.5 Z" fill="#7c3aed" />
              <path d="M50 82.5 L50 87.5 L85 70 L85 65 Z" fill="#db2777" />
              
              {/* Floating 3D M and R sheets */}
              <path d="M22 53 L48 66 L48 38 L22 25 Z" fill="url(#logo-grad-primary)" />
              <path d="M52 66 L78 53 L78 25 L52 38 Z" fill="url(#logo-grad-secondary)" />
              
              {/* Highlights */}
              <path d="M48 38 L52 38 L52 66 L48 66 Z" fill="#ffffff" opacity="0.3" />
            </svg>
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
                <span className="text-brand-400 font-medium normal-case">Pro</span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="hidden lg:flex p-1.5 hover:bg-surface-bright rounded text-muted hover:text-foreground transition-colors"
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
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted hover:bg-surface-bright hover:text-foreground',
              ].join(' ')}
            >
              {/* Active left-border indicator */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-5 bg-primary rounded-r-full" />
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
      <div className="p-3 border-t border-border bg-background/40 flex-shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="h-9 w-9 rounded-full bg-surface-bright flex items-center justify-center font-bold text-primary border border-border uppercase flex-shrink-0 text-sm select-none">
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
                <p className="text-xs font-bold truncate text-foreground">{fullName}</p>
                <p className="text-xs text-muted truncate capitalize">{role}</p>
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
              className="mt-3 flex w-full items-center justify-center gap-2 px-3 py-1.5 border border-border hover:border-red-500/50 rounded-lg text-xs font-bold text-muted hover:text-red-400 transition-colors uppercase tracking-wider"
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
