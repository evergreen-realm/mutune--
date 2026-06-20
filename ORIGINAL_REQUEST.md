# Original User Request

## Initial Request — 2026-06-20T20:35:10+03:00

Redesign the **MutuneRent Pro** property management platform frontend using a professional blue-themed, light/dark unified design system with Framer Motion animations, a collapsible sidebar layout, custom primitives, and strict adherence to a11y (WCAG 2.1 AA) and security (OWASP) guidelines.

Working directory: `c:\Users\Admin\Desktop\mutune`
Integrity mode: development

---

## 1. Selected Design Style (Huashu Design Selection)

Based on the Huashu Design skill's `design-styles.md` style repository, the following directions were analyzed:
1. **Glassmorphism Bento**: Excellent card/widget visualization but can become visually cluttered.
2. **Swiss Monochrome / Swiss Editorial** (adapted to a professional blue accent): High readability, crisp grid alignment, high accessibility, and clean minimalism.
3. **Angled Fluid Gradient**: Dynamic modern marketing hero transitions, great for public landing/auth pages.

**Selected Direction:** **Swiss-inspired Editorial layout with a professional blue accent (#2563EB) and Bento Grid dashboards.** This provides high information density, structural grid-based borders, strong typography contrast (Inter), and clean minimalism suitable for property management, accented by smooth Framer Motion card lifts and layout animations.

---

## 2. Requirements

### R1. Theme System & Global Foundation
- Implement a global light/dark theme toggle system syncing with `localStorage` (`mutunerent-theme`) and updating the HTML document class.
- **Unified Behavior**: All dashboards—including both the Admin/Landlord/Agent dashboard and the Tenant Portal dashboard—must support full Dark and Light modes (Theme Toggle works everywhere).
- Update Tailwind CSS configurations and `index.css` to use color variables (primary blue `#2563EB`, background `#F8FAFC` for light, `#0F172A` for dark, etc.).
- Enforce accessibility font size baseline: no text size below `text-xs` (12px) anywhere in the application.

### R2. Global Layout & AppShell Decomposition
- Decompose the current 900+ line `App.jsx` by extracting layout concerns into standalone shell components under a new `layouts/` directory:
  - `AppShell.jsx` (main layout wrapper)
  - `Sidebar.jsx` (collapsible, 240px wide to 72px icon-only, with a 4px active border indicator)
  - `Topbar.jsx` (hamburger, breadcrumbs, search bar, settings, theme toggle, and notification bell)
- Add a smooth Framer Motion page-level transition wrapper for page navigation.

### R3. Premium Dashboard Redesigns (Real Data Only)
- **Admin Dashboard**: Multi-panel bento layout (inspired by Buildium) with KPI cards, Recharts visualizations (area trend, occupancy bars), task feeds, and quick actions.
- **Tenant Portal**: Rebuild to adapt to the unified theme variables, supporting both clean Light mode and sleek Dark mode. Features lease summaries, maintenance kanban panels, and an interactive AI Chat widget (floating drawer with Framer Motion lists).
- **Onboarding Page**: Rebuild as an animated step-by-step wizard (Role selection -> Profile details -> Verification upload -> Confirmation confetti).

### R4. Core Operations & Registry Pages
- **Properties & Details**: Responsive grid/list views with property cards (images, area badges, units, occupancy bars) and a clean tabbed Detail page (Overview, Units, Tenants, Payments).
- **Tenants Registry**: Data table with sorting/filtering, inline actions (Details, Edit, Evict with reasons/dates), and CSV exporter.
- **Payments Management**: Reconciled status indicators (matched/unmatched M-Pesa badges), revenue stats, export utilities, and manual STK push/void actions.
- **Maintenance Board**: Kanban board (Open -> In Progress -> Resolved -> Closed) with detailed log, update, and cancel modals.
- **Notices Hub**: Redesigned Compose drawer, automatic tenant resolvers (from property/unit selects), and multi-scope bulk templates.

### R5. a11y, Security & Norman's UX Principles
- **a11y**: Enforce keyboard navigation, clear focus rings, screen reader labels, and contrast compliance.
- **Security**: Preserve Clerk auth token injections, role route guards, and input sanitization to prevent XSS.
- **Norman's Principles**: Ensure clear system feedback (loading spinners, skeleton shimmers), validation state constraints, consistent CTA colors, and undo indicators for actions.

---

## 3. Acceptance Criteria

### Visual & Typography
- [ ] Primary brand colors are blue (`#2563EB`), green is strictly restricted to success states (paid, active).
- [ ] Dark/Light mode toggle successfully switches all dashboard views instantly without page reloads.
- [ ] No text element in the application is smaller than `text-xs` (12px).
- [ ] Sidebars transition smoothly between collapsed and expanded states on click.

### Functional Integration
- [ ] Local production compile `npm run build` in `frontend/` succeeds with zero errors.
- [ ] Every dashboard integrates with real backend endpoints via `@tanstack/react-query` without mock data or stubs.
- [ ] Tenant onboarding and profile verification successfully link Clerk IDs with MongoDB records.
- [ ] Recharts widgets render correctly with dynamic tooltips and color gradients matching the active theme.

## Follow-up — 2026-06-20T20:43:52+03:00

Please direct the orchestrator and developers to use TypeScript for the UI improvements and component refactorings where appropriate.
