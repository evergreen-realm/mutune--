# Cybersecurity Hardening Analysis (OWASP Top 10) — MutuneRent Pro

## Executive Summary
This report documents a comprehensive read-only security investigation of the MutuneRent Pro backend. The focus of the audit is to identify vulnerability vectors corresponding to the OWASP Top 10 and construct concrete remediation strategies.

Key areas analyzed:
1. **Authentication & Authorization Middlewares (OWASP A01 & A07)**
2. **Input Validation Schemas (express-validator) (OWASP A03 & A07)**
3. **NoSQL Injection Protections (mongoSanitize) (OWASP A03)**
4. **Sensitive Field Disclosure in Logging (OWASP A09)**

---

## 1. Authentication & Authorization Gaps (A01 & A07)

### 1.1 Scope Bypass Gaps (Broken Access Control)
While the backend uses role-based access control (RBAC) permissions (via `requireRole` and `requirePermission` middlewares), it consistently fails to verify **scope ownership/assignment**. This permits users with legitimate roles to query or mutate resources they do not own or manage:

1. **Property Creation & Association Scope**:
   - **File**: `backend/routes/properties.js` (lines 194-280)
   - **Vulnerability**: `POST /properties` and `POST /properties/with-gps` permit any agent to create properties in any area. It also allows landlords to create properties associated with any landlord ID by passing `landlord_id` in `req.body`.
   - **Requirement**: Agents must only create properties within their `assigned_areas`. Landlords must only create properties with their own user ID (`req.user._id`).

2. **Unit Geolocation Modification**:
   - **File**: `backend/routes/properties.js` (lines 395-420)
   - **Vulnerability**: `PATCH /properties/:id/units/:unitId/geolocation` lacks `enforcePropertyScope`. Any agent can modify the GPS coordinates of any unit in the system.

3. **GeoJSON Units Retrieval**:
   - **File**: `backend/routes/properties.js` (lines 422-450)
   - **Vulnerability**: `GET /properties/:id/units/geojson` lacks `enforcePropertyScope`. Any authenticated user (including tenants) can query the exact coordinates and rental details of all units in a property.

4. **Tenant Modification**:
   - **File**: `backend/routes/tenants.js` (lines 299-329)
   - **Vulnerability**: `PATCH /tenants/:id` gates access to `['admin', 'super_admin', 'agent']` but applies **no scope validation** for agents. An agent can update details (like rent amount or lease end date) for tenants in properties they do not manage.

5. **Tenant Payment History Access**:
   - **File**: `backend/routes/tenants.js` (lines 378-394)
   - **Vulnerability**: `GET /tenants/:id/payment-history` is gated by `requirePermission('view:payments')`. Since tenants have this permission (to view their own unit payments), a tenant can query the payment history of *any* tenant in the system by passing their tenant ID. No ownership check is performed.

6. **Notice Generation & Bulk Broadcasting**:
   - **File**: `backend/routes/notices.js` (lines 15-203, 259-320)
   - **Vulnerability**: `POST /notices/generate` and `POST /notices/bulk` permit agents to issue notices for any property or tenant in the DB, bypassing their assigned property scope.

7. **Notice Downloads**:
   - **File**: `backend/routes/notices.js` (lines 206-229)
   - **Vulnerability**: `GET /notices/:id/download` only scopes downloads for `tenant` roles. An agent or landlord can download any notice in the system without checking if the notice relates to their assigned property.

8. **Maintenance Ticket Submission**:
   - **File**: `backend/routes/maintenance.js` (lines 22-70)
   - **Vulnerability**: `POST /` allows any tenant to submit maintenance tickets for any unit and property in the DB. The route retrieves the tenant profile but fails to assert that `property_id` and `unit_id` in `req.body` match the tenant's current property and unit.

9. **Maintenance Ticket Modification**:
   - **File**: `backend/routes/maintenance.js` (lines 153-201)
   - **Vulnerability**: `PATCH /:id` is gated by `requirePermission('view:maintenance')`. Because all roles (including tenants) have this permission, any user can modify ticket details, status, or assign agents to *any* ticket.

10. **Inventory Additions**:
    - **File**: `backend/routes/inventory.js` (lines 290-337)
    - **Vulnerability**: `POST /:propertyId/add-item` lacks `enforcePropertyScope`. Any landlord or agent can add inventory items to any property.

11. **Notification Reads**:
    - **File**: `backend/routes/notifications.js` (lines 44-62)
    - **Vulnerability**: `PATCH /:id/read` permits any user to mark any notification as read by passing its ID, without checking if they are the intended recipient.

### 1.2 Webhook Signature Authentication Gap
- **File**: `backend/routes/users.js` (lines 587-593)
- **Vulnerability**: The Clerk webhook endpoint `/api/v1/users/webhook` authenticates using a simple header check: `req.headers['x-webhook-secret'] === secret`. This is vulnerable to replay attacks and unauthorized spoofing if the secret is leaked.
- **Fix Strategy**: Implement svix signature verification using Clerk's official Webhook package:
  ```javascript
  const { Webhook } = require('svix');
  const payload = req.body.toString(); // requires raw body parsing
  const headers = req.headers;
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);
  const evt = wh.verify(payload, headers);
  ```

---

## 2. Input Validation Schemas (express-validator) (A03 & A07)

Across the entire routing layer, there is a systemic lack of express-validator validation. Parameters and body fields are frequently extracted directly from `req.body` or `req.query` without schema validation or sanitization.

### 2.1 Major Omissions
1. **GET list endpoints**: Missing query parameter validation for pagination (`page`, `limit` as positive integers) and filters.
   - Files: `backend/routes/properties.js`, `backend/routes/tenants.js`, `backend/routes/payments.js`, `backend/routes/maintenance.js`.
