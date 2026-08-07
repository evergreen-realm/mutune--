# MutuneRent Pro — User Flow Journeys (All Roles)

> **Purpose:** Complete, verified end-to-end journey for every role. Every button, every loading state, every notification, every data call. Based on a full read of the codebase (App.jsx routing, Sidebar nav, api.js, every page component, and every backend route).

---

## 0. Global App Shell (shared by all authenticated roles)

| Element | Behavior | Status |
|---------|----------|--------|
| **Entry gate** | `App.jsx` → Clerk `SignedIn` → `AppShell`. Syncs Clerk user to backend via `syncClerk()`, sets `dbUser` | ✅ Works |
| **Preloader** | `CinematicPreloader` (2s) on first authenticated load | ✅ Works (feels artificial) |
| **Stabiliser** | 2.5s `setTimeout` after role assignment to prevent onboarding↔dashboard flash | 🟠 Band-aid |
| **Role verification gate** | `RoleIdVerification` (agent/landlord/tenant) or `AdminPasswordGuard` (admin/super_admin) before shell | ✅ Works |
| **Sidebar** (`Sidebar.tsx`) | Role-filtered nav items, collapse toggle, mobile drawer (framer-motion) | ✅ Works |
| **Topbar** (`Topbar.tsx`) | Breadcrumb, M-Pesa env badge, search, notification bell (30s poll), theme toggle, settings modal | ✅ Works |
| **Notifications** | `GET /notifications` polled every 30s; mark read / mark all / clear all / delete one; optimistic cache updates | ✅ Works |
| **Page transitions** | framer-motion `AnimatePresence` keyed on pathname (fade+slide) | ✅ Works |
| **Theme** | `themeStore.ts` Zustand, `light`/`dark` class on `<html>`, persisted to localStorage | ✅ Works |
| **AI Assistant** | `ChatAssistant` mounted on every authenticated screen | ✅ Works |

**Cross-cutting gaps:**
- 🟠 No global loading skeleton on first data fetch (spinners only)
- 🟠 No `<EmptyState>` adoption on any page (component exists but unused)
- 🟠 No confirmation dialogs on most destructive actions (e.g. payment void does prompt, but tenant terminate / property delete often do not)
- 🔴 No error boundary around landing/login/onboarding/map components

---

## 1. Tenant Journey (`/tenant` → `TenantPortalPage.jsx`, 1676 lines)

### 1.1 Onboarding & link
1. **Invite** → agent creates tenant via `/tenants` → tenant record has no `user_id`
2. **Sign up** → Clerk → `/onboarding` → `checkTenantEmail()` matches email → `updateUserRole({role:'tenant'})` → `link-user` backend call joins `Tenant.user_id`
3. **Lands on** `/tenant` (`TenantPortalPage`)
4. **No-profile guard** → if `fetchMyProfile()` returns no tenant, show dark-slate "link your code" form

### 1.2 Dashboard tabs
| Tab | Data call | Action buttons | Loading | Notification |
|------|-----------|----------------|---------|--------------|
| **Overview** | `fetchMyProfile`, `fetchMyPayments`, `fetchMyNotices` | Rent countdown timer (`RentCountdownTimer`), "Pay Rent" CTA | spinner | toast on action |
| **Payments** | `fetchMyPayments` | **Pay Rent** → `autoInitiatePayment()` → STK Push to phone | `stkLoading` state | toast "STK sent"; SMS via `smsService` |
| **Lease** | `fetchMyProfile` (lease_start/end, rent_amount, deposit) | View lease terms | spinner | — |
| **Maintenance** | `fetchMyTickets` | **New Ticket** → `createMaintenanceTicket()` (category + photos via `ImageUpload`); **Update** status | `submitting` | toast |
| **Notices** | `fetchMyNotices` | **Acknowledge** → `acknowledgeNotice(id)` | spinner | toast |
| **Map** | `fetchMyProfile` (property location) | react-leaflet map (🔴 wrong lib — should be Mapbox) | — | — |

### 1.3 The payment flow (critical path)
```
Tenant clicks "Pay Rent"
  → POST /payments/auto-initiate  (requireAuth + pay:rent)
  → backend: find tenant by user_id, compute outstanding = rent + arrears
  → Payment.create(pending)  ← 🔴 created BEFORE STK (orphan risk)
  → mpesaService.initiateSTKPush()  ← 🔴 no token cache
  → STK sent to phone
  → Safaricom → POST /payments/callback (requireSafaricomIP)
  → handleSTKCallback()  ← 🔴 no idempotency, read-modify-write on arrears (race)
  → Tenant.arrears_kes mutated, payment_history.push, Property unit locked
  → SMS confirmation sent
  → Frontend: TanStack Query refetch shows 'confirmed' status
```

