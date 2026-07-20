import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useThemeStore } from '../store/themeStore';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Building2, Shield, CreditCard, Users, MapPin, FileText,
  ArrowRight, Sun, Moon, Menu, X, Check, ChevronRight,
  BarChart3, Smartphone, ClipboardCheck, UserCheck, Landmark,
  Eye, Receipt, Bell, KeyRound, UserPlus, Search, Activity
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const VoxelBuildingMini3D = lazy(() => import('../components/VoxelBuildingMini3D'));

/* ══════════════════════════════════════════════
   DATA
   ══════════════════════════════════════════════ */

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
    desc: 'Navigate every floor, unit, and corridor in an interactive voxel model. See payment status per unit at a glance — paid, pending, overdue, vacant.',
    icon: MapPin,
    badge: 'INTERACTIVE 3D',
    accentClass: 'lp-icon--accent',
    span: 2,
    has3D: true,
  },
  {
    id: 'kra',
    title: 'KRA Tax Engine',
    desc: 'Automatically calculates 7.5% MRI withholding and 10% WHT on every rental payment. Generates CSV returns ready for iTax upload.',
    icon: FileText,
    badge: 'AUTO FILING',
    accentClass: 'lp-icon--emerald',
    span: 1,
  },
  {
    id: 'mpesa',
    title: 'M-Pesa STK Push',
    desc: 'Tenants tap one button. The STK prompt hits their phone in under 3 seconds. Payment reconciles automatically — no manual matching.',
    icon: Smartphone,
    badge: 'INSTANT PAY',
    accentClass: 'lp-icon--teal',
    span: 1,
  },
  {
    id: 'portals',
    title: 'Role-Gated Portals',
    desc: 'Four separate dashboards — Landlord, Tenant, Agent, Admin — each with permissions, views, and workflows tailored to their job.',
    icon: Users,
    badge: '4 PORTALS',
    accentClass: 'lp-icon--purple',
    span: 2,
  },
];

const ROLES = [
  {
    id: 'landlord',
    title: 'Landlord',
    icon: Landmark,
    accent: 'var(--lp-accent)',
    accentMuted: 'var(--lp-accent-muted)',
    photo: '/assets/landlord_property_office.png',
    steps: [
      { icon: UserPlus, text: 'Register & verify ownership via Google SSO' },
      { icon: Building2, text: 'Add properties, define units, set rent amounts' },
      { icon: FileText, text: 'Auto KRA tax filing — 7.5% MRI & 10% WHT calculated' },
      { icon: CreditCard, text: 'Collect rent via M-Pesa, funds to your bank' },
      { icon: BarChart3, text: 'Track net income, occupancy, and expenses' },
    ],
  },
  {
    id: 'tenant',
    title: 'Tenant',
    icon: KeyRound,
    accent: 'var(--lp-emerald)',
    accentMuted: 'var(--lp-emerald-muted)',
    photo: '/assets/tenant_mpesa_payment.png',
    steps: [
      { icon: Bell, text: 'Get invited by your agent via email' },
      { icon: UserCheck, text: 'Link account — auto-detect your tenant code' },
      { icon: Smartphone, text: 'Pay rent via M-Pesa STK Push in under 3 seconds' },
      { icon: Receipt, text: 'View digital receipts, payment history & lease docs' },
    ],
  },
  {
    id: 'agent',
    title: 'Agent',
    icon: ClipboardCheck,
    accent: 'var(--lp-amber)',
    accentMuted: 'var(--lp-amber-muted)',
    photo: '/assets/agent_field_inspection.png',
    steps: [
      { icon: FileText, text: 'Submit EARB license for verification' },
      { icon: Check, text: 'Get admin approval on your agent profile' },
      { icon: Building2, text: 'Manage properties, assign tenants, issue notices' },
      { icon: BarChart3, text: 'Earn tracked commission on managed units' },
    ],
  },
  {
    id: 'admin',
    title: 'Admin',
    icon: Shield,
    accent: 'var(--lp-purple)',
    accentMuted: 'var(--lp-purple-muted)',
    photo: '/assets/admin_control_center.png',
    steps: [
      { icon: Eye, text: 'Full system dashboard on sign-in' },
      { icon: UserCheck, text: 'Review and approve agent & landlord registrations' },
      { icon: Activity, text: 'Monitor audit logs and security events' },
      { icon: Search, text: 'Manage inventory auctions and unit assets' },
    ],
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Register',
    desc: 'Create your account with Google SSO. Select your role — landlord, tenant, agent, or admin. Verification takes under 24 hours.',
    icon: UserPlus,
  },
  {
    step: '02',
    title: 'Set Up',
    desc: 'Landlords add properties and units. Agents upload EARB licenses. Tenants get auto-detected when their agent registers their email.',
    icon: Building2,
  },
  {
    step: '03',
    title: 'Manage',
    desc: 'Collect rent via M-Pesa, file KRA taxes automatically, track payments in real time, and visualize your portfolio in 3D.',
    icon: BarChart3,
  },
];

/* ══════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════ */

