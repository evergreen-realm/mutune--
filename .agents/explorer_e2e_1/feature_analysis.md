# MutuneRent Pro E2E Test Suite Analysis & Plan

This report provides a comprehensive feature inventory and a structured E2E test plan for MutuneRent Pro, designed to achieve 100% opaque-box E2E test coverage across four tiers.

---

## 1. Introduction

MutuneRent Pro is a multi-role property management SaaS.
* **Frontend**: React + Vite + Tailwind CSS, Clerk for authentication, Sentry for error tracking.
* **Backend**: Express + Mongoose (MongoDB).
* **Payment**: Safaricom M-Pesa STK push and C2B callback flows.
* **Messaging**: SMS (AfricasTalking) and email (Resend) notifications.

### Summary of Findings
1. **User Identity & Role Tying**: The database user record is synced on login via `POST /api/v1/users/sync-clerk` and kept in sync using Clerk webhooks (`POST /api/v1/users/webhook`). There is a strict gatekeeper mechanism where landlords/agents need ID verification, and admins need password verification.
2. **Missing/Pending Features**:
   * **Bulk Notices**: Described in `PROJECT.md` (`POST /api/v1/notices/bulk`) but not currently implemented in `backend/routes/notices.js` or the frontend.
   * **Income Statement Report**: Described in `PROJECT.md` (`GET /api/v1/reports/income-statement`) but not currently implemented in `backend/routes/reports.js` or the frontend.
   These are accounted for in our test plans.

---

## 2. Feature Inventory

The MutuneRent Pro application consists of the following 9 key features:

### Feature 1: User Authentication, Role Sync & Onboarding Flow
* **Description**: Users register via Clerk, select a role (`admin`, `agent`, `landlord`, `tenant`), sync metadata with the DB, and go through role-based onboarding.
* **Backend Routes**:
  * `POST /api/v1/users/sync-clerk` (Verify token and sync Clerk profile with MongoDB)
  * `POST /api/v1/users/webhook` (Clerk event hooks: user.created, user.updated, user.deleted)
  * `GET /api/v1/users/me` (Retrieve current user profile)
  * `PATCH /api/v1/users/me/role` (Submit onboarding details and role selection)
  * `GET /api/v1/users/check-tenant-email/:email` (Verify pre-onboarded tenant email)
* **Models**: `User`, `Tenant`
* **Frontend Pages**: `LoginPage`, `SignUpPage`, `OnboardingPage`, `RoleIdVerification`, `AdminPasswordGuard`
* **State**: Operational. Syncing backfills role from MongoDB to Clerk if missing.

### Feature 2: Property & Unit Lifecycle Management
* **Description**: Registration and approval of properties, adding/deleting units, proposing and approving property tiers.
* **Backend Routes**:
  * `GET /api/v1/properties` (Scoped properties list)
  * `POST /api/v1/properties` (Create property)
  * `POST /api/v1/properties/with-gps` (Compatibility route for GPS creation)
  * `POST /api/v1/properties/landlord/submit` (Landlord submits property for approval)
  * `POST /api/v1/properties/:id/approve` (Admin approves landlord property)
  * `POST /api/v1/properties/:id/reject` (Admin rejects landlord property)
  * `PATCH /api/v1/properties/:id/units/:unitId/geolocation` (Update unit coordinates)
  * `GET /api/v1/properties/:id/units/geojson` (Export units GeoJSON feature collection)
* **Models**: `Property` (nested `units` sub-document)
* **Frontend Pages**: `PropertiesPage`, `PropertyDetailPage`, `AddPropertyPage`, `LandlordAddPropertyPage`
* **State**: Operational. Landlord properties go to status `pending_admin_approval` before activation.

### Feature 3: Tenant Profile & Lease Management
* **Description**: Agents pre-onboard tenants, generate lease agreements, assign vacant units, and link tenant users to profiles using unique Tenant Codes.
* **Backend Routes**:
  * `GET /api/v1/tenants` (Scoped tenants list)
  * `POST /api/v1/tenants` (Pre-register tenant with tenancy code)
  * `PATCH /api/v1/tenants/:id` (Edit tenant details)
  * `POST /api/v1/tenants/:id/terminate` (Terminate tenancy and vacate unit)
  * `GET /api/v1/properties/units/vacant` (Fetch vacant units for assignment)
