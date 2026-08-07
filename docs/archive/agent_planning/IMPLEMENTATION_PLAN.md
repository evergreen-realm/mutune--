# MutuneRent Pro — Detailed Implementation Plan (v3 — Final)

> **SCOPE DISCIPLINE:** This is a **quality + security upgrade only.** No business logic changes. Every existing button, flow, role permission, and workflow stays behaviorally identical — we make them cinematic, correct, secure, and reliable. Logic is preserved.
> **Driven by:** `AUDIT_REPORT.md`, `USER_FLOWS.md`, `DATA_FLOW.md`, `REQUIREMENTS.md`, `UI_UX_REPORT.md`, and a full verification pass of every button in every file.
> **Baseline verified:** 309 onClick handlers + 22 forms across 30 components, all wired to real endpoints. **No dead buttons found.** MapWidget controls (tabs, vector/satellite, 3D/lite, fullscreen, search, fly-to) all functional.

---

## Part A — Known Errors Catalog (verified, per file)

These are real defects confirmed by reading the code. Must be fixed as part of the upgrade. None change logic.

### A.1 Broken Tailwind classes (silent style failures)
`550`/`650` are NOT default Tailwind shades → classes render nothing. (`emerald-950` IS valid — leave those.)
| File | Line | Bad class | Fix |
|------|------|-----------|-----|
| `MapWidget.jsx` | 1320 | `bg-blue-550/10` | → `bg-blue-500/10` |
| `MapWidget.jsx` | 1478 | `bg-indigo-550/10 text-indigo-600 border-indigo-550/30` | → `indigo-500/10 indigo-600 indigo-500/30` |
| `AdminDashboardPage.jsx` | 1131 | `to-indigo-550` (hover) | → `to-indigo-500` |
| `AdminDashboardPage.jsx` | 1224 | `from-emerald-550 to-teal-550` | → `from-emerald-500 to-teal-500` |
| `PropertiesPage.jsx` | 170 | `to-indigo-550` (hover) | → `to-indigo-500` |
| `AddPropertyPage.jsx` | 262,374 | `text-slate-550` | → `text-slate-500` |
| `AdminInventoryPage.jsx` | 306,575 | `text-slate-550` | → `text-slate-500` |
| `AdminInventoryPage.jsx` | 365,366 | `text-emerald-650` | → `text-emerald-600` |
| `TenantsPage.jsx` | 505 | `border-emerald-550/20` | → `border-emerald-500/20` |
| `TenantsPage.jsx` | 1028,1042 | `text-red-550` | → `text-red-500` |
| `TenantPortalPage.jsx` | 1641 | `to-emerald-650` | → `to-emerald-700` |

**Batch fix:** global search-replace `550`/`650` → `500`/`700` on these color tokens, OR (cleaner) extend `tailwind.config.js` to define the missing shades.

### A.2 MapWidget defects (3D subsystem)
| Defect | Location | Impact |
|--------|----------|--------|
| Fake GPS hash-jitter fallback | `getPropertyCoords:57-72` | Properties shown at wrong locations |
| Fake building footprints (33m squares) | `property-buildings:462-510, 624-652` | Non-existent buildings rendered |
| Three overlapping 3D systems | fill-extrusion + custom WebGL (869-1048) + R3F preview | Performance, context leaks, god-effect |
| Custom WebGL layer repaints every frame | `render()` → `triggerRepaint()` | Battery/CPU drain |
| God-effect (7-dep useEffect, 856-1198) | rebuilds all on `onPropertySelect` ref change | Glitchy feel |
| `THREE`+`GLTFLoader` top-level import | lines 7-8 | Loaded even in lite mode |

### A.3 Security defects (from AUDIT_REPORT §1)
| Defect | Location |
|--------|----------|
| Payment race + no idempotency | `payments.js:163-224, 332-427` |
| RBAC scope bypass (agent no-assignment → allow) | `rbac.js:36` |
| No frontend route guard on `/admin/*` | `App.jsx:540-541` |
| PDF mock URLs when R2 unset (prod silent fail) | `pdf.js:27-28, 137-138` |
| Notice PDF download IDOR | `notices.js:206` |
| `transaction_id` from Date.now+random | `payments.js:35, 87` |
| No error boundary on landing/auth/map | `App.jsx` |

### A.4 Data-integrity defects
| Defect | Location |
|--------|----------|
| Expenses never created → income-statement netIncome misleading | no UI for `POST /expenses` |
| `Tenant.id_number`/KYC plaintext | `models/Tenant.js:20` |
| TenantPortal uses react-leaflet (redundant lib + unpkg CDN) | `TenantPortalPage.jsx:7-9` |

