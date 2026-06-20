## 2026-06-20T20:38:47Z
You are a worker agent (teamwork_preview_worker) tasked with implementing Milestone 1: Theme System & Global Foundation (R1) of the MutuneRent Pro redesign.
Your working directory is: c:\Users\Admin\Desktop\mutune\.agents\worker_redesign_m1_1/
Your parent (orchestrator) conversation ID is: ff621fb9-bab6-4cf1-8cb1-1e99502dab8d

Please execute the following tasks:

1. Update `frontend/tailwind.config.js`:
   - Enable class-based dark mode: `darkMode: 'class'`.
   - Extend the theme with colors that use CSS variables (primary, background, foreground, success, surface, border, muted).
   - Map `brand` colors (50 to 950) to blue colors (--brand-50 to --brand-950) to support the blue theme direction.

2. Update `frontend/src/index.css`:
   - Define custom CSS properties in `:root` (for Light Mode) and `.dark` (for Dark Mode).
   - Light mode values: primary (#2563EB), background (#F8FAFC), foreground (#0F172A), surface (#FFFFFF), success (#16A34A), success-bg (#F0FDF4), border (#E2E8F0), muted (#64748B).
   - Dark mode values: primary (#3B82F6), background (#0F172A), foreground (#F8FAFC), surface (#1E293B), success (#22C55E), success-bg (#052E16), border (#334155), muted (#94A3B8).
   - Ensure the `.badge` CSS helper class uses `text-xs` (not `text-[11px]`).
   - Set up the body base styling to apply bg-background and text-foreground with transition class.

3. Create the theme store:
   - Create `frontend/src/store/themeStore.js` using Zustand. It should manage the active theme ('light' or 'dark') synced with localStorage ('mutunerent-theme') and updating document.documentElement class.

4. Prevent FOUC (flash of unstyled content) in `frontend/index.html`:
   - Add an inline `<script>` in the `<head>` to immediately read the saved theme preference from localStorage and apply the class.

5. Update `frontend/src/App.jsx`:
   - Integrate the Zustand theme store.
   - Adjust the outer layout wrapper to use dynamic theme classes: bg-background text-foreground, and header/navbar elements to use theme-specific background and borders (bg-surface border-border).
   - Add a nice Sun/Moon theme toggle button (using lucide-react Sun and Moon icons) inside the Settings dropdown or navbar header next to the profile menu.
   - Pass the theme dynamically to `<ToastContainer theme={theme} />`.
   - Systematically locate and replace all sub-12px font sizes (such as `text-[8px]`, `text-[9px]`, `text-[10px]`, `text-[11px]`) with `text-xs` (lines audited: 310, 347, 353, 408, 445, 542, 582, 590, 638, 691, 735, 736, 767, 769, 770, 773, 794).

6. Update `frontend/src/pages/AdminDashboardPage.jsx`:
   - Make all cards, panels, and borders theme-aware.
   - Systematically convert all sub-12px text sizes (`text-[10px]`, `text-[11px]`, etc.) to `text-xs`.
   - Update Recharts grid ticks to use `fontSize: 12` (such as CartesianGrid stroke based on theme state, XAxis/YAxis ticks).

7. Update `frontend/src/pages/TenantPortalPage.jsx`:
   - Remove the hardcoded `bg-slate-950` and `text-slate-100` page wrapper styles. Make it adapt dynamically to both Light and Dark themes.
   - Update cards, tables, inputs, badges, and modals to use dynamic variables (e.g. `bg-surface border-border`).
   - Systematically replace all sub-12px text sizes (e.g., `text-[9px]`, `text-[10px]`, `text-[11px]`) with `text-xs`.

8. Verification:
   - Navigate to `frontend/` and run `npm run build` to verify there are no compilation or typescript/lint errors.
   - Ensure the app is correctly running.
   - Write your implementation findings to `handoff.md` in your working directory and report back.
