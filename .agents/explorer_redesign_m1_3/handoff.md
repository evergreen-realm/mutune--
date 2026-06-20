# Handoff Report — Theme System & Global Foundation (Milestone 1)

This report details observations, logical deductions, caveats, conclusions, and verification methods for implementing R1 (Theme System & Global Foundation) and verifying the font size baseline.

---

## 1. Observation
The following observations were made after inspecting the codebase:

* **Tailwind Configuration (`frontend/tailwind.config.js`)**:
  * Currently does not specify `darkMode` (meaning it defaults to system media query media-mode).
  * Defines a custom green-based `brand` color scheme (lines 8-20) instead of a variable-based scheme.
* **Index Stylesheet (`frontend/src/index.css`)**:
  * Line 17 defines body style: `body { @apply bg-gray-50 text-gray-900 antialiased; min-height: 100dvh; }`.
  * Line 83 contains the `.badge` component with a sub-12px font size: `text-[11px]`.
* **Application Shell (`frontend/src/App.jsx`)**:
  * Has no theme state, toggle logic, or theme context.
  * Uses hardcoded backgrounds (e.g. line 600: `bg-gray-50/50`, line 626: `bg-white border-b border-gray-100`).
* **Admin Dashboard Page (`frontend/src/pages/AdminDashboardPage.jsx`)**:
  * Contains multiple hardcoded text colors and container backgrounds (e.g. `bg-white`, `border-slate-100`, `text-slate-800`).
  * Recharts visual component layouts are statically styled.
* **Tenant Portal Page (`frontend/src/pages/TenantPortalPage.jsx`)**:
  * Uses static dark mode styles (`bg-slate-950`, `text-slate-100`) as a full-page wrapper despite being nested in `AppShell` main container layout (which uses light gray `bg-gray-50/50` backgrounds).
  * Uses sub-12px custom fonts in buttons, badge indicators, table headers, and form inputs (e.g. `text-[9px]`, `text-[10px]`, `text-[11px]`).
* **Package Configuration (`frontend/package.json`)**:
  * Uses `tailwindcss` version `^3.4.4`.
  * Test script is set to `"test": "vitest run"`.

---

## 2. Logic Chain
1. To enable global manual theme switching (light/dark) using document classes, the Tailwind configuration must define `darkMode: 'class'`.
2. To allow dynamic theme adjustments without rebuilding styles, tailwind colors must be mapped to CSS custom variables (e.g., `var(--color-background)`) defined in `index.css`.
3. To prevent theme flicker (FOUC) when loading the SPA, a small, synchronous inline script must be placed in `index.html`'s `<head>` to resolve the stored theme from `localStorage` immediately.
4. Because the app already uses Zustand for state management (`frontend/src/store/authStore.js`), creating a theme store in Zustand (`store/themeStore.js`) is the most architecturally consistent state solution.
5. In order for the Tenant Portal (`TenantPortalPage.jsx`) to respect the active theme, we must remove its hardcoded `bg-slate-950` wrapper, change card structures to use semantic classes, and soften background decorative mesh gradients in light mode.
6. Over 100 instances of font sizes below `12px` (like `text-[10px]` and `text-[9px]`) were found in the codebase. Satisfying the baseline constraint requires upgrading these classes to `text-xs` (12px).

---

## 3. Caveats
* **Leaflet Maps**: Custom popups and markers are styled via Leaflet-specific stylesheet classes in `index.css` (lines 90-95). These may require dark-mode overrides if the map components do not auto-style.
* **Clerk Auth Styling**: The `<ClerkProvider>` configuration inside `App.jsx` handles authentication pages (`LoginPage`, `SignUpPage`). Its internal theme styling will need to be configured using Clerk appearances to sync with dark mode.

---

## 4. Conclusion
* Implementing R1 requires enabling `darkMode: 'class'` in tailwind.config.js, defining theme CSS variables in index.css, establishing a Zustand store, adding inline flash-prevention script to index.html, and updating standard layout container classes in `App.jsx`, `AdminDashboardPage.jsx`, and `TenantPortalPage.jsx`.
* The audited sub-12px fonts in `index.css`, `App.jsx`, `AdminDashboardPage.jsx`, and `TenantPortalPage.jsx` must be upgraded to `text-xs` to satisfy the design system's baseline font constraint.

---

## 5. Verification Method
* **Build Verification**: Run `npm run build` inside `frontend/` to confirm that tailwind compilation succeeds with the new configuration.
* **Component Verification**: Check that toggle buttons correctly trigger `document.documentElement.classList.toggle('dark')` and update `localStorage` key `'mutunerent-theme'`.
* **Visual Audit**: Toggle between themes and confirm that all backgrounds transition between `#F8FAFC` and `#0F172A`, text sizes are at least `12px` (`text-xs`), and colors reflect the brand blue (#2563EB) and success green (#16A34A).
