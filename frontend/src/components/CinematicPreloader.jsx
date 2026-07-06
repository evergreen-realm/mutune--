import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CinematicPreloader({ onComplete, duration = 2000 }) {
  const [progress, setProgress] = useState(0);
  const [isWiping, setIsWiping] = useState(false);
  const canvasRef = useRef(null);

  // 1. Progress Counter Animation
  useEffect(() => {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progressPercent = Math.min(Math.round((elapsed / duration) * 100), 100);
      setProgress(progressPercent);

      if (elapsed < duration) {
        window.requestAnimationFrame(step);
      } else {
        // Trigger wipe transition
        setIsWiping(true);
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 800); // match sliding transition duration
      }
    };
    window.requestAnimationFrame(step);
  }, [duration, onComplete]);

  // 2. Spinning Particle Vortex (Canvas 2D / WebGL style fallback)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Particle definition
    const particleCount = 280;
    const particles = [];
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * Math.max(canvas.width, canvas.height) * 0.6;
      particles.push({
        angle: angle,
        distance: distance,
        speed: 0.015 + Math.random() * 0.02,
        radialSpeed: -0.8 - Math.random() * 0.8,
        size: 1 + Math.random() * 2.5,
        color: i % 2 === 0 ? 'rgba(139, 92, 246, ' : 'rgba(236, 72, 153, ' // Purple / Pink
      });
    }

    const draw = () => {
      // Clear with dark trail
      ctx.fillStyle = 'rgba(3, 7, 18, 0.12)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      for (let i = 0; i < particleCount; i++) {
        const p = particles[i];
        p.angle += p.speed;
        p.distance += p.radialSpeed;

        // Reset if particles pull into center
        if (p.distance <= 10) {
          p.distance = Math.max(canvas.width, canvas.height) * 0.5 + Math.random() * 100;
        }

        const x = centerX + Math.cos(p.angle) * p.distance;
        const y = centerY + Math.sin(p.angle) * p.distance;

        // Fade based on distance to center
        const alpha = Math.min(1, p.distance / 150);
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + alpha + ')';
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color === 'rgba(139, 92, 246, ' ? '#8b5cf6' : '#ec4899';
        ctx.fill();
      }

      animationFrameId = window.requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[99999] overflow-hidden select-none bg-slate-950 flex items-center justify-center">
      {/* 2D/3D Vortex Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Royal Purple background overlay */}
      <div className="absolute inset-0 bg-radial-at-c from-purple-950/20 via-slate-950/80 to-slate-950 pointer-events-none" />

      {/* Centered Pulsing Vortex Image & HUD */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1.08, opacity: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="relative w-48 h-48 md:w-56 md:h-56 mb-8"
        >
          {/* Inner Vortex Glow */}
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
          
          <img
            src="/assets/cinematic_loading_screen.png"
            alt="Cinematic 3D Vortex"
            className="w-full h-full object-contain rounded-full border border-primary/25 filter drop-shadow-[0_0_25px_rgba(139,92,246,0.4)] animate-[spin_40s_linear_infinite]"
          />
        </motion.div>

        {/* Counter HUD */}
        <div className="space-y-2">
          <p className="text-[10px] text-primary uppercase font-extrabold tracking-[0.25em]">System Authorizing</p>
          <div className="font-mono text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-300 to-amber-300">
            {progress}%
          </div>
          <div className="w-40 h-[2px] bg-slate-900 border border-slate-800 rounded-full overflow-hidden mx-auto mt-2">
            <div
              className="h-full bg-gradient-to-r from-primary to-pink-500 rounded-full transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Double Panel Wipe Wipes Overlay */}
      <AnimatePresence>
        {isWiping && (
          <>
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
              className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-purple-900 to-indigo-950 border-r border-primary/30 z-[100000]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
              className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-purple-900 to-indigo-950 border-l border-primary/30 z-[100000]"
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
