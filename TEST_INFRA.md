# MutuneRent Pro E2E Test Infrastructure & Specifications

This document defines the E2E test infrastructure, 4-tier testing architecture, and the comprehensive suite of test cases for the MutuneRent Pro property management SaaS.

---

## 1. Test Architecture Overview

The MutuneRent Pro E2E test suite uses an opaque-box, requirement-driven testing approach. The test runner is configured to interact with the system via HTTP APIs (using Playwright and Jest/Supertest) to verify the integration, correctness, and security of the platform without relying on internal implementation details.

The test cases are structured into four distinct tiers:
- **Tier 1: Feature Coverage (Functional Verification)**: Succinct, behavior-focused tests verifying the main success paths of each feature. Minimum of 5 test cases per feature across 9 features (Total: 45 cases).
- **Tier 2: Boundary & Corner Cases (Robustness & Security)**: Edge cases, validation limits, security/role boundary gating, and error handling. Minimum of 5 test cases per feature across 9 features (Total: 45 cases).
- **Tier 3: Cross-Feature Combinations (Pairwise Interactions)**: Verification of integrations and data flows when multiple features interact (Total: 9 cases, including 4 custom combinations).
- **Tier 4: Real-world Application Scenarios (System-Level Workflows)**: Comprehensive user stories executing complex, multi-user, multi-step actions simulating actual usage (Total: 5 scenarios).

---

## 2. Feature Inventory

The test suite covers the following 9 key features:

1. **User Authentication, Role Sync & Onboarding Flow**:
   - Handles login via Clerk, user data sync with MongoDB, Clerk webhook integration, and role-based onboarding (Admin, Agent, Landlord, Tenant).
2. **Property & Unit Lifecycle Management**:
   - Manages property registrations, landlord submissions, admin approval/rejections, and unit management (vacant/occupied states, geolocations, GeoJSON export).
3. **Tenant Profile & Lease Management**:
   - Covers agent pre-onboarding, lease configuration, tenant-to-user profile linking via codes, and lease termination workflows.
4. **Rent Payments & Safaricom M-Pesa Integration**:
   - Initiates STK push payments, processes Safaricom callbacks (under IP whitelisting), resolves payment discrepancies, and supports manual overrides.
5. **Notices, PDF Generation & Multi-Channel Delivery**:
   - Generates official notices, creates and uploads PDF templates to R2/S3, triggers email/SMS delivery, and logs recipient acknowledgements.
6. **Agent Geo-Tracking & Performance**:
   - Verifies agent coordinates and check-in tasks, validates check-in photos, maps performance analytics, and tracks last known geolocations.
7. **Distress Inventory & Auction System**:
   - Logs unit inventory items, marks items as auctionable due to rent arrears, processes tenant reclaims, and reports auction sales.
8. **Late Fee Penalization & Rules**:
   - Configures grace periods and caps, applies automated late fee runs via cron, and enforces penalty limit rules.
9. **Maintenance Ticket Workflow**:
   - Manages tenant repair requests, routes tickets based on area assignments, handles agent status updates, and logs tenant ratings.

---

## 3. Tier 1: Feature Coverage Test Cases (45 Cases)

### Feature 1: User Authentication, Role Sync & Onboarding Flow
- **TC-1.1.1: Sync Clerk User Creation**
  - *Objective*: Verify user sync endpoint creates a new tenant user record.
  - *Steps*: Send `POST /api/v1/users/sync-clerk` with new Clerk ID and email.
  - *Assertion*: Returns `200 OK` and creates a User document with role `tenant` and active status.
- **TC-1.1.2: Clerk Webhook Update**
  - *Objective*: Verify Clerk webhook updates user information.
  - *Steps*: Send mock `user.updated` webhook payload to `POST /api/v1/users/webhook`.
  - *Assertion*: MongoDB User document's name and details are successfully updated.
- **TC-1.1.3: Tenant Code Linking**
  - *Objective*: Verify tenant code linking during onboarding.
  - *Steps*: Call onboarding route `PATCH /api/v1/users/me/role` using a valid `tenant_code`.
  - *Assertion*: Links the tenant profile to the user ID and marks the unit as occupied.
- **TC-1.1.4: Agent Onboarding Request**
  - *Objective*: Verify onboarding submission for agents.
  - *Steps*: Submit onboarding request via `PATCH /api/v1/users/me/role` with `earb_license`.
  - *Assertion*: Agent status becomes pending admin approval and remains inactive.
