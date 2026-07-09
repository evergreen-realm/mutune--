# Handoff Report: Frontend 3D & Motion Upgrade Audit

## 1. Observation

### File Layout & Structure
* The frontend is a React SPA built with Vite and styled with Tailwind CSS. It is structured under `frontend/src/` as follows:
  * `App.jsx` (Central router, syncs Clerk user metadata with the database).
  * `main.jsx` (Entrypoint mounting the App).
  * `layouts/` (`AppShell.tsx`, `Sidebar.tsx`, `Topbar.tsx` managing the dashboard layout).
  * `pages/` (18 screens including `PropertiesPage.jsx`, `PropertyDetailPage.jsx`, `TenantPortalPage.jsx`, `OnboardingPage.jsx`, `LoginPage.jsx`).
  * `components/` (Helper components like `MapWidget.jsx` incorporating R3F canvas, `PropertyList.jsx`, `AdminPasswordGuard.jsx`).

### Key Component Locations
* **Hero Lease Card (Zillow Style)**: Located in `frontend/src/pages/TenantPortalPage.jsx` lines 573–650:
  ```javascript
  {/* HERO PROPERTY LEASE CARD - ZILLOW STYLE */}
  <div className="bg-surface/30 backdrop-blur-xl border border-border rounded-[32px] overflow-hidden shadow-2xl mb-8">
  ```
* **Property Cards List**: Located in `frontend/src/pages/PropertiesPage.jsx` lines 240–334 (rendered in Grid View when `viewMode === 'cards'`):
  ```javascript
  } : viewMode === 'cards' ? (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {properties.map(prop => {
  ```
* **Property Details Banner**: Located in `frontend/src/pages/PropertyDetailPage.jsx` lines 212–337:
  ```javascript
  {/* Property Details Banner - Zillow Style */}
  <div className="bg-white border border-gray-150 rounded-[28px] shadow-md p-4 sm:p-5 flex flex-col xl:flex-row gap-5 items-stretch">
  ```
* **3D Building Preview Canvas**: Located in `frontend/src/components/MapWidget.jsx` lines 167–238, using a React-Three-Fiber Canvas with OrbitControls:
  ```javascript
  {/* R3F WebGL Canvas */}
  <div className="w-full h-80 bg-slate-950 rounded-lg overflow-hidden border border-slate-850 mt-10">
    <Canvas camera={{ position: [5, 4, 8], fov: 45 }}>
  ```

### Dependencies (`frontend/package.json`)
* The following 3D packages are currently installed (lines 15–16, 33):
  * `three`: `^0.184.0`
  * `@react-three/fiber`: `^8.18.0`
  * `@react-three/drei`: `^9.122.0`
* **GSAP** and **Lenis** are **NOT** present in `package.json` dependencies and must be installed.

### TODOs, FIXMEs, and Stubs
* Ripgrep search for literal `TODO` and `FIXME` returned zero matches, indicating no standard task tags exist in the frontend source code.
* The following placeholder/skeleton behaviors were found:
  * `TenantPortalPage.jsx` lines 89–114: Animated skeleton loader blocks for the lease card, stat boxes, and tables.
  * `PropertyDetailPage.jsx` lines 276–280: Placeholder visual for property photos if none are registered in the DB.
  * `components/MapWidget.jsx` line 167: `BuildingPreview3D` renders properties as colored 3D boxes/stubs rather than full voxel geometry models.

### Assets Search
* A deep search in the project folder for WebP or WebM animation sequences/files returned zero results. No voxel graphics or scroll sequences exist in the repository.

---

## 2. Logic Chain

