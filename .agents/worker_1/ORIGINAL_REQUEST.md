## 2026-06-19T20:25:55Z
Create the E2E test file backend/tests/tier3_4.e2e.test.js.

The file must be written directly to:
c:\Users\Admin\Desktop\mutune\backend\tests\tier3_4.e2e.test.js

Here are the requirements:
1. Include all 9 Tier 3 test cases:
   - TC-3.1: Rent Payments & Distress Inventory
     - Interacting Features: Feature 4 (Rent Payments) & Feature 7 (Distress Inventory)
     - Scenario: Tenant outstanding balance exceeds limit, causing unit item (e.g. sofa) to be marked `auctionable`. Tenant makes payment via STK push. The callback confirms payment. Tenant/Admin uses the confirmed payment receipt to immediately call the reclaim endpoint.
     - Assertion: Item status successfully transitions from `auctionable` back to `reclaimed` and links to the payment.
   - TC-3.2: Late Fee Applicator & Auto Rent Payments
     - Interacting Features: Feature 8 (Late Fee Rules) & Feature 4 (Rent Payments)
     - Scenario: Cron applicator runs and applies a late fee penalty (e.g. KES 2,000) to an overdue tenant. Tenant then requests `/payments/auto-initiate`.
     - Assertion: The initiated STK push aggregates the normal rent plus the applied late fee balance (Total: KES 27,000) and executes payment.
   - TC-3.3: Property Registration & Agent Geo-Scoping
     - Interacting Features: Feature 2 (Property Lifecycle) & Feature 6 (Geo-Tracking)
     - Scenario: Landlord registers a property in Nyali. Admin approves it and assigns it to a Nyali-scoped agent. The agent performs check-in at the coordinates of the property.
     - Assertion: Check-in is accepted as fully compliant because the agent is assigned to the property's area.
   - TC-3.4: Maintenance Ticket Resolution & Notifications
     - Interacting Features: Feature 9 (Maintenance) & Feature 1 (Auth & Notifications)
     - Scenario: Tenant files maintenance ticket. Agent resolves the ticket.
     - Assertion: System automatically dispatches in-app notification to the tenant's portal, and the unread counter increment is verified.
   - TC-3.5: Notice Generation & Lease Termination
     - Interacting Features: Feature 5 (Notices) & Feature 3 (Tenant/Lease Management)
     - Scenario: Admin issues eviction notice to tenant due to arrears.
     - Assertion: Upon notice expiry date, system automatically triggers lease termination, vacating the unit and transitioning status to `terminated`.
   - TC-3.6: Late Fees & Lease Termination
     - Interacting Features: Feature 8 (Late Fee Rules) & Feature 3 (Tenant/Lease Management)
     - Scenario: Tenant lease is terminated (vacated).
     - Assertion: Outstanding balance is calculated combining rent + accumulated late fees. The late fee applicator cron script must no longer apply penalties to this tenant account post-termination.
   - TC-3.7: Unit Location & Agent Check-in
     - Interacting Features: Feature 2 (Property & Unit Lifecycle) & Feature 6 (Agent Geo-Tracking)
     - Scenario: Agent attempts check-in for a specific unit task. The system compares agent check-in coordinates against the unit's registered geolocation.
     - Assertion: If distance exceeds 50 meters, the check-in is rejected or flagged as non-compliant.
   - TC-3.8: Maintenance Photos & Upload
     - Interacting Features: Feature 9 (Maintenance) & Feature 5 (R2/S3 Upload)
     - Scenario: Tenant files maintenance ticket attaching photos.
     - Assertion: Frontend uploads photos via `/api/v1/upload` to S3/R2 storage, receiving URLs. The backend stores these URLs inside the `MaintenanceTicket` document, successfully validating and rendering the images.
   - TC-3.9: User Deactivation & Rent Payments
     - Interacting Features: Feature 1 (User Auth) & Feature 4 (Rent Payments)
     - Scenario: Admin deactivates tenant user account in the database.
     - Assertion: Tenant cannot trigger STK pushes, and any incoming callbacks or manual payment allocations for this deactivated user are rejected or flagged for manual review without applying rent credits.