- **TC-1.1.5: Landlord Onboarding Request**
  - *Objective*: Verify onboarding submission for landlords.
  - *Steps*: Submit onboarding request via `PATCH /api/v1/users/me/role` with verification documents.
  - *Assertion*: Landlord status is set to pending admin approval and remains inactive.

### Feature 2: Property & Unit Lifecycle Management
- **TC-1.2.1: Landlord Submit Property**
  - *Objective*: Verify landlord property registration.
  - *Steps*: Landlord sends `POST /api/v1/properties/landlord/submit` with property details.
  - *Assertion*: Property is saved in the database with status `pending_admin_approval`.
- **TC-1.2.2: Admin Approve Property**
  - *Objective*: Verify property approval by administrator.
  - *Steps*: Admin calls `POST /api/v1/properties/:id/approve`.
  - *Assertion*: Property status transitions to `active` and landlord notification is sent.
- **TC-1.2.3: Admin Reject Property**
  - *Objective*: Verify property rejection by administrator.
  - *Steps*: Admin calls `POST /api/v1/properties/:id/reject` with comments.
  - *Assertion*: Property status transitions to `inactive` and comments are saved.
- **TC-1.2.4: Add Unit to Property**
  - *Objective*: Verify unit creation within a property.
  - *Steps*: Agent sends `POST /api/v1/properties/:propertyId/units` for unit `3A`.
  - *Assertion*: Unit is added to Mongoose property schema array with status `vacant`.
- **TC-1.2.5: Delete Vacant Unit**
  - *Objective*: Verify deleting a vacant unit.
  - *Steps*: Admin calls `DELETE /api/v1/properties/:id/units/:unitId` on a vacant unit.
  - *Assertion*: Unit is successfully removed from the units sub-document array.

### Feature 3: Tenant Profile & Lease Management
- **TC-1.3.1: Pre-onboard Tenant**
  - *Objective*: Verify tenant profile creation.
  - *Steps*: Agent registers tenant profile via `POST /api/v1/tenants`.
  - *Assertion*: Tenant document is created with a unique code (format: `TNT-MOM-XXXX`).
- **TC-1.3.2: Fetch Vacant Units**
  - *Objective*: Verify retrieval of empty units for lease assignment.
  - *Steps*: Call `GET /api/v1/properties/units/vacant`.
  - *Assertion*: Returns list of units with status `vacant` along with rent amounts.
- **TC-1.3.3: Link Tenant to User**
  - *Objective*: Verify manual linking of tenant profile to user.
  - *Steps*: Admin calls `POST /api/v1/tenants/:id/link-user` with a user ID.
  - *Assertion*: Tenant record references user ID and unit becomes occupied.
- **TC-1.3.4: Tenant Payment History**
  - *Objective*: Verify payment history display.
  - *Steps*: Call `GET /api/v1/tenants/:id/payment-history`.
  - *Assertion*: Returns list of all rent payment items associated with the tenant.
- **TC-1.3.5: Terminate Tenancy**
  - *Objective*: Verify lease termination workflow.
  - *Steps*: Call `POST /api/v1/tenants/:id/terminate`.
  - *Assertion*: Tenancy status changes to `terminated` and unit status resets to `vacant`.

### Feature 4: Rent Payments & Safaricom M-Pesa Integration
- **TC-1.4.1: Initiate STK Push**
  - *Objective*: Verify payment initiation request.
  - *Steps*: Call `POST /api/v1/payments/initiate-stk` with tenant ID and amount.
  - *Assertion*: Returns payment pending status and a Safaricom checkout request ID.
- **TC-1.4.2: M-Pesa STK Callback SUCCESS**
  - *Objective*: Verify automated payment confirmation.
  - *Steps*: POST a successful callback payload to `/api/v1/payments/callback`.
  - *Assertion*: Payment transitions to `confirmed` and unit status is updated.
- **TC-1.4.3: M-Pesa STK Callback FAILURE**
  - *Objective*: Verify handling of failed payments.
  - *Steps*: POST a failed callback payload (cancelled checkout) to `/api/v1/payments/callback`.
  - *Assertion*: Payment transitions to `failed` and is flagged for manual review.
- **TC-1.4.4: M-Pesa C2B Callback (Unmatched)**
  - *Objective*: Verify C2B payment log without pre-existing session.
  - *Steps*: POST raw payment callback payload to C2B callback endpoint.
  - *Assertion*: Unmatched payment record is logged and flagged for manual reconciliation.