### 1.4 Tenant gaps
- 🔴 Payment race condition (see audit)
- 🟠 1676-line god component
- 🟠 Uses react-leaflet (redundant map lib + unpkg CDN dependency)
- 🟠 No confirmation dialog before STK initiation
- 🟡 `estimateLocation` area→coord fallback is semi-fabricated

---

## 2. Landlord Journey (`/dashboard` → `LandlordDashboardPage.jsx`, 610 lines)

### 2.1 Onboarding & approval
1. Sign up → role `landlord`, `landlord_approval_status='pending'` (default `n_a`)
2. `LandlordAddPropertyPage` → `submitLandlordProperty()` with verification docs (R2 upload)
3. Sees **"Landlord Verification Pending"** gate until admin approves

### 2.2 Dashboard
| Section | Data | Buttons | Notes |
|---------|------|---------|-------|
| **KPI cards** | derived from `properties` + `payments` state | — | AnimatedCounter (🟠 K-format bug) |
| **Property portfolio** | `fetchProperties()` filtered to landlord's | hover → parallax tilt, click → `/properties/:id` | GSAP stagger entrance |
| **Financial chart** | `financialData` useMemo (REAL — buckets confirmed payments by month) | — | recharts AreaChart |
| **Mini 3D** | `VoxelBuildingMini3D` (lazy) | — | decorative |
| **Map** | `MapWidget` (lazy, Mapbox) | click property → select | 🔴 fake GPS + 3 techniques |
| **Tenant lease approvals** | tenants with pending lease | **Approve** → `updateTenant()` | `approvingLeaseId` loading state |

### 2.3 Property management
- `/properties` → `PropertiesPage` (list, grid/list toggle, stats)
- `/properties/add` → `LandlordAddPropertyPage` (GPS capture via `createPropertyWithGPS`)
- `/properties/:id` → `PropertyDetailPage` (add/delete units, lock units, geolocation)

### 2.4 Landlord gaps
- 🔴 RBAC bypass lets agents see all properties (affects landlord data privacy)
- 🟠 AnimatedCounter K-format bug
- 🟠 No expenses tracking UI (backend `Expense` model + `/reports/income-statement` exists but no landlord UI)

---

## 3. Agent Journey (`/` → `AgentPerformancePage.jsx`, 975 lines)

### 3.1 Onboarding & approval
1. Sign up → role `agent`, `agent_approval_status='pending'`
2. Upload EARB license → `uploadDoc()` → `updateUserRole({earb_license})`
3. **"Verification Pending"** gate until admin `/admin/agents/:id/approve`

### 3.2 Dashboard tabs
| Tab | Data | Buttons |
|------|------|---------|
| **Leaderboard** | `fetchAgentPerformance()` → top 10 by revenue | medal display |
| **My Tasks** | `fetchMyTasks()` / `fetchAllTasks()` | **Create Task**, **Update Status**, **Delete** (`createTask`, `updateTaskStatus`, `deleteTask`) |
| **Quick Collection** | `fetchProperties`, `fetchTenants` | property/unit pickers → **Initiate STK** → `initiatePayment()` |
| **Property Review** | `fetchProperties` (pending) | **Submit Tier Review** → `submitAgentReview(id, tier)` |
| **Profile** | `dbUser` | avatar upload → `updateUserProfilePicture()` |

### 3.3 Geo check-in
- `CheckInButton` → `agentCheckIn({property_id, lat, lng, accuracy, photo})` → `POST /agents/checkin`
- Backend stores `User.last_location` (2dsphere indexed)

### 3.4 Agent gaps
- 🔴 RBAC bypass — agent with no assignments sees everything
- 🟠 AnimatedCounter K-format bug
- 🟠 `VoxelBackground3D` + `VoxelLogo3D` loaded eagerly (not lazy) → bundle bloat

---

## 4. Admin / Super Admin Journey

**Admin** lands on `/` → `AdminDashboardPage.jsx` (1243 lines).
**Super admin** = admin + can delete properties + grant super_admin.

### 4.1 Admin dashboard
| Section | Data call | Real? |
|---------|-----------|-------|
| KPI cards | `fetchAdminStats()` | ✅ real aggregation |
| Revenue bar chart | `stats.revenue` (6-mo `$group`) | ✅ real |
| Payment status pie | `stats.paymentStatusBreakdown` | ✅ real |
| Pending approvals | `fetchPendingAgents`, `fetchPendingLandlords`, `fetchPendingProperties` | ✅ real |

