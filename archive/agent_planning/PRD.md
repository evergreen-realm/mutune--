# MutuneRent Pro — Product Requirements Document (PRD)

**Version:** 1.0.0  
**Date:** June 2025  
**Status:** Production  
**Classification:** Internal — Engineering & Product  

---

## 1. Executive Summary

MutuneRent Pro is a full-stack property management platform designed for the Kenyan real-estate market. It connects property owners (landlords), estate agents, tenants, accountants, and administrators in a single vertically-integrated workflow. The platform differentiates itself through:

- **M-Pesa Daraja integration** for rent collection (STK Push + C2B callbacks)
- **GPS agent check-in** with 50 m property-radius verification and 200 m lock-operation radius
- **AI-powered chat assistant** (Groq LLM) with tenant-context enrichment
- **Property tier classification** (Bronze → Platinum) for automated rent-band validation
- **Inventory & auction system** for asset lifecycle management
- **Digital notice system** with SMS/email delivery, PDF generation, and tenant acknowledgment tracking
- **KRA-compliant reporting** with automated withholding-tax CSV exports
- **Full RBAC with property scoping** — agents see only assigned areas/properties, landlords see only their own assets, tenants see only their unit

The product is live on **Vercel** (React 18 SPA) and **Render** (Node.js 20 + Express API), with **MongoDB Atlas** as the primary data store.

---

## 2. Functional Requirements by Role

### 2.1 Super Admin / Admin

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| A-01 | View platform-wide analytics dashboard (KPIs, 6-month revenue, occupancy rate, top agents) | P0 | ✅ |
| A-02 | Manage user lifecycle: create, edit, deactivate, enable, soft-delete (PII anonymization) | P0 | ✅ |
| A-03 | Approve or reject agent registrations with EARB verification document review | P0 | ✅ |
| A-04 | Approve or reject landlord registrations with property-ownership verification | P0 | ✅ |
| A-05 | Approve or reject landlord property submissions (status: `pending_admin_approval` → `active`/`inactive`) | P0 | ✅ |
| A-06 | Verify and validate property tier classifications proposed by agents | P0 | ✅ |
| A-07 | Configure late-fee rules (grace days, penalty type, penalty value, max per month, property-type scope) | P0 | ✅ |
| A-08 | Configure property tiers (Bronze, Silver, Gold, Platinum) with rent ranges and criteria | P0 | ✅ |
| A-09 | Export KRA-formatted rent-reconciliation CSV (monthly, with 10 % commercial WHT / 7.5 % residential MRI) | P0 | ✅ |
| A-10 | Override payment status (manual confirmation/void) with audit trail and reason capture | P0 | ✅ |
| A-11 | View overdue-tenant report (tenants with no confirmed payment in last 30 days) | P0 | ✅ |
| A-12 | View agent-performance leaderboard (task completion rate, rent collected, maintenance resolution time) | P0 | ✅ |
| A-13 | Broadcast in-app notifications to roles or specific users | P1 | ✅ |
| A-14 | Admin password verification with bcrypt-hashed hardcoded password and rate-limited endpoint | P0 | ✅ |
| A-15 | Soft-delete users with automatic Clerk session revocation, tenant unit vacation, and PII anonymization | P0 | ✅ |

### 2.2 Agent

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| G-01 | GPS check-in to property (within 50 m radius) with photo capture and accuracy recording | P0 | ✅ |
| G-02 | View and toggle digital unit locks (within 200 m of checked-in property, 30-minute session expiry) | P0 | ✅ |
| G-03 | View assigned properties and units (scoped by `assigned_property_ids` or `assigned_areas`) | P0 | ✅ |
| G-04 | View tenants in assigned properties only | P0 | ✅ |
| G-05 | Verify payments with geo-tagged location and photo evidence | P0 | ✅ |
| G-06 | Issue digital notices to tenants (rent increase, maintenance, eviction, lease renewal, inspection, general) | P0 | ✅ |
| G-07 | Create and update maintenance tickets for assigned properties | P0 | ✅ |
| G-08 | Review landlord property submissions and propose tier classification | P0 | ✅ |
| G-09 | View inventory for assigned properties and mark items auctionable | P1 | ✅ |
| G-10 | View personal task list with auto-overdue flagging and completion tracking | P0 | ✅ |
| G-11 | AI chat assistant access for property/tenant queries | P1 | ✅ |
| G-12 | Agent approval workflow: register with EARB license, upload verification doc, await admin approval | P0 | ✅ |

### 2.3 Landlord

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| L-01 | Submit new properties for admin approval with digital signature, unit details, and GPS coordinates | P0 | ✅ |
| L-02 | View own properties and their occupancy/financial status | P0 | ✅ |
| L-03 | View rent-payment history for own properties | P0 | ✅ |
| L-04 | View maintenance tickets reported by tenants in own properties | P0 | ✅ |
| L-05 | View KRA-compliant reports for own properties | P1 | ✅ |
| L-06 | Landlord approval workflow: register, upload ownership verification doc, await admin approval | P0 | ✅ |
| L-07 | Receive notifications for property approval/rejection events | P0 | ✅ |

### 2.4 Tenant

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| T-01 | Pay rent via M-Pesa STK Push (auto-initiated from outstanding balance) | P0 | ✅ |
| T-02 | View payment history and current arrears balance | P0 | ✅ |
| T-03 | Submit maintenance tickets with photos (max 5), category, and priority | P0 | ✅ |
| T-04 | View own maintenance ticket status and resolution history | P0 | ✅ |
| T-05 | View digital notices issued to their unit and acknowledge receipt | P0 | ✅ |
| T-06 | AI chat assistant access for rent/balance/maintenance queries | P1 | ✅ |
| T-07 | Onboarding via tenant code linking or vacant-unit selection | P0 | ✅ |
| T-08 | Receive SMS and email notifications for payment confirmations, notices, and maintenance updates | P0 | ✅ |

