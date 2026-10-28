# MutuneRent Pro — Complete Data Flow Map (All Roles)

> **Purpose:** Trace every data path from frontend route → API call → backend route → Mongoose model → MongoDB collection → external service. Confirmed by reading every backend route file, model, and the frontend `api.js` client.

---

## 0. Stack Topology

```
Browser (React 18 + Vite)
  ├─ Clerk SDK → Clerk JWT (session token)
  ├─ axios client (api.js) → Authorization: Bearer <Clerk JWT>
  │    └─ baseURL: VITE_API_URL (Render)
  └─ Mapbox GL JS → VITE_MAPBOX_TOKEN (client-side)
        │
        ▼
Backend (Node 20 + Express 4) on Render
  ├─ middleware/auth.js   → ClerkExpressRequireAuth → User.findOne({clerk_id}) → req.user
  ├─ middleware/rbac.js   → requirePermission / requireRole / enforcePropertyScope
  ├─ middleware/security.js → requireSafaricomIP (M-Pesa callbacks only)
  ├─ middleware/sanitize.js → mongoSanitize
  ├─ routes/*.js          → business logic
  ├─ models/*.js          → Mongoose 8 schemas
  └─ services/*.js        → external integrations
        │
        ▼
External Services
  ├─ MongoDB Atlas (MONGODB_URI)
  ├─ M-Pesa Daraja (MPESA_*)  → STK Push + callbacks
  ├─ Africa's Talking (AT_*)  → SMS
  ├─ Resend (RESEND_*)        → Email
  ├─ Cloudflare R2 (CLOUDFLARE_R2_*) → object storage (photos, PDFs)
  ├─ Groq AI (GROQ_*)         → chat
  └─ Sentry (SENTRY_DSN)      → error tracking
```

---

## 1. Models & Collections (verified)

| Model | Collection | PII / sensitive fields | Key indexes |
|-------|------------|------------------------|-------------|
| **User** | `users` | `email`, `phone`, `admin_hardcoded_hash`, `clerk_id`, `last_location` (GPS), `profile_picture` | `clerk_id` unique sparse, `role`, `last_location` 2dsphere |
| **Property** | `properties` | `landlord_id`, `agent_ids`, `address`, `location` (GeoJSON Point), `units[]` (embedded) | `landlord_id`, `location` 2dsphere |
| **Unit** (embedded in Property.units) | — | `tenant_id`, `rent_kes`, `lock_status`, `status` | — |
| **Tenant** | `tenants` | 🔴 `id_number`, `phone`, `email`, `emergency_contact`, `kyc_documents[].url`, `guarantor.id_number`, `payment_history[]` | `phone`, `email` sparse, `id_number`, `user_id` sparse |
| **Payment** | `payments` | `mpesa_receipt`, `tenant_id`, `verification_location` | `transaction_id` unique, `mpesa_receipt` (🟠 not unique), `tenant_id+status`, `verification_location` 2dsphere |
| **MaintenanceTicket** | `maintenancetickets` | `tenant_id`, `photos[]`, `assigned_agent_id` | `tenant_id`, `property_id`, `status` |
| **Notice** | `notices` | `tenant_id`, `recipient_ids[]`, `pdf_url` | `tenant_id`, `created_at` |
| **Task** | `tasks` | `assigned_to`, `related_property_id` | `assigned_to`, `status`, `due_date` |
| **Notification** | `notifications` | `recipient_ids[]`, `read_by[]` | `recipient_ids`, `created_at` |
| **Expense** | `expenses` | `property_id`, `amount_kes` | `property_id`, `payment_date` |
| **LateFeeRule** | `latefeerules` | — | — |
| **PropertyTier** | `propertytiers` | — | — |

---

## 2. Authentication Data Flow

```
1. User signs in via Clerk (Google SSO or email)
2. Clerk issues JWT → frontend stores in Clerk session
3. Frontend: syncClerk({clerk_id, email, full_name, phone})
     → POST /users/sync-clerk (verifyClerkToken middleware — not requireAuth)
     → User.findOneAndUpdate({clerk_id}, {...}, {upsert:true})
     → returns dbUser (with role, approval statuses)
4. Every subsequent request: axios interceptor attaches Bearer JWT
5. Backend requireAuth:
     → ClerkExpressRequireAuth validates JWT
     → User.findOne({clerk_id}).lean() → req.user
     → checks is_active, is_deleted
6. RBAC: requirePermission(p) checks permissions[role] array
7. Scope: enforcePropertyScope checks agent assignments / tenant ownership / landlord ownership
```

---

## 3. Role-Specific Data Flows

### 3.1 Tenant — Rent Payment (THE critical money flow)

