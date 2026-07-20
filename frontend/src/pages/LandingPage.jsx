import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useThemeStore } from '../store/themeStore';
import RoleAuthModal from '../components/RoleAuthModal';
import {
  Building2, ShieldCheck, Key, Briefcase, Shield, Sparkles,
  ArrowRight, CheckCircle2, ChevronRight, Play, Award,
  Zap, Compass, Layers, FileText, Smartphone, TrendingUp,
  Lock, Sun, Moon, Users, Eye, ArrowUpRight
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const { isSignedIn, user } = useUser();
  const { theme, toggleTheme } = useThemeStore();
  const isLight = theme === 'light';

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('new'); // 'new' | 'existing'

  // Role Showcase Tabs
  const [activeTab, setActiveTab] = useState('landlords');

  // Canvas Ref for Interactive 3D Vortex
  const canvasRef = useRef(null);

  const openAuthModal = (mode = 'new') => {
    setModalMode(mode);
    setModalOpen(true);
  };

  // ── 3D Particle & Ring Vortex Canvas Animation ─────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationFrameId;
    let width = (canvas.width = canvas.parentElement.clientWidth);
    let height = (canvas.height = canvas.parentElement.clientHeight);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Mouse Parallax
    let mouseX = width / 2;
    let mouseY = height / 2;
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Particles setup
    const particleCount = 280;
    const particles = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        radius: 20 + Math.random() * (Math.min(width, height) * 0.45),
        speed: 0.003 + Math.random() * 0.008,
        size: 1 + Math.random() * 2.5,
        color: Math.random() > 0.4 ? '#3b82f6' : Math.random() > 0.5 ? '#06b6d4' : '#10b981',
        z: Math.random() * 400 - 200,
        zSpeed: 0.5 + Math.random() * 1.2
      });
    }

    let rotAngle = 0;

    const render = () => {
      rotAngle += 0.005;
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2 + (mouseX - width / 2) * 0.04;
      const centerY = height / 2 + (mouseY - height / 2) * 0.04;

      // Draw Glowing Center Portal Core
      const portalGrad = ctx.createRadialGradient(
        centerX, centerY, 5,
        centerX, centerY, Math.min(width, height) * 0.35
      );
      portalGrad.addColorStop(0, 'rgba(59, 130, 246, 0.45)');
      portalGrad.addColorStop(0.3, 'rgba(6, 182, 212, 0.2)');
      portalGrad.addColorStop(0.7, 'rgba(16, 185, 129, 0.08)');
      portalGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');

      ctx.fillStyle = portalGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, Math.min(width, height) * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // Draw Concentric Vortex Orbit Rings
      const ringCount = 5;
      for (let r = 1; r <= ringCount; r++) {
        const ringRadius = (Math.min(width, height) * 0.08) * r + Math.sin(rotAngle + r) * 6;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotAngle * (r % 2 === 0 ? 1 : -1) * 0.4);
        ctx.scale(1, 0.55); // Perspective tilt

        ctx.strokeStyle = r === 2 ? 'rgba(6, 182, 212, 0.4)' : 'rgba(59, 130, 246, 0.25)';
        ctx.lineWidth = r === 2 ? 2 : 1;
        ctx.setLineDash(r % 2 === 0 ? [12, 8] : []);
        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Render Spiraling Particles
      particles.forEach((p) => {
        p.angle += p.speed;
        p.z -= p.zSpeed;
        if (p.z < -200) {
          p.z = 200;
          p.radius = 20 + Math.random() * (Math.min(width, height) * 0.45);
        }

        // Perspective projection
        const fov = 300;
        const scale = fov / (fov + p.z);
        const currentRadius = p.radius * scale;

        const x = centerX + Math.cos(p.angle) * currentRadius;
        const y = centerY + Math.sin(p.angle) * currentRadius * 0.55; // Tilt

        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0.1, Math.min(1, scale * 0.8));
        ctx.beginPath();
        ctx.arc(x, y, p.size * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className={`min-h-screen relative font-sans overflow-x-hidden transition-colors duration-300 ${
      isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'
    }`}>

      {/* ── Z0: DYNAMIC BACKGROUND GRAPH ──────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.15),rgba(255,255,255,0))]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b12_1px,transparent_1px),linear-gradient(to_bottom,#1e293b12_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      {/* ── Z1: NAVIGATION BAR (Floating Glass Pill) ──────────────────────── */}
      <header className="sticky top-4 z-40 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="backdrop-blur-xl bg-slate-900/80 border border-white/10 shadow-2xl shadow-blue-500/5 rounded-2xl px-5 py-3 flex items-center justify-between transition-all">
          
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-base text-white">
                MutuneRent <span className="text-blue-400 font-semibold">Pro</span>
              </span>
              <span className="hidden sm:inline-block text-[9px] text-blue-400/80 tracking-[0.2em] uppercase font-bold ml-2 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                Mombasa 3D
              </span>
            </div>
          </div>

          {/* Center Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-300">
            <a href="#features" className="hover:text-blue-400 transition-colors">Features</a>
            <a href="#vortex-3d" className="hover:text-blue-400 transition-colors">3D Vortex Engine</a>
            <a href="#kra-tax" className="hover:text-blue-400 transition-colors">KRA Tax Automation</a>
            <a href="#roles" className="hover:text-blue-400 transition-colors">Role Portals</a>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-white/10 bg-slate-800/60 text-slate-300 hover:text-white transition-colors"
              aria-label="Toggle Theme"
            >
              {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {isSignedIn ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all flex items-center gap-1.5"
              >
                <span>Go to Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => openAuthModal('existing')}
                  className="hidden sm:inline-flex py-2 px-4 rounded-xl border border-white/10 hover:border-blue-500/50 bg-slate-800/40 text-slate-200 hover:text-white font-semibold text-xs transition-all"
                >
                  Sign In
                </button>
                <button
                  onClick={() => openAuthModal('new')}
                  className="py-2 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition-all transform active:scale-95 flex items-center gap-1.5"
                >
                  <span>Get Started</span>
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Z2: HERO SECTION (2-Line Expressive Iron Rule) ────────────────── */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 max-w-7xl mx-auto px-4 sm:px-6 text-center z-10">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-wider mb-6 backdrop-blur-md">
          <Zap className="w-3.5 h-3.5 animate-pulse" />
          <span>Next-Gen Coastal Property Management • Kenya</span>
        </div>

        {/* 2-Line Expressive Hero Title */}
        <h1 className="max-w-5xl mx-auto text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.15] text-slate-900 dark:text-white">
          High-Fidelity Coastal Property Management
          <br className="hidden sm:inline" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400">
            Powered by 3D Spatial Intelligence & KRA Automation
          </span>
        </h1>

        {/* Subtitle */}
        <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-6 leading-relaxed">
          The all-in-one platform for Landlords, Tenants, and EARB Agents in Mombasa. Automated 7.5% MRI & 10% WHT tax statements, 1-click M-Pesa STK Push rent payments, and spatial 3D voxel blueprints.
        </p>

        {/* Dual Pill Action CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
          <button
            onClick={() => openAuthModal('new')}
            className="w-full sm:w-auto py-3.5 px-8 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-extrabold text-sm shadow-xl shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
          >
            <span>Get Started Free</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => openAuthModal('existing')}
            className="w-full sm:w-auto py-3.5 px-8 rounded-2xl border border-slate-300 dark:border-white/15 hover:border-blue-500/50 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md text-slate-800 dark:text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Sign In / Select Role</span>
          </button>
        </div>

        {/* Metric Pills */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mt-14 pt-8 border-t border-slate-200 dark:border-slate-800/80">
          <div className="p-4 rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/5 backdrop-blur-md">
            <p className="text-2xl md:text-3xl font-black text-blue-500 font-mono">KES 450M+</p>
            <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mt-1">Rent Collected</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/5 backdrop-blur-md">
            <p className="text-2xl md:text-3xl font-black text-emerald-500 font-mono">100%</p>
            <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mt-1">KRA Tax Compliant</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/5 backdrop-blur-md">
            <p className="text-2xl md:text-3xl font-black text-cyan-500 font-mono">&lt; 3 Sec</p>
            <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mt-1">M-Pesa STK Push</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/5 backdrop-blur-md">
            <p className="text-2xl md:text-3xl font-black text-purple-500 font-mono">Sub-Meter</p>
            <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mt-1">3D Voxel Accuracy</p>
          </div>
        </div>
      </section>

      {/* ── Z2: 3D VORTEX INTERACTIVE SHOWCASE SECTION ────────────────────── */}
      <section id="vortex-3d" className="relative py-16 max-w-7xl mx-auto px-4 sm:px-6 z-10">
        <div className="relative rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-900/90 dark:bg-slate-950/90 overflow-hidden shadow-2xl shadow-blue-500/10">
          
          {/* Header */}
          <div className="p-8 sm:p-10 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 z-10 relative">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-wider mb-2">
                <Compass className="w-3 h-3" />
                <span>Spatial 3D Vortex Engine</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Interactive 3D Coastal Spatial Portal
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
                Experience real-time 3D property visualization. Move your cursor over the vortex to interact with spatial orbital particles and unit mesh layers.
              </p>
            </div>

            <button
              onClick={() => openAuthModal('new')}
              className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition-all flex items-center gap-2 self-start md:self-auto"
            >
              <span>Explore 3D Units</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Interactive Canvas & Graphic Container */}
          <div className="relative h-[420px] sm:h-[480px] w-full flex items-center justify-center overflow-hidden bg-slate-950">
            
            {/* Real-time 3D Particle Vortex Canvas */}
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10 pointer-events-auto" />

            {/* Generated 3D Vortex Brand Graphic Overlay */}
            <img
              src="/assets/vortex_3d_brand_portal.png"
              alt="3D Spatial Vortex Portal"
              className="absolute inset-0 w-full h-full object-cover opacity-35 mix-blend-screen pointer-events-none z-0"
            />

            {/* Glass Floating Stat Badges */}
            <div className="absolute top-6 left-6 z-20 hidden sm:flex flex-col gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-white/10 text-white shadow-xl max-w-xs">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Live 3D Raycasting Active</span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1 font-mono">Nyali Coast Block A • Unit 104 Paid</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-white/10 text-white shadow-xl max-w-xs">
                <div className="flex items-center gap-2 text-blue-400 text-xs font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>KRA Auto Tax Withholding</span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1 font-mono">7.5% Residential MRI Applied</p>
              </div>
            </div>

            <div className="absolute bottom-6 right-6 z-20 hidden sm:flex flex-col gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-white/10 text-white shadow-xl text-right max-w-xs">
                <div className="flex items-center justify-end gap-2 text-cyan-400 text-xs font-bold">
                  <Zap className="w-4 h-4" />
                  <span>M-Pesa Express Callback</span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1 font-mono">STK Confirmation &lt; 2.4s</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Z2: GAPLESS BENTO GRID SECTION (agent-motion-pro Law) ───────────── */}
      <section id="features" className="relative py-16 max-w-7xl mx-auto px-4 sm:px-6 z-10">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-blue-500 text-xs font-extrabold uppercase tracking-[0.2em]">Platform Architecture</span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">
            Engineered for Coastal Real Estate Excellence
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-3">
            Every tool built from the ground up for Kenyan statutory compliance, local payments, and spatial 3D building management.
          </p>
        </div>

        {/* Bento Grid (grid-flow-dense) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 grid-flow-dense">
          
          {/* Card 1: 3D Spatial Blueprints (Col Span 2) */}
          <div className="md:col-span-2 rounded-3xl p-8 bg-slate-900/80 dark:bg-slate-950/80 border border-slate-800/80 text-white shadow-xl hover:border-blue-500/40 transition-all group flex flex-col justify-between overflow-hidden relative">
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Layers className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full">
                Three.js Spatial Engine
              </span>
              <h3 className="text-2xl font-bold mt-3 group-hover:text-blue-400 transition-colors">
                Relative-To-Eye 3D Voxel Blueprints
              </h3>
              <p className="text-slate-400 text-xs sm:text-sm mt-2 max-w-lg leading-relaxed">
                Zero-jitter WebGL spatial building models that scale accurately to physical meters. View unit occupancy statuses (Paid, Pending, Overdue, Vacant) directly on dynamic 3D maps.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-blue-400 font-bold">
              <span>Explore 3D Map Models</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 2: KRA Tax Compliance (Col Span 1) */}
          <div id="kra-tax" className="rounded-3xl p-8 bg-slate-900/80 dark:bg-slate-950/80 border border-slate-800/80 text-white shadow-xl hover:border-emerald-500/40 transition-all group flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                Statutory Compliance
              </span>
              <h3 className="text-xl font-bold mt-3 group-hover:text-emerald-400 transition-colors">
                Automated KRA Tax Statements
              </h3>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                Generate official KRA rent reconciliation CSVs with automated 7.5% Monthly Rental Income (MRI) and 10% Withholding Tax (WHT) calculations.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 text-xs font-bold text-emerald-400 flex items-center justify-between">
              <span>KRA Ready Export</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          {/* Card 3: Instant M-Pesa STK Push (Col Span 1) */}
          <div className="rounded-3xl p-8 bg-slate-900/80 dark:bg-slate-950/80 border border-slate-800/80 text-white shadow-xl hover:border-cyan-500/40 transition-all group flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Smartphone className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full">
                Daraja API Integration
              </span>
              <h3 className="text-xl font-bold mt-3 group-hover:text-cyan-400 transition-colors">
                1-Click M-Pesa STK Push
              </h3>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                Tenants pay rent in seconds via direct M-Pesa popups on their phones. Real-time instant callbacks generate legal PDF receipts automatically.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 text-xs font-bold text-cyan-400 flex items-center justify-between">
              <span>Instant Confirmation</span>
              <Zap className="w-4 h-4" />
            </div>
          </div>

          {/* Card 4: Role-Gated Portals (Col Span 2) */}
          <div className="md:col-span-2 rounded-3xl p-8 bg-slate-900/80 dark:bg-slate-950/80 border border-slate-800/80 text-white shadow-xl hover:border-purple-500/40 transition-all group flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-full">
                RBAC Security Architecture
              </span>
              <h3 className="text-2xl font-bold mt-3 group-hover:text-purple-400 transition-colors">
                Tailored Role Dashboards & Digital Notices
              </h3>
              <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
                Dedicated interfaces for Landlords, Tenants, EARB Agents, and System Admins. Issue tamper-proof digital vacate notices, manage tenant check-ins, and run inventory auctions.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-purple-400 font-bold">
              <span>View Role Dashboards</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

        </div>
      </section>

      {/* ── Z2: INTERACTIVE ROLE SHOWCASE TABS SECTION ────────────────────── */}
      <section id="roles" className="relative py-16 max-w-7xl mx-auto px-4 sm:px-6 z-10">
        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-900/90 dark:bg-slate-950/90 p-8 sm:p-12 shadow-2xl">
          
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-blue-400 text-xs font-bold uppercase tracking-wider">Experience Your Role</span>
            <h2 className="text-3xl font-bold text-white tracking-tight mt-1">
              Built Specifically for Your Coastal Workflow
            </h2>
          </div>

          {/* Tab Controls */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
            {[
              { id: 'landlords', label: 'Landlords & Owners', icon: Building2 },
              { id: 'tenants', label: 'Tenants & Residents', icon: Key },
              { id: 'agents', label: 'Field Agents & EARB', icon: Briefcase },
              { id: 'admins', label: 'System Admins', icon: Shield }
            ].map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`py-3 px-6 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 scale-105'
                      : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Display */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-slate-950/80 rounded-2xl p-6 sm:p-8 border border-white/5">
            
            {activeTab === 'landlords' && (
              <>
                <div className="space-y-4">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Landlord Portal</span>
                  <h3 className="text-2xl font-bold text-white">Full Net Income Visibility & KRA Reconciliation</h3>
                  <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                    Track gross revenue across Bamburi, Nyali, and Tudor properties. View automated 7.5% MRI calculations, approve lease agreements, and receive direct M-Pesa bank disbursements.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Automated Monthly KRA Rent CSV Export</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Property Performance Breakdown & Occupancy Heatmaps</span>
                    </li>
                  </ul>
                  <button
                    onClick={() => openAuthModal('new')}
                    className="mt-4 py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition-all inline-flex items-center gap-2"
                  >
                    <span>Register as Landlord</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-xl">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs space-y-3">
                    <div className="flex justify-between text-blue-400 font-bold">
                      <span>Property Code: NYALI-BLK-A</span>
                      <span>12 Units</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Monthly Gross Rent:</span>
                      <span className="font-bold text-emerald-400">KES 420,000</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">KRA 7.5% MRI Tax Liability:</span>
                      <span className="font-bold text-amber-400">KES 31,500</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-[11px] font-bold text-center">
                      ✓ Net Disbursed: KES 388,500
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'tenants' && (
              <>
                <div className="space-y-4">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Resident Portal</span>
                  <h3 className="text-2xl font-bold text-white">Instant M-Pesa Payments & Digital Receipts</h3>
                  <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                    Pay rent in seconds from your mobile phone. View your unit 3D floor plan, download legal PDF receipts, and submit instant maintenance repair tickets.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>1-Click M-Pesa STK Push Confirmation</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Digital Notice Board & Maintenance Tracker</span>
                    </li>
                  </ul>
                  <button
                    onClick={() => openAuthModal('new')}
                    className="mt-4 py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all inline-flex items-center gap-2"
                  >
                    <span>Register as Tenant</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-xl">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs space-y-3">
                    <div className="flex justify-between text-emerald-400 font-bold">
                      <span>Tenant Code: TNT-9082</span>
                      <span>Unit 4B (Paid)</span>
                    </div>
                    <div className="p-3 rounded-xl bg-blue-600/20 border border-blue-500/30 text-center">
                      <p className="text-blue-400 text-[10px] uppercase font-bold">M-Pesa STK Prompt</p>
                      <p className="text-white font-bold text-sm mt-1">Pay Rent KES 35,000</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'agents' && (
              <>
                <div className="space-y-4">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Agent Portal</span>
                  <h3 className="text-2xl font-bold text-white">EARB License Audits & Field Inspection App</h3>
                  <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                    Verify tenant check-ins in the field, issue legal vacate notices, conduct unit inventory audits, and earn automated commission payouts.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-400" />
                      <span>EARB License Verification & Commission Tracking</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-400" />
                      <span>Digital Notice Generator & Unit Inspection Logs</span>
                    </li>
                  </ul>
                  <button
                    onClick={() => openAuthModal('new')}
                    className="mt-4 py-2.5 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg transition-all inline-flex items-center gap-2"
                  >
                    <span>Register as Field Agent</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-xl">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs space-y-3">
                    <div className="flex justify-between text-amber-400 font-bold">
                      <span>Agent License: EARB-8839</span>
                      <span>Mombasa North</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Assigned Properties:</span>
                      <span className="font-bold text-white">8 Complexes</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 text-[11px] font-bold text-center">
                      ✓ Commission Earned: KES 85,400
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'admins' && (
              <>
                <div className="space-y-4">
                  <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Admin Control</span>
                  <h3 className="text-2xl font-bold text-white">Global Platform Governance & Inventory Auctions</h3>
                  <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                    Full oversight over all user approvals, Sentry error logs, PostHog product analytics, and tenant item auction management.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-purple-400" />
                      <span>System-wide Security Audit Logs</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-purple-400" />
                      <span>Auction Manager for Unclaimed Tenant Inventory</span>
                    </li>
                  </ul>
                  <button
                    onClick={() => openAuthModal('existing')}
                    className="mt-4 py-2.5 px-5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg transition-all inline-flex items-center gap-2"
                  >
                    <span>Admin Portal Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-xl">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs space-y-3">
                    <div className="flex justify-between text-purple-400 font-bold">
                      <span>Role: Super Admin</span>
                      <span>Global Access</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 text-[11px] font-bold text-center">
                      ✓ Sentry & PostHog Status: Connected (100% Operational)
                    </div>
                  </div>
                </div>
              </>
            )}

          </div>

        </div>
      </section>

      {/* ── Z2: ACTION CTA BANNER & FOOTER ───────────────────────────────── */}
      <section className="relative py-20 max-w-7xl mx-auto px-4 sm:px-6 z-10">
        <div className="rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-cyan-600 p-10 sm:p-14 text-center text-white shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_60%)] pointer-events-none" />
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight relative z-10">
            Transform Your Coastal Property Management Today
          </h2>
          <p className="text-white/80 text-sm max-w-xl mx-auto mt-3 relative z-10">
            Join hundreds of landlords, tenants, and property agents in Mombasa experiencing the future of 3D spatial intelligence.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8 relative z-10">
            <button
              onClick={() => openAuthModal('new')}
              className="w-full sm:w-auto py-4 px-8 rounded-2xl bg-white hover:bg-slate-100 text-blue-900 font-extrabold text-sm shadow-xl transition-all transform hover:scale-105 flex items-center justify-center gap-2"
            >
              <span>Create Free Account</span>
              <ArrowRight className="w-4 h-4 text-blue-700" />
            </button>
            <button
              onClick={() => openAuthModal('existing')}
              className="w-full sm:w-auto py-4 px-8 rounded-2xl border border-white/30 hover:bg-white/10 text-white font-bold text-sm transition-all"
            >
              Portal Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-slate-200 dark:border-slate-800/80 py-12 max-w-7xl mx-auto px-4 sm:px-6 z-10 text-xs text-slate-500">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
              M
            </div>
            <span className="font-bold text-slate-800 dark:text-white text-sm">MutuneRent Pro</span>
            <span className="text-[10px] text-slate-400">© 2026 MutuneRent Pro. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-blue-500 transition-colors">Features</a>
            <a href="#vortex-3d" className="hover:text-blue-500 transition-colors">3D Vortex</a>
            <a href="#kra-tax" className="hover:text-blue-500 transition-colors">KRA Tax</a>
            <button onClick={() => openAuthModal('existing')} className="hover:text-blue-500 transition-colors font-bold">
              Portal Sign In
            </button>
          </div>
        </div>
      </footer>

      {/* ── Z3: INTERACTIVE ROLE AUTH MODAL OVERLAY ───────────────────────── */}
      <RoleAuthModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultMode={modalMode}
      />

    </div>
  );
}
