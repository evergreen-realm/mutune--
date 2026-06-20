# Handoff Report — Milestone 2 Security Investigation

## 1. Observation

Direct observations from the static analysis of the codebase:

1. **Custom Sanitizer Limitation**:
   In `backend/middleware/sanitize.js`:
   ```javascript
   function sanitize(obj) {
     if (obj && typeof obj === 'object') {
       for (const key in obj) {
         if (Object.prototype.hasOwnProperty.call(obj, key)) {
           if (key.startsWith('$')) {
             logger.warn(`NoSQL injection attempt blocked: stripped key "${key}"`);
             delete obj[key];
           } else {
             sanitize(obj[key]);
           }
         }
       }
     }
     return obj;
   }
   ```
   No check exists for dot notation (`.`).

2. **Plaintext Sensitive Fields in Logs**:
   In `backend/routes/notices.js` line 122:
   ```javascript
   logger.info('SMS notice delivered', { noticeId: notice._id, phone: tenant.phone, fallback: !delivery_method.includes('sms') });
   ```
   In `backend/routes/users.js` lines 36 and 46:
   ```javascript
   logger.info('Role mismatch detected in /users/me, DB role is empty, syncing from Clerk', { clerkId: user.clerk_id, clerkRole });
   ...
   logger.info('Role mismatch detected in /users/me, syncing Clerk from DB', { clerkId: user.clerk_id, dbRole: user.role, clerkRole });
   ```

3. **No Automatic Redaction in Custom Logger**:
   In `backend/utils/logger.js`:
   ```javascript
   const logger = {
     info:  (msg, meta = {}) => console.log(JSON.stringify({ level: 'info',  timestamp: new Date().toISOString(), message: msg, ...meta })),
     error: (msg, meta = {}) => console.error(JSON.stringify({ level: 'error', timestamp: new Date().toISOString(), message: msg, ...meta })),
     warn:  (msg, meta = {}) => console.warn(JSON.stringify({ level: 'warn',  timestamp: new Date().toISOString(), message: msg, ...meta }))
   };
   ```

4. **Broken Access Control (Missing Scoping Checks)**:
   In `backend/routes/tenants.js` line 299:
   ```javascript
   router.patch('/:id',
     requireAuth,
     requireRole(['admin', 'super_admin', 'agent']),
     [param('id').isMongoId()]
   ```
   No scoping middleware (e.g. `enforcePropertyScope` or agent-property mapping check) is applied.
   Similar scoping check omissions exist on:
   - `PATCH /properties/:id/units/:unitId/geolocation`
   - `GET /properties/:id/units/geojson`
   - `POST /notices/generate` and `POST /notices/bulk`
   - `POST /maintenance`
   - `POST /inventory/:propertyId/add-item`

5. **Missing express-validator Schema on PATCH routes**:
   In `backend/routes/properties.js` line 283:
   ```javascript
   router.patch('/:id',
     requireAuth,
     requireRole(['admin', 'super_admin']),
     [param('id').isMongoId()],
   ```
   There are no body validations for keys passed in `req.body`.

---

## 2. Logic Chain

1. **Custom Sanitizer NoSQL Vulnerability**:
   The custom sanitizer only strips keys starting with `$` (Observation 1). Since MongoDB supports nested fields via dot notation (e.g., querying `units.status` or other fields), an attacker can inject dot-notation keys in requests to manipulate queries or bypass filters. Therefore, the custom sanitizer is inadequate for full NoSQL injection protection (OWASP A03).

2. **Information Disclosure in Logging**:
   The custom logger prints all metadata without checking for sensitive variables (Observation 3). Multiple endpoints directly print plaintext `phone` and `clerk_id` in their metadata (Observation 2). Therefore, sensitive fields are exposed in console/stderr logs, violating OWASP A09 (Security Logging and Monitoring Failures).

3. **Broken Access Control & Scope Bypasses**:
   Multiple routes modify or access properties, tenants, and maintenance tickets based on role alone without validating if the resource is assigned to the current user (Observation 4). Therefore, an agent can manage tenants or properties outside their assigned area, and a tenant can read payment histories of other tenants or submit tickets for other units, constituting a Broken Access Control vulnerability (OWASP A01).

4. **Input Validation Omission**:
   PATCH endpoints and GET lists extract request fields without schemas (Observation 5). This allows unexpected types or values to be processed by controller logic, leading to validation bypasses or injection targets (OWASP A07).

---

## 3. Caveats

- The analysis was performed statically using file reading.
- No live payload attacks were executed against the server.
- Webhook functionality with Clerk was analyzed based on routing code, assuming SVIX payload structure; SVIX webhook validation should be tested with actual Clerk events during implementation.

---

## 4. Conclusion

The MutuneRent Pro backend contains several high-risk security gaps: NoSQL Injection vulnerabilities due to limited sanitization, plaintext PII logging due to lack of redaction filters, Broken Access Control due to missing scope gating on tenants and properties, and input validation failures due to missing schemas. 

Remediation requires:
1. Hardening `logger.js` with recursive metadata key redaction.
2. Integrating standard `express-mongo-sanitize` globally.
3. Adding validation arrays (`express-validator`) for PATCH/GET list endpoints.
4. Applying `enforcePropertyScope` or manual scope mapping checks for agents/landlords/tenants on all mutating and detail routes.

---

## 5. Verification Method

1. **Running the Test Suite**:
   Run the backend test runner:
   ```powershell
   npm --prefix backend test
   ```
   Ensure all existing tests pass.

2. **Audit Verification**:
   Inspect the newly hardened `backend/utils/logger.js` and verify that when passing sensitive fields like `phone` or `clerk_id` to logger metadata, they are redacted.
   Ensure every POST, PUT, and PATCH endpoint contains an express-validator array containing parameter and body field validation.