export default function LandingPage() {
  const navigate = useNavigate();
  const { isSignedIn } = useUser();
  const { theme, toggleTheme } = useThemeStore();

  /* ── State ─────────────────────────── */
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeRole, setActiveRole] = useState(0);
  const [navScrolled, setNavScrolled] = useState(false);
  const [demoVisible, setDemoVisible] = useState(false);

  /* ── Refs ──────────────────────────── */
  const heroRef = useRef(null);
  const heroImgRef = useRef(null);
  const heroContentRef = useRef(null);
  const transitionRef = useRef(null);
  const capabilitiesRef = useRef(null);
  const rolesRef = useRef(null);
  const howRef = useRef(null);
  const ctaRef = useRef(null);
  const canvasRef = useRef(null);
  const demoCardRef = useRef(null);
  const navRef = useRef(null);

  /* ── Reduced motion check ─────────── */
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  /* ── Navigation ────────────────────── */
  const handleGetStarted = useCallback(() => {
    if (isSignedIn) {
      navigate('/dashboard');
    } else {
      navigate('/sign-up');
    }
  }, [isSignedIn, navigate]);

  const handleSignIn = useCallback(() => {
    if (isSignedIn) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  }, [isSignedIn, navigate]);

  const scrollToSection = useCallback((id) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, []);

  /* ── Nav scroll listener ───────────── */
  useEffect(() => {
    const handleScroll = () => setNavScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /* ── 3D Demo IntersectionObserver ──── */
  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth < 768) return;
    const node = demoCardRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setDemoVisible(true); },
      { rootMargin: '200px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* ══════════════════════════════════════
     CANVAS 2D — Ambient light particles
     ══════════════════════════════════════ */
  useEffect(() => {
    if (prefersReducedMotion.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let w, h;

    const count = window.innerWidth < 768 ? 15 : 30;
    const particles = [];

    const resize = () => {
      w = canvas.width = canvas.parentElement.offsetWidth;
      h = canvas.height = canvas.parentElement.offsetHeight;
    };

    const init = () => {
      resize();
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 1 + Math.random() * 2,
          vy: -(0.2 + Math.random() * 0.3),
          vx: (Math.random() - 0.5) * 0.3,
          alpha: 0.15 + Math.random() * 0.3,
          phase: Math.random() * Math.PI * 2,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx + Math.sin(p.phase) * 0.15;
        p.y += p.vy;
        p.phase += 0.008;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245, 215, 160, ${p.alpha})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };

    init();
    draw();
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  /* ══════════════════════════════════════
     GSAP SCROLL ANIMATIONS
     ══════════════════════════════════════ */
  useEffect(() => {
    if (prefersReducedMotion.current) return;

    const ctx = gsap.context(() => {
      /* ── Page load orchestration ────── */
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo(heroImgRef.current, { scale: 1.08, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8 })
        .fromTo(navRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.2)
        .fromTo('.lp-hero-badge', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, 0.4)
        .fromTo('.lp-hero-title', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, 0.5)
        .fromTo('.lp-hero-subtitle', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, 0.7)
        .fromTo('.lp-hero-ctas', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, 0.8)
        .fromTo('.lp-metric', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.06 }, 0.9);

      /* ── Hero parallax on scroll ────── */
      gsap.to(heroImgRef.current, {
        yPercent: 25,
        opacity: 0.3,
        ease: 'none',
        scrollTrigger: {
          trigger: heroRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: 1,
        },
      });

      /* ── Transition scene ────────────── */
      gsap.fromTo(
        '.lp-transition-img',
        { opacity: 0, scale: 1.1 },
        {
          opacity: 1, scale: 1, ease: 'none',
          scrollTrigger: {
            trigger: transitionRef.current,
            start: 'top 80%',
            end: 'top 30%',
            scrub: 0.5,
          },
        }
      );
      gsap.fromTo(
        '.lp-transition-text',
        { y: 40, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.6, ease: 'power2.out',
          scrollTrigger: {
            trigger: transitionRef.current,
            start: 'top 60%',
            toggleActions: 'play none none none',
          },
        }
      );

      /* ── Bento cards stagger ─────────── */
      gsap.fromTo(
        '.lp-feature-card',
        { y: 40, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: 'power2.out',
          scrollTrigger: {
            trigger: capabilitiesRef.current,
            start: 'top 80%',
            toggleActions: 'play none none none',
          },
        }
      );

      /* ── Roles section ──────────────── */
      gsap.fromTo(
        '.lp-roles-content',
        { y: 30, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.6, ease: 'power2.out',
          scrollTrigger: {
            trigger: rolesRef.current,
            start: 'top 75%',
            toggleActions: 'play none none none',
          },
        }
      );

      /* ── How It Works steps stagger ─── */
      gsap.fromTo(
        '.lp-step-card',
        { y: 40, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: 'power2.out',
          scrollTrigger: {
            trigger: howRef.current,
            start: 'top 80%',
            toggleActions: 'play none none none',
          },
        }
      );

      /* ── Final CTA ──────────────────── */
      gsap.fromTo(
        '.lp-final-cta-inner',
        { scale: 0.97, opacity: 0 },
        {
          scale: 1, opacity: 1, duration: 0.6, ease: 'power2.out',
          scrollTrigger: {
            trigger: ctaRef.current,
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
        }
      );

      /* ── Metric counter animation ───── */
      document.querySelectorAll('.lp-metric-value').forEach((el) => {
        const raw = el.dataset.value;
        if (!raw) return;
        const isNumber = /^\d+$/.test(raw.replace(/[^0-9]/g, ''));
        if (!isNumber) return;
        const target = parseInt(raw.replace(/[^0-9]/g, ''), 10);
        const obj = { val: 0 };
        gsap.to(obj, {
          val: target,
          duration: 1.2,
          ease: 'power1.inOut',
          scrollTrigger: {
            trigger: el,
            start: 'top 90%',
            toggleActions: 'play none none none',
          },
          onUpdate: () => {
            el.textContent = raw.replace(/\d+/, Math.round(obj.val).toLocaleString());
          },
        });
      });
    });

    return () => ctx.revert();
  }, []);

  /* ══════════════════════════════════════
     CURSOR TILT (desktop only)
     ══════════════════════════════════════ */
  useEffect(() => {
    if (prefersReducedMotion.current) return;
    if (typeof window === 'undefined' || window.innerWidth < 1024) return;
    const hero = heroContentRef.current;
    if (!hero) return;

    let tiltX = 0, tiltY = 0, targetX = 0, targetY = 0;
    let raf;

    const onMouseMove = (e) => {
      const rect = hero.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      targetX = ((e.clientY - cy) / (rect.height / 2)) * -3;
      targetY = ((e.clientX - cx) / (rect.width / 2)) * 5;
    };

    const update = () => {
      tiltX += (targetX - tiltX) * 0.06;
      tiltY += (targetY - tiltY) * 0.06;
      hero.style.transform = `perspective(1200px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
      raf = requestAnimationFrame(update);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    raf = requestAnimationFrame(update);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(raf);
      if (hero) hero.style.transform = '';
    };
  }, []);

  /* ══════════════════════════════════════
     RENDER
     ══════════════════════════════════════ */

  const currentRole = ROLES[activeRole];

  return (
    <div
      className="lp-root"
      style={{ background: 'var(--lp-bg)', color: 'var(--lp-text-primary)', fontFamily: 'var(--font-body)' }}
    >
      {/* ═══ SKIP LINK ═══ */}
      <a
        href="#main"
        style={{
          position: 'absolute', left: '-9999px', top: 'auto',
          width: '1px', height: '1px', overflow: 'hidden',
          zIndex: 100, padding: '12px 24px',
          background: 'var(--lp-accent)', color: '#fff', borderRadius: '8px',
        }}
        onFocus={(e) => { e.target.style.left = '16px'; e.target.style.top = '16px'; e.target.style.width = 'auto'; e.target.style.height = 'auto'; }}
        onBlur={(e) => { e.target.style.left = '-9999px'; }}
      >
        Skip to main content
      </a>

      {/* ═══════════════════════════════════
          NAVIGATION
          ═══════════════════════════════════ */}
      <nav
        ref={navRef}
        className="lp-nav"
        style={{
          position: 'sticky', top: '1rem', zIndex: 40,
          maxWidth: '80rem', margin: '0 auto',
          padding: '0.75rem 1.25rem',
          borderRadius: '1rem',
          background: navScrolled ? 'var(--lp-glass-bg)' : 'transparent',
          backdropFilter: navScrolled ? `blur(var(--lp-glass-blur))` : 'none',
          WebkitBackdropFilter: navScrolled ? `blur(var(--lp-glass-blur))` : 'none',
          border: navScrolled ? '1px solid var(--lp-glass-border)' : '1px solid transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'background 300ms ease, border-color 300ms ease, backdrop-filter 300ms ease, box-shadow 300ms ease',
          boxShadow: navScrolled ? '0 8px 32px rgba(0,0,0,0.2)' : 'none',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div style={{
            width: '2rem', height: '2rem', borderRadius: '0.5rem',
            background: 'var(--lp-cta-gradient)', display: 'grid', placeItems: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.75rem', color: '#fff',
          }}>MR</div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--lp-text-small)' }}>
            MutuneRent Pro
          </span>
        </div>

        {/* Desktop links */}
        <div className="lp-nav-links" style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
          {[{ label: 'Features', id: 'capabilities' }, { label: 'How It Works', id: 'how-it-works' }, { label: 'Roles', id: 'roles' }].map(l => (
            <button key={l.id} onClick={() => scrollToSection(l.id)} style={{
              fontFamily: 'var(--font-body)', fontSize: 'var(--lp-text-small)', fontWeight: 500,
              color: 'var(--lp-text-secondary)', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
              background: 'transparent', border: 'none', cursor: 'pointer',
              transition: 'color 200ms ease, background 200ms ease',
            }}
              onMouseEnter={e => { e.target.style.color = 'var(--lp-text-primary)'; e.target.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={e => { e.target.style.color = 'var(--lp-text-secondary)'; e.target.style.background = 'transparent'; }}
            >{l.label}</button>
          ))}
        </div>

        {/* Desktop actions */}
        <div className="lp-nav-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={toggleTheme} aria-label="Toggle theme" style={{
            width: '2.5rem', height: '2.5rem', display: 'grid', placeItems: 'center',
            borderRadius: '0.625rem', border: '1px solid var(--lp-border)',
            background: 'var(--lp-bg-elevated)', color: 'var(--lp-text-secondary)',
            cursor: 'pointer', transition: 'color 150ms ease, border-color 150ms ease',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--lp-text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--lp-text-secondary)'; }}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={handleSignIn} style={{
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--lp-text-small)',
            color: 'var(--lp-text-primary)', padding: '0.6rem 1.25rem', borderRadius: '0.75rem',
            background: 'transparent', border: '1.5px solid var(--lp-border)', cursor: 'pointer',
            transition: 'border-color 200ms ease, background 200ms ease, transform 200ms cubic-bezier(0.16,1,0.3,1)',
          }}
            onMouseEnter={e => { e.target.style.borderColor = 'var(--lp-accent)'; e.target.style.background = 'var(--lp-accent-muted)'; }}
            onMouseLeave={e => { e.target.style.borderColor = 'var(--lp-border)'; e.target.style.background = 'transparent'; }}
          >
            {isSignedIn ? 'Dashboard' : 'Sign In'}
          </button>
          <button onClick={handleGetStarted} style={{
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--lp-text-small)',
            color: '#fff', padding: '0.6rem 1.25rem', borderRadius: '0.75rem',
            background: 'var(--lp-cta-gradient)', border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(80,60,220,0.3)',
            transition: 'transform 200ms cubic-bezier(0.16,1,0.3,1), box-shadow 200ms ease',
          }}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 8px 24px rgba(80,60,220,0.4)'; }}
            onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 16px rgba(80,60,220,0.3)'; }}
          >
            {isSignedIn ? 'Go to Portal' : 'Get Started'}
            <ArrowRight size={14} style={{ display: 'inline', marginLeft: '0.35rem', verticalAlign: 'middle' }} />
          </button>
        </div>

        {/* Mobile hamburger */}
        <button className="lp-hamburger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu" style={{
          display: 'none', width: '2.5rem', height: '2.5rem', placeItems: 'center',
          borderRadius: '0.5rem', border: '1px solid var(--lp-border)', background: 'var(--lp-bg-elevated)',
          color: 'var(--lp-text-primary)', cursor: 'pointer',
        }}>
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </nav>

      {/* Mobile drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '80vw', maxWidth: '320px',
        zIndex: 50, background: 'var(--lp-bg-elevated)', padding: '5rem 1.5rem 2rem',
        transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 300ms cubic-bezier(0.16,1,0.3,1)',
        borderLeft: '1px solid var(--lp-border)',
        display: 'flex', flexDirection: 'column', gap: '1.5rem',
      }}>
        <button onClick={() => setMobileMenuOpen(false)} style={{
          position: 'absolute', top: '1rem', right: '1rem',
          background: 'none', border: 'none', color: 'var(--lp-text-primary)', cursor: 'pointer',
        }}><X size={24} /></button>
        {['Features', 'How It Works', 'Roles'].map(label => (
          <button key={label} onClick={() => scrollToSection(label.toLowerCase().replace(/ /g, '-'))} style={{
            fontFamily: 'var(--font-body)', fontSize: '1.125rem', fontWeight: 600,
            color: 'var(--lp-text-primary)', background: 'none', border: 'none',
            textAlign: 'left', cursor: 'pointer', padding: '0.5rem 0',
          }}>{label}</button>
        ))}
        <div style={{ borderTop: '1px solid var(--lp-border-subtle)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button onClick={() => { setMobileMenuOpen(false); toggleTheme(); }} style={{
            fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: '1rem',
            color: 'var(--lp-text-secondary)', background: 'none', border: 'none',
            textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</button>
          <button onClick={() => { setMobileMenuOpen(false); handleSignIn(); }} style={{
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '1rem',
            color: 'var(--lp-text-primary)', padding: '0.75rem', borderRadius: '0.75rem',
            background: 'transparent', border: '1.5px solid var(--lp-border)', cursor: 'pointer', textAlign: 'center',
          }}>{isSignedIn ? 'Dashboard' : 'Sign In'}</button>
          <button onClick={() => { setMobileMenuOpen(false); handleGetStarted(); }} style={{
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '1rem',
            color: '#fff', padding: '0.75rem', borderRadius: '0.75rem',
            background: 'var(--lp-cta-gradient)', border: 'none', cursor: 'pointer', textAlign: 'center',
          }}>{isSignedIn ? 'Go to Portal' : 'Get Started'}</button>
        </div>
      </div>
      {mobileMenuOpen && <div onClick={() => setMobileMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 45, background: 'rgba(0,0,0,0.5)' }} />}

      <main id="main">
        {/* ═══════════════════════════════════
            S1: HERO
            ═══════════════════════════════════ */}
        <section ref={heroRef} aria-label="Hero" style={{
          position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center',
          justifyContent: 'center', overflow: 'hidden', padding: '6rem 1rem 4rem',
        }}>
          {/* Background photo */}
          <div ref={heroImgRef} style={{
            position: 'absolute', inset: 0, zIndex: 0,
          }}>
            <img
              src="/assets/hero_coastal_building.png"
              alt="Luxury coastal apartment building in Mombasa at golden hour"
              fetchpriority="high"
              decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          {/* Gradient overlay */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1,
            background: 'var(--lp-hero-overlay)',
          }} aria-hidden="true" />

          {/* Ambient particles canvas */}
          <canvas ref={canvasRef} style={{
            position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
          }} aria-hidden="true" />

          {/* Hero content */}
          <div ref={heroContentRef} style={{
            position: 'relative', zIndex: 3, maxWidth: '64rem', textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem',
            willChange: 'transform',
          }}>
            {/* Badge */}
            <div className="lp-hero-badge" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
              fontFamily: 'var(--font-body)', fontSize: 'var(--lp-text-badge)', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '0.375rem 0.75rem', borderRadius: '2rem',
              background: 'var(--lp-accent-muted)', color: 'var(--lp-accent)',
            }}>
              <Building2 size={12} /> Mombasa&apos;s Premier Property Platform
            </div>

            {/* Headline — 2-line iron rule */}
            <h1 className="lp-hero-title" style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 'var(--lp-text-hero)', lineHeight: 'var(--lp-leading-tight)',
              maxWidth: '52rem',
            }}>
              Coastal Property Management{' '}
              <span style={{
                background: 'var(--lp-cta-gradient)', WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                Built on Spatial Intelligence
              </span>
            </h1>

            {/* Subtitle */}
            <p className="lp-hero-subtitle" style={{
              fontFamily: 'var(--font-body)', fontSize: 'var(--lp-text-body)',
              color: 'var(--lp-text-secondary)', maxWidth: '36rem',
              lineHeight: 'var(--lp-leading-normal)',
            }}>
              Automate KRA taxes. Collect rent via M-Pesa. Visualize every unit in 3D. Purpose-built for Mombasa&apos;s coast.
            </p>

            {/* CTAs */}
            <div className="lp-hero-ctas" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={handleGetStarted} style={{
                fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--lp-text-small)',
                color: '#fff', padding: '0.875rem 2rem', borderRadius: '0.75rem',
                background: 'var(--lp-cta-gradient)', border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(80,60,220,0.35)',
                transition: 'transform 200ms cubic-bezier(0.16,1,0.3,1), box-shadow 200ms ease',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 30px rgba(80,60,220,0.45)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(80,60,220,0.35)'; }}
              >
                {isSignedIn ? 'Go to Portal' : 'Get Started Free'} <ArrowRight size={16} />
              </button>
              <button onClick={handleSignIn} style={{
                fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--lp-text-small)',
                color: 'var(--lp-text-primary)', padding: '0.875rem 2rem', borderRadius: '0.75rem',
                background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)',
                cursor: 'pointer',
                transition: 'border-color 200ms ease, background 200ms ease',
              }}
                onMouseEnter={e => { e.target.style.borderColor = 'var(--lp-accent)'; e.target.style.background = 'var(--lp-accent-muted)'; }}
                onMouseLeave={e => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.background = 'rgba(255,255,255,0.08)'; }}
              >
                {isSignedIn ? 'Dashboard' : 'Sign In'}
              </button>
            </div>

            {/* Metrics */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem',
              marginTop: '2rem', width: '100%', maxWidth: '48rem',
            }} className="lp-metrics-grid">
              {METRICS.map((m, i) => (
                <div key={i} className="lp-metric" style={{
                  padding: '1rem 0.75rem', borderRadius: '1rem', textAlign: 'center',
                  background: 'var(--lp-glass-bg)',
                  backdropFilter: 'blur(var(--lp-glass-blur))',
                  WebkitBackdropFilter: 'blur(var(--lp-glass-blur))',
                  border: '1px solid var(--lp-glass-border)',
                }}>
                  <div className="lp-metric-value" data-value={m.value} style={{
                    fontFamily: 'var(--font-mono)', fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)',
                    fontWeight: 400, color: m.color, lineHeight: 'var(--lp-leading-tight)',
                  }}>{m.value}</div>
                  <div style={{
                    fontFamily: 'var(--font-body)', fontSize: 'var(--lp-text-badge)', fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: 'var(--lp-text-secondary)', marginTop: '0.25rem',
                  }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════
            S2: TRANSITION — "Step Inside"
            ═══════════════════════════════════ */}
        <section ref={transitionRef} aria-label="Transition" style={{
          position: 'relative', padding: 'var(--sp-24) 1rem',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '60vh', overflow: 'hidden',
        }}>
          <div className="lp-transition-img" style={{
            position: 'absolute', inset: 0, zIndex: 0, opacity: 0,
          }}>
            <img
              src="/assets/building_interior_lobby.png"
              alt="Modern luxury apartment building lobby"
              loading="lazy" decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'var(--lp-hero-overlay)',
            }} aria-hidden="true" />
          </div>
          <div className="lp-transition-text" style={{
            position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '40rem',
          }}>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 'var(--lp-text-h2)', lineHeight: 'var(--lp-leading-snug)',
              marginBottom: 'var(--sp-4)',
            }}>
              Step inside your next investment
            </h2>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: 'var(--lp-text-body)',
              color: 'var(--lp-text-secondary)', lineHeight: 'var(--lp-leading-normal)',
            }}>
              From lobby to rooftop, every floor is mapped. Every unit is tracked. Every payment is reconciled.
            </p>
          </div>
        </section>

        {/* ═══════════════════════════════════
            S3: CAPABILITIES — Bento Grid
            ═══════════════════════════════════ */}
        <section ref={capabilitiesRef} id="capabilities" aria-label="Features" style={{
          padding: 'var(--sp-20) 1rem', maxWidth: '80rem', margin: '0 auto',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--sp-10)' }}>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 'var(--lp-text-h2)', lineHeight: 'var(--lp-leading-snug)',
            }}>
              Everything you need to manage coastal property
            </h2>
          </div>

          <div className="lp-bento" style={{
            display: 'grid', gap: 'var(--sp-4)',
            gridTemplateColumns: 'repeat(3, 1fr)',
          }}>
            {FEATURES.map((f) => (
              <div
                key={f.id}
                ref={f.has3D ? demoCardRef : undefined}
                className="lp-feature-card"
                style={{
                  padding: 'var(--sp-6)', borderRadius: '1.25rem',
                  background: 'var(--lp-bg-elevated)', border: '1px solid var(--lp-border)',
                  gridColumn: `span ${f.span}`,
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  transition: 'border-color 300ms ease, transform 300ms cubic-bezier(0.16,1,0.3,1), box-shadow 300ms ease',
                  cursor: 'default', overflow: 'hidden', minHeight: f.has3D ? '20rem' : 'auto',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--lp-accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(80,60,220,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--lp-border)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div>
                  {/* Icon */}
                  <div className={`lp-card-icon ${f.accentClass}`} style={{
                    width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem',
                    display: 'grid', placeItems: 'center', marginBottom: 'var(--sp-5)',
                    transition: 'transform 300ms cubic-bezier(0.16,1,0.3,1)',
                    background: f.id === 'spatial' ? 'var(--lp-accent-muted)' :
                      f.id === 'kra' ? 'var(--lp-emerald-muted)' :
                        f.id === 'mpesa' ? 'var(--lp-teal-muted)' : 'var(--lp-purple-muted)',
                    color: f.id === 'spatial' ? 'var(--lp-accent)' :
                      f.id === 'kra' ? 'var(--lp-emerald)' :
                        f.id === 'mpesa' ? 'var(--lp-teal)' : 'var(--lp-purple)',
                  }}>
                    <f.icon size={20} />
                  </div>

                  {/* Badge */}
                  <div style={{
                    display: 'inline-flex', fontSize: 'var(--lp-text-badge)', fontWeight: 700,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    padding: '0.25rem 0.5rem', borderRadius: '0.375rem', marginBottom: 'var(--sp-3)',
                    background: f.id === 'spatial' ? 'var(--lp-accent-muted)' :
                      f.id === 'kra' ? 'var(--lp-emerald-muted)' :
                        f.id === 'mpesa' ? 'var(--lp-teal-muted)' : 'var(--lp-purple-muted)',
                    color: f.id === 'spatial' ? 'var(--lp-accent)' :
                      f.id === 'kra' ? 'var(--lp-emerald)' :
                        f.id === 'mpesa' ? 'var(--lp-teal)' : 'var(--lp-purple)',
                  }}>{f.badge}</div>

                  {/* Title + desc */}
                  <h3 style={{
                    fontFamily: 'var(--font-display)', fontWeight: 600,
                    fontSize: 'var(--lp-text-h3)', lineHeight: 'var(--lp-leading-snug)',
                    marginBottom: 'var(--sp-2)',
                  }}>{f.title}</h3>
                  <p style={{
                    fontFamily: 'var(--font-body)', fontSize: 'var(--lp-text-body)',
                    color: 'var(--lp-text-secondary)', lineHeight: 'var(--lp-leading-normal)',
                  }}>{f.desc}</p>
                </div>

                {/* 3D Demo embed for spatial card */}
                {f.has3D && (
                  <div style={{
                    marginTop: 'var(--sp-6)', borderRadius: '0.75rem', overflow: 'hidden',
                    height: '14rem', background: 'var(--lp-bg-recessed)',
                    border: '1px solid var(--lp-border-subtle)',
                  }}>
                    {demoVisible ? (
                      <Suspense fallback={
                        <div style={{
                          width: '100%', height: '100%',
                          background: 'linear-gradient(90deg, var(--lp-bg-elevated) 25%, var(--lp-bg-recessed) 50%, var(--lp-bg-elevated) 75%)',
                          backgroundSize: '200% 100%',
                          animation: 'shimmer 1.5s infinite',
                        }} />
                      }>
                        <VoxelBuildingMini3D />
                      </Suspense>
                    ) : (
                      <img src="/assets/voxel_estate.png" alt="3D voxel building visualization"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loading="lazy" decoding="async" />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════
            S4: ROLE-SPECIFIC FLOWS
            ═══════════════════════════════════ */}
        <section ref={rolesRef} id="roles" aria-label="Role-specific flows" style={{
          padding: 'var(--sp-20) 1rem', maxWidth: '80rem', margin: '0 auto',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--sp-10)' }}>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 'var(--lp-text-h2)', lineHeight: 'var(--lp-leading-snug)',
            }}>
              Your role. Your journey.
            </h2>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: 'var(--lp-text-body)',
              color: 'var(--lp-text-secondary)', marginTop: 'var(--sp-3)', maxWidth: '32rem', marginInline: 'auto',
            }}>
              Four portals, each purpose-built for how you work.
            </p>
          </div>

          {/* Role tabs */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 'var(--sp-2)',
            marginBottom: 'var(--sp-8)', flexWrap: 'wrap',
          }}>
            {ROLES.map((r, i) => (
              <button key={r.id} onClick={() => setActiveRole(i)} style={{
                fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--lp-text-small)',
                padding: '0.625rem 1.25rem', borderRadius: '0.625rem', cursor: 'pointer',
                border: i === activeRole ? '1.5px solid transparent' : '1.5px solid var(--lp-border)',
                background: i === activeRole ? r.accentMuted : 'transparent',
                color: i === activeRole ? 'var(--lp-text-primary)' : 'var(--lp-text-secondary)',
                transition: 'all 250ms ease',
                display: 'flex', alignItems: 'center', gap: '0.375rem',
              }}>
                <r.icon size={16} /> {r.title}
              </button>
            ))}
          </div>

          {/* Role content */}
          <div className="lp-roles-content" style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-8)',
            alignItems: 'center',
          }}>
            {/* Photo */}
            <div style={{
              borderRadius: '1.25rem', overflow: 'hidden',
              aspectRatio: '4/3', position: 'relative',
            }}>
              <img
                key={currentRole.id}
                src={currentRole.photo}
                alt={`${currentRole.title} using MutuneRent Pro`}
                loading="lazy" decoding="async"
                style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                  transition: 'opacity 400ms ease',
                }}
              />
            </div>

            {/* Steps */}
            <div>
              <h3 style={{
                fontFamily: 'var(--font-display)', fontWeight: 700,
                fontSize: 'var(--lp-text-h3)', marginBottom: 'var(--sp-6)',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <span style={{
                  width: '2rem', height: '2rem', borderRadius: '0.5rem',
                  background: currentRole.accentMuted, display: 'grid', placeItems: 'center',
                  color: currentRole.accent,
                }}>
                  <currentRole.icon size={16} />
                </span>
                {currentRole.title} Journey
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                {currentRole.steps.map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)',
                    padding: 'var(--sp-4)', borderRadius: '0.75rem',
                    background: 'var(--lp-bg-elevated)', border: '1px solid var(--lp-border-subtle)',
                    transition: 'border-color 200ms ease',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = currentRole.accent; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--lp-border-subtle)'; }}
                  >
                    <div style={{
                      width: '2rem', height: '2rem', borderRadius: '0.5rem', flexShrink: 0,
                      background: currentRole.accentMuted, display: 'grid', placeItems: 'center',
                      color: currentRole.accent, fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
                    }}>
                      <s.icon size={14} />
                    </div>
                    <p style={{
                      fontFamily: 'var(--font-body)', fontSize: 'var(--lp-text-body)',
                      color: 'var(--lp-text-primary)', lineHeight: 'var(--lp-leading-normal)',
                    }}>{s.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════
            S5: HOW IT WORKS
            ═══════════════════════════════════ */}
        <section ref={howRef} id="how-it-works" aria-label="How it works" style={{
          padding: 'var(--sp-20) 1rem', maxWidth: '80rem', margin: '0 auto',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--sp-10)' }}>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 'var(--lp-text-h2)', lineHeight: 'var(--lp-leading-snug)',
            }}>
              Three steps to full control
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-6)' }} className="lp-steps-grid">
            {HOW_IT_WORKS.map((s) => (
              <div key={s.step} className="lp-step-card" style={{
                padding: 'var(--sp-6)', borderRadius: '1.25rem',
                background: 'var(--lp-bg-elevated)', border: '1px solid var(--lp-border)',
                textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center',
                transition: 'border-color 300ms ease, transform 300ms cubic-bezier(0.16,1,0.3,1)',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--lp-accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--lp-border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--lp-text-caption)',
                  color: 'var(--lp-accent)', fontWeight: 400, marginBottom: 'var(--sp-3)',
                }}>{s.step}</div>
                <div style={{
                  width: '3rem', height: '3rem', borderRadius: '0.75rem',
                  background: 'var(--lp-accent-muted)', display: 'grid', placeItems: 'center',
                  color: 'var(--lp-accent)', marginBottom: 'var(--sp-4)',
                }}>
                  <s.icon size={22} />
                </div>
                <h3 style={{
                  fontFamily: 'var(--font-display)', fontWeight: 600,
                  fontSize: 'var(--lp-text-h3)', marginBottom: 'var(--sp-2)',
                }}>{s.title}</h3>
                <p style={{
                  fontFamily: 'var(--font-body)', fontSize: 'var(--lp-text-body)',
                  color: 'var(--lp-text-secondary)', lineHeight: 'var(--lp-leading-normal)',
                }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* S6: Testimonials — zero trace, reserved for future */}

        {/* ═══════════════════════════════════
            S7: FINAL CTA
            ═══════════════════════════════════ */}
        <section ref={ctaRef} aria-label="Call to action" style={{
          position: 'relative', padding: 'var(--sp-24) 1rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '50vh', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
            <img
              src="/assets/mombasa_aerial_coastline.png"
              alt="Aerial view of Mombasa coastline"
              loading="lazy" decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'var(--lp-hero-overlay)',
            }} aria-hidden="true" />
          </div>

          <div className="lp-final-cta-inner" style={{
            position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '36rem',
          }}>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 'var(--lp-text-h2)', lineHeight: 'var(--lp-leading-snug)',
              marginBottom: 'var(--sp-4)',
            }}>
              Ready to manage your coast?
            </h2>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: 'var(--lp-text-body)',
              color: 'var(--lp-text-secondary)', lineHeight: 'var(--lp-leading-normal)',
              marginBottom: 'var(--sp-8)',
            }}>
              Join landlords, tenants, and agents across Mombasa who have switched to automated property management.
            </p>
            <button onClick={handleGetStarted} style={{
              fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '1rem',
              color: '#fff', padding: '1rem 2.5rem', borderRadius: '0.75rem',
              background: 'var(--lp-cta-gradient)', border: 'none', cursor: 'pointer',
              boxShadow: '0 6px 24px rgba(80,60,220,0.4)',
              transition: 'transform 200ms cubic-bezier(0.16,1,0.3,1), box-shadow 200ms ease',
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 36px rgba(80,60,220,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(80,60,220,0.4)'; }}
            >
              Create Free Account <ArrowRight size={18} />
            </button>
          </div>
        </section>
      </main>

      {/* ═══════════════════════════════════
          FOOTER
          ═══════════════════════════════════ */}
      <footer style={{
        padding: 'var(--sp-12) 1rem var(--sp-6)',
        maxWidth: '80rem', margin: '0 auto',
        borderTop: '1px solid var(--lp-border-subtle)',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-8)',
          marginBottom: 'var(--sp-8)',
        }} className="lp-footer-grid">
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--sp-3)' }}>
              <div style={{
                width: '2rem', height: '2rem', borderRadius: '0.5rem',
                background: 'var(--lp-cta-gradient)', display: 'grid', placeItems: 'center',
                fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.75rem', color: '#fff',
              }}>MR</div>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--lp-text-small)' }}>
                MutuneRent Pro
              </span>
            </div>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: 'var(--lp-text-small)',
              color: 'var(--lp-text-secondary)', lineHeight: 'var(--lp-leading-normal)',
            }}>
              Mutune General Estate Agency<br />
              Mombasa, Kenya
            </p>
          </div>

          {/* Platform */}
          <div>
            <h4 style={{
              fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--lp-text-small)',
              marginBottom: 'var(--sp-3)', color: 'var(--lp-text-primary)',
            }}>Platform</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {['3D Spatial Maps', 'KRA Tax Engine', 'M-Pesa Payments', 'Agent Portal'].map(l => (
                <button key={l} onClick={() => scrollToSection('capabilities')} style={{
                  fontFamily: 'var(--font-body)', fontSize: 'var(--lp-text-small)',
                  color: 'var(--lp-text-secondary)', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left', padding: 0,
                  transition: 'color 150ms ease',
                }}
                  onMouseEnter={e => { e.target.style.color = 'var(--lp-text-primary)'; }}
                  onMouseLeave={e => { e.target.style.color = 'var(--lp-text-secondary)'; }}
                >{l}</button>
              ))}
            </div>
          </div>

          {/* Legal */}
          <div>
            <h4 style={{
              fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--lp-text-small)',
              marginBottom: 'var(--sp-3)', color: 'var(--lp-text-primary)',
            }}>Legal</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {['Privacy Policy', 'Terms of Service', 'EARB Compliance'].map(l => (
                <span key={l} style={{
                  fontFamily: 'var(--font-body)', fontSize: 'var(--lp-text-small)',
                  color: 'var(--lp-text-tertiary)',
                }}>{l}</span>
              ))}
            </div>
          </div>
        </div>

        <div style={{
          textAlign: 'center', paddingTop: 'var(--sp-6)',
          borderTop: '1px solid var(--lp-border-subtle)',
        }}>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 'var(--lp-text-caption)',
            color: 'var(--lp-text-tertiary)',
          }}>
            &copy; {new Date().getFullYear()} Mutune General Estate Agency. All rights reserved.
          </p>
        </div>
      </footer>

      {/* ═══ RESPONSIVE STYLES ═══ */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        /* Mobile nav */
        @media (max-width: 767px) {
          .lp-nav-links, .lp-nav-actions { display: none !important; }
          .lp-hamburger { display: grid !important; }
          .lp-metrics-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .lp-bento { grid-template-columns: 1fr !important; }
          .lp-bento .lp-feature-card { grid-column: span 1 !important; }
          .lp-roles-content { grid-template-columns: 1fr !important; }
          .lp-steps-grid { grid-template-columns: 1fr !important; }
          .lp-footer-grid { grid-template-columns: 1fr !important; }
          .lp-hero-title { text-align: left !important; }
          .lp-hero-subtitle { text-align: left !important; }
          .lp-hero-ctas { justify-content: flex-start !important; }
        }

        @media (min-width: 768px) and (max-width: 1023px) {
          .lp-bento { grid-template-columns: repeat(2, 1fr) !important; }
          .lp-steps-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .lp-steps-grid .lp-step-card:last-child { grid-column: span 2; }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }

        /* Focus visible */
        button:focus-visible, a:focus-visible {
          outline: 2px solid var(--lp-accent);
          outline-offset: 3px;
        }
      `}</style>
    </div>
  );
}