### 2.5 Accountant

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| C-01 | View all payments with filtering by status, property, and date | P0 | ✅ |
| C-02 | Export KRA-formatted CSV reconciliation reports | P0 | ✅ |
| C-03 | View late-fee rules and payment breakdowns | P0 | ✅ |
| C-04 | View agent performance reports for commission calculations | P1 | ✅ |
| C-05 | View auctionable inventory for asset-disposal accounting | P1 | ✅ |

---

## 3. Non-Functional Requirements

### 3.1 Performance

| Metric | Target | Implementation |
|--------|--------|----------------|
| API p95 response time | < 200 ms (cached reads), < 800 ms (writes) | React Query stale-time 30 s, MongoDB lean queries, compound indexes |
| Frontend TTI | < 3 s on 4G | Vite build, code-splitting by route, lazy loading of heavy libs (Three.js, Recharts) |
| Map widget load | < 2 s for 50 markers | Leaflet with MarkerCluster, lazy-loaded GeoJSON |
| Payment callback processing | < 500 ms end-to-end | Async M-Pesa callback handler, background SMS dispatch |
| PDF generation | < 3 s for single-page notices | PDFKit streaming, non-blocking on delivery failure |
| Cron job execution | < 5 min for late-fee applicator | Batch processing with idempotency checks |

### 3.2 Security

See Section 7 for detailed security requirements. Summary targets:
- OWASP Top 10 compliance (A01–A10)
- Role-Based Access Control (RBAC) with property-level scoping
- Data encryption in transit (TLS 1.2+) and at rest (MongoDB Atlas encryption)
- Admin password hashing with bcrypt (cost factor 10)
- Clerk webhook signature verification
- M-Pesa callback IP allowlisting (Safaricom CIDRs)

### 3.3 Scalability

| Dimension | Strategy |
|-----------|----------|
| Horizontal API scaling | Stateless Express API deployable to multiple Render instances behind load balancer |
| Database scaling | MongoDB Atlas M10+ with auto-scaling; compound indexes for query efficiency |
| File storage | Cloudflare R2 (S3-compatible, unlimited scale) for verification docs and photos |
| Read-heavy workloads | React Query client-side caching; future server-side Redis cache for property listings |
| Geospatial queries | 2dsphere indexes on `Property.location`, `Property.units.unit_geolocation`, `User.last_location` |

### 3.4 Availability

| Target | Implementation |
|--------|----------------|
| API uptime | 99.9 % (Render health checks, auto-restart on crash) |
| Frontend uptime | 99.9 % (Vercel edge network) |
| Database uptime | 99.95 % (MongoDB Atlas replica set, 3-node cluster) |
| Degraded mode | If Clerk is unavailable, API returns 401 with cached RBAC checks where safe |
| Health monitoring | `/api/v1/health` endpoint returns `ok` + timestamp; Sentry alerts on 5xx errors |

### 3.5 Maintainability

| Practice | Implementation |
|----------|----------------|
| Code style | ESLint (React + Node), consistent error-response envelope `{ success, error: { code, message } }` |
| Logging | Structured JSON logs with `utils/logger` (path, method, user ID, error stack) |
| Error tracking | Sentry integration with user context and request metadata |
| Testing | Jest + Supertest backend (coverage threshold 80 %); Vitest frontend |
| Documentation | Inline JSDoc for services; this PRD; API route comments |
| Environment parity | `.env.local` (dev) and `.env.production.local` (prod) with identical key names |

### 3.6 Accessibility

| Requirement | Implementation |
|-------------|----------------|
| WCAG 2.1 AA | Color contrast ratios ≥ 4.5:1 for normal text, ≥ 3:1 for large text |
| Keyboard navigation | All interactive elements reachable via Tab; modal focus trapping |
| Screen-reader support | Semantic HTML (`<nav>`, `<main>`, `<button>`), `aria-label` on icons, `aria-live` for toast notifications |
| Motion | `prefers-reduced-motion` respected; Framer Motion animations are subtle (< 0.3 s) |
| Form labels | All inputs have visible labels or `aria-label`; validation errors announced |

---

## 4. API Specification

Base URL: `https://api.mutunerent.pro/api/v1` (production)  
Auth: `Authorization: Bearer <Clerk JWT>` (required for all endpoints except webhooks and health)

