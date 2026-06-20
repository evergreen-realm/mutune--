# Original User Request

## Initial Request — 2026-06-19T12:05:24Z

**MutuneRent Pro** is a full-stack property management SaaS for Mutune Estate Agency (Mombasa, Kenya). The task is to audit & fix all remaining bugs, resolve the Vercel deployment gap (production URL shows an 18h-old build, NOT the latest local commit), ensure all user data flows (phone → Gmail → role) work end-to-end with no stubs, and make the platform definitively superior to the competitor EazzyRent Kenya — all while enforcing cybersecurity hardening across the full stack.

Working directory: `c:\Users\Admin\Desktop\mutune`

Integrity mode: development

---

## Background Intelligence (Pre-Researched)

### Root Cause of Production URL Issue
- Latest local commit: `1384261` ("fix: chat assistant on all screens, verification queue nav, onboarding stability")
- Production URL `https://mutunerent-web-mishael-s-alpha.vercel.app/` IS aliased to the `mutunerent-rnwx9n6u2` deployment (18h old) which is itself the latest Vercel deploy — BUT **Vercel is not auto-deploying from the newest git push**
- The `frontend` subfolder's `vercel.json` has no `rootDirectory` set correctly for the monorepo; the `.vercel/project.json` shows `rootDirectory: null` in the frontend project config but `"rootDirectory": "frontend"` in the root `.vercel/project.json`, causing Vercel to miss automatic Git integration triggers
- Local `npm run build` in `/frontend` completes **successfully** with zero errors (only a chunk-size warning)
- Vercel CLI 54.11.1 is installed and authenticated as `evergreen-realm` on team `mishael-s-alpha`
- The production alias `mutunerent-web-mishael-s-alpha.vercel.app` correctly points to the latest ready deployment but that deployment is from an older build — a fresh `npx vercel --prod` from the `frontend` directory will fix it

### Tech Stack
- **Frontend**: React + Vite + TailwindCSS, hosted on Vercel (project: `mutunerent-web`, team: `mishael-s-alpha`)
- **Backend**: Node.js/Express + MongoDB (Mongoose) + Clerk auth, hosted on Render
- **Auth**: Clerk (role sync via webhooks + DB user model)
- **Roles**: `admin`, `agent`, `landlord`, `tenant`
- **Key routes**: payments, properties, tenants, users, agents, admin, maintenance, reports, notices, ai, tasks, inventory, notifications, upload
- **Pages**: DashboardPage, TenantsPage, PaymentsPage, AddPropertyPage, AdminDashboardPage, TenantPortalPage, NoticesPage, LoginPage, SignUpPage, PropertiesPage, PropertyDetailPage, OnboardingPage, MaintenancePage, LandlordDashboardPage, LandlordAddPropertyPage, AgentPerformancePage, AdminUserManagementPage, AdminInventoryPage

### Competitor Intelligence: EazzyRent Kenya
EazzyRent's strengths: automated invoicing, M-Pesa/Paybill, bulk SMS/email, landlord+tenant portals, trial balance & income statement reports, granular permissions, accrual accounting, bulk Excel import, 24/7 monitoring.
**MutuneRent must exceed** by offering: real-time AI chat assistant, geo-verified agent check-ins, agent performance analytics, distress inventory reclamation, verification document uploads (R2), tenant code-based onboarding, area-scoped agents, KRA tax reporting (7.5% MRI / 10% WHT), and superior UX.

### Security Posture (already in codebase)
- Helmet CSP, CORS whitelist with regex for Vercel subdomains, rate limiting (300/15min), mongoSanitize, Sentry error tracking
- Needs: CSRF tokens for state-mutating routes, input validation hardening (express-validator), JWT/Clerk token verification on ALL protected routes, secrets not leaked in responses
- Debug/temp endpoints that MUST be removed: `/api/v1/users/debug-role`, `/api/v1/users/check-user-role`, `/api/v1/users/check-all-users`

---

## Requirements

