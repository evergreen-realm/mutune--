# MutuneRent Pro — Master Audit Report (Consolidated)

> **Scope:** Full-stack audit merging `AUDIT_REPORT.md` (original) with extended findings, then **corrected against a fresh deep verification pass of every backend route.**
> **Method:** Automated route enumeration (Node.js AST-style scan) + manual file review of every mutation handler + cross-referencing every user requirement against actual implementation.
> **Verdict:** Real working plumbing. But production deployment would be irresponsible until the Phase 1 critical fixes land.

---

## ⚠️ Correction Notice — Prior Audit Was Wrong On One Headline Claim

A thorough re-verification of `backend/routes/properties.js` shows the original `AUDIT_REPORT.md` and the extended audit's **#1 headline claim was INCORRECT**:

> ❌ ~~"PATCH /:id (line 293) and DELETE /:id (line 321) have only `requireAuth`. Any logged-in tenant can edit or delete ANY landlord's property."~~

**Verified actual code (`backend/routes/properties.js:293-295, 321-323`):**
```js
router.patch('/:id', requireAuth, requireRole(['admin', 'super_admin']), ...)
router.delete('/:id', requireAuth, requireRole(['super_admin']), ...)
```

Both have `requireRole` guards. The properties IDOR claim was a false positive. The real, verified critical gaps are listed in §1 below. This is documented openly so future audits don't repeat or build on the bad claim.

---

## 0. Severity Legend

| Icon | Meaning | Action |
|------|---------|--------|
| 🔴 | **Critical** — blocks launch, leaks data or money | Fix before any deployment |
| 🟠 | **High** — degrades trust, causes silent failures | Fix within 1 week |
| 🟡 | **Medium** — tech debt, UX gaps, maintainability | Fix within 1 month |
| 🟢 | **Low** — polish, optimization, nice-to-have | Backlog |

---

## 1. Security & Authorization — VERIFIED

A complete enumeration of all 95+ routes across 14 route files was performed. The middleware chain for every `/:id` mutation was inspected. Findings below are **confirmed against source code in this session**, not inherited from prior claims.

### 1.1 🔴 Payment Race Condition + No Idempotency (CONFIRMED)

**File:** `backend/routes/payments.js`

- Line 35: `transaction_id = \`MUT-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}\`` — predictable, collision-prone under load
- Lines 36–54 (`/initiate-stk`): creates Payment row **before** sending STK Push — STK failure → orphaned pending payment
- Lines 87–108 (`/auto-initiate`): same pattern, duplicated
- Lines 163–224 (`handleSTKCallback`): **no idempotency check** — duplicate Safaricom callbacks re-process the same payment. `Payment.findOne({ transaction_id: checkoutRequestId })` then unconditional `payment.status = 'confirmed'` + balance mutation
- Lines 200–217: tenant arrears updated via **read-modify-write** (`tenantDoc.arrears_kes -= deduction; await tenantDoc.save()`) — NOT atomic. Two concurrent callbacks both read balance B, both write B−amount → lost update
- Lines 332–387 (override) and 389–427 (void): the **balance-mutation logic is duplicated three times** across callback/override/void — three places for the same bug to live
- `handleC2BCallback` (226–244): creates orphan Payment with `transaction_id: \`C2B-${Date.now()}\`` — `Date.now()` is not unique under concurrency

**Fix:** Wrap state-changing handlers in `session.withTransaction()`, use atomic `$inc`, add unique index on `mpesa_receipt` (already non-unique-indexed at `Payment.js:41` — must be `{ unique: true, sparse: true }`), extract `applyPaymentToTenant(session, payment)` helper.

### 1.2 🔴 RBAC Scope Bypass (CONFIRMED)

**File:** `backend/middleware/rbac.js:36`

```js
if (!hasAssignments) return next();  // ← agent with no assignments sails through
```

An agent with zero `assigned_property_ids` AND zero `assigned_areas` bypasses every scope check on routes that use `enforcePropertyScope` (e.g. `GET /properties/:id`, `PATCH /properties/:id/units/:unitId`). The correct behavior is **deny with 403**, not allow.

### 1.3 🔴 Admin Routes Have No Frontend Guard (CONFIRMED)

**File:** `frontend/src/App.jsx:540-541`

```jsx
<Route path="/admin/users"    element={<AdminUserManagementPage />} />
<Route path="/admin/inventory" element={<AdminInventoryPage />} />
```

No `<RoleRoute>` wrapper. Any authenticated user who types the URL loads admin surfaces. The backend API calls (`requireRole(['admin','super_admin'])`) would reject the data fetch, but the user sees the admin shell with error states — leaking admin UI structure and surfaces.

### 1.4 🟠 PDF Mock Returns Fake URLs When R2 Unset

**File:** `backend/services/pdf.js:27-28` (also `:137-138` in contract generator)

```js
if (process.env.NODE_ENV === 'test' || !process.env.CLOUDFLARE_R2_BUCKET) {
  resolve(`https://r2.cloudflare.com/mock-${key}`);
}
```

A misconfigured production deploy (R2 bucket env var missing) silently serves `https://r2.cloudflare.com/mock-...` dead links instead of failing loudly. **Fix:** only mock in `NODE_ENV === 'test'`; throw otherwise.