### 4.1 Authentication & Users

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/health` | None | Service health check |
| GET | `/users/me` | Clerk | Fetch current user profile with Clerk sync |
| GET | `/users/check-tenant-email/:email` | Clerk | Check if tenant email exists before onboarding |
| PATCH | `/users/me/role` | Clerk | Onboarding: set role, link tenant code, create tenant |
| GET | `/users` | Clerk + Admin | List all users (paginated, filterable by role/active) |
| POST | `/users` | Clerk + Admin | Create user manually (admin/tenant/agent/landlord/accountant) |
| PATCH | `/users/:id` | Clerk + Admin/Self | Update user fields (admin can edit all; self can edit name/phone) |
| POST | `/users/:id/deactivate` | Clerk + Admin | Deactivate user account |
| PATCH | `/users/:id/disable` | Clerk + Admin | Disable + revoke all Clerk sessions |
| PATCH | `/users/:id/enable` | Clerk + Admin | Re-enable user account |
| DELETE | `/users/:id/soft` | Clerk + Admin | Soft delete: anonymize PII, vacate unit, delete Clerk user |
| POST | `/users/sync-clerk` | Clerk | Upsert user from Clerk after login |
| POST | `/users/webhook` | Clerk Webhook Secret | Listen for `user.created` / `user.updated` |

### 4.2 Properties

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/properties` | Clerk | List properties (role-scoped: agent→assigned, landlord→own, tenant→current) |
| GET | `/properties/nearby` | Clerk | Geospatial search by `lng`, `lat`, `radius` (100–50,000 m) |
| GET | `/properties/units/vacant` | Clerk | List all vacant units with property context (for tenant onboarding) |
| GET | `/properties/:id` | Clerk + Scope | Get property detail with landlord/agent populate |
| POST | `/properties` | Clerk + Admin/Agent/Landlord | Create property with auto-generated `property_code` |
| POST | `/properties/with-gps` | Clerk + Admin/Agent/Landlord | Backwards-compatible GPS property creation |
| PATCH | `/properties/:id` | Clerk + Admin | Update property fields (name, address, agents, amenities) |
| DELETE | `/properties/:id` | Clerk + Super Admin | Hard delete property |
| POST | `/properties/:id/units` | Clerk + Admin/Agent/Landlord | Add unit to property |
| PATCH | `/properties/:id/units/:unitId` | Clerk + Scope | Update unit status, lock, rent, bedrooms, etc. |
| PATCH | `/properties/:id/units/:unitId/geolocation` | Clerk + Admin/Agent | Set unit GPS coordinates |
| GET | `/properties/:id/units/geojson` | Clerk | Export all units as GeoJSON FeatureCollection |
| POST | `/properties/:id/units/:unitId/lock` | Clerk + Admin/Agent | Lock/unlock unit (agent requires active 30-min check-in within 200 m) |
| DELETE | `/properties/:id/units/:unitId` | Clerk + Admin | Delete unit (blocked if active tenant) |
| POST | `/properties/landlord/submit` | Clerk + Landlord | Landlord submits property for admin approval |
| PATCH | `/properties/:id/agent-review` | Clerk + Agent | Agent proposes tier and sends to admin |
| POST | `/properties/:id/approve` | Clerk + Admin | Approve pending landlord property |
| POST | `/properties/:id/reject` | Clerk + Admin | Reject pending landlord property with reason |

### 4.3 Tenants

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/tenants` | Clerk + Scope | List tenants (role-scoped) |
| GET | `/tenants/:id` | Clerk + Scope | Get tenant detail with full payment history and KYC |
| POST | `/tenants` | Clerk + Admin/Agent | Create tenant profile and assign to unit |
| PATCH | `/tenants/:id` | Clerk + Admin/Agent | Update tenant fields (lease, rent, status, KYC) |
| POST | `/tenants/:id/depart` | Clerk + Admin/Agent | Mark tenant as departed, vacate unit, record departure date |
| GET | `/tenants/:id/payments` | Clerk + Scope | Get tenant payment history |
| GET | `/tenants/overdue` | Clerk + Admin | Alias for admin overdue report |

### 4.4 Payments

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/payments/initiate-stk` | Clerk + Tenant | Initiate M-Pesa STK Push for a specific tenant/unit |
| POST | `/payments/auto-initiate` | Clerk + Tenant | Auto-initiate STK Push for logged-in tenant's outstanding balance |
| POST | `/payments/callback` | IP Allowlist | M-Pesa STK/C2B callback (Safaricom IP range check) |
| POST | `/payments/callback/validate` | None | M-Pesa validation callback (always accept) |
| GET | `/payments` | Clerk + Scope | List payments (role-scoped, filterable by status, property, search) |
| POST | `/payments/:id/override` | Clerk + Admin | Manual override payment status (super_admin required for > KES 100,000) |
| POST | `/payments/:id/void` | Clerk + Admin | Void payment with reason (reverses tenant balances and unit lock) |
| POST | `/payments/test-sms` | Clerk + Admin | Test SMS delivery (admin only) |

### 4.5 Maintenance

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/maintenance` | Clerk + Tenant | Create maintenance ticket (max 5 photos) |
| GET | `/maintenance/my-tickets` | Clerk + Tenant | View tenant's own tickets |
| GET | `/maintenance` | Clerk + Admin/Agent/Landlord | View all tickets (role-scoped) |
| PATCH | `/maintenance/:id` | Clerk + Admin/Agent | Update ticket status, assign agent, add notes, tenant satisfaction |
| DELETE | `/maintenance/:id` | Clerk + Owner/Admin | Delete ticket (tenant only if status === `open`) |

### 4.6 Notices

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/notices/generate` | Clerk + Admin/Agent | Create notice, generate PDF, deliver via SMS/email/portal |
| GET | `/notices` | Clerk + Scope | List notices for tenant or admin/agent view |
| POST | `/notices/:id/acknowledge` | Clerk + Tenant | Tenant acknowledges notice receipt |
| GET | `/notices/:id/pdf` | Clerk | Download generated notice PDF |