### R1. Fix Vercel Production Deployment Gap
Investigate why `https://mutunerent-web-mishael-s-alpha.vercel.app/` is not serving the latest local codebase (commit `1384261`). Force a fresh production deployment from the current codebase using `npx vercel --prod` from the `c:\Users\Admin\Desktop\mutune\frontend` directory. The deployed site must serve the same build as `npm run build` produces locally. After deployment, verify by checking that the deployed JS bundle hash differs from the currently live `index-DCIl0FOU.js`. Also ensure the GitHub Actions / Vercel Git integration is set up so future pushes to `main` auto-deploy.

### R2. Full Code Audit — Zero Stubs, Zero TODOs, Zero Placeholders
Audit every file in `frontend/src/` and `backend/` for:
- `TODO`, `FIXME`, `stub`, `placeholder`, `mock`, `// ...` comments that indicate unimplemented logic
- Hardcoded test data, fake API responses, or conditional `if (process.env.NODE_ENV === 'test')` bypasses in production paths
- Any route or page that throws a 404 or returns `{ error: "Not implemented" }` in production
- Scratch/debug files at root level: `check_clerk.js`, `cleanup_users.js`, `scratch_check_user.js` — these must be removed from the repo
All such items must be fully implemented with real business logic. The application must be demo-ready with genuine data flows.

### R3. End-to-End User Identity & Role Tying
Every user record must be uniquely tied by: **phone number + Gmail (email) + Clerk ID + MongoDB `_id` + role**. Verify and fix:
- `POST /api/v1/users/sync` correctly creates or updates a user record in MongoDB with `clerkId`, `email`, `phone`, `role`, `name`
- Role-based routing on the frontend (App.jsx) correctly reads from the DB user role (not just Clerk metadata) and redirects each role to the correct dashboard
- The Clerk webhook (`/api/v1/users/webhook`) correctly handles `user.created`, `user.updated`, and `user.deleted` events to keep MongoDB in sync
- Tenant onboarding via unique tenant code correctly links a Clerk user to an existing tenant record in MongoDB
- All 4 roles (admin, agent, landlord, tenant) must have fully functional, non-stubbed dashboards and navigation
- The User MongoDB model must include: `clerkId` (unique), `email` (unique), `phone` (unique, sparse), `name`, `role`, `isActive`, `createdAt`, `updatedAt`

### R4. Competitive Feature Parity & Superiority over EazzyRent
Add or complete features that make MutuneRent definitively better than EazzyRent:
- **Bulk operations**: Bulk SMS/email notices to tenants (backend route + frontend UI) — EazzyRent has this, MutuneRent must too. Add `POST /api/v1/notices/bulk` and a "Send Bulk Notice" button on the NoticesPage
- **Financial reports**: Monthly income statement and trial balance report endpoints in `/api/v1/reports` visible in the admin dashboard — currently KRA CSV exists but not full P&L. Add `GET /api/v1/reports/income-statement?month=YYYY-MM` and display results in AdminDashboardPage
- **Real-time notifications**: In-app notifications (`/api/v1/notifications`) must be polled every 30s and displayed in the navbar bell icon with correct unread count badge
- **M-Pesa receipt verification**: The payment reconciliation flow must show matched vs unmatched M-Pesa transactions in the payments page with status badges
- All existing MutuneRent differentiators (AI chat, geo agent check-in, verification docs, KRA tax reports) must be fully functional

### R5. Cybersecurity Hardening (OWASP Top 10)
Audit and fix the following security gaps across the full stack:
- **A01 Broken Access Control**: Every backend route that modifies data must verify that the authenticated user has the correct role (admin/agent/landlord/tenant) before processing. Add `requireRole(['admin'])` middleware where missing. Area-scoped agents must only access properties/tenants in their assigned area.
- **A03 Injection**: All MongoDB queries using user-supplied `req.params` or `req.body` fields must use Mongoose typed schemas (not raw string interpolation). Verify `mongoSanitize` middleware is active for all routes.
- **A05 Security Misconfiguration**: Remove debug/temp endpoints from production (`/api/v1/users/debug-role`, `/api/v1/users/check-user-role`, `/api/v1/users/check-all-users`). Remove scratch files from repo (`check_clerk.js`, `cleanup_users.js`, `scratch_check_user.js`).
- **A07 Auth Failures**: Clerk token verification middleware must be applied to ALL non-health routes. Verify no route is accidentally public. Add `express-validator` input sanitization to all POST/PUT/PATCH routes.
- **A09 Logging**: Sensitive fields (`password`, `clerkId`, `phone`) must never appear in log output. Audit the Winston logger calls in all route files and redact sensitive fields.

