# Changelog

All notable changes to MutuneRent Pro will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] — 2026-08-17

### Added

#### Backend — 29 API Route Modules
- **Payments** (`/api/v1/payments`) — M-Pesa STK Push, C2B callbacks, IP whitelist, transaction reversal, double-entry GL journal posting
- **Properties** (`/api/v1/properties`) — CRUD with Mapbox geocoding, unit management, 3D model triggers, plus-code generation
- **Tenants** (`/api/v1/tenants`) — Onboarding, lease management, termination, linking, profile sync
- **Users** (`/api/v1/users`) — Clerk-synced user management, role assignment, approval workflows
- **Agents** (`/api/v1/agents`) — Geo-tracked check-in/check-out, performance metrics, property scoping
- **Admin** (`/api/v1/admin`) — Super admin dashboard, KPI analytics, user/property approval
- **Maintenance** (`/api/v1/maintenance`) — Ticket lifecycle, photo uploads, agent assignment, tenant review
- **Reports** (`/api/v1/reports`) — Financial reports, KRA CSV export, occupancy analytics
- **Notices** (`/api/v1/notices`) — Digital rent/eviction notices with PDF generation and SMS/email delivery
- **AI** (`/api/v1/ai`) — Kimi AI-powered chat assistant with role-based context
- **Tasks** (`/api/v1/tasks`) — Agent task tracking and assignment
- **Inventory** (`/api/v1/inventory`) — Distressed inventory management, auction gating, reclaim with receipt
- **Notifications** (`/api/v1/notifications`) — In-app notification feed with read/unread tracking
- **Upload** (`/api/v1/upload`) — Cloudflare R2 file uploads with Sharp image optimization
- **Scans** (`/api/v1/scans`) — 3D room scanning pipeline with Gaussian splatting
- **Settings** (`/api/v1/settings`) — Financial settings, chart of accounts, trial balance, MEWASCO tariff configuration
- **Commission** (`/api/v1/commission`) — Agent salary and commission payroll engine
- **Disbursement** (`/api/v1/disbursement`) — Priority bulk B2C disbursement via Daraja
- **Paperwork** (`/api/v1/paperwork`) — Multi-role PDF generation (leases, receipts, statements)
- **Tax** (`/api/v1/tax`) — KRA eTIMS electronic invoice transmission
- **Vacation** (`/api/v1/vacation`) — Tenant move-out damage inspection survey engine
- **Exchange** (`/api/v1/exchange`) — CBK live USD/KES exchange rate
- **Audit** (`/api/v1/audit`) — Immutable audit log with compliance trail
- **Utilities** (`/api/v1/utilities`) — Multi-provider water/electricity submetering (MEWASCO, KPLC, Kyanda)
- **Scoring** (`/api/v1/scoring`) — Tenant financial health scoring engine
- **Vendors** (`/api/v1/vendors`) — Vendor management with B2C payout integration
- **Bank Payments** (`/api/v1/bank-payments`) — Multi-bank checkout aggregator (IntaSend)
- **USSD** (`/api/v1/ussd`) — Africa's Talking USSD gateway handler
- **Listings** (`/api/v1/listings`) — Public property listings with inquiry system

#### External Integrations
- Safaricom M-Pesa Daraja API (STK Push + C2B + B2C Bulk Disbursement + Reversals)
- Africa's Talking (SMS notifications + USSD gateway)
- KRA eTIMS (electronic tax invoice transmission)
- Kyanda (KPLC prepaid token vending + postpaid bill query + water meter validation)
- Cloudflare R2 (S3-compatible object storage for images, PDFs, 3D assets)
- Clerk (authentication, role management, webhook sync)
- Resend (transactional email delivery)
- Kimi / Moonshot AI (context-aware chat assistant)
- Mapbox GL (interactive maps with 3D building extrusions)
- Sentry (error tracking and performance monitoring)
- PostHog (product analytics)

#### Frontend
- React 18 SPA with Vite 5, code-split via React.lazy
- 15+ role-specific pages (Admin, Landlord, Agent, Tenant, Caretaker)
- Mapbox GL + Esri satellite toggle with Three.js 3D building integration
- Three.js / React Three Fiber 3D property viewers
- Gaussian Splat (.splat) room viewer
- Recharts analytics dashboards
- Zustand + TanStack React Query state management
- Dark/Light theme with Zustand persistence
- Clerk-based authentication with role verification gates
- Cinematic preloader with GSAP animations
- Responsive mobile-first design

#### Infrastructure
- CI pipeline (GitHub Actions): lint + test + build + npm audit
- CD pipeline: auto-deploy to Render (backend) + Vercel (frontend) on push to main
- render.yaml Blueprint with 40+ environment variable declarations
- MongoDB Atlas with compound indexes for performance
- Cloudflare R2 dual-bucket setup (images + pipeline assets)

#### Testing
- 14 backend test suites (166 tests) — Jest + Supertest + mongodb-memory-server
- 7 frontend test suites (17 tests) — Vitest
- Playwright E2E specs with mocked Clerk auth (5 specs)
- k6 load testing configurations (payments + properties)

#### Documentation
- Comprehensive README with architecture diagram
- SETUP_INSTRUCTIONS.md (manual configuration checklist)
- DEPLOYMENT.md (step-by-step deploy guide)
- API_KEY_ROTATION.md (credential rotation procedures)
- OpenAPI / Swagger interactive docs at /api/docs
- Privacy Policy page (Kenya DPA 2019 draft template)
