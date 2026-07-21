import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useThemeStore } from '../store/themeStore';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Building2, Shield, CreditCard, Users, MapPin, FileText,
  ArrowRight, Sun, Moon, Menu, X, Check,
  BarChart3, Smartphone, ClipboardCheck, UserCheck, Landmark,
  Eye, Receipt, Bell, KeyRound, UserPlus, Search, Activity,
  ChevronDown
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const VoxelBuildingMini3D = lazy(() => import('../components/VoxelBuildingMini3D'));

/* ══════════════════════════════════════════════════════════════
   DATA
   ══════════════════════════════════════════════════════════════ */

const METRICS = [
  { value: '450M+', label: 'Rent Collected (KES)', color: 'var(--lp-accent)' },
  { value: '100%', label: 'KRA Compliant', color: 'var(--lp-emerald)' },
  { value: '< 3s', label: 'M-Pesa Payment', color: 'var(--lp-teal)' },
  { value: 'Sub-m', label: '3D Precision', color: 'var(--lp-purple)' },
];

const FEATURES = [
  {
    id: 'spatial',
    title: '3D Spatial Blueprints',
    desc: 'Navigate every floor, unit, and corridor in an interactive voxel model. See payment status per unit at a glance.',
    icon: MapPin,
    color: 'var(--lp-accent)',
    colorMuted: 'var(--lp-accent-muted)',
    photo: '/assets/building_interior_lobby.png',
    has3D: true,
  },
  {
    id: 'kra',
    title: 'KRA Tax Engine',
    desc: 'Automatically calculates 7.5% MRI withholding and 10% WHT on every rental payment. CSV returns ready for iTax.',
    icon: FileText,
    color: 'var(--lp-emerald)',
    colorMuted: 'var(--lp-emerald-muted)',
    photo: '/assets/landlord_property_office.png',
  },
  {
    id: 'mpesa',
    title: 'M-Pesa STK Push',
    desc: 'Tenants tap one button. STK prompt hits their phone in under 3 seconds. Payment reconciles automatically.',
    icon: Smartphone,
    color: 'var(--lp-teal)',
    colorMuted: 'var(--lp-teal-muted)',
    photo: '/assets/tenant_mpesa_payment.png',
  },
  {
    id: 'portals',
    title: 'Role-Gated Portals',
    desc: 'Four separate dashboards — Landlord, Tenant, Agent, Admin — each with permissions and workflows tailored to their job.',
    icon: Users,
    color: 'var(--lp-purple)',
    colorMuted: 'var(--lp-purple-muted)',
    photo: '/assets/agent_field_inspection.png',
  },
];

const ROLES = [
  {
    id: 'landlord', title: 'Landlord', icon: Landmark,
    accent: 'var(--lp-accent)', accentMuted: 'var(--lp-accent-muted)',
    photo: '/assets/landlord_property_office.png',
    steps: [
      { icon: UserPlus, text: 'Register & verify ownership via Google SSO' },
      { icon: Building2, text: 'Add properties, define units, set rent amounts' },
      { icon: FileText, text: 'Auto KRA tax filing — 7.5% MRI & 10% WHT' },
      { icon: CreditCard, text: 'Collect rent via M-Pesa, funds to your bank' },
      { icon: BarChart3, text: 'Track net income, occupancy, and expenses' },
    ],
  },
  {
    id: 'tenant', title: 'Tenant', icon: KeyRound,
    accent: 'var(--lp-emerald)', accentMuted: 'var(--lp-emerald-muted)',
    photo: '/assets/tenant_mpesa_payment.png',
    steps: [
      { icon: Bell, text: 'Get invited by your agent via email' },
      { icon: UserCheck, text: 'Link account — auto-detect your tenant code' },
      { icon: Smartphone, text: 'Pay rent via M-Pesa STK Push in under 3s' },
      { icon: Receipt, text: 'View digital receipts & lease documents' },
    ],
  },
  {
    id: 'agent', title: 'Agent', icon: ClipboardCheck,
    accent: 'var(--lp-amber)', accentMuted: 'var(--lp-amber-muted)',
    photo: '/assets/agent_field_inspection.png',
    steps: [
      { icon: FileText, text: 'Submit EARB license for verification' },
      { icon: Check, text: 'Get admin approval on your agent profile' },
      { icon: Building2, text: 'Manage properties, assign tenants, issue notices' },
      { icon: BarChart3, text: 'Earn tracked commission on managed units' },
    ],
  },
  {
    id: 'admin', title: 'Admin', icon: Shield,
    accent: 'var(--lp-purple)', accentMuted: 'var(--lp-purple-muted)',
    photo: '/assets/admin_control_center.png',
    steps: [
      { icon: Eye, text: 'Full system dashboard on sign-in' },
      { icon: UserCheck, text: 'Approve agent & landlord registrations' },
      { icon: Activity, text: 'Monitor audit logs and security events' },
      { icon: Search, text: 'Manage inventory auctions and unit assets' },
    ],
  },
];

const STEPS = [
  { step: '01', title: 'Register', desc: 'Create your account with Google SSO. Select your role. Verification takes under 24 hours.', icon: UserPlus },
  { step: '02', title: 'Set Up', desc: 'Landlords add properties. Agents upload EARB licenses. Tenants get auto-detected.', icon: Building2 },
  { step: '03', title: 'Manage', desc: 'Collect rent via M-Pesa, file KRA taxes automatically, visualize your portfolio in 3D.', icon: BarChart3 },
];

