# MutuneRent Pro — Complete Requirements Document

> **Source:** Full conversation transcript mining across all sessions (July 2026)
> **Method:** Every `USER_INPUT` entry in `transcript.jsonl` was scanned and cross-referenced

---

## 1. Page-by-Page Requirements

### 1.1 Landing Page (`/`)

| ID | Requirement | Status | Source |
|----|-------------|--------|--------|
| LP-01 | Cinematic 3D animated website — NOT a standard marketing page | ✅ Built (v2) | User: "build a premium 3d animated website" |
| LP-02 | Pin-scroll scenes — every section is a full-viewport scene that pins and animates within the frame | ✅ Built (v2) | User: "more of like a 3d movie showcasing" |
| LP-03 | Camera arrival effect on hero (scale + blur → focus) | ✅ Built | User: "camera movements, scroll-driven storytelling" |
| LP-04 | Word-by-word text reveals with 3D rotateX | ✅ Built | User: "interactive scenes, camera movements" |
| LP-05 | Horizontal panel scroll for features (scroll DOWN → panels move LEFT) | ✅ Built | Implementation plan |
| LP-06 | Scroll-driven role switching (Landlord/Tenant/Agent/Admin) | ✅ Built | User: "reflect actual role specific flows" |
| LP-07 | Ambient particle system (Canvas 2D, not Three.js) | ✅ Built | User: "particle systems" |
| LP-08 | Cursor-reactive parallax tilt (desktop only) | ✅ Built | User: "depth transitions" |
| LP-09 | Support light/dark mode toggle | ✅ Built | User: "first use google fonts and support both light and dark toggle" |
| LP-10 | Google Fonts: Outfit, Plus Jakarta Sans, JetBrains Mono | ✅ Built | User: "first use google fonts" |
| LP-11 | Glassmorphism ONLY where it earns its place | ✅ Partial | User: "glassmorphism only where it earns its place" |
| LP-12 | Testimonials section = zero trace for now | ✅ Reserved | User: "testimonials section should be zero trace" |
| LP-13 | Use realistic images instead of actual 3D models for scenes | ✅ Built | User: "use realistic images instead of the actual 3d models" |
| LP-14 | Admin photo must show "Mutune General Estate Agency" | ✅ Generated | User: "generate the admin photo with the company name" |
| LP-15 | Product demo should be screenshot of the app | ⚠️ Uses VoxelBuildingMini3D instead | User: "product demo should be screenshot of the app" |
| LP-16 | CTA redirects: new user → `/sign-up`, existing → `/login` | ✅ Built | User: "landing page that leads to sign in" |
| LP-17 | Every animation must serve the story. Zero decoration for its own sake | ✅ Principle applied | User: "every effect must serve the story" |
| LP-18 | `prefers-reduced-motion` respected | ✅ Built | Implementation plan |
| LP-19 | 3D disabled on mobile (<768px) | ✅ Built | Performance constraint |
| LP-20 | SEO: proper title, meta description, structured data JSON-LD | ✅ Built | Implementation plan |

### 1.2 Onboarding Page (`/onboarding`)

| ID | Requirement | Status | Source |
|----|-------------|--------|--------|
| OB-01 | Gmail auto-detection: query `GET /api/v1/tenants/check-email` on mount | ⚠️ Needs verification | Transcript |
| OB-02 | If pre-registered tenant matches email, bypass role selector → tenant-confirm step | ⚠️ Needs verification | Transcript |
| OB-03 | Pre-fill tenant code (locked/green), show phone input | ⚠️ Needs verification | Transcript |
| OB-04 | ClerkProvider `afterSignUpUrl="/onboarding"` | ✅ Set in App.jsx | Built in session |
| OB-05 | Anti-glitch 2.5s stabilization buffer | ⚠️ Exists but is a bandaid | Known tech debt |

### 1.3 Dashboard (`/dashboard`)

