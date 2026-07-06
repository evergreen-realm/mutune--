import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Settings, Menu, Sun, Moon, ShieldCheck, MapPin, LogOut, X, Search, Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { markAllNotifsRead, markNotifRead, deleteNotification, clearAllNotifications } from '../lib/api';
import { toast } from 'react-toastify';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchNotifications } from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbUser {
  _id: string;
  full_name: string;
  role: string;
  email?: string;
  phone?: string;
}

interface Notification {
  _id: string;
  title: string;
  message: string;
  created_at: string;
  read_by?: string[];
}

export interface TopbarProps {
  theme: string;
  onToggleTheme: () => void;
  dbUser: DbUser | null;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  isSynced: boolean;
  clerkUserId?: string | null;
  onLogout: (options?: Record<string, string>) => void;
}

// ─── Path → breadcrumb label map ─────────────────────────────────────────────

const BREADCRUMB_MAP: Record<string, string> = {
  '/':                   'Dashboard',
  '/dashboard':          'Dashboard',
  '/properties':         'Properties',
  '/properties/add':     'Add Property',
  '/tenants':            'Tenants',
  '/payments':           'Rent Payments',
  '/maintenance':        'Maintenance',
  '/notices':            'Notices',
  '/admin':              'Admin Dashboard',
  '/admin/users':        'Verification Queue',
  '/admin/inventory':    'Auctions & Inventory',
  '/tenant':             'My Portal',
};

function getBreadcrumb(pathname: string): string {
  if (BREADCRUMB_MAP[pathname]) return BREADCRUMB_MAP[pathname];
  // Try prefix match (e.g. /properties/abc123)
  for (const [key, label] of Object.entries(BREADCRUMB_MAP)) {
    if (key !== '/' && pathname.startsWith(key)) return label;
  }
  return 'Dashboard';
}

// ─── Topbar component ─────────────────────────────────────────────────────────