### A.5 UX defects
| Defect | Location |
|--------|----------|
| AnimatedCounter K-format bug | `AgentPerformancePage:70-72`, `LandlordDashboardPage:52` |
| Landing nav pill white-on-white in light theme | `LandingPage.jsx` |
| Landing gradient-text per-word slice | `LandingPage.jsx` |
| No `<EmptyState>` adoption anywhere (component exists) | all list pages |
| No skeleton loaders on data pages (spinners only) | all pages |
| No confirmation dialog on tenant STK initiation | `TenantPortalPage.jsx` |
| recharts not themed to OKLCH / no dark-light response | dashboards |
| 2.5s `stabilising` setTimeout (band-aid) | `App.jsx:200-203` |

---

## Part B — Per-Page Button & Flow Inventory (verified working)

> Verified: **every** button below is wired to a real handler → real API → real model mutation. The upgrade preserves all of this; it only adds cinematic treatment, skeletons, toasts, and fixes the catalog errors above.

### B.1 MapWidget (1648L) — 10 onClick, all functional
| Control | Wired to | Status |
|---------|----------|--------|
| Properties/Units/3D tabs | `setActiveTab` + `fetchUnitGeoJSON` | ✅ |
| Vector ↔ Satellite toggle | `setMapStyleMode` → `satellite-layer` raster-opacity | ✅ |
| 3D ↔ Lite toggle | `toggleLiteView` → `easeTo` + extrusion opacity + localStorage | ✅ |
| Fullscreen toggle (admin) | `setIsFullscreen` | ✅ |
| Search input | `setSearchQuery` → filter | ✅ |
| Property marker click | `handlePropertySelect` → `fetchUnitGeoJSON` | ✅ |
| Popup "View 3D Model" | `setActiveTab('3d')` + `flyTo` | ✅ |
| Popup close X | clears selection | ✅ |
| Unit select | `setSelectedUnit` | ✅ |
| "Back to Map" | clears selection | ✅ |
**Upgrade:** rebuild to single fill-extrusion technique, real footprints, fix broken classes, cinematic popups.

### B.2 AdminDashboardPage (1243L) — 32 onClick, all functional
KPI cards (real `fetchAdminStats`), revenue bar chart (real), payment-status pie (real), 3 tabs (overview/units/agents), KRA download, property CRUD (create/edit/add-unit), refresh. Loading skeleton + error retry already present. **Upgrade:** cinematic KPI count-up, themed charts, slide-in approvals.

### B.3 AdminUserManagementPage (1126L) — 34 onClick, all functional
Approve/reject agents & landlords, property approvals, user CRUD, late-fee rules, tiers, customer-care. **Upgrade:** cinematic list animations, confirm dialogs, skeletons.

### B.4 AdminInventoryPage (603L) — 31 onClick, all functional
Auctionable list, mark auctionable, record sale, reclaim, add/delete items, download CSV. **Upgrade:** fix slate-550 classes, skeletons, banners.

### B.5 TenantPortalPage (1676L) — 28 onClick, all functional
Pay rent (STK), maintenance tickets, notices acknowledge, profile link. **Upgrade:** split into 4 sub-components, replace react-leaflet with Mapbox lite, payment confirmation dialog, SSE status, skeletons.

### B.6 TenantsPage (1087L) — 28 onClick, all functional
Create/edit/link/terminate tenants, payment history. **Upgrade:** fix emerald/red-550, confirm dialogs, skeletons.

### B.7 Other pages (all verified functional)
- `LandlordDashboardPage` (3 onClick + 3 Links) — property cards, lease approvals, financial chart
- `AgentPerformancePage` (7 onClick, 2 forms) — tasks, STK, tier review, check-in, profile
- `PropertiesPage` (11 onClick) — list/grid, approve/reject
- `PropertyDetailPage` (7 onClick, 1 form) — units CRUD, lock, geolocation
- `PaymentsPage` (5 onClick, 1 form) — void, override
- `MaintenancePage` (14 onClick, 2 forms) — ticket CRUD
- `NoticesPage` (17 onClick, 3 forms) — generate, bulk, acknowledge, download
- `TasksPage` (9 onClick, 1 form) — task CRUD
- `OnboardingPage` (8 onClick, 2 forms) — role select, tenant link
- `AddPropertyPage` / `LandlordAddPropertyPage` — GPS property creation

---

## Part C — Phased Upgrade Plan (quality + security, logic preserved)

### Phase 1 — Security & Money (Week 1, 🔴 blockers)
*(Unchanged from v2 — see AUDIT_REPORT §1. Exact tasks in TASK.md P1.x)*
- P1.1 Payment atomicity + idempotency + UUID + token cache
- P1.2 RBAC scope bypass → 403
- P1.3 `<RoleRoute>` on admin pages
- P1.4 Error boundaries (extract + WebGLErrorBoundary + wrap all)
- P1.5 PDF mock split (test-only)
- P1.6 Notice download IDOR scope
**Discipline:** behavior identical — only the *security* of each path changes.