- **TC-1.4.5: Admin Manual Override**
  - *Objective*: Verify payment override functionality.
  - *Steps*: Admin calls `POST /api/v1/payments/:id/override` with reason.
  - *Assertion*: Payment is marked as confirmed and unit status is updated.

### Feature 5: Notices, PDF Generation & Multi-Channel Delivery
- **TC-1.5.1: Generate Notice**
  - *Objective*: Verify notice document creation.
  - *Steps*: Admin calls `POST /api/v1/notices/generate` with notice type.
  - *Assertion*: Notice document is created with correct metadata.
- **TC-1.5.2: PDF Generation**
  - *Objective*: Verify PDF generation and storage link creation.
  - *Steps*: Check the notice generation service response.
  - *Assertion*: Notice record contains a valid, downloadable R2/S3 PDF link.
- **TC-1.5.3: Email Delivery Dispatch**
  - *Objective*: Verify dispatch of notice emails.
  - *Steps*: Generate notice and check the email log output.
  - *Assertion*: Email service log confirms email is sent to the tenant's email.
- **TC-1.5.4: Email Failure SMS Fallback**
  - *Objective*: Verify SMS fallback on email delivery failure.
  - *Steps*: Force email dispatch failure during notice creation.
  - *Assertion*: System immediately dispatches an SMS notice and logs the fallback event.
- **TC-1.5.5: Acknowledge Notice**
  - *Objective*: Verify tenant notice acknowledgement.
  - *Steps*: Tenant calls `POST /api/v1/notices/:id/acknowledge`.
  - *Assertion*: Notice's `tenant_acknowledged` is set to `true` with timestamp.

### Feature 6: Agent Geo-Tracking & Performance
- **TC-1.6.1: Agent Check-in**
  - *Objective*: Verify agent check-in recording.
  - *Steps*: Agent calls `POST /api/v1/agents/checkin` with GPS coordinates and photo URL.
  - *Assertion*: Check-in record is created and returns success.
- **TC-1.6.2: Fetch Agent Last Location**
  - *Objective*: Verify location lookup for a specific agent.
  - *Steps*: Call `GET /api/v1/agents/location` for agent ID.
  - *Assertion*: Returns correct last recorded coordinate mapping.
- **TC-1.6.3: Fetch All Agent Locations**
  - *Objective*: Verify all-agents coordinates query.
  - *Steps*: Admin calls `GET /api/v1/agents/all-locations`.
  - *Assertion*: Returns a list of all active agents and their last geolocations.
- **TC-1.6.4: Fetch Agent Performance**
  - *Objective*: Verify performance analytics lookup.
  - *Steps*: Admin calls `GET /api/v1/admin/agent-performance`.
  - *Assertion*: Returns check-in statistics, compliance scores, and task summaries.
- **TC-1.6.5: Check-in User Location Update**
  - *Objective*: Verify agent profile location sync.
  - *Steps*: Check the agent's User document after a successful check-in.
  - *Assertion*: The agent's `last_location` field matches the check-in coordinates.

### Feature 7: Distress Inventory & Auction System
- **TC-1.7.1: Add Inventory Item**
  - *Objective*: Verify logging of unit inventory items.
  - *Steps*: Admin/Agent calls `POST /inventory/:propId/add-item` with item details.
  - *Assertion*: Item is added to the property unit's inventory array.
- **TC-1.7.2: Mark Item Auctionable**
  - *Objective*: Verify marking items for auction due to rent arrears.
  - *Steps*: Admin calls `POST /inventory/:propId/mark-auctionable` for an item.
  - *Assertion*: Item condition is marked `auctionable` and flag is set to `true`.
- **TC-1.7.3: Fetch Auctionable Items**
  - *Objective*: Verify display of items ready for auction.
  - *Steps*: Call `GET /api/v1/inventory/auctionable`.
  - *Assertion*: Returns list of all items flagged as auctionable across all units.
- **TC-1.7.4: Record Auction Sale**
  - *Objective*: Verify recording of auction buyer and sale price.
  - *Steps*: Admin calls `POST /inventory/:propId/auction-sold` with sale details.
  - *Assertion*: Item status is updated to `sold` and sale price is recorded.
- **TC-1.7.5: Distress Reclaim Flow**
  - *Objective*: Verify reclaiming items upon paying arrears.
  - *Steps*: Call `POST /inventory/:propId/reclaim` with valid payment receipt.
  - *Assertion*: Item status resets to `reclaimed` and links to the receipt ID.

