# MutuneRent Pro — Security & Reliability Remediation Plan

> **Plan Overview:** A structured, phased action plan to remediate all 30 security vulnerabilities, architectural flaws, and compliance gaps identified in `AUDIT.md` and `GAP_ANALYSIS.md`.  
> **Target System:** MutuneRent Pro (`evergreen-realm/mutune--`)  

---

## 1. Remediation Strategy & Phasing

The remediation process is divided into 4 prioritized phases:

* **Phase 1: Critical Security & Financial Integrity (Days 1–7)**
  * Payment race conditions, idempotency, RBAC scope enforcement, credential cleanup, and error boundaries.
* **Phase 2: Access Control & Data Protection Compliance (Days 8–14)**
  * IDOR remediation, client-side route guards, Clerk webhook verification, PII encryption (KDPA compliance).
* **Phase 3: Service Reliability & Infrastructure Hardening (Days 15–21)**
  * R2 PDF error handling, per-route rate limiting, CSP header cleanup, M-Pesa token caching.
* **Phase 4: Frontend Polish, Refactoring & Data Integrity (Days 22–30)**
  * Removing fake map coordinates/footprints, WebGL component refactoring, Zod schema validation, CI/CD pipeline setup.

---

## 2. Phase 1 — Critical Security & Financial Integrity (Days 1–7)