### R6. Nielsen/Norman Usability — Full CRUD Actions Per Role on Every Data Instance
Every entity that a user can interact with (property, tenant, payment, notice, maintenance ticket, task, inventory item, notification, agent record) must expose the full set of contextually appropriate actions based on the authenticated user's role. Specifically:
- **Input (Create/Edit)**: Every form must have clear labels, inline validation feedback, and a visible Save/Submit button. Required fields must be marked with an asterisk (*). Forms must show a success or error toast on completion.
- **Output (View/Export)**: Every list and detail view must display data in a readable, structured format. Tables must support at minimum: sorting by key column, and an "Export CSV" or "Download" button where data reporting is relevant.
- **Redo/Undo**: Any destructive or state-changing action (mark paid, approve, reject, evict, archive) must show a confirmation dialog BEFORE committing, and where feasible an "Undo" or "Revert" option for up to 30 seconds after the action (using a toast with an Undo button).
- **Cancel**: Every modal, drawer, or multi-step form must have a clearly visible Cancel/Close button that safely discards unsaved changes without data loss.
- **Delete**: Delete actions must be role-gated (only admin or the record owner can delete), must require a confirmation dialog with the record name displayed, and must use a soft-delete pattern (mark `isDeleted: true`) rather than hard-deleting from MongoDB.

All UI interactions must satisfy Nielsen's 10 Usability Heuristics:
1. **Visibility of system status** — loading spinners, progress indicators (skeleton loaders), and status badges on every async operation
2. **Match between system and real world** — use Kenyan property/tenant terminology and M-Pesa-familiar language
3. **User control and freedom** — cancel/undo available on all state changes
4. **Consistency and standards** — unified component library (buttons, cards, modals, tables) used throughout; no ad-hoc one-off styles
5. **Error prevention** — form validation runs on blur + submit; disable Submit button while loading
6. **Recognition rather than recall** — breadcrumbs on all nested pages; role label always visible in the navbar
7. **Flexibility and efficiency** — quick-filter/search inputs on all tables; keyboard Esc to close modals
8. **Aesthetic and minimalist design** — each page has one primary action highlighted; no clutter
9. **Help users recognize, diagnose, and recover from errors** — all API errors display human-readable messages with a suggested next action
10. **Help and documentation** — each page has a collapsible info panel explaining the page purpose and available actions

Role permissions matrix for CRUD actions (enforce in both frontend UI visibility AND backend middleware):
| Action | Admin | Agent | Landlord | Tenant |
|--------|-------|-------|----------|--------|
| Create property | ✅ | ✅ (own area) | ✅ (own) | ❌ |
| Edit property | ✅ | ✅ (own area) | ✅ (own) | ❌ |
| Delete property | ✅ | ❌ | ✅ (own, soft) | ❌ |
| Create tenant | ✅ | ✅ | ✅ | ❌ |
| Edit tenant | ✅ | ✅ (own area) | ✅ (own) | ✅ (self) |
| Delete tenant | ✅ | ❌ | ❌ | ❌ |
| Create payment | ✅ | ✅ | ✅ | ✅ |
| Void/Cancel payment | ✅ | ❌ | ❌ | ❌ |
| Create notice | ✅ | ✅ | ✅ | ❌ |
| Delete notice | ✅ | ✅ (own) | ✅ (own) | ❌ |
| Create maintenance | ✅ | ✅ | ✅ | ✅ |
| Close/Delete maintenance | ✅ | ✅ (own) | ✅ (own) | ❌ |
| Delete inventory | ✅ | ❌ | ❌ | ❌ |

---

## Acceptance Criteria