### Feature 8: Late Fee Penalization & Rules
- **TC-1.8.1: Create Late Fee Rule**
  - *Objective*: Verify late fee configuration.
  - *Steps*: Admin calls `POST /api/v1/admin/late-fee-rules` with percentage rate and cap.
  - *Assertion*: Late fee rule document is successfully created in MongoDB.
- **TC-1.8.2: Update Late Fee Rule**
  - *Objective*: Verify late fee configuration updates.
  - *Steps*: Admin calls `PATCH /api/v1/admin/late-fee-rules/:id` to change grace period.
  - *Assertion*: Rule document reflects the updated grace days.
- **TC-1.8.3: Execute Late Fee Cron**
  - *Objective*: Verify cron script calculation of late fees.
  - *Steps*: Trigger late fee applicator script.
  - *Assertion*: Overdue tenant accounts receive calculated late fee charges.
- **TC-1.8.4: Late Fee Applicator Idempotency**
  - *Objective*: Verify double-charge protection.
  - *Steps*: Run the late fee applicator cron script twice consecutively.
  - *Assertion*: Late fee charges are only applied once per billing cycle.
- **TC-1.8.5: Delete Late Fee Rule**
  - *Objective*: Verify rule removal.
  - *Steps*: Admin calls `DELETE /api/v1/admin/late-fee-rules/:id`.
  - *Assertion*: Late fee rule is deleted and no longer runs.

### Feature 9: Maintenance Ticket Workflow
- **TC-1.9.1: Tenant File Maintenance**
  - *Objective*: Verify filing repair requests.
  - *Steps*: Tenant calls `POST /api/v1/maintenance` with description and category.
  - *Assertion*: Ticket document is created with status `open`.
- **TC-1.9.2: Assign Maintenance Ticket**
  - *Objective*: Verify ticket assignment by admin.
  - *Steps*: Admin calls `PATCH /api/v1/maintenance/:id` with assigned agent ID.
  - *Assertion*: Ticket status transitions to `assigned`.
- **TC-1.9.3: Agent Update Maintenance Status**
  - *Objective*: Verify ticket progress updates by agent.
  - *Steps*: Agent calls `PATCH /api/v1/maintenance/:id` setting status to `in_progress`.
  - *Assertion*: Ticket status updates and agent notes are saved.
- **TC-1.9.4: Resolve Maintenance Ticket**
  - *Objective*: Verify resolving ticket by agent.
  - *Steps*: Agent calls `PATCH /api/v1/maintenance/:id` setting status to `resolved`.
  - *Assertion*: Ticket is resolved and `resolved_at` timestamp is set.
- **TC-1.9.5: Tenant Cancel Open Ticket**
  - *Objective*: Verify cancelling an open ticket.
  - *Steps*: Tenant calls `DELETE /api/v1/maintenance/:id` on an open ticket.
  - *Assertion*: Ticket is deleted from the system database.

---

## 4. Tier 2: Boundary & Corner Cases (45 Cases)

### Feature 1: User Authentication, Role Sync & Onboarding Flow
- **TC-2.1.1: Duplicate Registration**
  - *Steps*: Attempt to sync a user with an already registered email or clerk ID via `/api/v1/users/sync`.
  - *Assertion*: Returns `409 Conflict` and denies duplicate DB entry.
- **TC-2.1.2: Invalid Tenant Code Onboarding**
  - *Steps*: Call onboarding `PATCH /api/v1/users/me/role` with a fake tenant code.
  - *Assertion*: Returns `404 Not Found` and rejects role change.
- **TC-2.1.3: Already Claimed Tenant Code**
  - *Steps*: Call onboarding with a tenant code already linked to another active User ID.
  - *Assertion*: Returns `409 Conflict` and prevents hijacking.
- **TC-2.1.4: Unauthorized Role Elevation**
  - *Steps*: Agent attempts to elevate their role to `super_admin` via user edit endpoint.
  - *Assertion*: Returns `403 Forbidden` and blocks the role change.
- **TC-2.1.5: Deactivating Own Account**
  - *Steps*: Admin attempts to call `/api/v1/users/:id/deactivate` targeting their own ID.
  - *Assertion*: Returns `400 Bad Request` with code `SELF_DEACTIVATE` and blocks action.

### Feature 2: Property & Unit Lifecycle Management
- **TC-2.2.1: Property Create Without Auth**
  - *Steps*: Make `POST /api/v1/properties` without authorization header.
  - *Assertion*: Returns `401 Unauthorized` and rejects request.
- **TC-2.2.2: Landlord Scope Violation**
  - *Steps*: Landlord attempts to approve property submission of another landlord.
  - *Assertion*: Returns `403 Forbidden` and blocks the action.