### 4.7 Agents

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/agents/checkin` | Clerk + Agent | GPS check-in with photo verification (50 m radius) |
| GET | `/agents/location` | Clerk + Agent | Get agent's last recorded location |
| GET | `/agents/all-locations` | Clerk + Admin | View all active agent locations (admin only) |

### 4.8 Admin

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/admin/stats` | Clerk + Admin | Dashboard KPIs (properties, tenants, revenue, occupancy, top agents) |
| GET | `/admin/overdue` | Clerk + Admin | Overdue tenants (no payment in 30 days) |
| GET | `/admin/agent-performance` | Clerk + Admin/Agent | Agent leaderboard with task/payment/maintenance metrics |
| GET | `/admin/agents/pending` | Clerk + Admin | List pending agent approvals |
| PATCH | `/admin/agents/:id/approve` | Clerk + Admin | Approve agent, generate Agent ID code |
| PATCH | `/admin/agents/:id/reject` | Clerk + Admin | Reject agent with reason |
| GET | `/admin/landlords/pending` | Clerk + Admin | List pending landlord approvals |
| PATCH | `/admin/landlords/:id/approve` | Clerk + Admin | Approve landlord, generate 6-digit Landlord ID |
| PATCH | `/admin/landlords/:id/reject` | Clerk + Admin | Reject landlord with reason |
| POST | `/admin/landlords` | Clerk + Admin | Manually create landlord (auto-approved) |
| GET | `/admin/late-fee-rules` | Clerk + Admin/Accountant | List all late-fee rules |
| POST | `/admin/late-fee-rules` | Clerk + Admin | Create late-fee rule |
| PATCH | `/admin/late-fee-rules/:id` | Clerk + Admin | Update late-fee rule |
| DELETE | `/admin/late-fee-rules/:id` | Clerk + Admin | Delete late-fee rule |
| GET | `/admin/tiers` | Clerk + Admin/Agent | List property tiers |
| POST | `/admin/tiers` | Clerk + Admin | Create property tier |
| PATCH | `/admin/tiers/:id` | Clerk + Admin | Update property tier |
| PATCH | `/admin/properties/:id/verify-tier` | Clerk + Admin | Approve or reject proposed tier |
| POST | `/admin/verify-password` | Clerk + Admin + Rate Limit | Verify admin hardcoded password (5 attempts / 15 min) |

### 4.9 Tasks

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/tasks/agent/my` | Clerk + Agent | Get agent's tasks with auto-overdue flagging and summary |
| GET | `/tasks` | Clerk + Admin | Admin view of all tasks (filter by agent, status, date range) |
| POST | `/tasks` | Clerk + Admin | Create and assign task to agent |
| PATCH | `/tasks/:id` | Clerk + Admin/Agent | Update task status, notes, completion date |
| DELETE | `/tasks/:id` | Clerk + Admin | Delete task |

### 4.10 Inventory

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/inventory/auctionable` | Clerk + Admin/Accountant | List all auctionable items across properties |
| POST | `/inventory/:propertyId/mark-auctionable` | Clerk + Admin | Flag inventory item as auctionable |
| POST | `/inventory/:propertyId/auction-sold` | Clerk + Admin | Record auction sale with buyer and amount |
| POST | `/inventory/:propertyId/reclaim` | Clerk + Admin | Reclaim item from auction (tenant paid arrears) |
| GET | `/inventory/:propertyId` | Clerk + Scope | View property inventory |
| POST | `/inventory/:propertyId` | Clerk + Admin/Agent | Add inventory item to property |
| PATCH | `/inventory/:propertyId/:itemId` | Clerk + Admin/Agent | Update inventory item condition/notes |
| DELETE | `/inventory/:propertyId/:itemId` | Clerk + Admin | Remove inventory item |

### 4.11 Notifications

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/notifications` | Clerk | Get user's scoped notifications (max 50) with unread count |
| PATCH | `/notifications/:id/read` | Clerk | Mark single notification as read |
| PATCH | `/notifications/read-all` | Clerk | Mark all notifications as read |
| POST | `/notifications` | Clerk + Admin | Broadcast notification to role or specific users |

### 4.12 Reports

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/reports/kra?month=YYYY-MM` | Clerk + Admin/Accountant | Download KRA CSV reconciliation report |
| GET | `/reports/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD` | Clerk + Admin | Revenue trend report (JSON) |
| GET | `/reports/occupancy` | Clerk + Admin | Occupancy rate by property and area |

### 4.13 AI

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/ai/chat` | Clerk | Send message to AI assistant (tenant context enriched automatically) |
| GET | `/ai/history/:session_id` | Clerk | Get chat history (session must contain user ID) |
| DELETE | `/ai/history/:session_id` | Clerk | Clear chat history |

### 4.14 Upload

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/upload/doc` | Clerk + Daily Rate Limit | Upload verification document to Cloudflare R2 (max 5 MB, PDF/JPEG/PNG/WebP) |

---

## 5. Data Model Summary

### 5.1 User

```javascript
{
  user_code:           String, unique, required  // e.g. "USR-AGT-0001"
  role:                String, enum: ['super_admin','admin','agent','landlord','accountant','tenant'], index
  full_name:           String, required
  email:               String, unique, required
  phone:               String
  password_hash:       String                     // legacy fallback
  earb_license:        String
  earb_verified:       Boolean, default: false
  earb_verification_doc_url: String
  agent_approval_status: String, enum: ['pending','approved','rejected','n_a'], default: 'n_a'
  agent_rejection_reason: String
  agent_allow_all_areas: Boolean, default: false
  landlord_id:         String, unique, sparse     // 6-digit generated ID
  landlord_approval_status: String, enum, default: 'n_a', index
  landlord_verification_doc_url: String
  admin_hardcoded_hash: String                    // bcrypt hash of env admin password
  assigned_areas:      [String]
  assigned_property_ids: [ObjectId] → Property
  ai_memory_id:        String, unique, sparse
  current_property_id: ObjectId → Property
  current_unit_id:     ObjectId
  last_location:       { type: 'Point', coordinates: [Number], accuracy: Number, recorded_at: Date }
  last_checkin_photo:  String
  is_active:           Boolean, default: true
  clerk_id:            String, unique, sparse     // Clerk user ID
  created_at:          Date, default: Date.now
}
// Indexes: role (1), last_location.coordinates (2dsphere, sparse), landlord_id (1, sparse)
```