* **Models**: `Tenant`, `Property`
* **Frontend Pages**: `TenantsPage`
* **State**: Operational. Terminating tenancy changes `tenancy_status` to `terminated` and resets unit status to `vacant`.

### Feature 4: Rent Payments & Safaricom M-Pesa Integration
* **Description**: Tenants pay rent via Safaricom M-Pesa STK push. The system processes callbacks, matches payments, sets lock states, and handles discrepancies.
* **Backend Routes**:
  * `POST /api/v1/payments/initiate-stk` (Initiate STK Push)
  * `POST /api/v1/payments/auto-initiate` (Auto-initiate push based on tenant outstanding balance)
  * `POST /api/v1/payments/callback` (IP-restricted Safaricom C2B/STK webhook)
  * `POST /api/v1/payments/:id/override` (Admin manual verification override)
  * `GET /api/v1/payments` (List payments)
* **Models**: `Payment`, `Property`, `Tenant`
* **Frontend Pages**: `PaymentsPage`, `TenantPortalPage`
* **State**: Operational. Safe callbacks require IP whitelist checks (`X-Forwarded-For` from Safaricom range).

### Feature 5: Notices, PDF Generation & Multi-Channel Delivery
* **Description**: Creation of official notices with PDF templates stored in S3/R2, delivered via SMS and Email. Includes email failure SMS fallback.
* **Backend Routes**:
  * `POST /api/v1/notices/generate` (Generate notice PDF and trigger delivery)
  * `GET /api/v1/notices` (Get notices scoped by role)
  * `GET /api/v1/notices/:id/download` (Download notice PDF from R2 redirect)
  * `POST /api/v1/notices/:id/acknowledge` (Tenant receipt acknowledgement)
  * `POST /api/v1/notices/bulk` (Pending: Bulk notices endpoint)
* **Models**: `Notice`, `Tenant`
* **Frontend Pages**: `NoticesPage`
* **State**: Notice generation and acknowledgement are operational. Bulk notices endpoint is pending.

### Feature 6: Agent Geo-Tracking & Performance
* **Description**: Scoping agents to areas. Agents perform tasks and check-in with GPS locations and selfie validation.
* **Backend Routes**:
  * `POST /api/v1/agents/checkin` (Submit GPS coordinates, photo, and task check-in)
  * `GET /api/v1/agents/location` (Fetch agent last recorded location)
  * `GET /api/v1/agents/all-locations` (Fetch last check-in location of all agents)
  * `GET /api/v1/admin/agent-performance` (Analyze check-in logs and task compliance)
* **Models**: `User`
* **Frontend Pages**: `AgentPerformancePage`, `AdminDashboardPage` (Map widget)
* **State**: Operational. Location stored in User object under `last_location` and indexed with `2dsphere`.

### Feature 7: Distress Inventory & Auction System
* **Description**: Recording unit inventory. If tenant falls into rent arrears, admin can mark items as auctionable. Includes tenant reclaim and auction sale reporting.
* **Backend Routes**:
  * `POST /api/v1/inventory/:propId/mark-auctionable` (Flag unit item for auction due to arrears)
  * `POST /api/v1/inventory/:propId/auction-sold` (Record buyer details and sale price)
  * `POST /api/v1/inventory/:propId/reclaim` (Tenant reclaims item with arrears payment receipt)
  * `GET /api/v1/inventory/auctionable` (List all items marked for auction)
  * `GET /api/v1/inventory/auction-report` (Export KRA CSV report of sold items)
* **Models**: `Property` (nested `inventory` sub-document), `Payment`
* **Frontend Pages**: `AdminInventoryPage`
* **State**: Operational. Reclaims verify the associated payment receipt is confirmed.

### Feature 8: Late Fee Penalization & Rules
* **Description**: Configuring grace days, penalties, and maximum penalty caps. A daily cron script applies penalties to overdue balances.
* **Backend Routes**:
  * `GET /api/v1/admin/late-fee-rules` (List rules)
  * `POST /api/v1/admin/late-fee-rules` (Create late fee rule)
  * `PATCH /api/v1/admin/late-fee-rules/:id` (Update rule details)
  * `DELETE /api/v1/admin/late-fee-rules/:id` (Delete rule)