/* ══════════════════════════════════════════════════════════════
   WORD SPLIT UTILITY
   ══════════════════════════════════════════════════════════════ */
function SplitWords({ children, className = '' }) {
  const words = children.split(' ');
  return (
    <span className={className}>
      {words.map((word, i) => (
        <span key={i} className="lp-word" style={{
          display: 'inline-block', opacity: 0,
          transform: 'translateY(40px) rotateX(40deg)',
          transformOrigin: 'center bottom',
        }}>
          {word}{i < words.length - 1 ? '\u00A0' : ''}
        </span>
      ))}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const navigate = useNavigate();
  const { isSignedIn } = useUser();
  const { theme, toggleTheme } = useThemeStore();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeRole, setActiveRole] = useState(0);
  const [navSolid, setNavSolid] = useState(false);
  const [demoVisible, setDemoVisible] = useState(false);

  /* Refs */
  const rootRef = useRef(null);
  const heroRef = useRef(null);
  const heroPhotoRef = useRef(null);
  const heroOverlayRef = useRef(null);
  const descentRef = useRef(null);
  const descentPhotoRef = useRef(null);
  const panelsWrapRef = useRef(null);
  const panelsTrackRef = useRef(null);
  const rolesRef = useRef(null);
  const howRef = useRef(null);
  const ctaRef = useRef(null);
  const canvasRef = useRef(null);
  const navRef = useRef(null);
  const demoCardRef = useRef(null);

  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  /* Navigation */
  const go = useCallback((path) => { setMobileMenuOpen(false); navigate(path); }, [navigate]);
  const handleGetStarted = useCallback(() => go(isSignedIn ? '/dashboard' : '/sign-up'), [isSignedIn, go]);
  const handleSignIn = useCallback(() => go(isSignedIn ? '/dashboard' : '/login'), [isSignedIn, go]);
  const scrollTo = useCallback((id) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  /* Nav bg on scroll */
  useEffect(() => {
    const fn = () => setNavSolid(window.scrollY > 80);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  /* 3D lazy load */
  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth < 768) return;
    const node = demoCardRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setDemoVisible(true); }, { rootMargin: '300px' });
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  /* ════════════════════════════════════════════════
     AMBIENT PARTICLES (Canvas 2D)
     ════════════════════════════════════════════════ */
  useEffect(() => {
    if (prefersReducedMotion.current) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    let raf, w, h;
    const N = window.innerWidth < 768 ? 20 : 40;
    const pts = [];

    const resize = () => { w = c.width = c.parentElement.offsetWidth; h = c.height = c.parentElement.offsetHeight; };
    resize();
    for (let i = 0; i < N; i++) pts.push({
      x: Math.random() * w, y: Math.random() * h,
      r: 0.8 + Math.random() * 2, vy: -(0.15 + Math.random() * 0.25),
      vx: (Math.random() - 0.5) * 0.2, a: 0.1 + Math.random() * 0.35, ph: Math.random() * Math.PI * 2,
    });

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx + Math.sin(p.ph) * 0.1; p.y += p.vy; p.ph += 0.006;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245,215,160,${p.a})`; ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  /* ════════════════════════════════════════════════
     CINEMATIC GSAP SCROLL SYSTEM
     ════════════════════════════════════════════════ */
  useEffect(() => {
    if (prefersReducedMotion.current) return;
    const mm = gsap.matchMedia();

    mm.add('(min-width: 768px)', () => {
      /* ── SCENE 1: HERO — Pin & multi-phase reveal (3 scroll-heights) ── */
      const heroTL = gsap.timeline({
        scrollTrigger: {
          trigger: heroRef.current,
          start: 'top top',
          end: '+=250%',
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
        },
      });

      // Phase 1: Camera arrives — photo scales down and sharpens
      heroTL
        .fromTo(heroPhotoRef.current,
          { scale: 1.4, filter: 'brightness(0.3) blur(8px)' },
          { scale: 1.0, filter: 'brightness(1) blur(0px)', duration: 1, ease: 'none' },
          0
        )
        // Phase 2: Title words reveal one by one
        .to('.lp-hero-section .lp-word', {
          opacity: 1, y: 0, rotateX: 0,
          stagger: 0.04, duration: 0.3, ease: 'power3.out',
        }, 0.3)
        // Phase 3: Subtitle + CTAs slide up
        .fromTo('.lp-hero-subtitle', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.3 }, 0.65)
        .fromTo('.lp-hero-ctas', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.3 }, 0.7)
        // Phase 4: Metrics slam up from below viewport
        .fromTo('.lp-metric', { opacity: 0, y: 80, scale: 0.8 }, {
          opacity: 1, y: 0, scale: 1, stagger: 0.04, duration: 0.25, ease: 'back.out(1.5)',
        }, 0.78)
        // Phase 5: Hold — the visitor reads
        .to({}, { duration: 0.4 })
        // Phase 6: EXIT — everything rises + fades, photo blurs + zooms
        .to('.lp-hero-content', { opacity: 0, y: -60, duration: 0.5, ease: 'power2.in' }, 1.5)
        .to(heroPhotoRef.current, {
          scale: 1.6, filter: 'brightness(0.15) blur(12px)', duration: 0.5, ease: 'power2.in',
        }, 1.5);

      /* ── SCENE 2: DESCENT — Lobby crossfade + text wipe ── */
      const descentTL = gsap.timeline({
        scrollTrigger: {
          trigger: descentRef.current,
          start: 'top top',
          end: '+=200%',
          pin: true,
          scrub: 0.6,
          anticipatePin: 1,
        },
      });

      descentTL
        .fromTo(descentPhotoRef.current,
          { scale: 1.3, opacity: 0 },
          { scale: 1, opacity: 1, duration: 1, ease: 'none' },
          0
        )
        .fromTo('.lp-descent-text', { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.5 }, 0.3)
        .fromTo('.lp-descent-line', { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: 'power2.out' }, 0.5)
        .fromTo('.lp-descent-sub', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4 }, 0.6)
        // Hold
        .to({}, { duration: 0.5 })
        // Exit
        .to('.lp-descent-content', { opacity: 0, y: -40, duration: 0.4 }, 1.5)
        .to(descentPhotoRef.current, { scale: 1.1, filter: 'brightness(0.2)', duration: 0.5 }, 1.5);

      /* ── SCENE 3: CAPABILITIES — Horizontal panel scroll ── */
      const track = panelsTrackRef.current;
      if (track) {
        const totalWidth = track.scrollWidth - window.innerWidth;
        gsap.to(track, {
          x: () => -totalWidth,
          ease: 'none',
          scrollTrigger: {
            trigger: panelsWrapRef.current,
            start: 'top top',
            end: () => '+=' + totalWidth,
            pin: true,
            scrub: 1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });

        // Each panel's content fades in as it enters viewport center
        document.querySelectorAll('.lp-panel-content').forEach((el) => {
          gsap.fromTo(el,
            { opacity: 0, x: 80 },
            {
              opacity: 1, x: 0, duration: 0.5, ease: 'power2.out',
              scrollTrigger: {
                trigger: el,
                containerAnimation: gsap.getById?.('panelScroll'),
                start: 'left 80%',
                toggleActions: 'play none none reverse',
              },
            }
          );
        });
      }

      /* ── SCENE 4: ROLES — Pinned with scroll-driven role switching ── */
      const rolesTL = gsap.timeline({
        scrollTrigger: {
          trigger: rolesRef.current,
          start: 'top top',
          end: '+=400%',
          pin: true,
          scrub: 0.5,
          anticipatePin: 1,
          onUpdate: (self) => {
            const prog = self.progress;
            const idx = Math.min(3, Math.floor(prog * 4));
            setActiveRole(idx);
          },
        },
      });

      // Animate section header
      rolesTL.fromTo('.lp-roles-header', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.15 }, 0);

      /* ── SCENE 5: HOW IT WORKS — Staggered reveals ── */
      gsap.fromTo('.lp-step-card', { opacity: 0, y: 60, scale: 0.9 }, {
        opacity: 1, y: 0, scale: 1, stagger: 0.15, duration: 0.6, ease: 'power3.out',
        scrollTrigger: {
          trigger: howRef.current,
          start: 'top 70%',
          toggleActions: 'play none none none',
        },
      });

      /* ── SCENE 7: FINAL CTA — Zoom out ── */
      gsap.fromTo('.lp-cta-bg', { scale: 1.3 }, {
        scale: 1, ease: 'none',
        scrollTrigger: {
          trigger: ctaRef.current,
          start: 'top bottom',
          end: 'top top',
          scrub: 1,
        },
      });
      gsap.fromTo('.lp-cta-inner', { opacity: 0, y: 40 }, {
        opacity: 1, y: 0, duration: 0.8, ease: 'power2.out',
        scrollTrigger: {
          trigger: ctaRef.current,
          start: 'top 60%',
          toggleActions: 'play none none none',
        },
      });
    });

    /* ── MOBILE: simpler animations, no pin-scroll ── */
    mm.add('(max-width: 767px)', () => {
      gsap.fromTo(heroPhotoRef.current,
        { scale: 1.15, filter: 'brightness(0.4)' },
        { scale: 1, filter: 'brightness(1)', duration: 1, ease: 'power2.out' }
      );
      gsap.to('.lp-hero-section .lp-word', {
        opacity: 1, y: 0, rotateX: 0, stagger: 0.03, duration: 0.5, delay: 0.3, ease: 'power3.out',
      });
      gsap.fromTo('.lp-hero-subtitle', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.6 });
      gsap.fromTo('.lp-hero-ctas', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.7 });
      gsap.fromTo('.lp-metric', { opacity: 0, y: 30 }, { opacity: 1, y: 0, stagger: 0.06, delay: 0.8 });

      // Simple fade-ups for other sections
      ['.lp-descent-text', '.lp-descent-sub', '.lp-feature-card', '.lp-step-card', '.lp-cta-inner'].forEach(sel => {
        gsap.fromTo(sel, { opacity: 0, y: 40 }, {
          opacity: 1, y: 0, stagger: 0.08, duration: 0.6, ease: 'power2.out',
          scrollTrigger: { trigger: sel, start: 'top 85%', toggleActions: 'play none none none' },
        });
      });
    });

    return () => mm.revert();
  }, []);

  /* ════════════════════════════════════════════════
     CURSOR TILT (desktop hero only)
     ════════════════════════════════════════════════ */
  useEffect(() => {
    if (prefersReducedMotion.current || typeof window === 'undefined' || window.innerWidth < 1024) return;
    const hero = heroRef.current;
    if (!hero) return;
    let tx = 0, ty = 0, cx = 0, cy = 0, raf;
    const onMove = (e) => {
      const r = hero.getBoundingClientRect();
      cx = ((e.clientY - r.top - r.height / 2) / (r.height / 2)) * -2;
      cy = ((e.clientX - r.left - r.width / 2) / (r.width / 2)) * 3;
    };
    const tick = () => {
      tx += (cx - tx) * 0.04; ty += (cy - ty) * 0.04;
      hero.style.setProperty('--tilt-x', `${tx}deg`);
      hero.style.setProperty('--tilt-y', `${ty}deg`);
      raf = requestAnimationFrame(tick);
    };
    hero.addEventListener('mousemove', onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => { hero.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf); hero.style.removeProperty('--tilt-x'); hero.style.removeProperty('--tilt-y'); };
  }, []);

  /* Current role */
  const role = ROLES[activeRole];

  /* ════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════ */
  return (
    <div ref={rootRef} className="lp-root" style={{
      background: 'var(--lp-bg)', color: 'var(--lp-text-primary)',
      fontFamily: 'var(--font-body)', overflowX: 'hidden',
    }}>
      {/* Skip link */}
      <a href="#main" className="lp-skip" style={{
        position: 'absolute', left: '-9999px', top: 'auto', zIndex: 100,
        padding: '12px 24px', background: 'var(--lp-accent)', color: '#fff', borderRadius: '8px',
      }}
        onFocus={e => { e.target.style.left = '16px'; e.target.style.top = '16px'; e.target.style.width = 'auto'; e.target.style.height = 'auto'; }}
        onBlur={e => { e.target.style.left = '-9999px'; }}
      >Skip to main content</a>

      {/* ═══════════════════════════════════════════
          NAV — Floating glass pill
          ═══════════════════════════════════════════ */}
      <nav ref={navRef} style={{
        position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)',
        zIndex: 50, width: 'calc(100% - 2rem)', maxWidth: '76rem',
        padding: '0.625rem 1.25rem', borderRadius: '1rem',
        background: navSolid ? 'var(--lp-glass-bg)' : 'rgba(0,0,0,0.15)',
        backdropFilter: `blur(${navSolid ? 20 : 8}px)`,
        WebkitBackdropFilter: `blur(${navSolid ? 20 : 8}px)`,
        border: `1px solid ${navSolid ? 'var(--lp-glass-border)' : 'rgba(255,255,255,0.06)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'all 400ms ease',
        boxShadow: navSolid ? '0 8px 32px rgba(0,0,0,0.3)' : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div style={{
            width: '2rem', height: '2rem', borderRadius: '0.5rem',
            background: 'var(--lp-cta-gradient)', display: 'grid', placeItems: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.7rem', color: '#fff',
          }}>MR</div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.875rem', color: '#fff' }}>
            MutuneRent Pro
          </span>
        </div>

        <div className="lp-nav-links" style={{ display: 'flex', gap: '0.25rem' }}>
          {[{ l: 'Features', id: 'features' }, { l: 'Roles', id: 'roles' }, { l: 'How It Works', id: 'how' }].map(n => (
            <button key={n.id} onClick={() => scrollTo(n.id)} style={{
              fontFamily: 'var(--font-body)', fontSize: '0.8125rem', fontWeight: 500,
              color: 'rgba(255,255,255,0.65)', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
              background: 'none', border: 'none', cursor: 'pointer', transition: 'color 200ms ease',
            }}
              onMouseEnter={e => { e.target.style.color = '#fff'; }}
              onMouseLeave={e => { e.target.style.color = 'rgba(255,255,255,0.65)'; }}
            >{n.l}</button>
          ))}
        </div>

        <div className="lp-nav-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={toggleTheme} aria-label="Toggle theme" style={{
            width: '2.25rem', height: '2.25rem', display: 'grid', placeItems: 'center',
            borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
          }}>{theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}</button>
          <button onClick={handleSignIn} style={{
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.8125rem',
            color: '#fff', padding: '0.5rem 1rem', borderRadius: '0.625rem',
            background: 'none', border: '1.5px solid rgba(255,255,255,0.2)', cursor: 'pointer',
            transition: 'border-color 200ms, background 200ms',
          }}
            onMouseEnter={e => { e.target.style.borderColor = 'var(--lp-accent)'; e.target.style.background = 'var(--lp-accent-muted)'; }}
            onMouseLeave={e => { e.target.style.borderColor = 'rgba(255,255,255,0.2)'; e.target.style.background = 'none'; }}
          >{isSignedIn ? 'Dashboard' : 'Sign In'}</button>
          <button onClick={handleGetStarted} style={{
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.8125rem',
            color: '#fff', padding: '0.5rem 1.25rem', borderRadius: '0.625rem',
            background: 'var(--lp-cta-gradient)', border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(80,60,220,0.35)',
            transition: 'transform 200ms ease, box-shadow 200ms ease',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(80,60,220,0.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(80,60,220,0.35)'; }}
          >{isSignedIn ? 'Portal' : 'Get Started'} <ArrowRight size={13} style={{ display: 'inline', marginLeft: 4, verticalAlign: 'middle' }} /></button>
        </div>

        {/* Mobile hamburger */}
        <button className="lp-hamburger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu" style={{
          display: 'none', width: '2.25rem', height: '2.25rem', placeItems: 'center',
          borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer',
        }}>{mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}</button>
      </nav>

      {/* Mobile drawer */}
      {mobileMenuOpen && <div onClick={() => setMobileMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(0,0,0,0.6)' }} />}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '80vw', maxWidth: '300px',
        zIndex: 60, background: 'var(--lp-bg-elevated)', padding: '4.5rem 1.5rem 2rem',
        transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 300ms cubic-bezier(0.16,1,0.3,1)',
        borderLeft: '1px solid var(--lp-border)', display: 'flex', flexDirection: 'column', gap: '1.5rem',
      }}>
        <button onClick={() => setMobileMenuOpen(false)} style={{
          position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--lp-text-primary)', cursor: 'pointer',
        }}><X size={22} /></button>
        {['Features', 'Roles', 'How It Works'].map(l => (
          <button key={l} onClick={() => scrollTo(l.toLowerCase().replace(/ /g, '-').replace('how-it-works','how'))} style={{
            fontFamily: 'var(--font-body)', fontSize: '1.125rem', fontWeight: 600,
            color: 'var(--lp-text-primary)', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer',
          }}>{l}</button>
        ))}
        <div style={{ borderTop: '1px solid var(--lp-border-subtle)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button onClick={() => { setMobileMenuOpen(false); toggleTheme(); }} style={{
            fontFamily: 'var(--font-body)', fontWeight: 500, color: 'var(--lp-text-secondary)',
            background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} {theme === 'dark' ? 'Light' : 'Dark'} Mode</button>
          <button onClick={() => { setMobileMenuOpen(false); handleSignIn(); }} style={{
            fontFamily: 'var(--font-body)', fontWeight: 600, color: 'var(--lp-text-primary)',
            padding: '0.75rem', borderRadius: '0.75rem', background: 'none', border: '1.5px solid var(--lp-border)', cursor: 'pointer', textAlign: 'center',
          }}>{isSignedIn ? 'Dashboard' : 'Sign In'}</button>
          <button onClick={() => { setMobileMenuOpen(false); handleGetStarted(); }} style={{
            fontFamily: 'var(--font-body)', fontWeight: 700, color: '#fff',
            padding: '0.75rem', borderRadius: '0.75rem', background: 'var(--lp-cta-gradient)', border: 'none', cursor: 'pointer', textAlign: 'center',
          }}>{isSignedIn ? 'Portal' : 'Get Started'}</button>
        </div>
      </div>

      <main id="main">
        {/* ═══════════════════════════════════════════
            SCENE 1: HERO — Full-viewport cinematic arrival
            Pinned for 250% scroll. Camera arrives, text reveals
            word-by-word, metrics slam up, then everything exits.
            ═══════════════════════════════════════════ */}
        <section ref={heroRef} className="lp-hero-section" style={{
          position: 'relative', height: '100vh', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Photo layer */}
          <div ref={heroPhotoRef} style={{
            position: 'absolute', inset: '-15%', zIndex: 0,
            willChange: 'transform, filter',
          }}>
            <img src="/assets/hero_coastal_building.png" alt="Luxury coastal building in Mombasa at golden hour"
              fetchpriority="high" decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>

          {/* Dark gradient */}
          <div ref={heroOverlayRef} style={{
            position: 'absolute', inset: 0, zIndex: 1,
            background: 'linear-gradient(to bottom, rgba(10,12,20,0.25) 0%, rgba(10,12,20,0.7) 50%, rgba(10,12,20,0.95) 100%)',
          }} />

          {/* Particles */}
          <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }} aria-hidden="true" />

          {/* Content */}
          <div className="lp-hero-content" style={{
            position: 'relative', zIndex: 3, textAlign: 'center',
            maxWidth: '56rem', padding: '0 1.5rem',
            perspective: '1200px',
          }}>
            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
              fontFamily: 'var(--font-body)', fontSize: '0.625rem', fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: '0.375rem 0.875rem', borderRadius: '2rem',
              background: 'rgba(100,130,255,0.15)', color: 'rgba(160,180,255,0.9)',
              marginBottom: '1.5rem',
            }}>
              <Building2 size={11} /> Mombasa&apos;s Premier Property Platform
            </div>

            {/* Headline — word-by-word reveal */}
            <h1 style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 'var(--lp-text-hero)', lineHeight: 1.1,
              color: '#fff', marginBottom: '1.25rem',
            }}>
              <SplitWords>Coastal Property Management</SplitWords>
              <br />
              <span style={{ display: 'block', marginTop: '0.25rem' }}>
                <SplitWords className="lp-gradient-text" style={{
                  background: 'var(--lp-cta-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>Built on Spatial Intelligence</SplitWords>
              </span>
            </h1>

            {/* Subtitle */}
            <p className="lp-hero-subtitle" style={{
              fontFamily: 'var(--font-body)', fontSize: 'clamp(0.9375rem, 1.5vw, 1.125rem)',
              color: 'rgba(255,255,255,0.55)', maxWidth: '34rem', margin: '0 auto 2rem',
              lineHeight: 1.6, opacity: 0,
            }}>
              Automate KRA taxes. Collect rent via M-Pesa. Visualize every unit in 3D. Purpose-built for Mombasa&apos;s coast.
            </p>

            {/* CTAs */}
            <div className="lp-hero-ctas" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', opacity: 0 }}>
              <button onClick={handleGetStarted} style={{
                fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9375rem',
                color: '#fff', padding: '0.9rem 2.25rem', borderRadius: '0.75rem',
                background: 'var(--lp-cta-gradient)', border: 'none', cursor: 'pointer',
                boxShadow: '0 6px 28px rgba(80,60,220,0.4)',
                transition: 'transform 200ms ease, box-shadow 200ms ease',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(80,60,220,0.55)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(80,60,220,0.4)'; }}
              >{isSignedIn ? 'Go to Portal' : 'Get Started Free'} <ArrowRight size={16} /></button>
              <button onClick={handleSignIn} style={{
                fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.9375rem',
                color: 'rgba(255,255,255,0.85)', padding: '0.9rem 2.25rem', borderRadius: '0.75rem',
                background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.15)', cursor: 'pointer',
                transition: 'border-color 200ms ease, background 200ms ease',
              }}
                onMouseEnter={e => { e.target.style.borderColor = 'var(--lp-accent)'; e.target.style.background = 'var(--lp-accent-muted)'; }}
                onMouseLeave={e => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.background = 'rgba(255,255,255,0.07)'; }}
              >{isSignedIn ? 'Dashboard' : 'Sign In'}</button>
            </div>

            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginTop: '3rem', maxWidth: '48rem', margin: '3rem auto 0' }} className="lp-metrics-grid">
              {METRICS.map((m, i) => (
                <div key={i} className="lp-metric" style={{
                  padding: '1rem 0.5rem', borderRadius: '1rem', textAlign: 'center', opacity: 0,
                  background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', color: m.color, lineHeight: 1.1 }}>{m.value}</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginTop: '0.25rem' }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Scroll indicator */}
          <div style={{
            position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
            zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
          }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.625rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>Scroll</span>
            <ChevronDown size={16} style={{ color: 'rgba(255,255,255,0.3)', animation: 'lp-bounce 2s infinite' }} />
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            SCENE 2: DESCENT — Camera pushes through the door
            Pinned for 200% scroll. Lobby photo crossfades in.
            ═══════════════════════════════════════════ */}
        <section ref={descentRef} style={{
          position: 'relative', height: '100vh', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div ref={descentPhotoRef} style={{
            position: 'absolute', inset: '-10%', zIndex: 0, opacity: 0, willChange: 'transform',
          }}>
            <img src="/assets/building_interior_lobby.png" alt="Modern luxury lobby" loading="lazy" decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(10,12,20,0.4) 0%, rgba(10,12,20,0.85) 100%)' }} />
          </div>
          <div className="lp-descent-content" style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '40rem', padding: '0 1.5rem' }}>
            <h2 className="lp-descent-text" style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 'var(--lp-text-h2)', lineHeight: 1.2, color: '#fff', marginBottom: '1rem',
            }}>Step inside your next investment</h2>
            <div className="lp-descent-line" style={{ width: '60px', height: '2px', background: 'var(--lp-accent)', margin: '0 auto 1.5rem', transformOrigin: 'left' }} />
            <p className="lp-descent-sub" style={{
              fontFamily: 'var(--font-body)', fontSize: 'var(--lp-text-body)',
              color: 'rgba(255,255,255,0.55)', lineHeight: 1.6,
            }}>From lobby to rooftop, every floor is mapped. Every unit is tracked. Every payment is reconciled.</p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            SCENE 3: CAPABILITIES — Horizontal panel scroll
            4 full-viewport panels that scroll LEFT as you scroll DOWN.
            ═══════════════════════════════════════════ */}
        <section ref={panelsWrapRef} id="features" aria-label="Features" style={{ overflow: 'hidden' }}>
          <div ref={panelsTrackRef} className="lp-panels-track" style={{
            display: 'flex', width: 'fit-content',
          }}>
            {FEATURES.map((f, i) => (
              <div key={f.id} className="lp-panel" style={{
                width: '100vw', height: '100vh', flexShrink: 0,
                display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden',
              }}>
                {/* Panel background photo */}
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 0,
                }}>
                  <img src={f.photo} alt={f.title} loading="lazy" decoding="async"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.3)' }} />
                  <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, rgba(10,12,20,0.92) 0%, rgba(10,12,20,0.6) 100%)` }} />
                </div>

                {/* Panel content */}
                <div className="lp-panel-content" style={{
                  position: 'relative', zIndex: 1,
                  display: 'grid', gridTemplateColumns: f.has3D ? '1fr 1fr' : '1fr 1fr', gap: '4rem',
                  maxWidth: '72rem', margin: '0 auto', padding: '0 4rem',
                  alignItems: 'center', width: '100%',
                }}>
                  <div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                      fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                      padding: '0.3rem 0.6rem', borderRadius: '0.375rem',
                      background: f.colorMuted, color: f.color, marginBottom: '1.25rem',
                    }}>
                      <f.icon size={12} /> Feature {String(i + 1).padStart(2, '0')}
                    </div>
                    <h3 style={{
                      fontFamily: 'var(--font-display)', fontWeight: 700,
                      fontSize: 'clamp(1.75rem, 3vw, 2.75rem)', lineHeight: 1.15,
                      color: '#fff', marginBottom: '1rem',
                    }}>{f.title}</h3>
                    <p style={{
                      fontFamily: 'var(--font-body)', fontSize: 'clamp(0.9375rem, 1.2vw, 1.0625rem)',
                      color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, maxWidth: '28rem',
                    }}>{f.desc}</p>
                  </div>

                  {/* Right side: 3D demo or large icon */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {f.has3D ? (
                      <div ref={demoCardRef} style={{
                        width: '100%', aspectRatio: '4/3', borderRadius: '1.25rem',
                        overflow: 'hidden', background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
                      }}>
                        {demoVisible ? (
                          <Suspense fallback={
                            <div style={{ width: '100%', height: '100%', background: 'rgba(20,22,30,0.8)', display: 'grid', placeItems: 'center' }}>
                              <div style={{ width: '2rem', height: '2rem', border: '2px solid var(--lp-accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            </div>
                          }>
                            <VoxelBuildingMini3D />
                          </Suspense>
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: 'rgba(20,22,30,0.8)', display: 'grid', placeItems: 'center' }}>
                            <MapPin size={48} style={{ color: 'var(--lp-accent)', opacity: 0.3 }} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{
                        width: '12rem', height: '12rem', borderRadius: '2rem',
                        background: f.colorMuted, display: 'grid', placeItems: 'center',
                        border: `1px solid ${f.color}20`,
                        boxShadow: `0 24px 80px ${f.color}15`,
                      }}>
                        <f.icon size={56} style={{ color: f.color, opacity: 0.7 }} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Panel number indicator */}
                <div style={{
                  position: 'absolute', bottom: '2rem', left: '4rem', zIndex: 2,
                  fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)',
                }}>{String(i + 1).padStart(2, '0')} / {String(FEATURES.length).padStart(2, '0')}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            SCENE 4: ROLE JOURNEYS — Pinned, roles switch on scroll
            ═══════════════════════════════════════════ */}
        <section ref={rolesRef} id="roles" aria-label="Role journeys" style={{
          position: 'relative', height: '100vh', overflow: 'hidden',
        }}>
          {/* Background photos — stacked, controlled by activeRole */}
          {ROLES.map((r, i) => (
            <div key={r.id} style={{
              position: 'absolute', inset: 0, zIndex: 0,
              opacity: activeRole === i ? 1 : 0,
              transition: 'opacity 600ms ease',
            }}>
              <img src={r.photo} alt={`${r.title} role`} loading="lazy" decoding="async"
                style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.25)' }} />
            </div>
          ))}
          <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(135deg, rgba(10,12,20,0.88) 0%, rgba(10,12,20,0.6) 100%)' }} />

          {/* Content */}
          <div style={{
            position: 'relative', zIndex: 2, height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 2rem',
          }}>
            <div style={{ maxWidth: '72rem', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }} className="lp-roles-grid">
              {/* Left: Role info */}
              <div className="lp-roles-header">
                <div style={{
                  display: 'inline-flex', gap: '0.375rem', alignItems: 'center',
                  fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                  padding: '0.3rem 0.6rem', borderRadius: '0.375rem',
                  background: role.accentMuted, color: role.accent, marginBottom: '1.5rem',
                }}><role.icon size={12} /> Your Journey</div>

                <h2 style={{
                  fontFamily: 'var(--font-display)', fontWeight: 700,
                  fontSize: 'var(--lp-text-h2)', lineHeight: 1.15, color: '#fff', marginBottom: '0.5rem',
                }}>{role.title} Portal</h2>

                {/* Role tabs */}
                <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                  {ROLES.map((r, i) => (
                    <button key={r.id} onClick={() => setActiveRole(i)} style={{
                      fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 600,
                      padding: '0.375rem 0.75rem', borderRadius: '0.5rem',
                      background: activeRole === i ? r.accentMuted : 'rgba(255,255,255,0.04)',
                      border: 'none', color: activeRole === i ? '#fff' : 'rgba(255,255,255,0.4)',
                      cursor: 'pointer', transition: 'all 200ms ease',
                    }}>{r.title}</button>
                  ))}
                </div>
              </div>

              {/* Right: Steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {role.steps.map((s, i) => (
                  <div key={`${role.id}-${i}`} style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '1rem 1.25rem', borderRadius: '1rem',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    transition: 'border-color 300ms ease, background 300ms ease',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = role.accent; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  >
                    <div style={{
                      width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', flexShrink: 0,
                      background: role.accentMuted, display: 'grid', placeItems: 'center', color: role.accent,
                    }}><s.icon size={14} /></div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>{s.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Progress dots */}
          <div style={{
            position: 'absolute', right: '2rem', top: '50%', transform: 'translateY(-50%)',
            zIndex: 3, display: 'flex', flexDirection: 'column', gap: '0.5rem',
          }} className="lp-role-dots">
            {ROLES.map((r, i) => (
              <div key={r.id} style={{
                width: activeRole === i ? '10px' : '6px',
                height: activeRole === i ? '10px' : '6px',
                borderRadius: '50%',
                background: activeRole === i ? role.accent : 'rgba(255,255,255,0.2)',
                transition: 'all 300ms ease',
              }} />
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            SCENE 5: HOW IT WORKS
            ═══════════════════════════════════════════ */}
        <section ref={howRef} id="how" aria-label="How it works" style={{
          padding: '8rem 2rem', maxWidth: '72rem', margin: '0 auto',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 'var(--lp-text-h2)', lineHeight: 1.2,
            }}>Three steps to full control</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }} className="lp-steps-grid">
            {STEPS.map(s => (
              <div key={s.step} className="lp-step-card" style={{
                padding: '2.5rem 2rem', borderRadius: '1.5rem',
                background: 'var(--lp-bg-elevated)', border: '1px solid var(--lp-border)',
                textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center',
                transition: 'border-color 300ms ease, transform 300ms ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--lp-accent)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--lp-border)'; e.currentTarget.style.transform = 'none'; }}
              >
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--lp-accent)', marginBottom: '1rem' }}>{s.step}</div>
                <div style={{
                  width: '3.5rem', height: '3.5rem', borderRadius: '1rem',
                  background: 'var(--lp-accent-muted)', display: 'grid', placeItems: 'center',
                  color: 'var(--lp-accent)', marginBottom: '1.25rem',
                }}><s.icon size={22} /></div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.25rem', marginBottom: '0.5rem' }}>{s.title}</h3>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: 'var(--lp-text-secondary)', lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            SCENE 7: FINAL CTA — Aerial pullback
            ═══════════════════════════════════════════ */}
        <section ref={ctaRef} aria-label="Call to action" style={{
          position: 'relative', height: '80vh', minHeight: '500px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}>
          <div className="lp-cta-bg" style={{
            position: 'absolute', inset: '-15%', zIndex: 0, willChange: 'transform',
          }}>
            <img src="/assets/mombasa_aerial_coastline.png" alt="Aerial Mombasa coastline" loading="lazy" decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(10,12,20,0.5), rgba(10,12,20,0.9))' }} />
          </div>
          <div className="lp-cta-inner" style={{
            position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '36rem', padding: '0 1.5rem',
          }}>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 'var(--lp-text-h2)', lineHeight: 1.2, color: '#fff', marginBottom: '1rem',
            }}>Ready to manage your coast?</h2>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: '1rem',
              color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: '2.5rem',
            }}>Join landlords, tenants, and agents across Mombasa who have switched to automated property management.</p>
            <button onClick={handleGetStarted} style={{
              fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '1.0625rem',
              color: '#fff', padding: '1.125rem 3rem', borderRadius: '0.75rem',
              background: 'var(--lp-cta-gradient)', border: 'none', cursor: 'pointer',
              boxShadow: '0 8px 32px rgba(80,60,220,0.45)',
              transition: 'transform 200ms ease, box-shadow 200ms ease',
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.03)'; e.currentTarget.style.boxShadow = '0 14px 48px rgba(80,60,220,0.6)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(80,60,220,0.45)'; }}
            >Create Free Account <ArrowRight size={18} /></button>
          </div>
        </section>
      </main>

      {/* ═══════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════ */}
      <footer style={{
        padding: '4rem 2rem 2rem', maxWidth: '72rem', margin: '0 auto',
        borderTop: '1px solid var(--lp-border-subtle)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', marginBottom: '3rem' }} className="lp-footer-grid">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{
                width: '1.75rem', height: '1.75rem', borderRadius: '0.4rem',
                background: 'var(--lp-cta-gradient)', display: 'grid', placeItems: 'center',
                fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.6rem', color: '#fff',
              }}>MR</div>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.8125rem' }}>MutuneRent Pro</span>
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8125rem', color: 'var(--lp-text-secondary)', lineHeight: 1.6 }}>
              Mutune General Estate Agency<br />Mombasa, Kenya
            </p>
          </div>
          <div>
            <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.8125rem', marginBottom: '0.75rem' }}>Platform</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {['3D Spatial Maps', 'KRA Tax Engine', 'M-Pesa Payments', 'Agent Portal'].map(l => (
                <button key={l} onClick={() => scrollTo('features')} style={{
                  fontFamily: 'var(--font-body)', fontSize: '0.8125rem', color: 'var(--lp-text-secondary)',
                  background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0,
                  transition: 'color 150ms', }}
                  onMouseEnter={e => { e.target.style.color = 'var(--lp-text-primary)'; }}
                  onMouseLeave={e => { e.target.style.color = 'var(--lp-text-secondary)'; }}
                >{l}</button>
              ))}
            </div>
          </div>
          <div>
            <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.8125rem', marginBottom: '0.75rem' }}>Legal</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {['Privacy Policy', 'Terms of Service', 'EARB Compliance'].map(l => (
                <span key={l} style={{ fontFamily: 'var(--font-body)', fontSize: '0.8125rem', color: 'var(--lp-text-tertiary)' }}>{l}</span>
              ))}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', paddingTop: '1.5rem', borderTop: '1px solid var(--lp-border-subtle)' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--lp-text-tertiary)' }}>
            &copy; {new Date().getFullYear()} Mutune General Estate Agency. All rights reserved.
          </p>
        </div>
      </footer>

      {/* ═══ RESPONSIVE + ANIMATION STYLES ═══ */}
      <style>{`
        @keyframes lp-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(6px); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .lp-gradient-text .lp-word {
          background: var(--lp-cta-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        @media (max-width: 767px) {
          .lp-nav-links, .lp-nav-actions { display: none !important; }
          .lp-hamburger { display: grid !important; }
          .lp-metrics-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .lp-panels-track { flex-direction: column !important; width: 100% !important; }
          .lp-panel { width: 100% !important; height: auto !important; min-height: 100vh; padding: 6rem 1.5rem !important; }
          .lp-panel-content { grid-template-columns: 1fr !important; gap: 2rem !important; padding: 0 !important; }
          .lp-roles-grid { grid-template-columns: 1fr !important; gap: 2rem !important; }
          .lp-role-dots { display: none !important; }
          .lp-steps-grid { grid-template-columns: 1fr !important; }
          .lp-footer-grid { grid-template-columns: 1fr !important; }
        }

        @media (min-width: 768px) and (max-width: 1023px) {
          .lp-steps-grid { grid-template-columns: 1fr 1fr !important; }
          .lp-steps-grid .lp-step-card:last-child { grid-column: span 2; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
          .lp-word { opacity: 1 !important; transform: none !important; }
          .lp-hero-subtitle, .lp-hero-ctas { opacity: 1 !important; }
          .lp-metric { opacity: 1 !important; }
        }

        button:focus-visible, a:focus-visible {
          outline: 2px solid var(--lp-accent);
          outline-offset: 3px;
        }
      `}</style>
    </div>
  );
}