### Deployment
- [ ] `https://mutunerent-web-mishael-s-alpha.vercel.app/` serves a JS bundle with a DIFFERENT hash from `index-DCIl0FOU.js` (the pre-fix hash), confirming a new build was deployed
- [ ] `npx vercel ls` in the `frontend` directory shows a new deployment created within the last 60 minutes with status `● Ready` pointing to the production alias

### Code Quality
- [ ] `grep -rn "TODO\|FIXME\|stub\|placeholder\|Not implemented" frontend/src/ backend/routes/ backend/models/` returns zero results
- [ ] `cd frontend && npm run build` exits with code 0 and no error-level messages (chunk size warnings are acceptable)
- [ ] Scratch debug files (`check_clerk.js`, `cleanup_users.js`, `scratch_check_user.js`) no longer exist in the backend directory

### User Identity
- [ ] The User MongoDB schema includes all 5 required fields: `clerkId`, `email`, `phone`, `role`, `name` — all indexed appropriately
- [ ] `POST /api/v1/users/sync` returns a 200 with the full user object including all 5 fields
- [ ] Role-based redirect works: admin → `/admin`, agent → `/dashboard`, landlord → `/landlord`, tenant → `/tenant-portal`

### Security
- [ ] `GET /api/v1/users/debug-role` and similar temp endpoints return 404
- [ ] `GET /api/v1/properties` without Authorization header returns 401
- [ ] Backend Winston logs do NOT contain raw `clerkId` or `phone` values in any log line
- [ ] All POST/PUT/PATCH routes in `backend/routes/` have at least one `express-validator` check

### Competitive Features
- [ ] `GET /api/v1/reports/income-statement` returns a valid JSON response with revenue and expense totals
- [ ] Navbar bell icon shows correct unread notification count fetched from `/api/v1/notifications`
- [ ] `POST /api/v1/notices/bulk` accepts `{ tenantIds: [], message: string }` and returns 200
- [ ] NoticesPage UI has a "Send Bulk Notice" button that opens a recipient selector and sends the bulk notice

### Usability & CRUD Actions (Nielsen/Norman)
- [ ] Every data table (properties, tenants, payments, notices, maintenance, tasks, inventory) has Edit, Delete (role-gated), and where applicable a Cancel/Void action button per row
- [ ] All delete actions show a confirmation dialog with the record name before committing
- [ ] Every form has: required-field markers (*), inline validation on blur, a Cancel button, and a disabled Submit while loading
- [ ] Every async operation shows a loading spinner or skeleton state (no blank screens during loading)
- [ ] All API errors display a human-readable message in a toast or inline error block
- [ ] Each page has a breadcrumb trail and the current user role badge is visible in the navbar

## Follow-up — 2026-06-19T12:28:49Z

### Bug Fixed Locally (commit c7da348 already pushed + deployed)
`frontend/src/pages/OnboardingPage.jsx` has been **fully rewritten**. The fix:

**Problem**: When a user with a pre-registered Gmail signs up, the system was showing the role picker even though it already detected the tenant record. The user had to manually click "Tenant" to trigger the email check — wrong UX.

**Fix Applied**:
- On mount, `checkTenantEmail(email)` fires **immediately** (before role selection)
- If a pre-registered tenant is found → auto-set role to `tenant`, auto-fill tenant code, **skip role picker entirely** and jump to a dedicated `step = 'tenant-confirm'` screen
- The confirm screen shows: Gmail verified badge, tenant name on record, auto-filled code field (green/locked), phone field, "Confirm & Complete Registration" CTA, and a Back button
- If `has_account === true` → show a blocking warning screen (account already linked)
- Agents and Landlords are unaffected — they still see the role picker + their own verification fields

### Tasks to add:
1. **Verify** the backend `POST /api/v1/users/sync` (or `updateUserRole`) correctly handles `tenant_code` linking and returns a valid user with `role: 'tenant'`
2. **Verify** `GET /api/v1/tenants/check-email` (the `checkTenantEmail` endpoint) returns `{ exists, tenant_code, has_account, tenant_name }` — confirm field names match what the new frontend expects
3. **Verify** after successful tenant code confirmation, the user is redirected to `/tenant` portal (not `/`)  — fix `navigate('/')` → `navigate('/tenant')` in `handleSubmit` if needed
4. **Make sure** the tenant portal `/tenant` is fully functional with no stubs — all CRUD actions (view lease, log maintenance, pay rent via M-Pesa) must work end-to-end

