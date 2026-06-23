# Exploration Report: Registry, Backend Logic, and Financial Bugs (Milestone 1/2)

This report details the read-only investigation and exact recommendations for resolving issues across the Distress Inventory, Late Fee Applicator, and Tenant Registry flows in the Mutune Rent platform.

---

## R5: Admin Inventory Adding 500 Error & Tenant Rent Updating Errors

### 1. Admin Inventory Adding 500 Error
* **File**: `backend/routes/inventory.js`
* **Target Line Range**: Lines 316–324
* **Direct Observation**:
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
* **Logic Chain & Root Cause**:
  1. The Mongoose subdocument schema `inventoryItemSchema` in `backend/models/Property.js` defines `item_id` as a required field: `item_id: { type: String, required: true }`.
  2. The controller does not provide `item_id` in `newItem`, triggering a `ValidationError` during `property.save()`.
  3. The schema restricts `auction_status` to the enum `['pending', 'sold', 'reclaimed', 'disposed']` (with a default of `'pending'`).
  4. The controller attempts to save `auction_status: 'none'`, which violates Mongoose enum validation and causes an unhandled 500 response error.
  5. The fields `added_at` and `added_by` are not defined in `inventoryItemSchema` (the schema fields are `added_date` and `audit_agent_id`).
* **Adjustment Recommendation**:
  Update `newItem` structure inside `backend/routes/inventory.js` to match the model schema exactly:
  ```javascript
  const newItem = {
    item_id: new (require('mongoose')).Types.ObjectId().toString(),
    name: name.trim(),
    description: description?.trim() || '',
    condition: condition || 'good',
    estimated_value_kes: Number(estimated_value_kes || 0),
    auction_status: 'pending', // or omit and let schema default handle it
    added_date: new Date(),
    audit_agent_id: req.user._id
  };
  ```

### 2. Tenant Rent Updating Errors
* **File**: `backend/routes/tenants.js`
* **Target Line Range**: Lines 308–329 (in `PATCH /tenants/:id`) and Lines 223–226 (in `POST /tenants/`)
* **Direct Observation (PATCH `/tenants/:id`)**:
  ```javascript
  const allowedFields = ['full_name', 'phone', 'email', 'emergency_contact', 'rent_amount_kes',
    'lease_end', 'tenancy_status', 'notes', 'guarantor'];
  const update = {};
  allowedFields.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });
  ```
* **Direct Observation (POST `/tenants`)**:
  ```javascript
  // Mark unit as occupied
  await Property.updateOne(
    { _id: req.body.current_property_id, 'units._id': req.body.current_unit_id },
    { $set: { 'units.$.status': 'occupied' } }
  );
  ```
* **Logic Chain & Root Causes**:
  1. **Lack of Agent Scope Validation**: The `PATCH /tenants/:id` route allows agents (`requireRole(['admin', 'super_admin', 'agent'])`) to update tenant records, but unlike the GET endpoints, it performs no validation that the tenant belongs to one of the agent's assigned properties (`req.user.assigned_property_ids`). An agent can therefore maliciously or accidentally edit rents and leases for unauthorized properties.
  2. **Orphaned Units (Missing Tenant Links)**: When a tenant is registered by an admin/agent via POST `/tenants/`, the Property unit status is marked as `'occupied'`, but its `'units.$.current_tenant_id'` is **never** set to the tenant's `_id`. This causes subsequent distress inventory reclamation checks (such as the verification at `backend/routes/inventory.js:260` which looks up `unit.current_tenant_id`) to fail.
  3. **No Phone Number Sanitization on Update**: The frontend details drawer does not format the phone number to `254XXXXXXXXX` when editing/saving, and the backend PATCH route does not enforce or sanitize the phone number either, causing SMS notifications to fail for updated numbers.
* **Adjustment Recommendation**:
  * In `backend/routes/tenants.js` (PATCH `/tenants/:id`), check and enforce the agent's property assignment boundaries:
    ```javascript
    if (req.user.role === 'agent') {
      const tenant = await Tenant.findById(req.params.id).lean();
      if (!tenant || !req.user.assigned_property_ids?.map(id => id.toString()).includes(tenant.current_property_id?.toString())) {
        return res.status(403).json({ success: false, error: { code: 'SCOPE_DENIED', message: 'Tenant is not in your assigned properties.' } });
      }
    }
    ```
  * In `backend/routes/tenants.js` (POST `/tenants/`), link the tenant `_id` to the unit:
    ```javascript
    await Property.updateOne(
      { _id: req.body.current_property_id, 'units._id': req.body.current_unit_id },
      { $set: { 'units.$.status': 'occupied', 'units.$.current_tenant_id': tenant._id } }
    );
    ```
  * In `frontend/src/pages/TenantsPage.jsx` (`handleSave` inside `TenantDetailDrawer`), add the same phone sanitization logic found in `AddTenantModal`.

---

## R6: Late Fee Rules Implementation

### 1. Partial Rent Payments & Prepayment Bypasses
* **File**: `backend/cron/late-fee-applicator.js`
* **Target Line Range**: Lines 72–82
* **Direct Observation**:
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
* **Logic Chain & Root Causes**:
  1. `Payment.findOne` only verifies the existence of **a** single payment record. If a tenant makes a token partial payment (e.g. KES 100 on a KES 20,000 rent), `rentPayment` evaluates to truthy, and the cron applicator skips the late fee.
  2. The query checks `created_at` boundaries strictly between the 1st and end of the current month. If a tenant pre-pays rent early (e.g., May 31st for June), the payment falls outside the boundaries, and the applicator erroneously penalizes the tenant.