### 5.2 Property

```javascript
{
  property_code:       String, unique, required  // e.g. "MUT-UNK-001"
  name:                String, required
  type:                String, enum: ['apartment','single_family','commercial','mixed_use','bedsitter','studio','house','single']
  address:             { street, area, city, county, plus_code }
  location:            { type: 'Point', coordinates: [lng, lat] }
  boundaries:          { type: 'Polygon', coordinates: [[[Number]]] }
  units:               [UnitSchema]               // embedded subdocs
  landlord_id:         ObjectId → User
  agent_ids:           [ObjectId] → User
  inventory:           [InventoryItemSchema]      // embedded subdocs
  amenities:           [String]
  status:              String, enum: ['pending_admin_approval','active','inactive'], default: 'active'
  contract_pdf_url:    String
  tier_id:             ObjectId → PropertyTier
  proposed_tier_id:    ObjectId → PropertyTier
  tier_approved_by:    ObjectId → User
  tier_approved_at:    Date
  review_status:       String, enum: ['pending_agent','pending_admin','approved','rejected'], default: 'pending_agent'
  photos:              [String]
  created_at:          Date
  updated_at:          Date
}
// Indexes: location (2dsphere), units.unit_geolocation (2dsphere), property_code (1), landlord_id (1), units.current_tenant_id (1)
```

#### UnitSchema (embedded)

```javascript
{
  unit_number:   String, required
  unit_type:     String
  bedrooms:      Number
  bathrooms:     Number
  floor:         Number
  size_sqft:     Number
  size_sqm:      Number
  rent_kes:      Number, required, min: 0
  status:        String, enum: ['vacant','occupied','maintenance','notice_issued'], default: 'vacant'
  current_tenant_id: ObjectId → Tenant
  lock_status:   String, enum: ['unlocked','pending_viewing','viewed_unlocked','payment_confirmed','locked'], default: 'unlocked'
  unit_geolocation: { type: 'Point', coordinates: [lng, lat] }
}
```

#### InventoryItemSchema (embedded)

```javascript
{
  item_id:            String, required
  name:               String, required
  category:           String, enum: ['furniture','electronics','fixture','appliance','other']
  condition:          String, enum: ['new','good','fair','damaged','auctionable']
  auctionable:          Boolean, default: false
  auctionable_marked_at: Date
  auctionable_reason:   String
  auction_status:     String, enum: ['pending','sold','reclaimed','disposed']
  auction_sold_at:    Date
  auction_buyer:      String
  auction_sale_amount: Number
  reclaimed_at:       Date
  reclaim_receipt_id: ObjectId → Payment
  unit_id:            ObjectId
  estimated_value_kes: Number
  photos:             [String]
  added_date:         Date, default: Date.now
  last_audit_date:    Date
  audit_agent_id:     ObjectId → User
}
```

### 5.3 Tenant

```javascript
{
  tenant_code:         String, unique, required  // e.g. "TNT-MOM-0001"
  user_id:             ObjectId → User, sparse
  full_name:           String, required
  id_number:           String, required
  phone:               String, required
  email:               String
  emergency_contact:   { name, phone, relationship }
  kyc_verified:        Boolean, default: false
  kyc_documents:       [{ type: enum, url, uploaded_at }]
  current_unit_id:     ObjectId
  current_property_id: ObjectId → Property
  lease_start:         Date
  lease_end:           Date
  rent_amount_kes:     Number, min: 0
  deposit_paid_kes:    Number, min: 0
  deposit_held:        Boolean, default: true
  payment_history:     [{ month, amount_kes, status, payment_id }]
  arrears_kes:         Number, default: 0, min: 0
  tenancy_status:      String, enum: ['active','terminated','notice','pending','expired','departed'], default: 'active'
  departed_at:         Date
  notice_status:       String, enum: ['none','7_day','30_day','eviction_pending'], default: 'none'
  preferred_channel:   String, enum: ['email','sms','both'], default: 'both'
  notes:               String
  guarantor:           { full_name, phone, id_number, relationship }
  created_at:          Date
  updated_at:          Date
}
// Indexes: phone (1), email (1, sparse), id_number (1), user_id (1, sparse), current_unit_id (1), current_property_id (1), tenancy_status (1)
```

### 5.4 Payment

```javascript
{
  transaction_id:      String, unique, required
  mpesa_receipt:       String
  tenant_id:           ObjectId → Tenant
  property_id:         ObjectId → Property
  unit_id:             ObjectId
  amount_kes:          Number, required, min: 0
  payment_type:        String, enum: ['rent','deposit','penalty','water','electricity','service_charge']
  channel:             String, enum: ['mpesa_stk','mpesa_c2b','bank_transfer','cash','diaspora_wire']
  status:              String, enum: ['pending','processing','confirmed','failed','reversed','manual_override'], default: 'pending'
  workflow_state:      String, enum: ['PENDING_VIEWING','VIEWED_UNLOCKED','PAYMENT_CONFIRMED','HOUSE_LOCKED','MANUAL_REVIEW'], default: 'PENDING_VIEWING'
  mpesa_callback:      { ResultCode, ResultDesc, CallbackMetadata, received_at }
  verified_by_agent_id: ObjectId → User
  verification_method:  String, enum: ['auto_mpesa','agent_geo','manual_override','bank_recon']
  verification_location: { type: 'Point', coordinates: [Number] }
  verification_photo:   String
  discrepancy_flag:     Boolean, default: false
  discrepancy_reason:   String
  created_at:           Date
  updated_at:           Date
}
// Indexes: tenant_id + status (compound), mpesa_receipt (1), status (1), created_at (-1), verification_location.coordinates (2dsphere, sparse)
```