2. Include all 5 Tier 4 scenarios:
   - Scenario 1: End-to-End Onboarding & Rent Collection Loop
     - Step 1: Pre-register a tenant profile in the database (unit MUT-NYL-001/3B, rent KES 25,000, email tenant@gmail.com).
     - Step 2: Simulates checkTenantEmail: call `GET /api/v1/tenants/check-email?email=tenant@gmail.com`. Assert response matches `{ exists: true, tenant_code: '...', has_account: false, tenant_name: '...' }`.
     - Step 3: Simulates Clerk signup and onboarding sync: call `POST /api/v1/users/sync` with `{ email: 'tenant@gmail.com', tenant_code: '...' }`. Assert that the backend links the tenant, registers the user, and returns user with `role: 'tenant'`.
     - Step 4: Verify Onboarding UI logic backend signals: Gmail verified badge check, tenant-confirm screen check, and auto-filled code matching.
     - Step 5: Simulate Tenant Portal actions:
       * View lease: call `GET /api/v1/tenants/my/profile` (or whatever route displays the lease) and check lease details.
       * Log maintenance: call `POST /api/v1/maintenance` to log a ticket.
       * Pay rent: call `POST /api/v1/payments/initiate-stk` or `/api/v1/payments/auto-initiate`.
     - Step 6: Simulate M-Pesa Callback. Post Safaricom callback to `/api/v1/payments/callback` with a successful callback payload containing a mock receipt.
     - Step 7: Verify payment status transitions to `confirmed`, unit lock status becomes `payment_confirmed`, and receipt is logged in the payment list.
   - Scenario 2: Landlord Registration to Tenant Occupancy
     - Step 1: Landlord signs up and submits onboarding details including verification document URL.
     - Step 2: Admin logs in, accesses verification panel, enters guard password, reviews documents, and activates the landlord account.
     - Step 3: Landlord logs in, submits "Shanzu Beach Villas" for approval.
     - Step 4: Admin approves the property, and the agent adds vacant units to the property.
     - Step 5: Agent pre-registers a tenant for unit `1A` in "Shanzu Beach Villas". Tenant logs in, enters tenant code, and completes onboarding, occupying the unit.
   - Scenario 3: Arrears Penalization & Distress Auction Loop
     - Step 1: Tenant rent goes unpaid past the grace period.
     - Step 2: Daily late fee applicator cron runs, detects overdue balance, and applies a 10% late fee penalty.
     - Step 3: Agent is assigned a task to visit the unit. Agent travels to coordinates, performs check-in with GPS and photo, and locks unit doors.
     - Step 4: Tenant departs. Admin marks the unit sofa as `auctionable`.
     - Step 5: Admin records the sale of the sofa to a local buyer, entering price, and downloads KRA CSV report containing KRA auction reporting details.
   - Scenario 4: Urgent Maintenance Escalation
     - Step 1: Tenant logs in and views lease. Logs maintenance: registers an urgent maintenance ticket for a "burst pipe" under the plumbing category, uploading a photo.
     - Step 2: Admin views ticket, notes category, and assigns it to the nearest Nyali-scoped agent.
     - Step 3: Agent receives assignment, travels to the unit, performs geo-verified check-in, resolves the pipe issue, adds repair notes, and sets status to `resolved`.
     - Step 4: Tenant receives in-app resolution notification, checks the repair, and rates the ticket 5 stars in the portal (patching `tenant_satisfaction` to 5).
   - Scenario 5: End-of-Month Tax Compliance Reporting
     - Step 1: Over a calendar month, various commercial and residential rent payments are processed and confirmed.
     - Step 2: Expired/terminated tenancies are resolved by system cron.
     - Step 3: Accountant logs in, enters secure password, and requests the KRA CSV tax report.
     - Step 4: System generates tax rows calculating 7.5% MRI on residential rent payments and 10% Withholding Tax (WHT) on commercial rent payments.
     - Step 5: Accountant downloads the CSV containing accurate tax computations, and dashboard figures reflect the total tax due.

3. Follow the standard Clerk mocking and service mocking patterns from tier1/tier2.
4. Since the backend routes `GET /api/v1/tenants/check-email` and `POST /api/v1/users/sync` may not be fully implemented in the current branch, write the test code expecting these actual API endpoints. It is fine if these tests fail during local test execution because the endpoints are not yet implemented — the E2E tests serve as the specification that the parallel implementation track will make pass.
5. Make sure the test code compiles and has correct syntax.
6. Verify your implementation by running Jest locally on the written file and documenting the output.