```
[Frontend] TenantPortalPage → autoInitiatePayment()
   │
   ▼ POST /payments/auto-initiate  [requireAuth, requirePermission('pay:rent')]
[Backend] payments.js:63
   ├─ Tenant.findOne({user_id: req.user._id})           → tenant
   ├─ outstanding = tenant.rent_amount_kes + tenant.arrears_kes
   ├─ Property.findById(tenant.current_property_id)
   ├─ transactionId = `MUT-${Date.now()}-${random}`     ← 🔴 weak
   ├─ Payment.create({pending, PENDING_VIEWING})        ← 🔴 before STK (orphan risk)
   ├─ mpesaService.initiateSTKPush()                    ← 🔴 no token cache
   │     ├─ getAccessToken() → Safaricom OAuth
   │     └─ POST Safaricom /stkpush/v1/processrequest
   ├─ payment.transaction_id = checkoutRequestId; save
   ├─ Notification.create({recipient: tenant})
   └─ smsService.send() → Africa's Talking
   │
   ▼ (async) Safaricom callback
[Backend] payments.js:146  POST /payments/callback [requireSafaricomIP]
   └─ handleSTKCallback(stkCallback)
         ├─ Payment.findOne({transaction_id: checkoutRequestId})   ← 🔴 no idempotency
         ├─ if ResultCode !== 0 → payment.status='failed', save, return
         ├─ parse amount + receipt from CallbackMetadata
         ├─ payment.status='confirmed'; payment.mpesa_receipt=receipt
         ├─ if amountDiff <= 100: transition('PAYMENT_CONFIRMED')
         ├─ Property.updateOne(unit lock_status)                   atomic ✓
         ├─ tenantDoc = Tenant.findById()                          ← 🔴 read
         ├─ tenantDoc.arrears_kes -= deduction                     ← 🔴 modify
         ├─ tenantDoc.payment_history.push({...})
         ├─ tenantDoc.save()                                       ← 🔴 write (RACE)
         └─ smsService.send() confirmation
   │
   ▼ Frontend TanStack Query refetch
[Tenant] sees payment 'confirmed'
```

**Data integrity gaps:** steps marked 🔴 are the Phase 1 fintech fixes (atomicity + idempotency + UUID + token cache).

### 3.2 Landlord — Add Property

```
[Frontend] LandlordAddPropertyPage
   ├─ geocodeAddress(street, area, city) → Mapbox Geocoding API
   └─ submitLandlordProperty({name, type, address, location:[lng,lat], units[]})
         │
         ▼ POST /properties/landlord/submit [requireAuth, requireRole('landlord')]
[Backend] properties.js:608
   ├─ Property.create({landlord_id: req.user._id, status:'pending_admin_approval', ...})
   ├─ pdfService.generateLandlordContractPDF() → R2 upload → contract_url
   │     └─ 🔴 returns mock URL if R2 unset
   └─ res.json(property)
         │
         ▼ Admin approval
[Admin] /admin/users → approveProperty(id) → POST /properties/:id/approve
   └─ Property.status = 'approved'
```

### 3.3 Agent — Geo Check-in

```
[Frontend] CheckInButton → navigator.geolocation.getCurrentPosition + camera photo
   └─ agentCheckIn({property_id, lat, lng, accuracy, photo})
         │
         ▼ POST /agents/checkin [requireAuth, requirePermission('checkin:property')]
[Backend] agents.js
   ├─ verify property in agent's scope (assigned_property_ids / assigned_areas)
   ├─ upload photo → R2
   ├─ User.updateOne({_id: req.user._id}, {
   │     last_location: {type:'Point', coordinates:[lng,lat], accuracy, recorded_at},
   │     last_checkin_photo: url
   │   })
   └─ res.json({success})
```

### 3.4 Admin — KRA Report (verified real)

```
[Frontend] Reports UI → downloadKRAReport('2026-07')
   ├─ Clerk token resolved
   └─ fetch(`${API}/reports/kra?month=2026-07`, {Authorization})
         │
         ▼ GET /reports/kra [requireAuth, requireRole(admin/super_admin/accountant)]
[Backend] reports.js:16
   ├─ Payment.find({status:'confirmed', created_at in month}) + populate
   ├─ For each payment:
   │     commercial → WHT 10% | residential → MRI 7.5%
   ├─ Build CSV rows (date, receipt, tenant, property, amount, tax, net)
   ├─ res.setHeader('text/csv'); res.send(BOM + csv)
   └─ logger.info({records, totalRevenue, totalTax})
         │
         ▼ Frontend: blob → objectURL → <a download>.csv
```

### 3.5 Admin — Income Statement (verified real, but expenses empty)

