# Project Plan: MutuneRent Pro Frontend Redesign

## Overview
MutuneRent Pro's frontend requires a complete visual and structural redesign. We are shifting from the current legacy UI to a professional blue-themed, Swiss-inspired Editorial layout with Bento Grid dashboards, smooth Framer Motion animations, collapsible navigation layouts, and strict compliance with a11y (WCAG 2.1 AA) and security (OWASP) guidelines.

---

## Architecture & Code Layout
- **Theme & CSS Foundation**: `frontend/tailwind.config.js` and `frontend/src/index.css`.
- **Global Layout & Navigation**: 
  - `frontend/src/layouts/AppShell.jsx` - Main shell wrapper.
  - `frontend/src/layouts/Sidebar.jsx` - Collapsible navigation sidebar.
  - `frontend/src/layouts/Topbar.jsx` - Top layout header.
- **Premium Dashboards**:
  - `frontend/src/pages/AdminDashboardPage.jsx` - Bento Grid KPI dashboard with Recharts.
  - `frontend/src/pages/TenantPortalPage.jsx` - Redesigned tenant portal with Dark/Light support and AI chat drawer.
  - `frontend/src/pages/OnboardingPage.jsx` - Step-by-step registration wizard.
- **Operations & Registries**:
  - `frontend/src/pages/PropertiesPage.jsx` & `PropertyDetailPage.jsx` - Properties grid and tabbed details.
  - `frontend/src/pages/TenantsPage.jsx` - Sortable/filterable table and CSV export.
  - `frontend/src/pages/PaymentsPage.jsx` - Reconciliation status & payments dashboard.
  - `frontend/src/pages/MaintenancePage.jsx` - Kanban board.
  - `frontend/src/pages/NoticesPage.jsx` - Notice creation and distribution hub.

---

## Milestone Decomposition

### Milestone 1: Theme System & Global Foundation (R1)
- **Goal**: Implement global light/dark mode and color variables.
- **Scope**:
  - Update `tailwind.config.js` and `index.css` with colors (primary blue `#2563EB`, background `#F8FAFC` light, `#0F172A` dark, success states green).
  - Implement a theme toggle context syncing with `localStorage` (`mutunerent-theme`) and updating `document.documentElement` class.
  - Ensure all text elements are at least `text-xs` (12px) for accessibility.
- **Verification**: Verify toggle switches instant styles on all dashboards; verify no text elements < 12px.

### Milestone 2: AppShell Layout & Navigation Transitions (R2)
- **Goal**: Decompose `App.jsx` layout into shell components and add page transitions.
- **Scope**:
  - Create `frontend/src/layouts/AppShell.jsx` to wrap application pages.
  - Create `frontend/src/layouts/Sidebar.jsx` (collapsible 240px to 72px width, active item 4px border).
  - Create `frontend/src/layouts/Topbar.jsx` (hamburger, breadcrumbs, search, settings, notifications).
  - Add page navigation animations with `framer-motion` page transition wrapper.
- **Verification**: Smooth transition check, layout spacing verification.

### Milestone 3: Premium Dashboards Redesign (R3)
- **Goal**: Implement Bento Grid Admin dashboard, Tenant portal (with AI chat), and Onboarding wizard.
- **Scope**:
  - Redesign `AdminDashboardPage.jsx` into multi-panel bento grid with KPIs, Recharts trend area, and occupancy bar charts.
  - Rebuild `TenantPortalPage.jsx` to match theme, featuring lease summaries, maintenance kanban panels, and floating Framer Motion AI chat widget.
  - Redesign `OnboardingPage.jsx` as animated step-by-step wizard (Role -> Profile -> Verification -> Confetti).
- **Verification**: Check real data queries (no mock data/stubs), test onboarding integration with Clerk.

### Milestone 4: Operations & Registry Pages Redesign (R4)
- **Goal**: Redesign all property, tenant, payment, maintenance, and notices management interfaces.
- **Scope**:
  - Properties & Details: Responsive grid, price badges, unit indicators, and tabbed Detail page.
  - Tenants Registry: Sortable data table with actions (Details, Edit, Evict) and CSV export.
  - Payments: M-Pesa match badges, revenue stats, STK actions, and CSV exporter.
  - Maintenance Board: Kanban board (Open -> In Progress -> Resolved -> Closed) with log modals.
  - Notices Hub: Redesigned compose drawer, bulk templates, unit/property selectors.
- **Verification**: Functional CRUD operations, CSV exports, dynamic payment reconciliation badge colors.

### Milestone 5: Global a11y, Security & Norman UX Verification (R5)
- **Goal**: Run comprehensive audit on keyboard nav, contrast, security route guards, loading/feedback states, and build compilation.
- **Scope**:
  - Keyboard navigation (focus rings, tab Indexing).
  - Sentry and Clerk auth token checks.
  - Norman UX feedback check (skeleton screens, undo alerts, CTAs).
  - Run frontend compilation build (`npm run build`) to ensure zero errors.
- **Verification**: Production build succeeds; tests pass.

---

## Verification & Gating Criteria
1. Subagent runs builds and checks.
2. Reviewers independently check code layout, user flow, and design specifications.
3. Forensic Auditor checks for authentic code implementations (no hardcoding, no cheating).
4. Success criteria met before milestone closure.