### 1.5 🟠 Admin Hardcoded Hash Mechanism

**Files:** `backend/models/User.js:19, 59-69`, plus 18 references across `routes/users.js`, `routes/admin.js`

The `User` model carries three auth mechanisms: `password_hash`, `admin_hardcoded_hash`, `clerk_id`. The pre-save hook auto-hashes `ADMIN_HARDCODED_PASSWORD` into every admin/super_admin user. This is a backdoor-shaped feature. **Fix:** if kept, gate to `NODE_ENV !== 'production'` and audit-log; otherwise remove entirely and rely on Clerk.

### 1.6 🟡 `/callback/validate` Is a No-Op

**File:** `backend/routes/payments.js:142-144`

```js
router.post('/callback/validate', async (req, res) => {
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
});
```

This is Safaricom's C2B validation URL. It accepts everything with no validation logic. Either implement actual validation (e.g. check the paybill account maps to a known property) or document that validation is intentionally permissive.

### 1.7 🟢 Verified — NO IDOR on properties

For completeness and to close the false-positive loop: a full scan of every `/:id` mutation route found that the in-handler authorization pattern is **mostly sound**:

| Route | Middleware | In-handler check | Verdict |
|-------|-----------|------------------|---------|
| `PATCH /properties/:id` | `requireRole(['admin','super_admin'])` | — | ✅ Safe |
| `DELETE /properties/:id` | `requireRole(['super_admin'])` | — | ✅ Safe |
| `PATCH /users/:id` | `requireAuth` | `isSelf || isAdmin` (lines 446-450), role-change gated to admin (452-454), super_admin grant gated (464-466) | ✅ Safe |
| `DELETE /maintenance/:id` | `requireAuth` | `isOwner || isAdmin` (lines 218-223) | ✅ Safe |
| `PATCH /maintenance/:id` | `requirePermission('view:maintenance')` | — | ⚠️ Tenant with `view:maintenance` could update any ticket — minor gap |
| `GET /notices/:id/download` | `requireAuth` | none | 🟠 IDOR — any user downloads any notice PDF |

**New finding (not in prior audits):** `GET /notices/:id/download` (`notices.js:206`) has only `requireAuth`. Any authenticated user can download any notice PDF by ID. Tenants could pull notices meant for other tenants.

---

## 2. Backend Architecture

### 2.1 🟠 Orphaned Frontend Packages in Backend
`backend/package.json` lists `@react-three/drei`, `@react-three/fiber`, `three` — browser 3D libs on a headless API server. Inflates install, misleads.

### 2.2 🟠 Orphaned Service References
- `MESHY_API_KEY` — user explicitly eliminated ("ELIMINATE IT")
- `TRIPO3D_API_KEY` — never had real credentials
- `KIMI_*` — status unclear
- `JWT_SECRET` — app uses Clerk; likely dead

### 2.3 🟡 M-Pesa Token Not Cached
`services/mpesa.js:14-21` — every STK Push calls `getAccessToken()`, hitting Safaricom OAuth (~300ms, rate-limited). Safaricom returns ~3599s expiry. Cache with refresh-before-expiry.

### 2.4 🟡 State Machine Missing States
`utils/stateMachine.js` defines 5 states. The `Payment` model enum includes `failed` and `reversed`, but `transition()` has no entry for them — failure/refund flows are handled ad-hoc in routes, untracked.

### 2.5 🟡 Infrastructure Smells (`server.js`)
- Line 4: `dns.setServers(['8.8.8.8','8.8.4.4'])` — DNS hack, investigate real cause
- Line 28: `unpkg.com` in CSP `scriptSrc` — third-party CDN in security policy
- Lines 98-100: `/debug-sentry` endpoint exposed in production
- Lines 65-71: global rate limit 300/15min is coarse; no per-route limits on auth/payments
- Lines 124-127: `node-cron` in-process → double-fires with >1 replica

---

## 3. Frontend Architecture

### 3.1 🔴 Error Boundary Gaps
`App.jsx` `ErrorBoundary` wraps only AppShell inner routes. Missing on: `/landing`, `/login`, `/sign-up`, `/onboarding`, and around all map/3D components. A WebGL crash takes the whole page down.

### 3.2 🟠 God Components
| Component | Lines | Problem |
|-----------|-------|---------|
| `MapWidget.jsx` | 1648 | God component, 3 overlapping 3D systems |
| `TenantPortalPage.jsx` | 1583 | Should split into TenantPayments/Maintenance/Leases |
| `AdminDashboardPage.jsx` | 1163 | Monolithic |
| `LandingPage.jsx` | 1025 | Acceptable for cinematic page |

### 3.3 🟠 Landing Page Light Theme Nav Broken
Floating nav pill uses hardcoded `rgba(255,255,255,*)`. In light theme: white text on white background.

### 3.4 🟠 Gradient Text Bug
`SplitWords` wraps each word in its own `<span>`. The gradient class is applied per-word → each word gets its own gradient slice instead of one spanning gradient.