- **TC-2.2.3: Delete Occupied Unit**
  - *Steps*: Try to delete a unit that currently has status `occupied`.
  - *Assertion*: Returns `409 Conflict` or `400 Bad Request` and blocks deletion of occupied units.
- **TC-2.2.4: Agent Propose Non-existent Tier**
  - *Steps*: Agent calls property review updating to a non-existent property tier ID.
  - *Assertion*: Returns `404 Not Found` and validation fails.
- **TC-2.2.5: Invalid Geolocation Coordinates**
  - *Steps*: Update unit coordinates with longitude > 180 or latitude > 90.
  - *Assertion*: Returns `400 Bad Request` with coordinates validation details.

### Feature 3: Tenant Profile & Lease Management
- **TC-2.3.1: Double Assign Occupied Unit**
  - *Steps*: Create tenant profile assigning unit already marked `occupied`.
  - *Assertion*: Returns `409 Conflict` and lease assignment fails.
- **TC-2.3.2: Check Non-existent Tenant Email**
  - *Steps*: Call email check endpoint `/api/v1/users/check-tenant-email/:email` with unregistered email.
  - *Assertion*: Returns `200 OK` with payload `{ exists: false }`.
- **TC-2.3.3: Emergency Contact Data Leakage**
  - *Steps*: Attempt to query emergency contact details of a tenant while authenticated as a different tenant.
  - *Assertion*: Returns `403 Forbidden` and blocks access.
- **TC-2.3.4: Invalid Lease Dates**
  - *Steps*: Submit lease with end date earlier than start date.
  - *Assertion*: Returns `400 Bad Request` with validation error.
- **TC-2.3.5: Double Terminate Tenancy**
  - *Steps*: Call `/terminate` on a tenant profile that is already `terminated` or `departed`.
  - *Assertion*: Returns `400 Bad Request` and blocks duplicate termination.

### Feature 4: Rent Payments & Safaricom M-Pesa Integration
- **TC-2.4.1: Callback IP Block**
  - *Steps*: Trigger mock callback endpoint from an unauthorized IP (not Safaricom range).
  - *Assertion*: Returns `403 Forbidden` with code `IP_BLOCKED`.
- **TC-2.4.2: Payment Amount Discrepancy**
  - *Steps*: Callback reports payment amount that is different from rent balance requested.
  - *Assertion*: Payment status updates to `failed` and flags for manual review discrepancy.
- **TC-2.4.3: Override payment > 100,000**
  - *Steps*: Non-admin agent attempts to override payment exceeding KES 100,000.
  - *Assertion*: Returns `403 Forbidden` (only Admin/Super-Admin can override large amounts).
- **TC-2.4.4: Auto-Initiate with No Balance**
  - *Steps*: Call `/payments/auto-initiate` on tenant with KES 0 outstanding.
  - *Assertion*: Returns `400 Bad Request` with code `NO_OUTSTANDING_BALANCE`.
- **TC-2.4.5: Duplicate Callback Receipt**
  - *Steps*: Send payment callback with a M-Pesa receipt ID that already exists in DB.
  - *Assertion*: Returns `200 OK` (idempotent response) but does not apply credit twice.

### Feature 5: Notices, PDF Generation & Multi-Channel Delivery
- **TC-2.5.1: Invalid Delivery Method**
  - *Steps*: Generate notice with delivery method set to an unsupported type (e.g. `whatsapp`).
  - *Assertion*: Returns `400 Bad Request` with validation failures.
- **TC-2.5.2: Cross-Tenant PDF Download**
  - *Steps*: Tenant attempts to download notice PDF generated for another tenant.
  - *Assertion*: Returns `403 Forbidden` and blocks download.
- **TC-2.5.3: Role-scoped notices list**
  - *Steps*: Tenant requests notices list endpoint.
  - *Assertion*: Response contains only notices addressed directly to their tenant ID.
- **TC-2.5.4: Notice PDF Generation Fail Fallback**
  - *Steps*: Force R2/S3 PDF upload failure during notice generation.
  - *Assertion*: Notice document is created; delivery falls back to plain-text SMS/Email.
- **TC-2.5.5: Bulk notices validation**
  - *Steps*: Call bulk notices endpoint with empty tenant IDs array or empty message.
  - *Assertion*: Returns `400 Bad Request` and blocks execution.

### Feature 6: Agent Geo-Tracking & Performance
- **TC-2.6.1: Check-in Outside Assigned Area**
  - *Steps*: Agent attempts task check-in at coordinates outside their operational area.
  - *Assertion*: Check-in is recorded, but compliance flag is marked low or warning logged.