### 5.5 Notice

```javascript
{
  notice_type:         String, enum: ['rent_increase','maintenance','eviction','lease_renewal','entry_inspection','general']
  property_id:         ObjectId → Property, required, index
  unit_id:             ObjectId, required
  tenant_id:           ObjectId → Tenant, required, index
  issued_by:           ObjectId → User, required
  title:               String, required, maxlength: 200
  body:                String, required, maxlength: 5000
  delivery_method:     [String: 'sms'|'email'|'portal'|'whatsapp']
  delivery_status:     [{ method, status, timestamp, provider_message_id }]
  pdf_url:             String
  requires_acknowledgment: Boolean, default: true
  tenant_acknowledged: Boolean, default: false
  acknowledged_at:     Date
  effective_date:      Date, required
  expiry_date:         Date
  legal_basis:         String, maxlength: 500
  created_at:          Date, index
  updated_at:          Date
}
// Indexes: tenant_id + created_at (compound), notice_type (1), delivery_status.status (1)
```

### 5.6 MaintenanceTicket

```javascript
{
  ticket_code:         String, unique, required  // e.g. "MT-ABCD-001"
  property_id:         ObjectId → Property
  unit_id:             ObjectId
  tenant_id:           ObjectId → Tenant
  created_by:          ObjectId → User
  category:            String, enum: ['plumbing','electrical','structural','security','appliance','pest_control','cleaning','other']
  priority:            String, enum: ['low','medium','high','emergency'], default: 'medium'
  description:         String, required, maxlength: 2000
  photos:              [String] (max 5)
  status:              String, enum: ['open','assigned','in_progress','pending_parts','resolved','closed','tenant_disputed'], default: 'open'
  assigned_agent_id:   ObjectId → User
  agent_notes:         String
  tenant_satisfaction: Number, min: 1, max: 5
  created_at:          Date
  updated_at:          Date
  resolved_at:         Date
}
// Indexes: property_id + status (compound), tenant_id (1), status (1), created_by (1)
```

### 5.7 LateFeeRule

```javascript
{
  name:                String, required
  grace_days:          Number, default: 5
  penalty_type:        String, enum: ['percentage','fixed'], default: 'percentage'
  penalty_value:       Number, required
  max_penalty_per_month: Number
  applies_to:          String, enum: ['all','residential','commercial'], default: 'all'
  is_active:           Boolean, default: true
  created_by:          ObjectId → User
  created_at:          Date
  updated_at:          Date
}
```

### 5.8 PropertyTier

```javascript
{
  name:                String, required, unique  // 'Bronze', 'Silver', 'Gold', 'Platinum'
  min_rent_kes:        Number, required
  max_rent_kes:        Number, required
  description:         String
  criteria:            String
  is_active:           Boolean, default: true
  created_by:          ObjectId → User
  created_at:          Date
}
```

### 5.9 SystemSetting

```javascript
{
  key:                 String, required, unique  // e.g. 'customer_care'
  value:               String, required
  description:         String
  updated_at:          Date
}
```

### 5.10 Notification

```javascript
{
  type:                String, enum: ['property_approval','maintenance_urgent','payment_alert','agent_approval','landlord_approval','general']
  recipient_role:      String, enum: ['admin','agent','landlord','tenant'], required
  recipient_ids:       [ObjectId] → User
  title:               String, required
  message:             String, required
  related_entity_id:   ObjectId
  property_name:       String
  property_area:       String
  property_tier_name:  String
  property_rent:       Number
  read_by:             [ObjectId] → User
  dismissed_by:        [ObjectId] → User
  created_at:          Date
}
```

### 5.11 Task

```javascript
{
  assigned_to:         ObjectId → User, required
  assigned_by:         ObjectId → User, required
  title:               String, required
  description:         String, required
  type:                String, enum: ['check_in','payment_followup','inspection','maintenance'], required
  related_property_id: ObjectId → Property
  related_unit_id:     ObjectId
  related_tenant_id:   ObjectId → Tenant
  due_date:            Date, required
  status:              String, enum: ['pending','in_progress','completed','overdue'], default: 'pending'
  completed_at:        Date
  created_at:          Date
}
```

---

## 6. Integration Points

### 6.1 Clerk Authentication

| Aspect | Detail |
|--------|--------|
| Product | `@clerk/clerk-react` (frontend) + `@clerk/clerk-sdk-node` (backend) |
| Flow | User signs in via Clerk → frontend calls `/users/sync-clerk` → backend upserts User record with Clerk ID linkage |
| Role Sync | Backend syncs `publicMetadata.role` to/from Clerk on every `/users/me` call and webhook event |
| Session Revocation | On user disable/soft-delete, all active Clerk sessions are revoked via `clerkClient.sessions.revokeSession` |
| Webhook | `/users/webhook` listens for `user.created` and `user.updated` with `X-Webhook-Secret` header verification |

### 6.2 M-Pesa Daraja