Continue your full audit work (R1–R6). The git main branch is at commit `c7da348`.

## 2026-06-19T21:04:21Z

**MutuneRent Pro** is a full-stack property management SaaS for Mutune Estate Agency (Mombasa, Kenya). The task is to audit & fix all remaining bugs, resolve the Vercel deployment gap, ensure all user data flows work end-to-end with no stubs, and make the platform definitively superior to the competitor EazzyRent Kenya — all while enforcing cybersecurity hardening across the full stack.

Working directory: `c:\Users\Admin\Desktop\mutune`

Integrity mode: development

---

## Background Intelligence (Pre-Researched)

### Root Cause of Production URL Issue
- Latest local commit: `1384261` ("fix: chat assistant on all screens, verification queue nav, onboarding stability")
- Production URL `https://mutunerent-web-mishael-s-alpha.vercel.app/` IS aliased to the `mutunerent-rnwx9n6u2` deployment (18h old) which is itself the latest Vercel deploy — BUT **Vercel is not auto-deploying from the newest git push**
- The `frontend` subfolder's `vercel.json` has no `rootDirectory` set correctly for the monorepo; the `.vercel/project.json` shows `rootDirectory: null` in the frontend project config but `"rootDirectory": "frontend"` in the root `.vercel/project.json`, causing Vercel to miss automatic Git integration triggers
- Local `npm run build` in `/frontend` completes **successfully** with zero errors (only a chunk-size warning)

### Tech Stack
- **Frontend**: React + Vite + TailwindCSS, hosted on Vercel (project: `mutunerent-web`, team: `mishael-s-alpha`)
- **Backend**: Node.js/Express + MongoDB (Mongoose) + Clerk auth, hosted on Render
- **Auth**: Clerk (role sync via webhooks + DB user model)
- **Roles**: `admin`, `agent`, `landlord`, `tenant`
- **Key routes**: payments, properties, tenants, users, agents, admin, maintenance, reports, notices, ai, tasks, inventory, notifications, upload

### Competitor Intelligence: EazzyRent Kenya
EazzyRent's strengths: automated invoicing, M-Pesa/Paybill, bulk SMS/email, landlord+tenant portals, trial balance & income statement reports, granular permissions, accrual accounting, bulk Excel import, 24/7 monitoring.
**MutuneRent must exceed** by offering: real-time AI chat assistant, geo-verified agent check-ins, agent performance analytics, distress inventory reclamation, verification document uploads (R2), tenant code-based onboarding, area-scoped agents, KRA tax reporting (7.5% MRI / 10% WHT), and superior UX.

### Security Posture (already in codebase)
- Helmet CSP, CORS whitelist with regex for Vercel subdomains, rate limiting (300/15min), mongoSanitize, Sentry error tracking
- Needs: CSRF tokens for state-mutating routes, input validation hardening (express-validator), JWT/Clerk token verification on ALL protected routes, secrets not leaked in responses

---

## Requirements

### R1. Fix Vercel Production Deployment Gap & Redeploy
Investigate why `https://mutunerent-web-mishael-s-alpha.vercel.app/` is not serving the latest local codebase. Force a fresh production deployment from the current codebase using Vercel CLI. Ensure that the deployed site serves the latest build after applying all fixes.

### R2. Full Code Audit — Zero Stubs, Zero TODOs, Zero Placeholders
Audit every file in `frontend/src/` and `backend/` for:
- `TODO`, `FIXME`, `stub`, `placeholder`, `mock`, `// ...` comments that indicate unimplemented logic
- Hardcoded test data, fake API responses, or conditional `if (process.env.NODE_ENV === 'test')` bypasses in production paths
- Any route or page that throws a 404 or returns `{ error: "Not implemented" }` in production
All such items must be fully implemented with real business logic. The application must be demo-ready with genuine data flows.

