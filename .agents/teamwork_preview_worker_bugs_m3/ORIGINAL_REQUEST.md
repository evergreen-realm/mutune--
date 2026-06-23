## 2026-06-21T16:26:31Z

<USER_REQUEST>
You are a teamwork_preview_worker.
Your working directory is: c:\Users\Admin\Desktop\mutune\.agents\teamwork_preview_worker_bugs_m3
Your role is: Registry & Financial Logic Specialist

Touch the following files and implement the requested changes:
1. `backend/routes/inventory.js`:
   - Fix the 500 error when adding items to property distress inventory.
   - Modify the `newItem` object properties before saving: ensure it generates a valid string `item_id`, sets `added_date: new Date()`, `audit_agent_id: req.user._id`, and `auction_status: 'pending'` (must match Mongoose `inventoryItemSchema` in backend/models/Property.js).
2. `backend/routes/tenants.js`:
   - Add agent assignment boundaries in `PATCH /tenants/:id` route (verify that the tenant's `current_property_id` is included in the agent's `assigned_property_ids` array).
   - In `POST /tenants/`, link the newly created tenant's `_id` to the unit details: set `units.$.status` to `'occupied'` and `units.$.current_tenant_id` to `tenant._id`.
3. `frontend/src/pages/TenantsPage.jsx`:
   - Update edit/evict permissions: allow editing when tenancy status is `'pending'` or `'notice'`, not just `'active'`.
   - Add an "Approve Tenancy" button in the detail drawer footer for pending tenants to update their status to `'active'`.
   - In the drawer save/update handler, sanitize phone numbers to format as `254XXXXXXXXX`.
4. `backend/cron/late-fee-applicator.js`:
   - In `runLateFeeApplicator`, sum the total amount of confirmed rent payments for the tenant in the current month instead of doing a simple `findOne` check, to handle partial payments and early prepayments. Skip late fee only if sum of confirmed payments is >= `tenant.rent_amount_kes`.
   - Correct the cron expression execution timezone/hours (daily at 00:10 AM EAT, cron `'10 00 * * *'`).

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Run builds/tests to verify correctness. Write a summary of your changes to handoff.md in your directory.
</USER_REQUEST>