2. **PATCH body payloads**: Missing validation schemas entirely.
   - Files: `backend/routes/properties.js` (`PATCH /:id`), `backend/routes/tenants.js` (`PATCH /:id`), `backend/routes/maintenance.js` (`PATCH /:id`), `backend/routes/users.js` (`PATCH /:id`).
3. **Route path parameters**:
   - `backend/routes/ai.js` (`GET /history/:session_id` and `DELETE /history/:session_id` have no validation on `session_id`).
   - `backend/routes/payments.js` (`POST /:id/override` and `POST /:id/void` have no validation on `:id` or request body params).

### 2.2 Fix Strategy
Define explicit validation middleware arrays for every endpoint. Example for `PATCH /tenants/:id`:
```javascript
router.patch('/:id',
  requireAuth,
  requireRole(['admin', 'super_admin', 'agent']),
  [
    param('id').isMongoId().withMessage('Invalid tenant ID'),
    body('full_name').optional().trim().notEmpty().withMessage('Full name cannot be empty'),
    body('phone').optional().trim().matches(/^254\d{9}$/).withMessage('Invalid phone format'),
    body('email').optional().isEmail().normalizeEmail().withMessage('Invalid email'),
    body('rent_amount_kes').optional().isInt({ min: 1 }).withMessage('Rent must be a positive integer'),
    body('tenancy_status').optional().isIn(['active', 'pending', 'terminated', 'expired', 'departed']).withMessage('Invalid status')
  ],
  async (req, res, next) => { ... }
);
```

---

## 3. NoSQL Injection Protections (mongoSanitize) (A03)

- **File**: `backend/middleware/sanitize.js`
- **Vulnerability**: The custom sanitizer loops keys and deletes them if they start with `$`:
  ```javascript
  if (key.startsWith('$')) {
    logger.warn(`NoSQL injection attempt blocked: stripped key "${key}"`);
    delete obj[key];
  }
  ```
  This is a fragile implementation. It fails to block dot notation keys (e.g. `{"units.status": {"$ne": "vacant"}}` or nested query structures using `.` to access schema properties), which can alter query logic or bypass filters.
- **Fix Strategy**: Install the industry-standard `express-mongo-sanitize` package and register it globally in `server.js`. It properly handles nested objects, arrays, and strips both `$` and `.` characters, or rejects requests containing them outright.
  ```javascript
  const mongoSanitize = require('express-mongo-sanitize');
  app.use(mongoSanitize({
    replaceWith: '_',
    dryRun: false
  }));
  ```

---

## 4. Sensitive Field Disclosure in Logging (A09)

### 4.1 Plaintext Log Leaks
An audit of logger statements reveals that sensitive customer and system data is logged in plaintext:
1. **File**: `backend/routes/notices.js` (line 122):
   ```javascript
   logger.info('SMS notice delivered', { noticeId: notice._id, phone: tenant.phone, fallback: !delivery_method.includes('sms') });
   ```
   -> Logs `tenant.phone` in plain text.
2. **File**: `backend/routes/users.js` (lines 36, 46, 52, 56, 317, 496, 507, 522, 526, 540, 577, 613, 639, 662):
   -> Logs `clerkId` / `clerk_id` and `email` in plain text during Clerk role sync and webhook event handlers.

### 4.2 Logger Design Gaps
The custom logger in `backend/utils/logger.js` simply stringifies console outputs and contains **no automated redaction capabilities**:
```javascript
const logger = {
  info:  (msg, meta = {}) => console.log(JSON.stringify({ level: 'info',  timestamp: new Date().toISOString(), message: msg, ...meta })),
  error: (msg, meta = {}) => console.error(JSON.stringify({ level: 'error', timestamp: new Date().toISOString(), message: msg, ...meta })),
  warn:  (msg, meta = {}) => console.warn(JSON.stringify({ level: 'warn',  timestamp: new Date().toISOString(), message: msg, ...meta }))
};
```

### 4.3 Fix Strategy
1. **Manual Audit & Cleanup**: Remove plain-text variables like `phone` and `clerkId` from all logging metadata calls in `users.js` and `notices.js`.
2. **Automated Logger Redaction**: Update `logger.js` to recursively traverse metadata and redact any key matching a list of sensitive fields (`phone`, `clerk_id`, `clerkId`, `password`, `email`, `national_id`).
   *Proposed hardened implementation for `backend/utils/logger.js`:*
   ```javascript
   const SENSITIVE_KEYS = new Set(['password', 'password_hash', 'clerkid', 'clerk_id', 'phone', 'email', 'national_id', 'id_number']);

   function redact(obj) {
     if (!obj || typeof obj !== 'object') return obj;
     const copy = Array.isArray(obj) ? [] : {};
     for (const key in obj) {
       if (Object.prototype.hasOwnProperty.call(obj, key)) {
         if (SENSITIVE_KEYS.has(key.toLowerCase())) {
           copy[key] = '[REDACTED]';
         } else if (typeof obj[key] === 'object') {
           copy[key] = redact(obj[key]);
         } else {
           copy[key] = obj[key];
         }
       }
     }
     return copy;
   }

   const logger = {
     info:  (msg, meta = {}) => console.log(JSON.stringify({ level: 'info',  timestamp: new Date().toISOString(), message: msg, ...redact(meta) })),
     error: (msg, meta = {}) => console.error(JSON.stringify({ level: 'error', timestamp: new Date().toISOString(), message: msg, ...redact(meta) })),
     warn:  (msg, meta = {}) => console.warn(JSON.stringify({ level: 'warn',  timestamp: new Date().toISOString(), message: msg, ...redact(meta) }))
   };

   module.exports = logger;
   ```