| Aspect | Detail |
|--------|--------|
| Product | Safaricom M-Pesa Daraja API v2 |
| STK Push | `POST /payments/initiate-stk` → `mpesaService.initiateSTKPush()` → tenant receives USSD push |
| Callback | `POST /payments/callback` — IP-restricted to Safaricom CIDRs (`196.201.214.0/24`, `196.201.215.0/24`) |
| Validation | `POST /payments/callback/validate` — always returns `ResultCode: 0` (accept all) |
| C2B | Unmatched C2B payments auto-logged as `manual_override` with `discrepancy_flag: true` |
| Auto-confirm | On successful STK callback, payment auto-confirmed if amount mismatch ≤ KES 100; otherwise flagged for manual review |
| SMS Receipt | Africa's Talking SMS sent to tenant on successful payment confirmation |

### 6.3 Cloudflare R2

| Aspect | Detail |
|--------|--------|
| Product | Cloudflare R2 (S3-compatible object storage) |
| SDK | `@aws-sdk/client-s3` |
| Usage | Verification document uploads (`verification-docs/<userId>-<uuid>.pdf`), notice PDFs, inventory photos, check-in photos |
| Upload Route | `POST /upload/doc` — multer memory storage, 5 MB limit, MIME filter (PDF/JPEG/PNG/WebP), daily upload rate limit (20/user) |
| Public URL | `CLOUDFLARE_R2_PUBLIC_URL` env variable prepended to object keys |

### 6.4 Africa's Talking SMS

| Aspect | Detail |
|--------|--------|
| Product | Africa's Talking REST SMS API |
| SDK | `africastalking` npm package |
| Usage | Payment confirmation SMS, auto-initiate rent reminders, notice delivery fallback, landlord submission confirmations |
| Service File | `backend/services/sms.js` |
| Failover | SMS failures are logged as warnings but never block the primary transaction flow |

### 6.5 Groq AI

| Aspect | Detail |
|--------|--------|
| Product | Groq API (LLM inference) via `groq-sdk` |
| Route | `POST /api/v1/ai/chat` |
| Context Enrichment | For tenants, backend automatically injects `tenantName`, `unitId`, `propertyName`, `propertyCode`, `preferredChannel` into the AI context |
| Session Management | Session IDs contain user ID for security; history isolated per session |
| Rate Limiting | Backend returns 429 if Groq quota exceeded; client shows retry message |
| Tool Intents | AI can suggest tool calls: `create_maintenance_ticket`, `check_payment_status`, `get_property_details`, `get_tenant_history` |

### 6.6 Sentry Error Monitoring

| Aspect | Detail |
|--------|--------|
| Product | `@sentry/react` (frontend) + `@sentry/node` (backend) |
| Frontend | ErrorBoundary captures React render errors; `Sentry.setUser()` on Clerk sync |
| Backend | Unhandled errors captured in Express error middleware with `path`, `method`, `user` context |
| Scope | User ID, email, role, request path, and method attached to every Sentry event |

---

## 7. Security Requirements

### 7.1 OWASP Top 10 Compliance

| OWASP ID | Threat | Mitigation |
|----------|--------|------------|
| A01 — Broken Access Control | Unauthorized cross-tenant data access | RBAC middleware (`rbac.js`) + `enforcePropertyScope` middleware; role-scoped MongoDB queries on every route |
| A02 — Cryptographic Failures | Plaintext passwords or weak hashing | Admin passwords hashed with bcrypt (cost 10); all traffic over HTTPS; MongoDB Atlas TLS |
| A03 — Injection | NoSQL injection | `express-mongo-sanitize` middleware; `mongoSanitize` applied globally; all user inputs validated with `express-validator` |
| A04 — Insecure Design | Missing approval workflows | Agent/landlord onboarding requires document upload + manual admin approval before activation |
| A05 — Security Misconfiguration | Debug endpoints exposed | Debug endpoints removed for production; `NODE_ENV` gated behaviors |
| A06 — Vulnerable Components | Outdated npm packages | `npm audit` in CI; lockfile committed; Dependabot alerts enabled |
| A07 — Identification & Auth Failures | Session hijacking, weak auth | Clerk JWT validation on every route; session revocation on disable; token expiry enforced by Clerk |
| A08 — Data Integrity Failures | Tampered M-Pesa callbacks | IP allowlist (`requireSafaricomIP`) + callback idempotency checks |
| A09 — Security Logging Failures | Undetected breaches | Structured JSON logs with user IDs, IP addresses, and request paths; Sentry alerts on 5xx |
| A10 — SSRF | Server-Side Request Forgery | Strict CORS whitelist; no open URL fetching from user input; AI context sanitized |

### 7.2 Role-Based Access Control (RBAC)

Permission matrix defined in `backend/middleware/rbac.js`:

| Role | Permissions |
|------|-------------|
| `super_admin` | `*` (all permissions) |
| `admin` | `*` (all permissions) |
| `agent` | `view:assigned`, `lock:house`, `verify:payment`, `issue:notice`, `view:inventory`, `edit:inventory`, `create:maintenance`, `view:maintenance`, `ai:chat`, `checkin:property`, `view:payments`, `pay:rent` |
| `landlord` | `view:own_properties`, `view:payments`, `view:reports`, `edit:property`, `view:assigned` |
| `accountant` | `view:payments`, `view:reports`, `export:kra`, `verify:payment` |
| `tenant` | `view:own_unit`, `pay:rent`, `view:notices`, `create:maintenance`, `view:maintenance`, `view:payments`, `ai:chat` |

### 7.3 Encryption

| Layer | Method |
|-------|--------|
| Transport | TLS 1.2+ (Vercel edge + Render auto-TLS) |
| Database | MongoDB Atlas encryption at rest (AES-256) |
| Secrets | Environment variables (`.env.production.local`); never committed to Git |
| Admin Passwords | bcrypt hash with salt rounds 10; stored in `admin_hardcoded_hash` field |
| PII on Soft Delete | Email overwritten to `deleted_<timestamp>@mutunerent.deleted`, phone to `0000000000`, name to `Deleted User <timestamp>` |