### 3.5 🟡 Bundle Size
| Chunk | Size |
|-------|------|
| `vendor-mapbox` | 1,838 KB |
| `index` (main) | 1,037 KB |
| `vendor-three` | 961 KB |
| `vendor-charts` | 411 KB |
Total ~4.4MB pre-gzip. Redundant libs: `leaflet`+`mapbox-gl`; `gsap`+`framer-motion`; `lenis`.

### 3.6 🟡 Inconsistent Server State
Mixed: TanStack Query + raw `useEffect` + local component state mirroring server.

### 3.7 🟡 No API Response Validation
Axios returns raw `res.data`. Schema drift renders silently. Add Zod on critical responses.

### 3.8 🟢 Anti-Glitch Stabilizer
`App.jsx:200-203` `setTimeout(..., 2500)` is a bandage over the map re-init storm. Fix the cause, delete the timer.

---

## 4. 3D Map System (Critical Technical Debt)

### 4.1 🔴 Three Overlapping Render Systems
1. Mapbox fill-extrusion (lines ~462-510) — fake footprints
2. Custom Three.js WebGL layer (lines ~869-1048) — separate renderer sharing Mapbox canvas
3. R3F preview (`BuildingPreview3D.jsx`) — third canvas for detail

Three render loops, two libraries, one canvas. Continuous `triggerRepaint()`. No viewport culling. WebGL context not reliably disposed.

### 4.2 🔴 Fabricated Geographic Data
- `getPropertyCoords` (lines 57-72): deterministic hash jitter around Mombasa default — **fake GPS**
- `property-buildings` (lines 462-510): 33m squares at hardcoded `0.00015°` offset — **fake footprints**

For a property platform, showing properties at locations where they don't exist is trust-destroying.

### 4.3 🟠 Dead Code + Unoptimized Assets
- `DetailedBuildingModelR3F` (`BuildingPreview3D.jsx:109-172`) defined, never used
- 4 GLBs total 8.8MB, none Draco-compressed

### 4.4 The God-Effect
The main `useEffect` (lines 856-1198) has 7 dependencies including `onPropertySelect` (a function prop → new reference nearly every render). Tears down + rebuilds the entire custom WebGL layer, all markers, all event handlers on every change. Root cause of the "glitchy" feel.

---

## 5. Design System

### 5.1 🟠 Dual Token System
Landing uses `--lp-*`. App pages use `--brand-*`/`--surface-*`. Components can't move between contexts.

### 5.2 🟡 Tailwind Config Thin
Extends `colors` and `fontFamily` only. Missing `spacing`, `borderRadius`, `boxShadow`, `fontSize`, `animation` → devs hand-write `rounded-[14px]` arbitrary values.

### 5.3 🟡 Google Fonts Only on Landing
`Outfit`/`Plus Jakarta Sans`/`JetBrains Mono` loaded via `<link>` but dashboard pages don't reference the families.

---

## 6. Deployment & Environment

### 6.1 🟠 Environment Variable Sprawl
Backend references 28+ env vars. Critical: if `CLOUDFLARE_R2_*` unset → mock URLs in prod. `MESHY`/`TRIPO`/`KIMI` likely dead.

### 6.2 🟡 No CI/CD Pipeline
No `.github/workflows/`, no test gate before deploy. Manual `npx vercel --prod`.

---

## 7. Error Summary by Count

| Category | 🔴 Critical | 🟠 High | 🟡 Medium | Total |
|----------|------------|---------|-----------|-------|
| Security & Auth | 3 | 2 | 1 | **6** |
| Backend Architecture | 0 | 2 | 3 | **5** |
| Frontend Architecture | 1 | 3 | 3 | **7** |
| 3D / Map System | 2 | 1 | 0 | **3** |
| Design System | 0 | 1 | 2 | **3** |
| Deployment / Env | 0 | 1 | 1 | **2** |
| **Total** | **6** | **10** | **10** | **26** |

*(Down from the prior audit's 31 — the corrected verification removed 5 false-positive IDOR claims.)*

---

## 8. What's Actually Good (Credit Where Due)

| What | Why It Matters |
|------|---------------|
| ✅ Clerk integration properly done | Middleware wraps SDK, looks up DB user, checks `is_active`/`is_deleted` |
| ✅ Payment state machine exists | Most early products handle payments as if-statements |
| ✅ OKLCH + token-bridged Tailwind | Modern, perceptually uniform color system |
| ✅ Dashboards use real data | Not mocked |
| ✅ UI component library (9 primitives) | Badge, Button, Card, DataTable, EmptyState, Input, Modal, Select, Spinner |
| ✅ Empty states on all major pages | Every data list handles `length === 0` |
| ✅ Cinematic landing page (v2) | Genuinely above average |
| ✅ useEffect cleanups present | All major effects have cleanup functions |
| ✅ In-handler authorization on most mutations | `isSelf || isAdmin` pattern is correctly applied on users/maintenance |
| ✅ Self-awareness | The team knows the 3D debt exists |