1. **Installations**: To support smooth scrolling and scroll-bound animations, we must run `npm install gsap @lenis/react` (or the core `lenis` package) in the `frontend` folder.
2. **Scroll Containers**: The dashboard application uses a fixed height layout (`h-screen overflow-hidden`) in `layouts/AppShell.tsx`, with actual scroll behavior restricted to `<main className="flex-1 overflow-y-auto p-6">` (lines 95–129). Therefore, standard global window-bound Lenis smooth scroll will fail. Lenis must be instantiated with the `wrapper` configuration pointing directly to this `<main>` scroll element.
3. **ScrollTrigger Syncing**: For GSAP ScrollTrigger to coordinate with Lenis smooth scroll, we must register ScrollTrigger, listen to Lenis scroll events to trigger updates, add Lenis `raf` calls to the GSAP ticker, and set the `<main>` container as the default scroller in ScrollTrigger.
4. **Transition Wipes**: Framer Motion is already installed (`"framer-motion": "^12.40.0"`). We can either write a custom transition overlay with GSAP timelines triggered during React Router location changes or adapt the existing `<AnimatePresence>` in `AppShell.tsx` using full-viewport purple sliding overlay panels.
5. **Mobile Fallback**: Relying on live WebGL canvases (R3F) on mobile can cause performance lag and battery drain. Implementing a 2D `<canvas>` that draws preloaded WebP image frames tied directly to ScrollTrigger scroll progress offers a high-performance 60fps fallback. Since no sequences exist, these frames must be pre-rendered (60 frames) and added to the build.
6. **Blue Primary Color Scheme**: The user requested that we replace all emerald/green primary visual elements with blue (`#2563EB`) as per the `ui-redesign-references` guidelines, keeping green strictly for success indicators. This requires modifying CSS backgrounds, borders, shadow rings, and button fills across all roles and Guest pages (such as `OnboardingPage.jsx` and `LoginPage.jsx`).

---

## 3. Caveats

* **Missing Voxel Assets**: Visual assets for the scroll-zoom image sequence do not exist. An implementer must generate them (e.g. exporting a 60-frame rotation sequence of a 3D model using Blender or a Three.js exporter) and place them in the public folder.
* **Leaflet Conflicts**: Leaflet maps (rendered in `PropertyDetailPage.jsx` and `MapWidget.jsx`) intercept drag and scroll gestures. Lenis must be configured to ignore these canvas maps so that user map interactions do not trigger page jitter or scroll locks.

---

## 4. Conclusion

The repository is primed for high-end visual upgrades but requires adding `gsap` and `lenis`, routing them through the specific scroller container inside `AppShell.tsx`, replacing the static preloader with an active 0-100% counter in `App.jsx`, upgrading all structural colors to brand blue (`#2563EB`), and deploying a mobile-friendly canvas sequence player component.

---

## 5. Proposed Implementation Strategy

### 5.1 GSAP & Lenis Integration
Install packages:
```bash
cd frontend
npm install gsap lenis
```

Modify `frontend/src/layouts/AppShell.tsx` to handle nested container smooth scrolling:
```typescript
import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export default function AppShellLayout({ children, ...props }: AppShellLayoutProps) {
  const mainScrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const scroller = mainScrollRef.current;
    if (!scroller) return;

    // Initialize Lenis on the main scrollable element
    const lenis = new Lenis({
      wrapper: scroller,
      content: scroller.firstElementChild as HTMLElement,
      lerp: 0.1,
      duration: 1.2,
      smoothWheel: true,
    });

    // Synchronize ScrollTrigger with Lenis scroll ticks
    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);

    // Apply main container as default scroller for all ScrollTrigger instances
    ScrollTrigger.defaults({
      scroller: scroller,
    });

    return () => {
      lenis.destroy();
      gsap.ticker.remove(() => {});
    };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar, Topbar code... */}
      <main ref={mainScrollRef} className="flex-1 overflow-y-auto p-6">
        <div>{children}</div>
      </main>
    </div>
  );
}
```

