# Synthesis: Milestone 1 Codebase Audit and Action Plan

## Consensus

### 1. Frontend 3D & Motion Upgrade
- **Dependencies**: `@react-three/fiber`, `@react-three/drei`, and `three` are installed. However, `gsap` and `lenis` are missing and must be installed.
- **Scroll Container**: The dashboard uses a fixed-height layout (`h-screen overflow-hidden`) with a scrollable container `<main className="flex-1 overflow-y-auto p-6">` inside `layouts/AppShell.tsx`. Lenis must be initialized targeting this element as the scroll `wrapper`.
- **Preloader & Page Transitions**:
  - The cinematic 0-100% preloader should be implemented in `App.jsx` using GSAP or Framer Motion and capped at 2s.
  - A purple double-panel wipe should trigger on route changes.
- **Mobile Fallback**: No scroll-zoom assets exist. A high-performance fallback player should draw pre-rendered WebP rotation frames (60 frames) onto a 2D `<canvas>` controlled by GSAP ScrollTrigger when screens are < 768px.
- **Theme Color Scheme**:
  - Tailwind's default primary color must be updated to blue (`#2563EB`) to follow the UI redesign guidelines.
  - Inline `<style>` elements containing `@keyframes spin` in dashboard pages should be removed in favor of Tailwind's `animate-spin` utility.
  - Font sizes < 12px (some as small as 9px/10px in `TenantPortalPage.jsx` and `PropertyDetailPage.jsx`) violate WCAG guidelines and must be upgraded to a minimum of 12px.

### 2. Styling, Color System & Dual-Theme (OKLCH)
- **Palette**: We must replace HEX variables in `frontend/src/index.css` with a strict OKLCH system:
  - Primary (Royal Lavender): `oklch(0.52 0.18 295)` (Light) / `oklch(0.72 0.14 295)` (Dark)
  - Secondary (Sunset Gold): `oklch(0.42 0.13 75)` / `oklch(0.78 0.15 75)`
  - Surface/Background/Muted variables aligned for high contrast (WCAG AAA readability).
- **Charts & Tables**:
  - Recharts instances in `DashboardPage.jsx` and `AdminDashboardPage.jsx` have hardcoded colors (e.g. stroke, fill, tooltips) that clash in dark mode. They must use dynamic variables responsive to the Zustand `themeStore`.
  - DataTable/UI kits must use Tailwind `dark:` classes and semantic tokens instead of hardcoded white backgrounds and green borders.
  - `RoleIdVerification.jsx` is statically styled dark and must be updated to adjust dynamically based on theme.
  - Correct invalid Tailwind classes like `placeholder-slate-505` and `border-gray-250` in `MapWidget.jsx`.

### 3. Backend & Express Routing
- **Status**: The backend uses genuine Mongoose database calls (no stubs, TODOs, or static memory mockups).
- **Gaps to Address**:
  - **Inspections**: Currently represented only as a generic Task. We need a dedicated `Inspection` model and routes (`/api/v1/inspections`) to capture checklist items, damage notes, and photo URLs.
  - **Check-ins**: The agent location updates overwrite the User model. We must implement a `CheckInLog` model to persist history.
  - **Leases**: Add PDF generation (`generateLeasePDF` in `services/pdf.js` via `pdfkit`) and endpoints for digital signature submission (`/api/v1/tenants/my/lease/sign`).
  - **Reports Role Gating**: Landlords have `view:reports` permissions but are blocked from reports endpoints by role checks. Refactor routes to use RBAC permissions and filter results by owned properties.
  - **Settings**: Integrate a general settings configuration schema to allow admins to toggle fees and services globally.

---

## Resolved Conflicts
- No conflicts were identified. The three exploration tracks (Frontend, Theme/OKLCH, Backend) are fully complementary.

---

## Dissenting Views
- None.

---

## Gaps
- **3D voxel assets**: No 3D model sequence frames exist. The implementation worker must configure/generate the WebP frames for mobile rendering.

---

## Detailed Action Plan

### Milestone 2: Preloader, Global Smooth Scroll & GSAP Animations
1. Install `gsap` and `lenis`.
2. Configure Lenis smooth scroll wrapping `<main>` in `AppShell.tsx`.
3. Set up GSAP ScrollTrigger to sync with Lenis.
4. Implement GSAP stagger reveals for property cards in `PropertiesPage.jsx`.
5. Implement cinematic 0-100% preloader in `App.jsx` (2s limit).
6. Implement purple double panel wipe for page transitions in `App.jsx`.

### Milestone 3: 3D Voxel Graphic & Mobile Fallback
1. Integrate R3F voxel rendering in Hero section (`TenantPortalPage.jsx` and property detail page).
2. Create mobile fallback canvas sequence component (`VoxelMobilePlayer.jsx`) with 60 WebP preloaded frames.
3. Configure responsive toggling (Three.js WebGL on desktop, 2D Canvas sequence on mobile).

### Milestone 4: Dual-Theme & OKLCH Theme
1. Replace HEX variables in `frontend/src/index.css` with the strict OKLCH variables.
2. Upgrade UI kit classes (Buttons, Cards, Modals, Tables, Forms) with `dark:` variants.
3. Integrate theme variables in Recharts (Dashboard, Admin portal).
4. Update `RoleIdVerification.jsx` layout colors to be theme-adaptive.
5. Upgrade all small typography below `12px` to `>=12px`.
6. Fix invalid class names in `MapWidget.jsx`.
7. Remove inline `<style>` keyframe spin injections.

### Milestone 5: Role Integration & Complete Backend Routing
1. Create `Inspection` model and `/api/v1/inspections` routes.
2. Create `CheckInLog` model and save agent check-ins on every request.
3. Add PDF generation helper for leases (`generateLeasePDF`) and add `/api/v1/tenants/my/lease/sign` route.
4. Refactor reports gating in `backend/routes/reports.js` to allow landlords based on RBAC permissions and owned property checks.
5. Implement Admin global system settings endpoint.
6. Verify and connect all actions, buttons, and toggles on the frontend to these backend routes.

### Milestone 6: Hardening & Final Verification
1. Verify 100% test completion: `npm test` in backend.
2. Verify frontend compilation: `npm run build` and `npm run lint`.
3. Run Forensic Auditor validation.