- **TC-2.6.2: Check-in Low Accuracy GPS**
  - *Steps*: Agent submits check-in with GPS accuracy reading > 200m (e.g. 500m).
  - *Assertion*: Returns `400 Bad Request` or logs a warning/rejects check-in.
- **TC-2.6.3: Non-Agent Role Check-in**
  - *Steps*: Tenant or Landlord calls agent check-in endpoint `/api/v1/agents/checkin`.
  - *Assertion*: Returns `403 Forbidden` and rejects request.
- **TC-2.6.4: Check-in Photo Missing**
  - *Steps*: Submit check-in parameters with geolocation but missing the check-in photo.
  - *Assertion*: Returns `400 Bad Request` (selfie is mandatory for audit checks).
- **TC-2.6.5: Scope Property List by Area**
  - *Steps*: Request properties list as an agent assigned to Mombasa-CBD area.
  - *Assertion*: Response list includes only properties physically located in Mombasa-CBD.

### Feature 7: Distress Inventory & Auction System
- **TC-2.7.1: Non-Admin Mark Auctionable**
  - *Steps*: Agent attempts to mark an item as auctionable via `/inventory/:propId/mark-auctionable`.
  - *Assertion*: Returns `403 Forbidden` and blocks status update.
- **TC-2.7.2: Reclaim with Wrong Tenant Receipt**
  - *Steps*: Call reclaim endpoint using a receipt ID belonging to a different tenant.
  - *Assertion*: Returns `400 Bad Request` and item remains auctionable.
- **TC-2.7.3: Reclaim with Unconfirmed Receipt**
  - *Steps*: Call reclaim endpoint using a payment receipt ID that is still pending or failed.
  - *Assertion*: Returns `400 Bad Request` and blocks reclamation.
- **TC-2.7.4: Record Sale on Reclaimed Item**
  - *Steps*: Attempt to call `/auction-sold` on an item that has already been reclaimed.
  - *Assertion*: Returns `409 Conflict` (cannot sell reclaimed goods).
- **TC-2.7.5: Empty Auction Report**
  - *Steps*: Request KRA auction report for a month where zero items were auctioned or sold.
  - *Assertion*: Returns empty CSV headers list without error.

### Feature 8: Late Fee Penalization & Rules
- **TC-2.8.1: Rule Scope Conflict**
  - *Steps*: Setup commercial-only late fee rule; run applicator against residential tenants.
  - *Assertion*: Residential tenants' balances are ignored, ensuring zero penalty application.
- **TC-2.8.2: Grace Period Overdue Check**
  - *Steps*: Run applicator on tenant overdue by 3 days when rule grace period is 5 days.
  - *Assertion*: No late fee is charged to the tenant's account.
- **TC-2.8.3: Penalty Cap enforcement**
  - *Steps*: Apply 10% penalty to rent of KES 80,000 where rule specifies max cap of KES 5,000.
  - *Assertion*: Total applied late fee is capped exactly at KES 5,000 (not KES 8,000).
- **TC-2.8.4: Non-Admin Configure Rules**
  - *Steps*: Landlord attempts to create a late fee rule via `POST /api/v1/admin/late-fee-rules`.
  - *Assertion*: Returns `403 Forbidden` and blocks the configuration.
- **TC-2.8.5: Applicator on Inactive Rules**
  - *Steps*: Disable late fee rule (`isActive: false`) and run applicator cron.
  - *Assertion*: No late fees are computed or charged for tenants matching that rule.

### Feature 9: Maintenance Ticket Workflow
- **TC-2.9.1: Delete In-Progress Ticket**
  - *Steps*: Tenant attempts to delete maintenance ticket that has status `in_progress`.
  - *Assertion*: Returns `400 Bad Request` (active repair tasks cannot be deleted).
- **TC-2.9.2: Delete Other Tenant Ticket**
  - *Steps*: Tenant attempts to delete ticket belonging to another tenant profile.
  - *Assertion*: Returns `403 Forbidden` and blocks deletion.
- **TC-2.9.3: Invalid Agent Assignment**
  - *Steps*: Admin assigns ticket to an agent whose assigned region does not cover the property.
  - *Assertion*: Returns `403 Forbidden` or `400 Bad Request` and blocks assignment.
- **TC-2.9.4: Photos limit check**
  - *Steps*: Attempt to file a maintenance ticket uploading 6 photos.
  - *Assertion*: Returns `400 Bad Request` or truncates array to a maximum of 5 photos.