### R3. End-to-End User Identity & Role Tying
Every user record must be uniquely tied by: **phone number + Gmail (email) + Clerk ID + MongoDB `_id` + role**. Verify and fix:
- `POST /api/v1/users/sync` correctly creates or updates a user record in MongoDB with `clerkId`, `email`, `phone`, `role`, `name`
- Role-based routing on the frontend (App.jsx) correctly reads from the DB user role (not just Clerk metadata) and redirects each role to the correct dashboard
- The Clerk webhook (`/api/v1/users/webhook`) correctly handles `user.created`, `user.updated`, and `user.deleted` events to keep MongoDB in sync
- Tenant onboarding via unique tenant code correctly links a Clerk user to an existing tenant record in MongoDB
- All 4 roles (admin, agent, landlord, tenant) must have fully functional, non-stubbed dashboards and navigation

### R4. Competitive Feature Parity & Superiority over EazzyRent
Add or complete features that make MutuneRent definitively better than EazzyRent:
- **Bulk operations**: Bulk SMS/email notices to tenants (backend route + frontend UI) — EazzyRent has this, MutuneRent must too
- **Financial reports**: Monthly income statement and trial balance report endpoints in `/api/v1/reports` visible in the admin dashboard — currently KRA CSV exists but not full P&L
- **Real-time notifications**: In-app notifications (`/api/v1/notifications`) must be polled and displayed in the navbar bell icon with correct unread count
- **M-Pesa receipt verification**: The payment reconciliation flow must show matched vs unmatched M-Pesa transactions in the payments page
- All existing MutuneRent differentiators (AI chat, geo agent check-in, verification docs, KRA tax reports) must be fully functional

### R5. Cybersecurity Hardening (OWASP Top 10)
Audit and fix the following security gaps across the full stack:
- **A01 Broken Access Control**: Every backend route that modifies data must verify that the authenticated user has the correct role before processing.
- **A03 Injection**: All MongoDB queries using user-supplied parameters must use Mongoose typed schemas. Verify `mongoSanitize` middleware is active for all routes.
- **A05 Security Misconfiguration**: Remove any debug/temp endpoints (`/api/v1/users/debug-role`, `/api/v1/users/check-user-role`) from production.
- **A07 Auth Failures**: Clerk token verification middleware must be applied to ALL non-health routes.
- **A09 Logging**: Sensitive fields must never appear in log output. Audit Winston logger calls.

### R6. Nielsen/Norman Usability — Full CRUD Actions Per Role on Every Data Instance
Every entity that a user can interact with (property, tenant, payment, notice, maintenance ticket, task, inventory item, notification, agent record) must expose the full set of contextually appropriate actions based on the authenticated user's role. Ensure forms have loading status, cancel buttons, confirmation prompts, error diagnostics, and undo capabilities where destructive actions are performed.

### R7. Onboarding & Tenant Profile Fixes (Immediate Priorities)
- **Landlord Pending Default Bug**: In `User.js` schema, `landlord_approval_status` must default to `'n_a'` instead of `'pending'` so that new users without a chosen role are not treated as landlords. Ensure the frontend `App.jsx` handles redirection correctly so new users can access the onboarding page without getting blocked by role-pending screens.
- **Tenant Dashboard Profile Matching & Tenant ID Guard**: In `TenantPortalPage.jsx`, if the user logs in as a tenant but doesn't have a linked Tenant profile (e.g. `fetchMyProfile` returns a 404/NO_TENANT_PROFILE), do NOT show a blank screen or a white page, and do NOT lock them. Instead, display a clean form asking for their Tenant Code (with validation, error feedback, and a submit button). On submit, call the backend role-update/link API (`PATCH /users/me/role` with `{ role: 'tenant', tenant_code }`) to link their profile, and refresh the dashboard.

---

## Acceptance Criteria