export default function Topbar({
  theme,
  onToggleTheme,
  dbUser,
  sidebarOpen,
  onToggleSidebar,
  isSynced,
  clerkUserId,
  onLogout,
}: TopbarProps) {
  const location  = useLocation();
  const navigate   = useNavigate();
  const queryClient = useQueryClient();
  const [notifOpen,    setNotifOpen]    = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');

  const role     = dbUser?.role;
  const isAdmin  = role === 'admin' || role === 'super_admin';
  const fullName = dbUser?.full_name || 'Property Owner';
  const breadcrumb = getBreadcrumb(location.pathname);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    // Route to the most relevant page based on current location or default to properties
    const dest = location.pathname.startsWith('/tenants') ? '/tenants'
      : location.pathname.startsWith('/properties') ? '/properties'
      : location.pathname.startsWith('/payments') ? '/payments'
      : location.pathname.startsWith('/maintenance') ? '/maintenance'
      : '/properties';
    navigate(`${dest}?q=${encodeURIComponent(q)}`);
    setSearchQuery('');
  };

  // Notifications
  const { data: notifData, refetch: refetchNotifs } = useQuery<{ data: Notification[]; unreadCount: number }>({
    queryKey: ['notifications'],
    queryFn: fetchNotifications as () => Promise<{ data: Notification[]; unreadCount: number }>,
    refetchInterval: 30000,
    enabled: isSynced && !!clerkUserId,
    retry: 1,
  });

  const notifications: Notification[] = notifData?.data || [];
  const unreadCount: number            = notifData?.unreadCount || 0;

  return (
    <header className="h-16 bg-surface border-b border-border px-4 sm:px-6 flex items-center justify-between flex-shrink-0 z-40">
      {/* ── Left: hamburger + breadcrumb ──────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          className="lg:hidden p-2 text-muted hover:text-foreground hover:bg-background rounded-lg transition-colors"
          onClick={onToggleSidebar}
          aria-label="Toggle mobile menu"
        >
          <Menu size={18} />
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted font-semibold flex items-center gap-1">
            <MapPin size={14} className="text-red-500" />
            Mombasa, KE
          </span>
          <span className="hidden sm:inline text-xs text-border">|</span>
          <span className="hidden sm:inline text-sm font-semibold text-foreground">
            {breadcrumb}
          </span>
        </div>

        {/* M-Pesa env badge */}
        <span
          className={`hidden sm:inline text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
            import.meta.env.VITE_MPESA_ENV === 'production'
              ? 'text-blue-700 bg-blue-500/10'
              : 'text-amber-700 bg-amber-500/10'
          }`}
        >
          {import.meta.env.VITE_MPESA_ENV === 'production' ? 'M-Pesa Live ✓' : 'M-Pesa Sandbox'}
        </span>
      </div>

      {/* ── Right: actions ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* Search input */}
        <form onSubmit={handleSearch} className="hidden md:flex items-center relative">
          <Search size={13} className="absolute left-2.5 text-muted pointer-events-none" />
          <input
            type="search"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(e as unknown as React.FormEvent)}
            className="h-8 w-44 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted pl-7 pr-3 outline-none focus:border-brand-400/50 focus:ring-1 focus:ring-brand-400/20 transition-all"
          />
        </form>

        {/* Admin verification queue shortcut */}
        {isAdmin && (
          <Link
            to="/admin/users"
            title="Verification Queue"
            className="p-1.5 text-muted hover:text-foreground hover:bg-background rounded-lg transition-colors"
          >
            <ShieldCheck size={18} />
          </Link>
        )}

        {/* ── Notifications ──────────────────────────────────────────────── */}
        <div className="relative">
          <button
            id="notifications-btn"
            onClick={() => { setNotifOpen(!notifOpen); setSettingsOpen(false); }}
            className="relative p-1.5 text-muted hover:text-foreground hover:bg-background rounded-lg transition-colors focus:outline-none"
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-surface animate-ping" />
            )}
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-surface" />
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute right-0 mt-2 w-80 bg-surface border border-border rounded-2xl shadow-xl z-50 p-4 max-h-96 overflow-y-auto"
                >
                  <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                    <span className="text-xs font-bold text-foreground">
                      Notifications ({unreadCount} unread)
                    </span>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={async () => {
                            try {
                              await markAllNotifsRead();
                              refetchNotifs();
                              toast.success('All notifications marked as read');
                            } catch (err: unknown) {
                              const e = err as { error?: { message?: string } };
                              toast.error(e?.error?.message || 'Failed to update notifications');
                            }
                          }}
                          className="text-xs text-brand-400 hover:text-brand-500 font-bold uppercase tracking-wider transition-colors"
                        >
                          Mark all read
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button
                          onClick={async () => {
                            try {
                              await clearAllNotifications();
                              queryClient.setQueryData(['notifications'], { data: [], unreadCount: 0 });
                              toast.success('All notifications cleared');
                              setNotifOpen(false);
                            } catch (err: unknown) {
                              const e = err as { error?: { message?: string } };
                              toast.error(e?.error?.message || 'Failed to clear notifications');
                            }
                          }}
                          className="p-1 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Clear all notifications"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="text-center py-8 text-xs text-muted font-medium">
                        All caught up! 🎉
                      </div>
                    ) : (
                      notifications.map((n) => {
                        const isRead = dbUser?._id
                          ? (n.read_by ?? []).some(
                              (uid) => uid?.toString() === dbUser._id.toString()
                            )
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
                                ? 'bg-surface border-border/50 hover:bg-background'
                                : 'bg-brand-500/5 border-brand-500/10 hover:bg-brand-500/10'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span
                                className={`text-xs font-semibold ${
                                  isRead ? 'text-foreground font-medium' : 'text-foreground font-bold'
                                }`}
                              >
                                {n.title}
                              </span>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {!isRead && (
                                  <span className="h-2 w-2 rounded-full bg-brand-400 mt-1" />
                                )}
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await deleteNotification(n._id);
                                      // Optimistically remove from cache
                                      queryClient.setQueryData(['notifications'], (old: typeof notifData) => {
                                        if (!old) return old;
                                        const newData = old.data.filter((x) => x._id !== n._id);
                                        return { ...old, data: newData, unreadCount: newData.filter((x) => !(x.read_by ?? []).some((uid) => uid?.toString() === dbUser?._id?.toString())).length };
                                      });
                                      toast.success('Notification dismissed');
                                    } catch (err) {
                                      console.error(err);
                                      toast.error('Failed to dismiss notification');
                                    }
                                  }}
                                  className="p-1 hover:bg-red-500/10 rounded text-muted hover:text-red-500 transition-colors"
                                  title="Dismiss notification"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                            <p className="text-xs text-muted mt-1 line-clamp-2">{n.message}</p>
                            <span className="text-xs text-muted font-mono block mt-1.5">
                              {new Date(n.created_at).toLocaleTimeString('en-KE', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* ── Theme toggle ───────────────────────────────────────────────── */}
        <button
          onClick={onToggleTheme}
          className="p-1.5 text-muted hover:text-foreground hover:bg-background rounded-lg transition-colors focus:outline-none"
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* ── Settings dropdown ──────────────────────────────────────────── */}
        <div className="relative">
          <button
            id="settings-btn"
            onClick={() => { setSettingsOpen(!settingsOpen); setNotifOpen(false); }}
            className="p-1.5 text-muted hover:text-foreground hover:bg-background rounded-lg transition-colors focus:outline-none"
            title="Settings"
          >
            <Settings size={18} />
          </button>

          <AnimatePresence>
            {settingsOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setSettingsOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                  onClick={(e) => e.target === e.currentTarget && setSettingsOpen(false)}
                >
                  <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6">
                    <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                      <h3 className="text-sm font-bold text-foreground">System Settings</h3>
                      <button
                        onClick={() => setSettingsOpen(false)}
                        className="p-1.5 text-muted hover:text-foreground hover:bg-background rounded-lg transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* User Profile Card */}
                      <div className="bg-background p-4 rounded-xl border border-border">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">User Profile</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-muted">Name</p>
                            <p className="text-sm font-bold text-foreground truncate">{fullName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted">Role</p>
                            <p className="text-sm font-bold text-foreground capitalize">{role}</p>
                          </div>
                          {dbUser?.phone && (
                            <div>
                              <p className="text-xs text-muted">Phone</p>
                              <p className="text-sm font-bold text-foreground font-mono">{dbUser.phone}</p>
                            </div>
                          )}
                          {dbUser?.email && (
                            <div>
                              <p className="text-xs text-muted">Email</p>
                              <p className="text-sm font-bold text-foreground truncate">{dbUser.email}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* System Info Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-background p-3 rounded-xl border border-border">
                          <p className="text-xs text-muted mb-1">Billing Currency</p>
                          <p className="text-sm font-bold text-foreground">KES (Shilling)</p>
                        </div>
                        <div className="bg-background p-3 rounded-xl border border-border">
                          <p className="text-xs text-muted mb-1">M-Pesa Status</p>
                          <p className="text-sm font-bold text-green-600">Active ✓</p>
                        </div>
                        <div className="bg-background p-3 rounded-xl border border-border">
                          <p className="text-xs text-muted mb-1">System Location</p>
                          <p className="text-sm font-bold text-foreground">Mombasa, KE</p>
                        </div>
                        <div className="bg-background p-3 rounded-xl border border-border">
                          <p className="text-xs text-muted mb-1">API Status</p>
                          <p className="text-sm font-bold text-green-600">Connected ✓</p>
                        </div>
                      </div>

                      {/* Sign Out */}
                      <button
                        onClick={() => onLogout()}
                        className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 uppercase tracking-wider"
                      >
                        <LogOut size={14} /> Sign Out
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Date chip */}
        <div className="h-8 w-px bg-border hidden sm:block" />
        <div className="hidden sm:block text-xs font-bold text-foreground bg-background px-3 py-1.5 rounded-lg border border-border font-mono">
          {new Date().toLocaleDateString('en-KE', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </div>
      </div>
    </header>
  );
}
