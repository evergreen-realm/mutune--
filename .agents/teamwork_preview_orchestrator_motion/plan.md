# Plan: MutuneRent Pro 3D and Motion Upgrade

This plan breaks down the premium 3D and motion upgrade project into 6 sequential milestones, following the Project Pattern guidelines.

## Milestones

### Milestone 1: Exploration & Codebase Audit
- **Goal**: Analyze the current repository structure, existing 3D/motion support, theme setup, stubs/TODOs, and backend test suites.
- **Verification**: Exploration reports from Explorer subagents.

### Milestone 2: Preloader, Global Smooth Scroll & GSAP Animations
- **Goal**: Implement:
  - Cinematic intro preloader (0-100% counter + SVG logo drawing + royal purple double panel wipe) capped at 2 seconds.
  - Lenis smooth scroll globally.
  - GSAP ScrollTrigger for stagger reveals of all property cards.
- **Verification**: Reviewer verification of smooth scroll and preloader visuals.

### Milestone 3: 3D Scene Elements & Mobile Canvas Fallback
- **Goal**: Implement:
  - Real-time 3D voxel property model in the hero section and property details page using Three.js/React-Three-Fiber.
  - Optimized canvas-based scroll-zoom image sequence fallback for mobile devices (<768px).
- **Verification**: Challenger and Reviewer verification of 3D rendering and mobile fallback.

### Milestone 4: Dual-Theme Support & OKLCH Palette
- **Goal**: Implement:
  - Global Light & Dark mode toggle.
  - Apply strict OKLCH color palette (royal lavender primary, sunset gold secondary, deep navy slate/pure white surfaces) with WCAG contrast ratios across all pages, views, modals, and charts.
- **Verification**: Reviewer verification of themes and contrast.

### Milestone 5: Role & Page Integration and Quick Actions
- **Goal**: Implement:
  - Complete backend integration for all quick actions (inspections, check-ins, lease agreements, analytics export, settings toggles) across all portals (Tenant, Landlord, Admin, Agent, Guest).
  - Complete all backend routes (no stubs or placeholders in API).
- **Verification**: Worker tests, Reviewer and Challenger verification of backend integrations.

### Milestone 6: Verification, Hardening & Audit
- **Goal**: Ensure:
  - Zero TODOs, FIXMEs, stubs, or placeholders remain.
  - Backend Jest tests pass perfectly.
  - Frontend builds and lints perfectly.
  - Forensic Auditor integrity checks pass.
- **Verification**: Forensic Auditor verdict is CLEAN. E2E tests and builds pass.