```
GET /reports/income-statement?month=YYYY-MM
   ├─ Payment.aggregate($match confirmed, $group by property.type) → revenue
   ├─ Expense.aggregate($group by category) → expenses
   ├─ tax = commercial*10% + residential*7.5%
   └─ res.json({revenue, expenses, netIncome, taxLiability:{mri,wht}})
```
⚠️ The `Expense` model exists but there is **no UI to create expenses** — so `expenses.breakdown` is always `[]` and `netIncome === totalRevenue`. This is a real gap, not a mock.

### 3.6 Notices — PDF Generation

```
[Agent/Admin] NoticesPage → generateNotice({type, tenant_id, title, body})
   ▼ POST /notices/generate [requireAuth, requirePermission('issue:notice'), requireRole(admin/super_admin/agent)]
[Backend] notices.js:15
   ├─ Notice.create({...})
   ├─ pdfService.generateNoticePDF() → PDFKit stream → R2 upload → url
   │     └─ 🔴 mock URL if R2 unset
   ├─ smsService.send() + emailService (Resend) to tenant
   └─ res.json({notice, pdf_url})
```

---

## 4. Notification Fan-out

Notifications are **created server-side** at key events (payment initiated, notice issued, task assigned) with `recipient_ids[]` and/or `recipient_role`. The Topbar polls `GET /notifications` every 30s and computes `unreadCount` from `read_by[]`.

```
Payment initiated → Notification.create({recipient_ids:[tenant.user_id]})
Notice issued     → Notification.create({recipient_role:'tenant', recipient_ids:[...]})
Task assigned     → Notification.create({recipient_ids:[agent.user_id]})

Frontend Topbar (30s poll)
   → GET /notifications  → returns {data:[...], unreadCount}
   → markNotifRead(id)   → PATCH /notifications/:id/read    → push to read_by
   → markAllNotifsRead() → PATCH /notifications/read-all
   → deleteNotification  → DELETE /notifications/:id
```

---

## 5. File Storage Flow (R2)

```
[Frontend] ImageUpload / uploadDoc(file) → FormData
   ▼ POST /upload/doc [requireAuth, dailyUploadLimiter, multer.single('file')]
[Backend] upload.js
   ├─ multer in-memory storage
   ├─ r2.uploadImage(buffer, key, contentType)
   │     └─ S3 SDK (Cloudflare R2 endpoint) → PutObject
   └─ res.json({success, url})   ← public R2 URL stored on the document
```
🔴 If `CLOUDFLARE_R2_BUCKET` unset → pdf.js returns mock URL (images may fail silently).

---

## 6. Real vs Mock Data — Final Verdict

| Surface | Real or Mock? | Evidence |
|---------|---------------|----------|
| Admin dashboard KPIs | ✅ **Real** | `admin/stats` runs 7 parallel aggregations |
| Admin revenue chart | ✅ **Real** | `Payment.aggregate($group by month)` |
| Admin payment-status pie | ✅ **Real** | `Payment.aggregate($group by status)` |
| Landlord financial chart | ✅ **Real** | `financialData` useMemo buckets real `payments` |
| Agent performance chart | ✅ **Real** | `chartData` useMemo buckets real confirmed payments by day |
| Agent leaderboard | ✅ **Real** | `admin/agent-performance` aggregation |
| KRA / income statement | ✅ **Real** | reports.js aggregations (but expenses empty — no UI) |
| Property/tenant/payment lists | ✅ **Real** | TanStack Query → real endpoints |
| Map property pins | 🔴 **Fabricated** | `getPropertyCoords` hash jitter when no GPS |
| Map building footprints | 🔴 **Fabricated** | 33m squares at hardcoded offset |
| PDF URLs when R2 unset | 🔴 **Mock** | `r2.cloudflare.com/mock-...` |
| Income statement expenses | 🟠 **Empty** (not mock) | Expense model exists, no creation UI |

**Conclusion:** The data layer is overwhelmingly real. The only true "mocks" are the 3D map's fabricated geometry and the R2 fallback. There are **no mocked chart datasets** — every chart derives from live API aggregations.

---

## 7. Identified Data-Flow Gaps (to close)

1. 🔴 **Payment money flow** — race + no idempotency (see §3.1)
2. 🔴 **Map fabricated data** — fake GPS + fake footprints (see map plan)
3. 🟠 **R2 mock fallback** — silent in prod
4. 🟠 **Expenses never created** — income statement `netIncome` is misleading
5. 🟠 **No real-time push** — 30s poll lag on notifications; consider SSE/WebSocket for payment status
6. 🟡 **No response validation** — axios returns raw `res.data`; schema drift is silent
7. 🟡 **Tenant.id_number / KYC plaintext** — no field-level encryption