### 4.2 Verification queue (`/admin/users` → `AdminUserManagementPage`, 1126 lines)
- Approve/reject agents → `approveAgent/rejectAgent`
- Approve/reject landlords → `approveLandlord/rejectLandlord`
- Approve/reject properties → `approveProperty/rejectProperty`
- Create/disable/enable/soft-delete users → `createUser`, `disableUser`, `enableUser`, `softDeleteUser`
- Late-fee rules CRUD → `createLateFeeRule`, `updateLateFeeRule`, `deleteLateFeeRule`
- Property tiers CRUD → `createPropertyTier`, `updatePropertyTier`
- Customer care number → `fetchCustomerCareNumber`, `updateCustomerCareNumber`

### 4.3 Inventory & auctions (`/admin/inventory` → `AdminInventoryPage`, 603 lines)
- `fetchAuctionableItems`, `fetchAllInventory`
- Mark auctionable → `markItemAuctionable`
- Record sale → `recordAuctionSale`
- Reclaim → `reclaimInventoryItem`
- Add/delete items → `addInventoryItem`, `deleteInventoryItem`
- Download auction report (CSV)

### 4.4 Reports
- KRA reconciliation CSV → `downloadKRAReport(month)` (7.5% MRI / 10% WHT)
- Income statement → `GET /reports/income-statement`
- Monthly summary → `GET /reports/summary`

### 4.5 Payments admin
- `/payments` → `PaymentsPage` → **Void** → `voidPayment(id, reason)` (🟠 duplicated balance logic)
- **Override** → `overridePayment(id, {reason, new_status})`

### 4.6 Admin gaps
- 🔴 No route guard on `/admin/users` or `/admin/inventory`
- 🟠 Late-fee rules / customer-care settings live inside user-mgmt page (poor IA)
- 🟠 AdminPasswordGuard uses `admin_hardcoded_hash` (backdoor-shaped)

---

## 5. Accountant Journey (subset of admin)

Same nav as admin but scoped by `requireRole(['admin','super_admin','accountant'])` on:
- `GET /admin/stats`, `/admin/overdue`, `/admin/late-fee-rules`
- `GET /reports/kra`, `/reports/summary`, `/reports/income-statement`
- `GET /inventory/auctionable`, `/inventory/auction-report`

**Cannot:** approve/reject users, manage tiers, void payments, manage customer care.

### 5.1 Accountant gaps
- 🟡 No dedicated accountant landing page — shares admin dashboard
- 🟡 Reports live behind admin nav, not a dedicated "Reports" nav item

---

## 6. Cross-Role Feature Matrix

| Feature | Admin | Landlord | Agent | Tenant | Accountant |
|---------|:-----:|:--------:|:-----:|:------:|:----------:|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅(shared) |
| Properties (CRUD) | ✅ | own | assigned | view | view |
| Tenants (CRUD) | ✅ | view | assigned | self | view |
| Payments (view) | ✅ | own | assigned | own | ✅ |
| Payments (void/override) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Maintenance | ✅ | own | assigned | create+own | ❌ |
| Tasks | ✅ | ❌ | own+assign | ❌ | ❌ |
| Notices (issue) | ✅ | ❌ | ✅ | acknowledge | ❌ |
| KRA / reports | ✅ | ❌ | ❌ | ❌ | ✅ |
| Inventory/auctions | ✅ | ❌ | ❌ | ❌ | view |
| User approvals | ✅ | ❌ | ❌ | ❌ | ❌ |
| Geo check-in | ❌ | ❌ | ✅ | ❌ | ❌ |

---

## 7. Verified Button → Endpoint Map (sample of critical actions)

| Button (page) | Handler | API call | Backend route | Model mutated |
|---------------|---------|----------|---------------|---------------|
| Pay Rent (Tenant) | `autoInitiatePayment` | `POST /payments/auto-initiate` | payments.js:63 | Payment, Tenant (arrears) |
| Approve Lease (Landlord) | `updateTenant` | `PATCH /tenants/:id` | tenants.js:302 | Tenant |
| Initiate STK (Agent) | `initiatePayment` | `POST /payments/initiate-stk` | payments.js:15 | Payment |
| Submit Tier (Agent) | `submitAgentReview` | `PATCH /properties/:id/agent-review` | properties.js:747 | Property |
| Approve Agent (Admin) | `approveAgent` | `PATCH /admin/agents/:id/approve` | admin.js | User |
| Void Payment (Admin) | `voidPayment` | `POST /payments/:id/void` | payments.js:389 | Payment, Tenant (arrears) |
| Create Task (Admin/Agent) | `createTask` | `POST /tasks` | tasks.js | Task |
| Generate Notice | `generateNotice` | `POST /notices/generate` | notices.js:15 | Notice + R2 PDF |
| Check-in (Agent) | `agentCheckIn` | `POST /agents/checkin` | agents.js | User.last_location |

**Verdict:** Every primary action button is wired to a real endpoint. No dead buttons found.