* **Models**: `LateFeeRule`, `Tenant`, `Payment`
* **Cron Service**: `cron/late-fee-applicator.js`
* **Frontend Pages**: `AdminDashboardPage` (System Settings)
* **State**: Operational. Daily script includes double-charge protection (idempotency check).

### Feature 9: Maintenance Ticket Workflow
* **Description**: Tenants request repairs. Tickets are routed to agents based on property assignment, resolved, and rated.
* **Backend Routes**:
  * `POST /api/v1/maintenance` (File new maintenance ticket)
  * `GET /api/v1/maintenance/my-tickets` (List tenant's tickets)
  * `GET /api/v1/maintenance` (List tickets scoped by role)
  * `PATCH /api/v1/maintenance/:id` (Update status: assigned, in_progress, resolved)
  * `DELETE /api/v1/maintenance/:id` (Delete/cancel open tickets)
* **Models**: `MaintenanceTicket`
* **Frontend Pages**: `MaintenancePage`
* **State**: Operational. Routing restricts non-assigned agents from updating tickets.

---

## 3. E2E Test Case Plan

### Tier 1: Feature Coverage Test Cases (Functional Verification)

#### Feature 1: User Auth & Onboarding Flow
* **TC-1.1.1**: **Sync Clerk User creation**: Verify that `POST /api/v1/users/sync-clerk` with a new `clerk_id` creates a User document with role=`tenant` and status=`is_active`=true.
* **TC-1.1.2**: **Clerk Webhook Update**: Send a mock webhook payload for `user.updated` to `POST /api/v1/users/webhook` and assert that the user's `full_name` is updated in MongoDB.
* **TC-1.1.3**: **Tenant Code Linking**: Onboard a tenant via `PATCH /api/v1/users/me/role` using a pre-assigned `tenant_code`. Verify that the tenant record links to the logged-in user ID and unit status changes to `occupied`.
* **TC-1.1.4**: **Agent Onboarding Request**: Onboard an agent via `PATCH /api/v1/users/me/role` with `earb_license`. Assert `agent_approval_status` is `pending`, `is_active` is `false`, and an admin notification is created.
* **TC-1.1.5**: **Landlord Onboarding Request**: Onboard a landlord via `PATCH /api/v1/users/me/role` with `landlord_verification_doc_url`. Verify that status is `pending` and `is_active` is `false`.

#### Feature 2: Property & Unit Lifecycle
* **TC-1.2.1**: **Landlord Submit Property**: Landlord submits a new property via `POST /api/v1/properties/landlord/submit`. Assert property is successfully saved with status=`pending_admin_approval`.
* **TC-1.2.2**: **Admin Approve Property**: Admin calls `POST /api/v1/properties/:id/approve`. Assert property status transitions to `active` and landlord receives an approval notification.
* **TC-1.2.3**: **Admin Reject Property**: Admin calls `POST /api/v1/properties/:id/reject` with a rejection reason. Assert property status transitions to `inactive` and landlord receives rejection details.
* **TC-1.2.4**: **Add Unit to Property**: Agent calls `POST /api/v1/properties/:propertyId/units` to add unit `5B`. Assert unit is appended to units array with status=`vacant`.
* **TC-1.2.5**: **Delete Vacant Unit**: Admin calls `DELETE /api/v1/properties/:id/units/:unitId` on a vacant unit. Assert unit is successfully removed.

#### Feature 3: Tenant & Lease Management
* **TC-1.3.1**: **Pre-onboard Tenant**: Agent registers a tenant via `POST /api/v1/tenants`. Assert tenant document is created with a unique code (e.g. `TNT-MOM-XXXX`) and default tenancy status is `active`.
* **TC-1.3.2**: **Fetch Vacant Units**: Call `GET /properties/units/vacant`. Assert that vacant unit details (unitNumber, rentAmount) are returned in the response.
* **TC-1.3.3**: **Link Tenant to User**: Call `POST /api/v1/tenants/:id/link-user` to link an existing user. Assert `user_id` matches the user and tenancy is active.
* **TC-1.3.4**: **Tenant Payment History**: Call `GET /api/v1/tenants/:id/payment-history`. Assert response lists past rent payment items.
* **TC-1.3.5**: **Terminate Tenancy**: Call `POST /api/v1/tenants/:id/terminate`. Assert tenant `tenancy_status` becomes `terminated` and unit status resets to `vacant`.

#### Feature 4: Rent Payments & M-Pesa Integration
* **TC-1.4.1**: **Initiate STK Push**: Call `POST /api/v1/payments/initiate-stk` with tenant ID, unit ID, and amount. Assert response status is `pending` and checkout request ID is returned.
* **TC-1.4.2**: **M-Pesa STK Callback SUCCESS**: Send successful Safaricom callback to `POST /api/v1/payments/callback` from a Safaricom IP. Assert payment status updates to `confirmed`, unit `lock_status` updates to `payment_confirmed`, and tenant history registers payment.
* **TC-1.4.3**: **M-Pesa STK Callback FAILURE**: Send failed Safaricom callback (ResultCode=1032 - cancelled). Assert payment status updates to `failed`, workflow state updates to `MANUAL_REVIEW`, and discrepancy flag is set.
* **TC-1.4.4**: **M-Pesa C2B Callback (Unmatched)**: Send Safaricom C2B payment payload without corresponding STK session. Assert unmatched payment record is created with channel `mpesa_c2b` and flagged for manual review.
* **TC-1.4.5**: **Admin Manual Override**: Admin calls `POST /api/v1/payments/:id/override` with reason. Assert payment status updates to `confirmed` and unit status is updated.

#### Feature 5: Notices & Delivery
* **TC-1.5.1**: **Generate Notice**: Admin calls `POST /api/v1/notices/generate` with notice type `rent_increase` and effective date. Assert notice document is created.
* **TC-1.5.2**: **PDF Generation**: Verify that during notice generation, PDF generator generates a valid PDF link and saves it to the notice document.
* **TC-1.5.3**: **Email Delivery Dispatch**: Assert notice generate triggers an email send to the tenant's email address and updates email delivery status to `sent`.
* **TC-1.5.4**: **Email Failure SMS Fallback**: Mock email delivery failure. Assert that the system triggers fallback SMS dispatch and updates delivery logs with fallback SMS details.
* **TC-1.5.5**: **Acknowledge Notice**: Tenant calls `POST /api/v1/notices/:id/acknowledge`. Assert `tenant_acknowledged` is set to `true` and acknowledged timestamp is registered.

#### Feature 6: Agent Geo-Tracking & Performance
* **TC-1.6.1**: **Agent Check-in**: Agent calls `POST /api/v1/agents/checkin` with GPS coordinates, accuracy, and checkin photo. Assert check-in is recorded.
* **TC-1.6.2**: **Fetch Agent Last Location**: Call `GET /api/v1/agents/location` for a specific agent. Assert coordinates returned match the last check-in.
* **TC-1.6.3**: **Fetch All Agent Locations**: Admin calls `GET /api/v1/agents/all-locations`. Assert response returns list of all active agents' check-in locations.
* **TC-1.6.4**: **Fetch Agent Performance**: Admin calls `GET /api/v1/admin/agent-performance`. Assert response includes metrics like check-in count and task completion rate.
* **TC-1.6.5**: **Check-in User Location Update**: Verify that successful check-in automatically updates the `last_location` field in the agent's User document.

#### Feature 7: Distress Inventory & Auction
* **TC-1.7.1**: **Add Inventory Item**: Call `POST /inventory/:propId/add-item` to add item `item-fridge-001` (Refrigerator) to a unit. Assert item is added to the inventory array.
* **TC-1.7.2**: **Mark Item Auctionable**: Admin calls `POST /inventory/:propId/mark-auctionable` for the fridge due to rent arrears. Assert item condition is updated to `auctionable` and `auctionable` flag is `true`.
* **TC-1.7.3**: **Fetch Auctionable Items**: Call `GET /api/v1/inventory/auctionable`. Assert the marked fridge appears in the list.
* **TC-1.7.4**: **Record Auction Sale**: Admin calls `POST /inventory/:propId/auction-sold` with buyer and price. Assert item status updates to `sold` and sale price is registered.
* **TC-1.7.5**: **Distress Reclaim Flow**: Tenant pays arrears. Admin calls `POST /inventory/:propId/reclaim` with the payment receipt. Assert item status resets to `reclaimed` and `reclaim_receipt_id` is linked.

#### Feature 8: Late Fee Penalization & Rules
* **TC-1.8.1**: **Create Late Fee Rule**: Admin calls `POST /api/v1/admin/late-fee-rules` for percentage penalty. Assert rule document is created.
* **TC-1.8.2**: **Update Late Fee Rule**: Admin calls `PATCH /api/v1/admin/late-fee-rules/:id` to change grace days. Assert changes are saved.
* **TC-1.8.3**: **Execute Late Fee Cron**: Trigger the cron late fee applicator task. Assert overdue tenant accounts receive penalty charge.
* **TC-1.8.4**: **Late Fee Applicator Idempotency**: Run the late fee applicator twice. Assert that penalty is only applied once per tenant per month.
* **TC-1.8.5**: **Delete Late Fee Rule**: Admin calls `DELETE /api/v1/admin/late-fee-rules/:id`. Assert rule is removed.

#### Feature 9: Maintenance Ticket Workflow
* **TC-1.9.1**: **Tenant File Maintenance**: Tenant calls `POST /api/v1/maintenance` describing issue and selecting plumbing category. Assert ticket is created with status=`open`.
* **TC-1.9.2**: **Assign Maintenance Ticket**: Admin calls `PATCH /api/v1/maintenance/:id` setting `assigned_agent_id`. Assert status transitions to `assigned`.
* **TC-1.9.3**: **Agent Update Maintenance Status**: Agent updates ticket status to `in_progress` and adds notes. Assert status and notes are successfully updated.
* **TC-1.9.4**: **Resolve Maintenance Ticket**: Agent updates ticket status to `resolved`. Assert `resolved_at` date is registered.
* **TC-1.9.5**: **Tenant Cancel Open Ticket**: Tenant calls `DELETE /api/v1/maintenance/:id` on an open ticket. Assert ticket is successfully deleted.

---

### Tier 2: Boundary & Corner Cases

#### Feature 1: User Auth & Onboarding Flow
* **TC-2.1.1**: **Duplicate Registration**: Attempt to sync a user with an already registered email or clerk ID via `POST /api/v1/users`. Assert endpoint returns `409 Conflict`.
* **TC-2.1.2**: **Invalid Tenant Code Onboarding**: Call onboarding with a non-existent tenant code. Assert endpoint returns `404 Not Found`.
* **TC-2.1.3**: **Already Claimed Tenant Code**: Attempt to onboard a tenant using a tenant code already linked to another user ID. Assert endpoint returns `409 Conflict`.
* **TC-2.1.4**: **Unauthorized Role Elevation**: A logged-in agent tries to update their role to `super_admin` in `PATCH /api/v1/users/:id`. Assert endpoint returns `403 Forbidden`.
* **TC-2.1.5**: **Deactivating Own Account**: Admin tries to deactivate their own account via `POST /api/v1/users/:id/deactivate`. Assert endpoint returns `400 Bad Request` with code `SELF_DEACTIVATE`.

#### Feature 2: Property & Unit Lifecycle
* **TC-2.2.1**: **Property Create Without Auth**: Access property creation route without authorization header. Assert endpoint returns `401 Unauthorized`.
* **TC-2.2.2**: **Landlord Scope Violation**: Landlord attempts to approve property submission of another landlord. Assert endpoint returns `403 Forbidden`.
* **TC-2.2.3**: **Delete Occupied Unit**: Attempt to delete a unit that has status=`occupied`. Assert system blocks delete and returns `400/409 Conflict`.
* **TC-2.2.4**: **Agent Propose Non-existent Tier**: Agent calls `PATCH /properties/:id/agent-review` with invalid tier ID. Assert endpoint returns `404 Not Found`.
* **TC-2.2.5**: **Invalid Geolocation Coordinates**: Update unit geolocation with coordinates outside valid range (e.g. longitude > 180). Assert endpoint returns `400 Validation Error`.

#### Feature 3: Tenant & Lease Management
* **TC-2.3.1**: **Double Assign Occupied Unit**: Pre-onboard tenant and assign unit that is occupied. Assert system returns `409 Conflict`.
* **TC-2.3.2**: **Check Non-existent Tenant Email**: Call email check for email not in system. Assert response returns `exists: false`.
* **TC-2.3.3**: **Emergency Contact Data Leakage**: Access tenant emergency contact phone details as a tenant accessing another tenant's profile. Assert endpoint returns `403 Forbidden`.
* **TC-2.3.4**: **Invalid Lease Dates**: Pre-onboard tenant with lease end date prior to lease start date. Assert validation returns `400 Bad Request`.
* **TC-2.3.5**: **Double Terminate Tenancy**: Call terminate tenancy on tenant with status already set to `departed` or `terminated`. Assert endpoint returns `400 Bad Request`.

#### Feature 4: Rent Payments & M-Pesa Integration
* **TC-2.4.1**: **Callback IP Block**: Call payment callback from an unauthorized IP address (e.g. `192.168.1.1`). Assert endpoint returns `403 Forbidden` with code `IP_BLOCKED`.
* **TC-2.4.2**: **Payment Amount Discrepancy**: Send M-Pesa callback where callback amount differs from expected rent amount. Assert payment state changes to `failed` / `MANUAL_REVIEW` and logs discrepancy.
* **TC-2.4.3**: **Override payment > 100,000**: Non-super_admin agent tries to override a payment of KES 150,000. Assert endpoint returns `403 Forbidden`.
* **TC-2.4.4**: **Auto-Initiate with No Balance**: Call auto-initiate payment for tenant with KES 0 outstanding balance. Assert endpoint returns `400 Bad Request` with code `NO_OUTSTANDING_BALANCE`.
* **TC-2.4.5**: **Duplicate Callback Receipt**: Send payment callback with M-Pesa receipt number that already exists. Assert system detects duplicate and returns `200 OK` (idempotent) without applying credit twice.

#### Feature 5: Notices & Delivery
* **TC-2.5.1**: **Invalid Delivery Method**: Generate notice with delivery method array containing `whatsapp` (if unsupported by schema or config). Assert endpoint returns `400 Validation Error`.
* **TC-2.5.2**: **Cross-Tenant PDF Download**: Tenant tries to download notice PDF issued to another tenant. Assert endpoint returns `403 Forbidden`.
* **TC-2.5.3**: **Role-scoped notices list**: Tenant requests notices list. Verify response contains only notices directed to their tenant ID.
* **TC-5.5.4**: **Notice PDF Generation Fail Fallback**: Force S3/R2 upload failure during notice generation. Assert that notice is still created and delivery occurs via SMS/Email text fallback.
* **TC-2.5.5**: **Bulk notices validation**: Call bulk notices with empty tenantIds array. Assert endpoint returns `400 Validation Error`.

#### Feature 6: Agent Geo-Tracking & Performance
* **TC-2.6.1**: **Check-in Outside Assigned Area**: Agent checks in at location outside their operational area. Assert check-in succeeds but logs a warning or registers low compliance.
* **TC-2.6.2**: **Check-in Low Accuracy GPS**: Agent checks in with GPS accuracy of 500 meters. Assert endpoint returns `400 Bad Request` or logs warning.
* **TC-2.6.3**: **Non-Agent Role Check-in**: Tenant or Landlord attempts check-in. Assert endpoint returns `403 Forbidden`.
* **TC-2.6.4**: **Check-in Photo Missing**: Submit check-in without selfie/photo data. Assert validation fails with `400 Bad Request`.
* **TC-2.6.5**: **Scope Property List by Area**: Nyali-scoped agent requests properties list. Assert response contains only properties located in Nyali area.

#### Feature 7: Distress Inventory & Auction
* **TC-2.7.1**: **Non-Admin Mark Auctionable**: Agent attempts to mark item as auctionable. Assert endpoint returns `403 Forbidden`.
* **TC-2.7.2**: **Reclaim with Wrong Tenant Receipt**: Reclaim item using receipt ID belonging to another tenant's payment. Assert endpoint returns `400 Bad Request`.
* **TC-2.7.3**: **Reclaim with Unconfirmed Receipt**: Reclaim item using a pending/failed payment receipt ID. Assert endpoint returns `400 Bad Request`.
* **TC-2.7.4**: **Record Sale on Reclaimed Item**: Record auction sale for item that has already been reclaimed. Assert endpoint returns `400 Conflict` or `404`.
* **TC-2.7.5**: **Empty Auction Report**: Request auction report when no items are sold. Assert response returns headers with empty list.

#### Feature 8: Late Fee Penalization & Rules
* **TC-2.8.1**: **Rule Scope Conflict**: Commercial late fee rule configured. Verify residential tenant is ignored by applicator.
* **TC-2.8.2**: **Grace Period Overdue Check**: Run applicator on tenant who is overdue by 3 days, with grace period of 5 days. Assert no penalty is applied.
* **TC-2.8.3**: **Penalty Cap enforcement**: Percentage penalty (10%) applied to KES 80,000 rent exceeds max penalty cap of KES 5,000. Assert applied penalty is exactly KES 5,000.
* **TC-2.8.4**: **Non-Admin Configure Rules**: Landlord attempts to create late fee rule. Assert endpoint returns `403 Forbidden`.
* **TC-2.8.5**: **Applicator on Inactive Rules**: Set rule `is_active` to false and run applicator. Assert no penalty is applied to matching tenants.

#### Feature 9: Maintenance Ticket Workflow
* **TC-2.9.1**: **Delete In-Progress Ticket**: Tenant attempts to delete ticket with status `in_progress`. Assert endpoint returns `400 Bad Request`.
* **TC-2.9.2**: **Delete Other Tenant Ticket**: Tenant attempts to delete ticket belonging to another tenant. Assert endpoint returns `403 Forbidden`.
* **TC-2.9.3**: **Invalid Agent Assignment**: Assign ticket to an agent whose assigned areas do not match the property's area. Assert system blocks assignment with `403 Forbidden`.
* **TC-2.9.4**: **Photos limit check**: Create ticket with 6 photos. Assert system truncates to 5 or returns `400 Validation Error`.
* **TC-2.9.5**: **Review Rating Out of Bounds**: Tenant rates maintenance resolved ticket with rating 6. Assert validation returns `400 Bad Request`.

---

### Tier 3: Cross-Feature Combinations (Pairwise Interactions)

* **TC-3.1**: **Rent Payments & Distress Inventory**:
  * *Features*: Feature 4 (Rent Payments) & Feature 7 (Distress Inventory)
  * *Scenario*: A tenant has an outstanding balance, causing their sofa to be marked as `auctionable`. Tenant makes an M-Pesa payment which callback successfully processes. The confirmed payment receipt is immediately used to call the reclaim endpoint, successfully transitioning the item status back to `reclaimed`.
* **TC-3.2**: **Late Fee Applicator & Auto Rent Payments**:
  * *Features*: Feature 8 (Late Fee Rules) & Feature 4 (Rent Payments)
  * *Scenario*: Late fee rule is active. Tenant rent is overdue. Cron late fee applicator runs, applying a KES 2,000 penalty. Tenant calls `POST /payments/auto-initiate`. The STK push aggregates the normal rent + penalty balance (KES 27,000) and triggers payment.
* **TC-3.3**: **Property Registration & Agent Geo-Scoping**:
  * *Features*: Feature 2 (Property Lifecycle) & Feature 6 (Geo-Tracking)
  * *Scenario*: Landlord registers a Nyali-based property. Admin approves it and assigns it to a Nyali-scoped agent. The agent successfully performs a geo-checkin at the coordinates of the property.
* **TC-3.4**: **Maintenance Ticket Resolution & Notifications**:
  * *Features*: Feature 9 (Maintenance) & Feature 1 (Auth & Notifications)
  * *Scenario*: Tenant files a maintenance ticket. Assigned agent resolves the ticket. System automatically triggers an in-app notification to the tenant's portal, which is successfully read and marked as read.
* **TC-3.5**: **Notice Generation & Lease Termination**:
  * *Features*: Feature 5 (Notices) & Feature 3 (Tenant/Lease Management)
  * *Scenario*: Admin issues a 30-day eviction notice due to non-payment. Upon notice expiry date, system automatically triggers lease termination, vacating the unit and changing tenancy status to `expired`/`departed`.

---

### Tier 4: Real-world Application Scenarios

#### Scenario 1: The End-to-End Onboarding & Rent Collection Loop
1. Admin creates tenant profile in system with unit `MUT-NYL-001/3B` (rent KES 25,000) and email `tenant@gmail.com`.
2. Tenant signs up via Clerk, logs in, redirected to onboarding, enters their tenant code, and successfully links profile.
3. System triggers monthly rent billing. Tenant calls auto-initiate STK push.
4. Safaricom sends successful payment callback.
5. System marks payment as confirmed, changes unit lock status to `payment_confirmed`, and adds payment to history.

#### Scenario 2: Landlord Registration to Tenant Occupancy
1. Landlord registers, uploads verification document, and enters pending state.
2. Admin logs in, inputs verification password, reviews landlord document, and approves account.
3. Approved landlord submits property "Shanzu Beach Villas" for approval.
4. Admin approves the property. Agent registers a new tenant for unit `1A` inside the villas.
5. Tenant logs in, links profile via tenant code, and completes onboarding.

#### Scenario 3: Arrears Penalization & Distress Auction Loop
1. Tenant rent payment becomes overdue (due on 5th, current date is 10th).
2. Late fee applicator cron runs, applies 10% penalty to tenant's arrears balance.
3. Tenant fails to pay. Agent check-in task is registered. Agent goes to site, checks in with photo, and locks the unit.
4. Tenant departs without paying. Admin marks unit sofa as `auctionable`.
5. Admin records auction sale of the sofa to Mombasa Auctions and generates the KRA CSV auction report.

#### Scenario 4: Urgent Maintenance Escalation
1. Tenant registers emergency maintenance ticket for "plumbing - burst pipe".
2. Admin receives notification, assigns ticket to nearest Nyali agent.
3. Agent checks in at unit coordinates, resolves plumbing issue, adds agent repair notes, and marks resolved.
4. Tenant receives resolution notification in portal.
5. Tenant logs in, verifies ticket is resolved, and rates satisfaction 5 stars.

#### Scenario 5: End-of-Month Tax Compliance Reporting
1. Throughout June, multiple residential and commercial payments are received.
2. Expired leases are cleaned up by cron jobs.
3. Accountant logs in, enters password verification, and requests KRA CSV report for June.
4. System calculates 7.5% MRI for residential rent payments and 10% WHT for commercial rent payments.
5. Accountant downloads CSV containing correct tax calculations and dashboard summary charts reflect figures.

---

## 4. Verification Methods & Mocking Strategies

To run and verify the test case scenarios locally, the following setup is configured:

### 1. Clerk Authentication Mocking
* Mock Clerk Express middleware in `tests/setup.js` by intercepting token validations and injecting a test `userId`.
```javascript
jest.mock('@clerk/clerk-sdk-node', () => ({
  ClerkExpressRequireAuth: () => (req, res, next) => {
    req.auth = { userId: 'clerk_test_user_id' };
    next();
  }
}));
```

### 2. Safaricom M-Pesa Mocking
* Mock Safaricom STK Push endpoint responses and C2B notifications.
* Use a local mock body matching standard Safaricom metadata:
```json
{
  "Body": {
    "stkCallback": {
      "CheckoutRequestID": "ws_CO_TEST12345",
      "ResultCode": 0,
      "ResultDesc": "Success",
      "CallbackMetadata": {
        "Item": [
          {"Name": "Amount", "Value": 25000},
          {"Name": "MpesaReceiptNumber", "Value": "QKJ7E2E123"}
        ]
      }
    }
  }
}
```

### 3. Messaging Mocks
* Mock AfricasTalking SMS gateway and Resend email gateway to verify delivery triggers without calling external services.

### 4. Running the Tests
To run existing tests and verify the E2E setup, execute:
```bash
npm run test
```
Inside the `backend` folder.

All test findings and plans mapped in this document will serve as the exact structural baseline for implementing the Playwright and Jest E2E test runner in the subsequent step.