- **TC-2.9.5: Review Rating Out of Bounds**
  - *Steps*: Tenant reviews resolved ticket with a satisfaction rating of 6.
  - *Assertion*: Returns `400 Bad Request` due to validation constraint (ratings must be 1 to 5).

---

## 5. Tier 3: Cross-Feature Combinations (9 Cases)

- **TC-3.1: Rent Payments & Distress Inventory**
  - *Interacting Features*: Feature 4 (Rent Payments) & Feature 7 (Distress Inventory)
  - *Scenario*: Tenant outstanding balance exceeds limit, causing unit item (e.g. sofa) to be marked `auctionable`. Tenant makes payment via STK push. The callback confirms payment. Tenant/Admin uses the confirmed payment receipt to immediately call the reclaim endpoint.
  - *Assertion*: Item status successfully transitions from `auctionable` back to `reclaimed` and links to the payment.
- **TC-3.2: Late Fee Applicator & Auto Rent Payments**
  - *Interacting Features*: Feature 8 (Late Fee Rules) & Feature 4 (Rent Payments)
  - *Scenario*: Cron applicator runs and applies a late fee penalty (e.g. KES 2,000) to an overdue tenant. Tenant then requests `/payments/auto-initiate`.
  - *Assertion*: The initiated STK push aggregates the normal rent plus the applied late fee balance (Total: KES 27,000) and executes payment.
- **TC-3.3: Property Registration & Agent Geo-Scoping**
  - *Interacting Features*: Feature 2 (Property Lifecycle) & Feature 6 (Geo-Tracking)
  - *Scenario*: Landlord registers a property in Nyali. Admin approves it and assigns it to a Nyali-scoped agent. The agent performs check-in at the coordinates of the property.
  - *Assertion*: Check-in is accepted as fully compliant because the agent is assigned to the property's area.
- **TC-3.4: Maintenance Ticket Resolution & Notifications**
  - *Interacting Features*: Feature 9 (Maintenance) & Feature 1 (Auth & Notifications)
  - *Scenario*: Tenant files maintenance ticket. Agent resolves the ticket.
  - *Assertion*: System automatically dispatches in-app notification to the tenant's portal, and the unread counter increment is verified.
- **TC-3.5: Notice Generation & Lease Termination**
  - *Interacting Features*: Feature 5 (Notices) & Feature 3 (Tenant/Lease Management)
  - *Scenario*: Admin issues eviction notice to tenant due to arrears.
  - *Assertion*: Upon notice expiry date, system automatically triggers lease termination, vacating the unit and transitioning status to `terminated`.
- **TC-3.6: Late Fees & Lease Termination**
  - *Interacting Features*: Feature 8 (Late Fee Rules) & Feature 3 (Tenant/Lease Management)
  - *Scenario*: Tenant lease is terminated (vacated).
  - *Assertion*: Outstanding balance is calculated combining rent + accumulated late fees. The late fee applicator cron script must no longer apply penalties to this tenant account post-termination.
- **TC-3.7: Unit Location & Agent Check-in**
  - *Interacting Features*: Feature 2 (Property & Unit Lifecycle) & Feature 6 (Agent Geo-Tracking)
  - *Scenario*: Agent attempts check-in for a specific unit task. The system compares agent check-in coordinates against the unit's registered geolocation.
  - *Assertion*: If distance exceeds 50 meters, the check-in is rejected or flagged as non-compliant.
- **TC-3.8: Maintenance Photos & Upload**
  - *Interacting Features*: Feature 9 (Maintenance) & Feature 5 (R2/S3 Upload)
  - *Scenario*: Tenant files maintenance ticket attaching photos.
  - *Assertion*: Frontend uploads photos via `/api/v1/upload` to S3/R2 storage, receiving URLs. The backend stores these URLs inside the `MaintenanceTicket` document, successfully validating and rendering the images.
- **TC-3.9: User Deactivation & Rent Payments**
  - *Interacting Features*: Feature 1 (User Auth) & Feature 4 (Rent Payments)
  - *Scenario*: Admin deactivates tenant user account in the database.
  - *Assertion*: Tenant cannot trigger STK pushes, and any incoming callbacks or manual payment allocations for this deactivated user are rejected or flagged for manual review without applying rent credits.

---

## 6. Tier 4: Real-world Application Scenarios (5 Scenarios)