| ID | Requirement | Status | Source |
|----|-------------|--------|--------|
| DB-01 | Role-specific KPIs: analytics rings, occupancy, financial summaries | ⚠️ Basic implementation | Transcript |
| DB-02 | Quick action bar: inspections, check-ins, lease, analytics, settings | ⚠️ Needs verification | Transcript |
| DB-03 | Map widget with RTE 3D rendering | ⚠️ Broken architecture (3 overlapping techniques) | AUDIT_REPORT §2 |
| DB-04 | Real-time notification bell (poll /notifications every 30s) | ⚠️ Needs verification | Transcript |

### 1.4 Tenant Portal (`/tenant-portal`)

| ID | Requirement | Status | Source |
|----|-------------|--------|--------|
| TP-01 | M-Pesa STK Push rent payment with instant status | ⚠️ Has race conditions | AUDIT_REPORT §1.2 |
| TP-02 | Maintenance tickets with category selection + photo attachments | ⚠️ Needs verification | Transcript |
| TP-03 | Lease viewing and payment history | ⚠️ Needs verification | Transcript |
| TP-04 | Tenant Code guard: if no linked profile, show form to link account | ⚠️ Needs verification | Transcript |
| TP-05 | Dark slate UI when tenant has no profile | ⚠️ Needs verification | Transcript |

### 1.5 Admin Dashboard (`/admin`)

| ID | Requirement | Status | Source |
|----|-------------|--------|--------|
| AD-01 | KRA tax reporting (7.5% MRI + 10% WHT) | ⚠️ Needs verification | Transcript |
| AD-02 | Monthly Income Statement / P&L reports | ⚠️ Needs verification | Transcript |
| AD-03 | User & role management: approval/rejection workflows | ⚠️ Built but no route guards | AUDIT_REPORT §3.1 |
| AD-04 | Distress inventory reclamation (`/admin/inventory`) | ⚠️ Needs verification | Transcript |
| AD-05 | Full CRUD + soft delete with confirmation dialogs | ⚠️ Partial | Transcript |
| AD-06 | **Route guard: admin-only access** | 🔴 MISSING | AUDIT_REPORT §3.1 |

### 1.6 Agent Performance (`/agent-performance`)

| ID | Requirement | Status | Source |
|----|-------------|--------|--------|
| AP-01 | Commission tracking & performance metrics | ⚠️ Built but AnimatedCounter has bugs | AUDIT_REPORT §5.2 |
| AP-02 | Geo-verified check-ins | ⚠️ Needs verification | Transcript |
| AP-03 | Area-scoped access (only assigned properties/tenants) | 🔴 RBAC bypass bug | AUDIT_REPORT §1.1 |

### 1.7 Properties & Property Detail (`/properties`, `/properties/:id`)

| ID | Requirement | Status | Source |
|----|-------------|--------|--------|
| PR-01 | Custom blue 3D buildings at exact Mercator coordinates | ⚠️ Uses fake GPS hash jitter | AUDIT_REPORT §2.2 |
| PR-02 | Color-coded unit cubes stacked by floor | ⚠️ Needs verification | Transcript |
| PR-03 | Clicking 3D buildings highlights property details | ⚠️ Map is unstable | AUDIT_REPORT §2.2 |
| PR-04 | No standard map markers on properties/units tabs | ⚠️ Needs verification | Transcript |
| PR-05 | R2 file upload for verification documents | ⚠️ Returns mock URLs when R2 unset | AUDIT_REPORT §1.6 |

### 1.8 Payments (`/payments`)

| ID | Requirement | Status | Source |
|----|-------------|--------|--------|
| PA-01 | M-Pesa STK Push initiation | ⚠️ Built but racy | AUDIT_REPORT §1.2 |
| PA-02 | Payment reconciliation with matched/unmatched badges | ⚠️ Needs verification | Transcript |
| PA-03 | **Race condition on balance updates** | 🔴 CRITICAL | AUDIT_REPORT §1.2 |
| PA-04 | **No idempotency on STK callbacks** | 🔴 CRITICAL | AUDIT_REPORT §1.2 |

