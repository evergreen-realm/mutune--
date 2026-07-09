# Implementation Plan: MutuneRent Pro 3D & Motion Upgrade

We will transform the frontend of **MutuneRent Pro** into a spectacular, high-performance, award-winning interface. It will feature real-time 3D voxel art, cinematic intro loaders, and scroll-driven storytelling, while maintaining flawless mobile performance and full integration with our backend Express API routes.

---

## 🎨 Design Reference
We have created [design.md](file:///C:/Users/Admin/.gemini/antigravity/brain/9e8c62b2-d6b2-48ab-b6bf-e60d50c9d581/design.md) containing the brand tokens, design philosophies, and direct links to the high-fidelity Google Stitch prototype screens for all major pages:
1.  **Tenant & Admin Dashboard:** Features a 3D isometric property viewer.
2.  **Analytics Portal:** Dynamic occupancy ring charts and area trends.
3.  **Settings Page:** Multi-tenant access toggles and API credential fields.
4.  **User Profile:** Verified badge listings and message log timelines.

---

## 🛠️ Proposed Changes

We will install necessary visual libraries (`gsap`, `@studio-freight/lenis`, `three`, `@react-three/fiber`, `@react-three/drei`) and update the key frontend pages.

### Frontend Dependencies

#### [MODIFY] [package.json](file:///c:/Users/Admin/Desktop/mutune/frontend/package.json)
- Add/confirm dependencies: `gsap`, `lenis`, `three`, `@types/three`, `@react-three/fiber`, `@react-three/drei`, `posthog-js`.

---

### Core UI Framework & Storytelling

#### [NEW] [IntroLoader.jsx](file:///c:/Users/Admin/Desktop/mutune/frontend/src/components/IntroLoader.jsx)
- Build a cinematic preloader displaying a `0-100%` progress counter, SVG path logo animation, and royal purple double color wipe transition (under 2 seconds).

#### [NEW] [SmoothScroll.jsx](file:///c:/Users/Admin/Desktop/mutune/frontend/src/components/SmoothScroll.jsx)
- Wrap the app layout in **Lenis** smooth scroll and wire it to the global window scroll, syncing with GSAP's `ScrollTrigger.update`.

#### [MODIFY] [App.jsx](file:///c:/Users/Admin/Desktop/mutune/frontend/src/App.jsx)
- Mount the `IntroLoader` and wrap the primary router in `SmoothScroll`.
- Initialize `posthog-js` for tracking user clicks and running feature flag A/B tests.

---

### 3D Voxel Integration

#### [NEW] [VoxelProperty.jsx](file:///c:/Users/Admin/Desktop/mutune/frontend/src/components/VoxelProperty.jsx)
- Build an interactive 3D voxel card component using `@react-three/fiber` that renders a stylised 3D model of "Mutune Heights".
- Implement a responsive check: if the screen is mobile (`< 768px`), automatically disable the WebGL renderer and display a clean pre-rendered WebP rotation sequence to ensure zero lags or crashes.

#### [MODIFY] [TenantPortalPage.jsx](file:///c:/Users/Admin/Desktop/mutune/frontend/src/pages/TenantPortalPage.jsx)
- Integrate the `VoxelProperty` 3D widget directly into the main grid layout.
- Bind dashboard quick actions (check-in, rent payments, issues log) to Express API routes.

#### [MODIFY] [AnalyticsPage.jsx](file:///c:/Users/Admin/Desktop/mutune/frontend/src/pages/AnalyticsPage.jsx)
- Upgrade default charts to use high-contrast purple area trends and gold/orange occupancy gauges.
- Add an optimization panel recommending rent values.

---

## 🧪 Verification Plan

### Automated Tests
- Run linting: `npm run lint` inside the `frontend` directory.
- Verify Vite compilation: `npm run build` inside the `frontend` directory.

### Manual Verification
- Deploy to Vercel and test the cinematic load transition.
- Check 3D scene rendering on mobile (iOS/Android) to ensure the flat fallback runs at 60fps.
- Verify PostHog event logging in the developer toolbar.