### Scenario 1: The End-to-End Onboarding & Rent Collection Loop
1. **Tenant Setup**: Admin registers a tenant profile with unit `MUT-NYL-001/3B` (rent KES 25,000) and email `tenant@gmail.com`.
2. **Onboarding**: Tenant signs up on Clerk, logs in, is redirected to Onboarding Page, enters the unique tenant code, and links their account.
3. **Payment Initiation**: Rent billing cycle begins. Tenant initiates STK push payment.
4. **Callback Processing**: Mock Safaricom callback returns a successful transaction payload with receipt `QKJ7E2E123`.
5. **Verification**: Payment status transitions to `confirmed`, unit lock status becomes `payment_confirmed`, and receipt is logged in the payment list.

### Scenario 2: Landlord Registration to Tenant Occupancy
1. **Landlord Registration**: Landlord signs up and submits onboarding details including verification document URL.
2. **Admin Verification**: Admin logs in, accesses verification panel, enters guard password, reviews documents, and activates the landlord account.
3. **Property Submission**: Landlord logs in, submits "Shanzu Beach Villas" for approval.
4. **Approval & Unit Setup**: Admin approves the property, and the agent adds vacant units to the property.
5. **Tenancy Link**: Agent pre-registers a tenant for unit `1A` in "Shanzu Beach Villas". Tenant logs in, enters tenant code, and completes onboarding, occupying the unit.

### Scenario 3: Arrears Penalization & Distress Auction Loop
1. **Rent Overdue**: Tenant rent goes unpaid past the grace period.
2. **Penalty Applied**: Daily late fee applicator cron runs, detects overdue balance, and applies a 10% late fee penalty.
3. **Agent Check-in & Lock**: Agent is assigned a task to visit the unit. Agent travels to coordinates, performs check-in with GPS and photo, and locks unit doors.
4. **Item Mark**: Tenant departs. Admin marks the unit sofa as `auctionable`.
5. **Auction Sale**: Admin records the sale of the sofa to a local buyer, entering price, and downloads KRA CSV report containing KRA auction reporting details.

### Scenario 4: Urgent Maintenance Escalation
1. **Ticket Filing**: Tenant registers an urgent maintenance ticket for a "burst pipe" under the plumbing category, uploading a photo.
2. **Routing & Assignment**: Admin views ticket, notes category, and assigns it to the nearest Nyali-scoped agent.
3. **Agent Fix**: Agent receives assignment, travels to the unit, performs geo-verified check-in, resolves the pipe issue, adds repair notes, and sets status to `resolved`.
4. **Tenant Verification**: Tenant receives in-app resolution notification, checks the repair, and rates the ticket 5 stars in the portal.

### Scenario 5: End-of-Month Tax Compliance Reporting
1. **Transactions Log**: Over a calendar month, various commercial and residential rent payments are processed and confirmed.
2. **Lease Maintenance**: Expired/terminated tenancies are resolved by system cron.
3. **Accountant Review**: Accountant logs in, enters secure password, and requests the KRA CSV tax report.
4. **Tax Calculations**: System generates tax rows calculating 7.5% MRI on residential rent payments and 10% Withholding Tax (WHT) on commercial rent payments.
5. **Export & Verify**: Accountant downloads the CSV containing accurate tax computations, and dashboard figures reflect the total tax due.

---

## 7. Test Infrastructure & Mocking Strategies

To enable reliable, fast, and hermetic execution of the E2E test suite locally and in CI/CD pipelines, the following mock layers are implemented in `tests/setup.js`:

### 1. Clerk Authentication Middleware Mock
Intercepts JWT check requests and populates the `req.auth` context with predefined test credentials depending on the role being tested:
```javascript
jest.mock('@clerk/clerk-sdk-node', () => ({
  ClerkExpressRequireAuth: () => (req, res, next) => {
    req.auth = { userId: req.headers['x-mock-clerk-id'] || 'clerk_test_tenant_id' };
    next();
  }
}));
```

### 2. Safaricom M-Pesa STK Push & C2B Callback Mocking
Verifies payment handling without contacting Safaricom. Mocks the HTTP client targeting the M-Pesa API and sends callback POST requests directly to `/api/v1/payments/callback` simulating successful and failed outcomes using standard Safaricom callback bodies.

### 3. Messaging Gateways Mock
Mocks the AfricasTalking (SMS) and Resend (Email) clients. Instead of sending live messages, the mock records the messages in an in-memory array (`global.sentSMS` and `global.sentEmails`), allowing tests to inspect and assert that the correct notifications were dispatched.

### 4. Running the Test Suite
To execute the tests locally within the `backend/` directory, run:
```bash
npm run test
```