### 1.9 Maintenance (`/maintenance`)

| ID | Requirement | Status | Source |
|----|-------------|--------|--------|
| MA-01 | Fault tickets: plumbing, electrical, structural, HVAC | ⚠️ Needs verification | Transcript |
| MA-02 | Photo uploads via mobile camera / drag-and-drop | ⚠️ Needs verification | Transcript |
| MA-03 | Role-gated status updates and closing | ⚠️ Needs verification | Transcript |

### 1.10 Notices (`/notices`)

| ID | Requirement | Status | Source |
|----|-------------|--------|--------|
| NO-01 | Bulk SMS & Email via `POST /api/v1/notices/bulk` | ⚠️ Needs verification | Transcript |
| NO-02 | Multi-select tenant modal for recipient selection | ⚠️ Needs verification | Transcript |

---

## 2. Requirements by Role

### 2.1 Landlord
| ID | Capability | Status |
|----|-----------|--------|
| R-LL-01 | Register & verify ownership via Google SSO | ✅ Clerk SSO |
| R-LL-02 | Add properties, define units, set rent amounts | ⚠️ Built |
| R-LL-03 | Auto KRA tax filing (7.5% MRI + 10% WHT) | ⚠️ Backend exists |
| R-LL-04 | Collect rent via M-Pesa, funds to bank | 🔴 Race conditions |
| R-LL-05 | Track net income, occupancy, and expenses | ⚠️ Basic dashboards |
| R-LL-06 | Default `landlord_approval_status = 'n_a'` for new users | ⚠️ Needs verification |

### 2.2 Tenant
| ID | Capability | Status |
|----|-----------|--------|
| R-TN-01 | Get invited by agent via email | ⚠️ Needs verification |
| R-TN-02 | Link account via auto-detect tenant code | ⚠️ Needs verification |
| R-TN-03 | Pay rent via M-Pesa STK Push in under 3s | 🔴 Race conditions |
| R-TN-04 | View digital receipts & lease documents | ⚠️ Needs verification |
| R-TN-05 | Log maintenance tickets with photos | ⚠️ Needs verification |

### 2.3 Agent
| ID | Capability | Status |
|----|-----------|--------|
| R-AG-01 | Submit EARB license for verification | ⚠️ Needs verification |
| R-AG-02 | Get admin approval on profile | ⚠️ Built |
| R-AG-03 | Manage properties/tenants in assigned area | 🔴 RBAC bypass |
| R-AG-04 | Earn tracked commission on managed units | ⚠️ Basic implementation |
| R-AG-05 | Geo-verified check-ins | ⚠️ Needs verification |

### 2.4 Admin
| ID | Capability | Status |
|----|-----------|--------|
| R-AD-01 | Full system dashboard on sign-in | ⚠️ Built |
| R-AD-02 | Approve agent & landlord registrations | ⚠️ Built |
| R-AD-03 | Monitor audit logs and security events | ⚠️ Needs verification |
| R-AD-04 | Manage inventory auctions and unit assets | ⚠️ Built |
| R-AD-05 | Void/cancel payments | 🔴 Duplicated balance logic |
| R-AD-06 | Send bulk notices (SMS + Email) | ⚠️ Needs verification |
| R-AD-07 | Generate KRA + P&L reports | ⚠️ Backend exists |
| R-AD-08 | **Route guard on admin pages** | 🔴 MISSING |

---

## 3. Images & Assets Referenced

### 3.1 Generated Cinematic Photos (in `/public/assets/`)
| File | Scene | User Request |
|------|-------|-------------|
| `hero_coastal_building.png` | Hero backdrop | "luxury coastal building at golden hour" |
| `building_interior_lobby.png` | Descent transition | "modern luxury lobby interior" |
| `landlord_property_office.png` | Landlord role flow | "landlord in property office" |
| `tenant_mpesa_payment.png` | Tenant role flow | "tenant using M-Pesa payment" |
| `agent_field_inspection.png` | Agent role flow | "agent doing field inspection" |
| `admin_control_center.png` | Admin role flow | "admin control center with Mutune General Estate Agency" |
| `mombasa_aerial_coastline.png` | Final CTA backdrop | "aerial Mombasa coastline" |