### Onboarding & Tenant Profile
- [ ] New users signing up can access the `/onboarding` page immediately and choose their roles.
- [ ] Tenant users without a linked profile are prompted to enter their tenant code on the dashboard instead of a white page or sign-out loop. Entering a valid code successfully links their profile and unlocks the portal.
- [ ] `User` schema has `landlord_approval_status` default value set to `'n_a'`.

### Deployment
- [ ] The updated site is successfully built and redeployed to production at the alias `mutunerent-web-mishael-s-alpha.vercel.app` after applying all fixes.
- [ ] `npx vercel ls` in the `frontend` directory shows a new deployment created with status `● Ready` pointing to the production alias.

### Code Quality
- [ ] `grep -r "TODO\|FIXME\|stub\|placeholder\|Not implemented" frontend/src/ backend/routes/ backend/models/` returns zero results.
- [ ] `cd frontend && npm run build` exits with code 0 and no errors.
- [ ] `cd backend && npm test` (if tests exist) exits with no failures.

### User Identity
- [ ] Navigating to `/` as each of the 4 roles redirects to the correct role-specific dashboard without errors.

## Follow-up — 2026-06-19T21:19:08Z

Critical user request to apply two immediate onboarding and profile linking fixes, verify them, and then trigger a production redeployment.

1. **New User Onboarding Block (Landlord Pending Default)**:
   - In `backend/models/User.js` schema, change `landlord_approval_status` to default to `'n_a'` instead of `'pending'`.
   - Ensure that when new users register/sync (before choosing a role), their landlord and agent approval statuses default to `'n_a'`.
   - Review the redirection checks in `frontend/src/App.jsx` to verify role-less users are strictly sent to `/onboarding` and not blocked by pending approval screens.

2. **Tenant ID Guard & Profile Matching (Tenant Dashboard)**:
   - In `frontend/src/pages/TenantPortalPage.jsx`, if a tenant user logs in but has no linked Tenant profile (i.e. `profile` is null or `fetchMyProfile` returned a `NO_TENANT_PROFILE` error code), do NOT show a static blocking screen or white page.
   - Instead, display a clean dark slate UI form that asks them to input their Tenant Code.
   - On submission, validate the code and call the backend link/role-update endpoint (`PATCH /users/me/role` with `{ role: 'tenant', tenant_code: code }`) to link the profile, then trigger `load()` to refresh the dashboard and unlock the portal.

3. **Production Build & Deploy**:
   - Run `npm run build` inside `frontend/` to confirm zero build errors.
   - Deploy the latest changes to production via Vercel CLI from the root folder:
     ```powershell
     cd frontend; npm run build; npx vercel --prod --yes
     ```
     Ensure the alias is associated with the new deployment: `mutunerent-web-mishael-s-alpha.vercel.app`.

## Follow-up — 2026-06-19T21:25:47Z

Please proceed with the following fixes immediately using the subagents or executing them yourself:

1. **User Schema Update**:
   - In `backend/models/User.js`, change the default value of `landlord_approval_status` to `'n_a'` instead of `'pending'`.
   
2. **Onboarding & Redirection Fixes**:
   - In `frontend/src/App.jsx`, ensure new users who do not have a role (role-less users) are not blocked or treated as landlords awaiting approval. They must be allowed to access the `/onboarding` page.

3. **Tenant Portal Linking & Guard**:
   - In `frontend/src/pages/TenantPortalPage.jsx`, if the profile fails with `NO_TENANT_PROFILE` (404) or is missing, do not crash to a white page or show a blank screen. Display a clean input form requesting the Tenant Code (using our dark slate design system: `slate-950` background, `green-600` accents).
   - On submission, call the backend endpoint `PATCH /users/me/role` with `{ role: 'tenant', tenant_code }` (or the appropriate endpoint configured to link the user with a tenant code and update their role) and reload the dashboard upon success.

4. **Verify and Deploy**:
   - Run `npm run build` inside `frontend/` to verify there are no compilation errors.
   - Deploy the latest changes to production using `npx vercel --prod --yes` from the root folder.
   - Verify the production alias is correctly mapped to `mutunerent-web-mishael-s-alpha.vercel.app`.

5. **Commit and Sync**:
   - Commit all changes to the repository with a clear message and push to remote.