### 5.2 Royal Purple Double Panel Wipe
Create `frontend/src/components/ui/DoublePanelWipe.jsx`:
```jsx
import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { gsap } from 'gsap';

export default function DoublePanelWipe() {
  const location = useLocation();
  const panel1 = useRef(null);
  const panel2 = useRef(null);

  useEffect(() => {
    const tl = gsap.timeline();
    // Slide panels in to cover screen, change page state, slide out
    tl.set([panel1.current, panel2.current], { xPercent: -100 })
      .to(panel1.current, { duration: 0.4, xPercent: 0, ease: 'power2.inOut' })
      .to(panel2.current, { duration: 0.4, xPercent: 0, ease: 'power2.inOut' }, '-=0.25')
      .to(panel1.current, { duration: 0.4, xPercent: 100, ease: 'power2.inOut', delay: 0.1 })
      .to(panel2.current, { duration: 0.4, xPercent: 100, ease: 'power2.inOut' }, '-=0.25');
  }, [location.pathname]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden flex flex-col">
      <div ref={panel1} className="w-full h-1/2 bg-purple-900" />
      <div ref={panel2} className="w-full h-1/2 bg-indigo-950" />
    </div>
  );
}
```
Mount this component in `App.jsx` inside the Router so it plays on every route transition.

### 5.3 0-100% Preloader
Create `frontend/src/components/ui/Preloader.jsx`:
```jsx
import React, { useState, useEffect } from 'react';
import { gsap } from 'gsap';

export default function Preloader({ onComplete }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const obj = { val: 0 };
    gsap.to(obj, {
      val: 100,
      duration: 2.2,
      ease: 'power3.out',
      onUpdate: () => setProgress(Math.floor(obj.val)),
      onComplete: onComplete
    });
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-[10000] text-white">
      <div className="relative flex items-center justify-center">
        {/* Ring layout */}
        <svg className="w-32 h-32 transform -rotate-90">
          <circle cx="64" cy="64" r="50" className="stroke-slate-800" strokeWidth="6" fill="transparent" />
          <circle 
            cx="64" cy="64" r="50" 
            className="stroke-blue-600 transition-all duration-75" 
            strokeWidth="6" 
            fill="transparent"
            strokeDasharray={314.16}
            strokeDashoffset={314.16 - (314.16 * progress) / 100}
          />
        </svg>
        <span className="absolute font-mono text-xl font-black">{progress}%</span>
      </div>
      <p className="text-xs text-slate-400 mt-6 tracking-widest uppercase font-bold">MutuneRent Pro Loading</p>
    </div>
  );
}
```

### 5.4 Mobile Fallback Canvas Player
Create `frontend/src/components/ui/VoxelMobilePlayer.jsx`:
```jsx
import React, { useEffect, useRef, useState } from 'react';

export default function VoxelMobilePlayer({ progress }) {
  const canvasRef = useRef(null);
  const [images, setImages] = useState([]);
  const totalFrames = 60;

  // Preload sequence
  useEffect(() => {
    const loadedImages = [];
    let loadedCount = 0;

    for (let i = 0; i < totalFrames; i++) {
      const img = new Image();
      const num = String(i).padStart(3, '0');
      img.src = `/assets/voxel-sequence/frame_${num}.webp`;
      img.onload = () => {
        loadedCount++;
        if (loadedCount === totalFrames) {
          setImages(loadedImages);
        }
      };
      loadedImages.push(img);
    }
  }, []);

  // Draw current frame based on scroll progress
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || images.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frameIndex = Math.min(
      totalFrames - 1,
      Math.floor(progress * totalFrames)
    );

    const img = images[frameIndex];
    if (img) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
  }, [progress, images]);

  return <canvas ref={canvasRef} className="w-full h-full object-contain" width={400} height={400} />;
}
```

---

## 6. Verification Method

### Local Build Verification
1. Run local installation in the `frontend` folder:
   ```bash
   npm install --legacy-peer-deps
   ```
2. Build the project to confirm layout configuration and ensure no bundler errors:
   ```bash
   npm run build
   ```

### Runtime Checks
1. Mount the components in `App.jsx` and `AppShell.tsx`.
2. Inspect the browser Console log for:
   * Verification that Lenis initialization targets `main` element (`mainScrollRef`).
   * No `ScrollTrigger` warning console output.
3. Validate that standard dashboard views do not trigger scroll conflicts.