### 3.2 3D Model Assets (in `/public/models/`)
| File | Size | Purpose |
|------|------|---------|
| `b_small.glb` | 1.2 MB | Small building model |
| `b_medium.glb` | 1.9 MB | Medium building model |
| `b_large.glb` | 2.4 MB | Large building model |
| `b_tower.glb` | 3.4 MB | Tower building model |

> ⚠️ **None of these GLBs are Draco-compressed.** Combined 8.8 MB of uncompressed 3D assets.

---

## 4. Services & Integrations

| Service | Purpose | Status | User Decision |
|---------|---------|--------|---------------|
| **Clerk** | Auth & identity (Google SSO) | ✅ Active | Keep |
| **Sentry** | Error monitoring (frontend + backend) | ✅ Active | Keep — "Include Sentry DSN" |
| **PostHog** | Product analytics | ⚠️ Key provided, integration unclear | User provided key |
| **M-Pesa (Daraja)** | STK Push payments | ✅ Active (buggy) | Keep |
| **Africa's Talking** | Bulk SMS | ⚠️ Wired but unverified | Keep |
| **Resend** | Bulk Email | ⚠️ Wired but unverified | Keep |
| **Cloudflare R2** | Object storage (photos, docs) | ⚠️ Mock fallback in prod | Keep — fix mock |
| **Groq AI** | AI chat assistant | ⚠️ Functional but unverified | Keep |
| **Vercel** | Frontend hosting | ✅ Active | `mutune-alpha.vercel.app` |
| **Render** | Backend hosting | ✅ Active | `render.yaml` exists |
| **Meshy AI** | 3D model generation | ❌ Eliminated | User: "MESHY AI NEEDS PAYMENT... ELIMINATE IT" |
| **Tripo3D** | 3D model generation | ❌ Should be eliminated | Never had real credentials |
| **MinersAI** | Mineral reports | ❌ Eliminated | User: "MINERAL REPORT IS NOT NEEDED REMOVE" |
| **Kimi AI** | Alternative AI | ⚠️ Referenced in env vars | Unclear status |

---

## 5. Explicit Design & UX Decisions

### Typography
- Display: **Outfit** (headings, hero)
- Body: **Plus Jakarta Sans** (paragraphs, UI)
- Mono: **JetBrains Mono** (metrics, code)

### Color System
- **OKLCH color tokens** (perceptually uniform)
- Royal lavender primary, sunset gold secondary
- Deep navy slate (`slate-950`) / pure white surfaces
- High WCAG contrast required

### Motion Rules
- GSAP ScrollTrigger for scroll-driven animations
- `prefers-reduced-motion: reduce` → ALL animations disabled
- Three.js disabled on mobile (<768px)
- Cursor tilt disabled on touch devices
- Every animation must serve narrative — zero decoration

### Layout Rules
- 8px spacing grid (`--sp-1` through `--sp-24`)
- Fluid type scale with `clamp()`
- Mobile-first responsive
- Glassmorphism only where it "earns its place"

### UX Standards (from user)
- Full CRUD on every entity per role
- Required fields marked with asterisks
- Form validation on blur + submit
- Cancel/Close on all modals
- Confirmation dialogs before destructive actions
- Soft-delete (`isDeleted: true`) not hard delete
- Toast with 30s Undo for state changes
- Human-readable error messages

### Security Standards (from user)
- RBAC middleware on all mutation endpoints
- Area-scoped agent filtering
- Mongoose schema typing + `mongoSanitize`
- Remove debug endpoints in production
- Mask sensitive fields in logs
