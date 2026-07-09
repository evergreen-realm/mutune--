# Project: MutuneRent Pro 3D and Motion Upgrade

## Architecture
- **Frontend**: React + Vite + TailwindCSS. Powered by Three.js/React-Three-Fiber for 3D, Lenis for smooth scroll, GSAP ScrollTrigger for scroll animations.
- **Backend**: Express + MongoDB. API routes for all portals and operations.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Exploration & Codebase Audit | Investigate the codebase, current dependencies, and tests. | None | DONE |
| 2 | Motion Upgrades | Implement cinematic loader, Lenis smooth scroll, and GSAP card animations. | M1 | PLANNED |
| 3 | 3D Graphics & Fallback | Real-time 3D voxel property model and mobile WebP image sequence fallback. | M2 | PLANNED |
| 4 | Dual-Theme & OKLCH Theme | Apply light/dark theme toggle and OKLCH color palette. | M3 | PLANNED |
| 5 | Role Integration & Routes | Verify all portals and ensure all forms, actions, and routes are fully integrated with backend. | M4 | PLANNED |
| 6 | Verification, Hardening & Audit | Run all Jest tests, build, lint, and run the Forensic Auditor. | M5 | PLANNED |

## Interface Contracts
### 3D Voxel Graphic Hero Section
- Dynamic Three.js canvas in `Hero` component.
- Smooth WebP sequence mobile fallback if width < 768px.

### Theme & Palette
- Light and Dark modes.
- Cohesive OKLCH colors: royal lavender primary, sunset gold secondary, deep navy slate/pure white surfaces.

### Express Backend Integration
- Quick action endpoints: Inspections, Check-ins, Lease Agreements, Analytics Export, Settings.
- Zero mockups/TODOs.
