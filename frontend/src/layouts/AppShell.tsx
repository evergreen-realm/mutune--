import React from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbUser {
  _id: string;
  full_name: string;
  role: string;
  email?: string;
  phone?: string;
}

export interface AppShellLayoutProps {
  children: React.ReactNode;

  // Theme
  theme: string;
  onToggleTheme: () => void;

  // Sidebar state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;

  // User
  role: string | undefined;
  dbUser: DbUser | null;
  isRoleVerified: boolean;

  // Auth
  isSynced: boolean;
  clerkUserId?: string | null;
  onLogout: (options?: Record<string, string>) => void;
}

// ─── Page transition variants ─────────────────────────────────────────────────

const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -4 },
};

const pageTransition = {
  duration: 0.18,
  ease: 'easeOut',
};

// ─── AppShell layout wrapper ──────────────────────────────────────────────────

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
}: AppShellLayoutProps) {
  const location = useLocation();
  const [isLarge, setIsLarge] = React.useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsLarge(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <Sidebar
        role={role}
        dbUser={dbUser}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        isRoleVerified={isRoleVerified}
        onLogout={onLogout}
      />

      {/* ── Main area (shifts right based on sidebar width) ──────────────── */}
      <motion.div
        initial={false}
        animate={{ marginLeft: isLarge ? (sidebarOpen ? 240 : 72) : 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="flex-1 flex flex-col h-screen overflow-hidden"
      >
        {/* ── Topbar ──────────────────────────────────────────────────── */}
        <Topbar
          theme={theme}
          onToggleTheme={onToggleTheme}
          dbUser={dbUser}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setMobileOpen(!mobileOpen)}
          isSynced={isSynced}
          clerkUserId={clerkUserId}
          onLogout={onLogout}
        />

        {/* ── Animated page content ───────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </motion.div>
    </div>
  );
}