* **Adjustment Recommendation**:
  Replace `Payment.findOne` with an aggregation pipeline or a sum function that calculates the total amount of confirmed rent payments for the tenant in the current month (or including late-month prepayments), and compares it to the tenant's `rent_amount_kes`:
  ```javascript
  const payments = await Payment.find({
    tenant_id: tenant._id,
    payment_type: 'rent',
    status: 'confirmed',
    created_at: { $gte: startOfMonth, $lte: endOfMonth } // or extend to include late prepayments
  }).lean();

  const totalPaid = payments.reduce((sum, p) => sum + p.amount_kes, 0);
  if (totalPaid >= (tenant.rent_amount_kes || 0)) {
    continue; // Tenant fully paid rent
  }
  ```

### 2. Timezone & Scheduling Issues
* **File**: `backend/cron/late-fee-applicator.js`
* **Target Line Range**: Lines 184–187
* **Direct Observation**:
  ```javascript
  const lateFeeApplicator = cron.schedule('10 21 * * *', runLateFeeApplicator, {
    timezone: 'Africa/Nairobi'
  });
  ```
* **Logic Chain & Root Cause**:
  The cron expression `10 21 * * *` represents 21:10 (9:10 PM). Since the timezone is set to `'Africa/Nairobi'`, the cron job executes at 9:10 PM EAT. However, the comments and specifications state the applicator is supposed to run daily at 00:10 AM EAT.
* **Adjustment Recommendation**:
  Correct the cron schedule to:
  ```javascript
  const lateFeeApplicator = cron.schedule('10 00 * * *', runLateFeeApplicator, {
    scheduled: false,
    timezone: 'Africa/Nairobi'
  });
  ```

### 3. Financial/KRA Reporting Penalty Confirmation Bug
* **File**: `backend/cron/late-fee-applicator.js`
* **Target Line Range**: Lines 115–125
* **Direct Observation**:
  ```javascript
  const payment = await Payment.create({
    ...
    payment_type: 'penalty',
    channel: 'cash',
    status: 'confirmed',
    workflow_state: 'MANUAL_REVIEW'
  });
  ```
* **Logic Chain & Root Cause**:
  Creating a penalty Payment record with `status: 'confirmed'` immediately logs the late fee as *received revenue* in the ledger (cash channel), even though no cash has changed hands (the tenant has merely had their `arrears_kes` balance increased). This skews all administrative financial reports and tax compliance audits.
* **Adjustment Recommendation**:
  Ensure that when a penalty is applied, it is logged as `status: 'pending'` (or a new status representing a debit/invoice) rather than `'confirmed'`, so it only shows as received revenue when the tenant pays off their arrears. (Note: The test `TC-1.8.3` asserts the status is `'confirmed'`; this test expectations should be reviewed alongside the adjustment).

---

## R7: Tenant Code/ID Visibility and Verification Flow

### 1. Admin Verification Block (Pending Tenants Lockout)
* **File**: `frontend/src/pages/TenantsPage.jsx`
* **Target Line Range**: Line 394, Line 561, and Line 931
* **Direct Observation (Drawer Edit Button)**:
  ```javascript
  {!editing && tenant.tenancy_status === 'active' && (
  ```
* **Direct Observation (Table Row Edit Actions)**:
  ```javascript
  {canAddTenant && t.tenancy_status === 'active' && (
  ```
* **Logic Chain & Root Cause**:
  1. During self-onboarding (`users.js`), when a tenant signs up without a pre-registered agent code, they select a vacant unit and their `tenancy_status` is created as `'pending'`.
  2. In `TenantsPage.jsx`, the Edit/Evict actions in the registry list and the edit buttons in the details drawer are strictly visible **only** when `tenancy_status === 'active'`.
  3. Consequently, there is no button or input form in the Admin dashboard that allows an administrator or agent to edit or change the status of a `'pending'` tenant to `'active'`. The tenant is locked in pending status indefinitely with no self-healing or verification mechanism.
* **Adjustment Recommendation**:
  * Expand edit permissions to pending and notice-given states:
    * In table actions:
      ```javascript
      {canAddTenant && ['active', 'pending', 'notice'].includes(t.tenancy_status) && (
      ```
    * In details drawer header:
      ```javascript
      {!editing && ['active', 'pending', 'notice'].includes(tenant.tenancy_status) && (
      ```
  * Add an explicit "Approve Tenancy" action button in the detail drawer footer for pending tenants:
    ```javascript
    {!editing && tenant.tenancy_status === 'pending' && (
      <div className="px-5 py-4 border-t border-slate-800 bg-slate-950/30">
        <button 
          onClick={() => updateMutation.mutate({ tenancy_status: 'active' })}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-black transition cursor-pointer uppercase tracking-wider"
        >
          <CheckCircle2 size={14} /> Approve & Activate Lease
        </button>
      </div>
    )}
    ```

### 2. Tenant Code/ID Visibility
* **Files**: `frontend/src/pages/TenantsPage.jsx` & `frontend/src/pages/TenantPortalPage.jsx`
* **Target Line Range**: `TenantsPage.jsx` Lines 887, 387
* **Direct Observation**:
  The tenant code (`TNT-MOM-XXXX`) is displayed in the admin table (`TenantsPage.jsx:887`) and drawer header (`TenantsPage.jsx:387`). It is also clearly exposed in the pending registration screen of the tenant portal (`TenantPortalPage.jsx:395`). The visibility is sufficient for admin mapping, but adding the linked Clerk User ID (`user_id`) to the `InfoBox` or details registry of the admin drawer would clarify verification logs.