### Phase 2 — Data Integrity (Week 2)
- P2.1 Remove fake GPS + fake footprints (no pin if no GPS; "Location not set")
- P2.2 Real building footprints backend (Microsoft/OSM, cache as GeoJSON)
- P2.3 Expenses feature (closes income-statement gap — purely additive, no logic change)
- P2.4 Zod response validation
- P2.5 Dead-service + backend-deps cleanup (uninstall three/r3f from backend)
- P2.6 server.js hardening (debug endpoint, CSP, DNS hack, per-route limiters)

### Phase 3 — 3D Map Rebuild (Week 3, the centerpiece)
**Goal:** preserve all 10 controls + the 3 tabs + lite/satellite toggles. Only the *rendering technique* changes.
- P3.1 Collapse to ONE technique (Mapbox fill-extrusion + real footprints); delete custom WebGL layer
- P3.2 Satellite + 3D coexistence (insert fill-extrusion beneath label layer per official example)
- P3.3 Stabilize god-effect (split useEffect, useCallback on handlers, repaint-on-event only, dispose on unmount)
- P3.4 Lite mode auto-detect + 3-way toggle (3D/Lite/Satellite), persisted
- P3.5 Draco-compress GLBs (8.8MB → ~1.5MB), local DRACOLoader
- P3.6 Replace react-leaflet in TenantPortal with Mapbox lite (removes unpkg CDN dep)
- P3.7 Delete leaflet/react-leaflet
- P3.8 Fix all MapWidget broken classes (A.1)
- P3.9 Zillow-class map UX: price pins, hover cards, draw-search, list↔map sync, verified badge
**Verify every control still works identically post-rebuild.**

### Phase 4 — Cinematic Upgrade (Weeks 4-5, all pages)
**Principle:** premium through restraint (Linear/Vercel/Stripe model). Cinematic on heroes/empty states; data tables stay flat & fast.
- P4.1 Motion design system (`lib/motion.ts` — durations, easings, stagger, reduced-motion gate)
- P4.2 `useGSAP` migration (auto-cleanup, StrictMode-safe) on Landlord/Agent/Landing
- P4.3 Per-page cinematic treatment (all roles) — see B.x; preserve all buttons
- P4.4 Skeleton loaders everywhere (new `ui/Skeleton.jsx` variants; replace spinners on data pages)
- P4.5 Notification banners (no overlays over data): cinematic toasts + new inline `ui/Banner.jsx`
- P4.6 `<EmptyState>` adoption on ALL list pages (currently used nowhere)
- P4.7 Confirmation `<Modal>` on all destructive actions (standardize)
- P4.8 Theme parity: unify tokens, theme recharts, fix landing nav + gradient bugs, extend Tailwind config
- P4.9 AnimatedCounter fix (`Intl.NumberFormat`) on Agent + Landlord
- P4.10 Fix all remaining broken Tailwind classes (A.1)

### Phase 5 — Polish & Foundation (Week 6+, ongoing)
- P5.1 Bundle diet (delete lenis, code-split Three.js, scope GSAP to landing)
- P5.2 CI/CD (`.github/workflows/ci.yml`)
- P5.3 PII encryption (Tenant.id_number, KYC)
- P5.4 Accessibility (focus traps, aria on charts, icon+text badges)
- P5.5 God-component splits (TenantPortal, MapWidget, AdminDashboard) — logic preserved
- P5.6 TS migration start (api.js + Zod → ts)

---

## Verification Discipline (every task)

Each TASK.md entry carries:
- **Preserve:** the existing behavior/contract that must not change
- **Change:** the exact file(s) + lines
- **Verify:** behavioral test (role + action + expected result) + the original defect can't reproduce
A task is ✅ only when verify passes. Gaps reopen as sub-tasks referencing the original.

---

## Research Sources
- [Mapbox GL JS v3 migration (Standard Satellite)](https://docs.mapbox.com/mapbox-gl-js/guides/migrate/)
- [Mapbox official 3D Buildings example](https://docs.mapbox.com/mapbox-gl-js/example/3d-buildings/) — fill-extrusion-height/base with zoom interpolate, insert beneath symbol layer
- [Mapbox Style Spec — layers](https://docs.mapbox.com/style-spec/reference/layers/)
- [Microsoft Global ML Building Footprints](https://github.com/microsoft/GlobalMLBuildingFootprints) (Kenya open data)
- [Microsoft Planetary Computer buildings](https://planetarycomputer.microsoft.com/dataset/ms-buildings) (STAC spatial query)
- [VIDA combined footprints (Google+MS+OSM)](https://source.coop/vida/google-microsoft-osm-open-buildings) (PMTiles/FlatGeobuf)
- [OSM Wiki — Microsoft Building Footprint Data](https://wiki.openstreetmap.org/wiki/Microsoft_Building_Footprint_Data)
- [GSAP React + useGSAP](https://gsap.com/resources/React/) — useGSAP() with gsap.context()