### 7.4 CORS Policy

```javascript
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://mutunerent-web.vercel.app',
  'https://mutunerent-web-mishael-s-alpha.vercel.app',
  'https://mutune-alpha.vercel.app',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
];

// Regex allows any Vercel preview subdomain: ^https://(mutunerent|mutune)(-.+)?\.vercel\.app$
```

- Credentials: `true`
- Methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`
- Allowed Headers: `Content-Type, Authorization, X-Requested-With, Accept, Origin`

### 7.5 Content Security Policy (Helmet)

```javascript
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "unpkg.com", "fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "*.tile.openstreetmap.org", "*.cloudflare.com"],
      connectSrc: ["'self'", "*.mongodb.net", "*.sentry.io", "api.render.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
});
```

### 7.6 Rate Limiting

| Endpoint / Scope | Window | Max | Implementation |
|------------------|--------|-----|----------------|
| General API | 15 min | 300 req | `express-rate-limit` global middleware |
| Admin password verify | 15 min | 5 req | `verifyPasswordLimiter` on `/admin/verify-password` |
| Document upload | 24 h | 20 uploads | `dailyUploadLimiter` keyed by user ID |
| M-Pesa callbacks | N/A | N/A | IP-restricted to Safaricom CIDRs (bypasses rate limit) |

---

## 8. Deployment Architecture

### 8.1 Frontend (Vercel)

| Attribute | Detail |
|-----------|--------|
| Platform | Vercel Serverless Functions + Edge Network |
| Build Tool | Vite 5.2.0 |
| Framework | React 18.3.1 (SPA with React Router v6) |
| Output | Static build (`dist/`) deployed to Vercel |
| Environment | `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_BASE_URL`, `VITE_SENTRY_DSN` |
| Domain | `https://mutunerent-web.vercel.app` (production) + preview subdomains |
| Caching | Vercel edge caching for static assets; API calls via React Query with 30 s stale time |

### 8.2 Backend (Render)

| Attribute | Detail |
|-----------|--------|
| Platform | Render Web Service (Node.js 20+) |
| Runtime | Node.js 20+ (specified in `engines`) |
| Process | `node server.js` (Express 4.19.2) |
| Health Check | `GET /api/v1/health` |
| Auto-deploy | Connected to Git `main` branch |
| Environment | `PORT`, `MONGODB_URI`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `MPESA_*`, `AFRICASTALKING_*`, `GROQ_API_KEY`, `SENTRY_DSN`, `CLOUDFLARE_R2_*`, `ADMIN_PASSWORD`, `FRONTEND_URL` |
| Cron Jobs | `node-cron` runs inside the same process: tenant lease cleanup (daily 00:05 EAT), late fee applicator (daily 00:10 EAT) |
| Scaling | Vertical scaling on Render; horizontal via multiple instances if stateless session store added |

### 8.3 Database (MongoDB Atlas)

| Attribute | Detail |
|-----------|--------|
| Provider | MongoDB Atlas (M10 cluster or higher) |
| Version | MongoDB 8.4.0 (Mongoose 8.4.0 ODM) |
| Region | AWS `af-south-1` (Cape Town) or `eu-west-1` (Ireland) for lowest latency to Kenyan users |
| Replication | 3-node replica set with automatic failover |
| Backups | Atlas continuous backups with 35-day point-in-time recovery |
| Monitoring | Atlas Performance Advisor + Query Profiler |
| Connection | TLS-encrypted connection string with IP allowlist |

### 8.4 Supporting Services

| Service | Role | Provider |
|---------|------|----------|
| Object Storage | Verification docs, PDFs, photos | Cloudflare R2 |
| SMS Gateway | Payment receipts, notice delivery | Africa's Talking |
| AI Inference | Chat assistant, natural-language queries | Groq |
| Error Monitoring | Real-time error tracking and alerts | Sentry |
| Email Delivery | HTML emails for approvals/rejections | Resend |
| Maps | Property and unit geolocation visualization | Leaflet + OpenStreetMap |

### 8.5 Network Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Browser    │  │  Mobile Web  │  │   M-Pesa     │      │
│  │  (React SPA) │  │  (Responsive)│  │   Callback   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼─────────────────┼─────────────────┼────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      EDGE / GATEWAY                          │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Vercel Edge Network (CDN + SSL termination)            │ │
│  │  CORS whitelist + Clerk JWT forwarding                  │ │
│  └────────────────────┬──────────────────────────────────┘ │
│                       │                                      │
│  ┌────────────────────┴──────────────────────────────────┐   │
│  │  Render Load Balancer (API)                         │   │
│  │  IP allowlist for M-Pesa callbacks                    │   │
│  └────────────────────┬──────────────────────────────────┘   │
└───────────────────────┼──────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Node.js 20 + Express 4.19.2 (Render Web Service)       │ │
│  │  • Helmet CSP + Rate Limit + Mongo Sanitize               │ │
│  │  • Clerk JWT verification + RBAC middleware               │ │
│  │  • Sentry error capture + Structured logging              │ │
│  │  • Cron: late-fee applicator + tenant lease cleanup       │ │
│  └────────────────────┬──────────────────────────────────┘   │
└───────────────────────┼──────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ MongoDB Atlas   │  │ Cloudflare R2   │  │  Clerk       │ │
│  │ (Primary DB)    │  │ (Object Store)  │  │  (Identity)  │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

*Document End*