### Step 1.1: Remediate Payment Callback Race Conditions & Atomicity
* **Target Files:** [`backend/models/Payment.js`](file:///c:/Users/Admin/Desktop/mutune/backend/models/Payment.js), [`backend/routes/payments.js`](file:///c:/Users/Admin/Desktop/mutune/backend/routes/payments.js)
* **Tasks:**
  1. Add unique sparse index on `mpesa_receipt` in `Payment.js`:
     ```javascript
     mpesa_receipt: { type: String, index: true, unique: true, sparse: true }
     ```
  2. Update transaction ID generation to use `crypto.randomUUID()`:
     ```javascript
     const crypto = require('crypto');
     const transaction_id = `MUT-${crypto.randomUUID()}`;
     ```
  3. Extract `applyPaymentToTenant` helper using Mongo transactions and `$inc` atomic operators:
     ```javascript
     // backend/routes/payments.js
     async function handleSTKCallback(stk) {
       const checkoutRequestId = stk.CheckoutRequestID;
       const resultCode = stk.ResultCode;
       const resultDesc = stk.ResultDesc;

       const session = await mongoose.startSession();
       try {
         await session.withTransaction(async () => {
           const payment = await Payment.findOne({ transaction_id: checkoutRequestId }).session(session);
           if (!payment || payment.status === 'confirmed') return; // Idempotent exit

           if (resultCode !== 0) {
             payment.status = 'failed';
             payment.discrepancy_reason = `STK Failed: ${resultDesc}`;
             await payment.save({ session });
             return;
           }

           const items = stk.CallbackMetadata?.Item || [];
           const amount = items.find(i => i.Name === 'Amount')?.Value;
           const receipt = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value;

           payment.status = 'confirmed';
           payment.mpesa_receipt = receipt;
           await payment.save({ session });

           const deduction = payment.amount_kes;
           await Tenant.updateOne(
             { _id: payment.tenant_id },
             {
               $inc: { arrears_kes: -deduction },
               $push: {
                 payment_history: {
                   month: new Date().toISOString().slice(0, 7),
                   amount_kes: payment.amount_kes,
                   status: 'paid',
                   payment_id: payment._id
                 }
               }
             },
             { session }
           );
         });
       } finally {
         session.endSession();
       }
     }
     ```

### Step 1.2: Fix RBAC Agent Scope Bypass
* **Target File:** [`backend/middleware/rbac.js:34-37`](file:///c:/Users/Admin/Desktop/mutune/backend/middleware/rbac.js#L34-L37)
* **Action:** Change return logic for agents with empty assignments:
  ```javascript
  // Replace line 36 in backend/middleware/rbac.js
  const hasAssignments = (req.user.assigned_property_ids && req.user.assigned_property_ids.length > 0) ||
                         (req.user.assigned_areas && req.user.assigned_areas.length > 0);
  if (!hasAssignments) {
    logger.warn('Agent scope denied - No assignments configured', { userId: req.user._id });
    return res.status(403).json({
      success: false,
      error: { code: 'SCOPE_DENIED', message: 'Agent has no assigned properties or areas' }
    });
  }
  ```

### Step 1.3: Purge Committed Secrets & Rotate API Credentials
* **Target Files:** `.env.local`, `.env.production.local`, `frontend/.env.production.local`
* **Tasks:**
  1. Revoke existing Vercel OIDC JWT tokens and Mapbox API keys via provider consoles.
  2. Issue fresh API keys and populate deployment environment variables directly in cloud hosting dashboard (Render / Vercel).
  3. Ensure `.env.local` and `.env.production.local` are added to `.gitignore`.

### Step 1.4: Add WebGL & Unauthenticated Route Error Boundaries
* **Target Files:** `frontend/src/components/ErrorBoundary.jsx`, `frontend/src/App.jsx`
* **Tasks:**
  1. Extract `<ErrorBoundary>` into standalone component `frontend/src/components/ErrorBoundary.jsx`.
  2. Create `<WebGLErrorBoundary>` with standard visual fallback ("WebGL rendering disabled or unavailable").
  3. Wrap `/landing`, `/login`, `/sign-up`, `/onboarding` and map components in `App.jsx`.

---

## 3. Phase 2 — Access Control & Data Protection (Days 8–14)

### Step 2.1: Remediate Notice PDF Download IDOR
* **Target File:** [`backend/routes/notices.js:206-220`](file:///c:/Users/Admin/Desktop/mutune/backend/routes/notices.js#L206-L220)
* **Action:** Enforce record ownership and role authorization checks before initiating file download:
  ```javascript
  router.get('/:id/download', requireAuth, async (req, res) => {
    try {
      const notice = await Notice.findById(req.params.id);
      if (!notice) return res.status(404).json({ success: false, error: 'Notice not found' });

      const isRecipient = req.user.role === 'tenant' && notice.recipient_ids.map(id => id.toString()).includes(req.user._id.toString());
      const isManagement = ['admin', 'super_admin', 'agent'].includes(req.user.role);

      if (!isRecipient && !isManagement) {
        return res.status(403).json({ success: false, error: 'Unauthorized to download this notice' });
      }

      // Proceed with PDF generation / streaming
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  ```

### Step 2.2: Wrap Client Admin Routes in Role Guards
* **Target File:** [`frontend/src/App.jsx:540-541`](file:///c:/Users/Admin/Desktop/mutune/frontend/src/App.jsx#L540-L541)
* **Action:** Create `RoleRoute` wrapper component and protect admin routes:
  ```jsx
  // Create frontend/src/components/RoleRoute.jsx
  import { useUser } from '@clerk/clerk-react';
  import { Navigate } from 'react-router-dom';

  export function RoleRoute({ allow, children }) {
    const { user, isLoaded } = useUser();
    if (!isLoaded) return null;
    const role = user?.publicMetadata?.role || 'tenant';
    if (!allow.includes(role)) return <Navigate to="/" replace />;
    return children;
  }

  // App.jsx route definitions
  <Route path="/admin/users" element={<RoleRoute allow={['admin', 'super_admin']}><AdminUserManagementPage /></RoleRoute>} />
  <Route path="/admin/inventory" element={<RoleRoute allow={['admin', 'super_admin']}><AdminInventoryPage /></RoleRoute>} />
  ```

### Step 2.3: Implement Tenant PII Encryption (KDPA 2019 Compliance)
* **Target File:** [`backend/models/Tenant.js`](file:///c:/Users/Admin/Desktop/mutune/backend/models/Tenant.js)
* **Action:** Integrate field encryption for National ID and phone numbers:
  ```javascript
  const mongooseFieldEncryption = require('mongoose-field-encryption').fieldEncryption;

  TenantSchema.plugin(mongooseFieldEncryption, {
    fields: ['id_number', 'phone', 'emergency_contact_phone'],
    secret: process.env.PII_ENCRYPTION_KEY,
    saltGenerator: (secret) => crypto.createHash('sha256').update(secret).digest('hex').slice(0, 16)
  });
  ```

---

## 4. Phase 3 — Infrastructure & Reliability (Days 15–21)

### Step 3.1: Strict Cloudflare R2 Bucket Exception Handling
* **Target File:** [`backend/services/pdf.js:27-28, 137-138`](file:///c:/Users/Admin/Desktop/mutune/backend/services/pdf.js#L27-L28)
* **Action:** Eliminate silent mock URL fallbacks in production:
  ```javascript
  if (!process.env.CLOUDFLARE_R2_BUCKET) {
    if (process.env.NODE_ENV === 'test') {
      return `https://r2.cloudflare.com/mock-${key}`;
    }
    logger.error('CRITICAL: Cloudflare R2 bucket environment variable missing');
    throw new Error('Storage service misconfiguration: CLOUDFLARE_R2_BUCKET missing');
  }
  ```

### Step 3.2: Cache M-Pesa OAuth Access Tokens
* **Target File:** [`backend/services/mpesa.js:14-25`](file:///c:/Users/Admin/Desktop/mutune/backend/services/mpesa.js#L14-L25)
* **Action:** Cache token in memory with expiry buffer (60s pre-expiry refresh):
  ```javascript
  let cachedToken = null;
  let tokenExpiry = null;

  async function getAccessToken() {
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry - 60000) {
      return cachedToken;
    }
    const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
    const response = await axios.get(`${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` }
    });
    cachedToken = response.data.access_token;
    tokenExpiry = Date.now() + parseInt(response.data.expires_in, 10) * 1000;
    return cachedToken;
  }
  ```

### Step 3.3: Configure Per-Route Rate Limiters
* **Target File:** [`backend/server.js`](file:///c:/Users/Admin/Desktop/mutune/backend/server.js)
* **Action:** Implement targeted rate limits for payment initiation endpoints:
  ```javascript
  const rateLimit = require('express-rate-limit');
  const stkLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, error: 'Too many payment requests from this IP' }
  });
  app.use('/api/payments/initiate-stk', stkLimiter);
  ```

---

## 5. Phase 4 — Data Integrity, Refactoring & CI/CD (Days 22–30)

### Step 4.1: Clean Fabricated Coordinates & Footprints
* **Target File:** [`frontend/src/components/MapWidget.jsx:57-72, 462-510`](file:///c:/Users/Admin/Desktop/mutune/frontend/src/components/MapWidget.jsx#L57)
* **Action:** Remove pseudo-random coordinate jitter and fabricated 33m square footprints. Properties lacking explicit lat/long display "Location Not Set" badges.

### Step 4.2: CI/CD Security & Test Pipeline Setup
* **Target File:** `.github/workflows/ci.yml`
* **Action:** Create GitHub Actions workflow enforcing linting, testing, and security scanning on PRs:
  ```yaml
  name: CI & Security Gate
  on: [push, pull_request]
  jobs:
    security-and-test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        - uses: actions/setup-node@v3
          with:
            node-version: 18
        - run: npm ci
        - run: npm run lint
        - run: npm test
  ```

---

## 6. Verification Criteria & Definition of Done

Each remediation step must satisfy the following criteria prior to release:

1. **Automated Unit & E2E Tests:** Pass full test suite without regression (`npm test` output attached).
2. **Security Verification:** Re-scan project with `code-vuln-audit` security scanner to verify zero High or Critical findings.
3. **No Unrequested Scope:** Strictly preserve existing route contracts and database schemas unless named in audit findings.
4. **Environment Audit:** Verify zero credentials in commit history and confirm `render.yaml` environment keys match application configuration.
