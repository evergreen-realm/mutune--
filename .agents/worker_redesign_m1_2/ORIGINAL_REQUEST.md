## 2026-06-20T18:09:07Z

You are a worker agent (teamwork_preview_worker) tasked with completing the remaining fixes for Milestone 1: Theme System & Global Foundation (R1).
Your working directory is: c:\Users\Admin\Desktop\mutune\.agents\worker_redesign_m1_2/
Your parent (orchestrator) conversation ID is: ff621fb9-bab6-4cf1-8cb1-1e99502dab8d

Please execute the following fixes:

1. Globally eliminate all remaining font size violations (< 12px) in the frontend codebase.
   Locate and replace all instances of text sizes smaller than text-xs (such as text-[8px], text-[9px], text-[10px], text-[11px]) with text-xs (12px) in at least the following files:
   - `frontend/src/components/AdminPasswordGuard.jsx` (e.g., lines 64, 104)
   - `frontend/src/components/ChatAssistant.jsx` (e.g., line 90)
   - `frontend/src/components/CheckInButton.jsx` (e.g., line 79)
   - `frontend/src/components/ImageUpload.jsx` (e.g., lines 101, 210)
   - `frontend/src/components/MapWidget.jsx` (e.g., line 189)
   - `frontend/src/components/ui/Badge.jsx` (e.g., lines 36, 37 - make sure sm is text-xs px-2 py-0.5 and md is text-xs px-2.5 py-1)
   - `frontend/src/components/ui/Card.jsx` (e.g., line 148)
   - `frontend/src/pages/DashboardPage.jsx` (e.g., line 163)
   - `frontend/src/pages/MaintenancePage.jsx` (e.g., line 370)
   - `frontend/src/pages/NoticesPage.jsx` (e.g., lines 518, 637)
   - `frontend/src/pages/OnboardingPage.jsx` (e.g., line 275)
   - `frontend/src/pages/PaymentsPage.jsx` (e.g., line 150)
   - `frontend/src/pages/PropertiesPage.jsx` (e.g., line 281)
   - `frontend/src/pages/PropertyDetailPage.jsx` (e.g., line 193)
   - `frontend/src/pages/TenantsPage.jsx` (e.g., lines 388, 629)

2. Fix the accessibility (a11y) issues identified by the Auditor:
   - In `frontend/src/pages/TenantPortalPage.jsx` (around lines 1167-1196), link the form control labels to their inputs by adding matching `htmlFor` and `id` properties.
   - In `frontend/src/App.jsx` (around line 629), add an `aria-label="Toggle Navigation Menu"` to the mobile menu hamburger button.
   - In `frontend/src/pages/TenantPortalPage.jsx` (around lines 541, 1046, 1102, 1157), add `aria-label="Close dialog"` or similar accessible descriptions to the icon-only 'X' buttons.
   - In `frontend/src/pages/AdminDashboardPage.jsx` (around lines 421, 431, 441), the clickable card divs for pending agents, landlords, and listings must have `tabIndex={0}`, `role="button"`, and a keydown event handler (supporting Enter and Space keys) to allow keyboard navigation and interaction.

3. Hardening the Zustand theme store (`frontend/src/store/themeStore.ts`):
   - Wrap any direct document, window, or localStorage accesses inside `typeof window !== 'undefined'` checks to ensure SSR safety and robustness.

4. Verification:
   - Run `npm run build` in the `frontend/` directory to verify that the app compiles successfully with zero warnings/errors.
   - Write your implementation details to `handoff.md` and report back.

MANDATORY INTEGRITY WARNING:
> DO NOT CHEAT. All implementations must be genuine. DO NOT
> hardcode test results, create dummy/facade implementations, or
> circumvent the intended task. A Forensic Auditor will independently
> verify your work. Integrity violations WILL be detected and your
> work WILL be rejected.
