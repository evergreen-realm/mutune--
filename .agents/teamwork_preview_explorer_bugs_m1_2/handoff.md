# Handoff Report: Registry, Backend Logic, and Financial Bugs (Milestone 1/2)

This report summarizes the read-only investigation of registry, backend logic, and financial bugs in the Mutune Rent codebase, targeting bugs R5, R6, and R7.

---

## 1. Observation

### R5: Admin Inventory adding 500 error & Tenant rent updating errors
* **Inventory Route**: `backend/routes/inventory.js` (lines 316-324)
  ```javascript
  const newItem = {
    name: name.trim(),
    description: description?.trim() || '',
    condition: condition || 'good',
    estimated_value_kes: Number(estimated_value_kes || 0),
    auction_status: 'none',
    added_at: new Date(),
    added_by: req.user._id
  };
  ```
* **Property Schema**: `backend/models/Property.js` (lines 17-25)
  ```javascript
  const inventoryItemSchema = new mongoose.Schema({
    item_id: { type: String, required: true },
    ...
    auction_status: { type: String, enum: ['pending', 'sold', 'reclaimed', 'disposed'], default: 'pending' },
  ```
* **Tenant Update Allowed Fields**: `backend/routes/tenants.js` (lines 308-311)
  ```javascript
  const allowedFields = ['full_name', 'phone', 'email', 'emergency_contact', 'rent_amount_kes',
    'lease_end', 'tenancy_status', 'notes', 'guarantor'];
  ```
* **Tenant Create (Unit Status Update)**: `backend/routes/tenants.js` (lines 223-226)
  ```javascript
  // Mark unit as occupied
  await Property.updateOne(
    { _id: req.body.current_property_id, 'units._id': req.body.current_unit_id },
    { $set: { 'units.$.status': 'occupied' } }
  );
  ```

### R6: Late fee rules implementation
* **Payment Checking**: `backend/cron/late-fee-applicator.js` (lines 72-82)
  ```javascript
  const rentPayment = await Payment.findOne({
    tenant_id: tenant._id,
    payment_type: 'rent',
    status: 'confirmed',
    created_at: { $gte: startOfMonth, $lte: endOfMonth }
  }).lean();

  if (rentPayment) {
    continue;
  }
  ```
* **Cron Scheduling**: `backend/cron/late-fee-applicator.js` (lines 184-187)
  ```javascript
  const lateFeeApplicator = cron.schedule('10 21 * * *', runLateFeeApplicator, {
    timezone: 'Africa/Nairobi'
  });
  ```

### R7: Tenant code/ID visibility and verification flow
* **Frontend Tenants List Actions Visibility**: `frontend/src/pages/TenantsPage.jsx` (line 931)
  ```javascript
  {canAddTenant && t.tenancy_status === 'active' && (
  ```
* **Frontend Drawer Edit Button Visibility**: `frontend/src/pages/TenantsPage.jsx` (line 394)
  ```javascript
  {!editing && tenant.tenancy_status === 'active' && (
  ```

---

## 2. Logic Chain

### R5 Logic Chain
1. Pushing `newItem` to `property.inventory` in the inventory route fails to supply `item_id`, which is marked `required: true` in the Mongoose schema.
2. The route sets `auction_status: 'none'`, which is not in the schema's enum `['pending', 'sold', 'reclaimed', 'disposed']`.
3. Consequently, Mongoose save fails with a `ValidationError`, returning a 500 error status to the client.
4. For tenant updates, `PATCH /tenants/:id` does not check if the target tenant belongs to the logged-in agent's assigned properties list, allowing agents to edit arbitrary tenant records.
5. In tenant registration, the Property unit status is set to `'occupied'`, but its `'units.$.current_tenant_id'` remains unlinked, causing the inventory reclaim checks to fail.

### R6 Logic Chain
1. The cron applicator uses `Payment.findOne` to look up any confirmed rent payments this month.
2. If a tenant makes a partial payment of a tiny amount, `Payment.findOne` returns truthy, and the applicator skips applying the penalty.
3. If a tenant pre-pays rent early (e.g. at the end of the previous month), the payment falls outside of `startOfMonth` and `endOfMonth` boundaries, so `rentPayment` is not found, causing the applicator to erroneously penalize the tenant.
4. The cron timezone is `'Africa/Nairobi'` but the cron time `'10 21 * * *'` executes at 9:10 PM EAT rather than 00:10 AM EAT.

### R7 Logic Chain
1. Tenants self-onboarding without a code are created in `'pending'` status.
2. In `TenantsPage.jsx`, the row action buttons and drawer edit buttons are conditioned strictly on `tenancy_status === 'active'`.
3. Because editing is disabled for `'pending'` status, the admin has no way to change their status to `'active'`, leaving them stuck in the pending flow.

---

## 3. Caveats
- Investigated only local codebase. External integrations such as Safaricom M-Pesa STK push and Clerk API were not tested directly.
- Assumed standard Mongoose validation behavior and timezone properties for node-cron.

---

## 4. Conclusion
* **R5**: Admin inventory addition 500 error is caused by schema mismatch (`item_id` missing, `auction_status: 'none'` invalid enum). Tenant rent updates lack agent property boundary checks. Tenant creation lacks updating `unit.current_tenant_id` on Property.
* **R6**: Late fee applicator has a logical bug allowing partial payments to bypass penalties, prepayments to trigger penalties, and a misconfigured cron time.
* **R7**: Pending tenants are locked out of admin editing/activation due to UI action visibility checks being restricted to `'active'` status only.

---

## 5. Verification Method
1. **R5 Inventory Verification**: Run the project tests using `npm test tests/tier1.e2e.test.js` or specific distress inventory suite:
   `npx jest backend/tests/tier1.e2e.test.js -t "Feature 7: Distress Inventory"`
   - If fixed, `Add Inventory Item` and `Mark Item Auctionable` tests should pass.
2. **R6 Late Fee Verification**: Run the late fee test suite:
   `npx jest backend/tests/tier1.e2e.test.js -t "Feature 8: Late Fee Rules"`
3. **R7 Visibility Verification**: Inspect `frontend/src/pages/TenantsPage.jsx` at line 931 and line 394 to ensure pending tenants can be edited.
