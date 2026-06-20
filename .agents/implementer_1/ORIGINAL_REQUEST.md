## 2026-06-19T15:19:15Z
Create the E2E test file backend/tests/tier1.e2e.test.js containing the Tier 1 Feature Coverage tests (45 tests total, 5 per feature across the 9 features).

Use the following guidelines:
1. Import supertest, the Express app, and all relevant Mongoose models (User, Property, Tenant, Payment, Notice, LateFeeRule, MaintenanceTicket, Notification, Task).
2. Mock clerk authentication using the standard pattern:
   ```javascript
   let mockClerkId = 'clerk_admin_001';
   jest.mock('@clerk/clerk-sdk-node', () => ({
     ClerkExpressRequireAuth: () => (req, res, next) => {
       req.auth = { userId: mockClerkId };
       next();
     },
     clerkClient: {
       users: {
         updateUserMetadata: jest.fn().mockResolvedValue({}),
         getUser: jest.fn().mockImplementation((id) => {
           // Resolve mock roles based on mockClerkId
           let role = 'tenant';
           if (id.includes('admin')) role = 'super_admin';
           else if (id.includes('agent')) role = 'agent';
           else if (id.includes('landlord')) role = 'landlord';
           return Promise.resolve({ id, publicMetadata: { role } });
         }),
         deleteUser: jest.fn().mockResolvedValue({})
       }
     }
   }));
   ```
3. Mock external services: services/sms, services/pdf (generateNoticePDF), resend (email), services/mpesa (initiateSTKPush).
4. Organize tests into describe blocks per feature:
   - Feature 1: User Authentication, Role Sync & Onboarding
   - Feature 2: Property & Unit Lifecycle
   - Feature 3: Tenant Profile & Lease
   - Feature 4: Rent Payments & M-Pesa callback
   - Feature 5: Notices & Delivery (including bulk notices endpoint POST /api/v1/notices/bulk)
   - Feature 6: Agent Geo-Tracking
   - Feature 7: Distress Inventory & Auction
   - Feature 8: Late Fee Rules
   - Feature 9: Maintenance Ticket Workflow
5. Keep tests concise and clean. Each test case should perform the request, check assertions on status/body, and check the database state if applicable.
6. For unimplemented endpoints (e.g. POST /api/v1/notices/bulk), write the correct expected E2E logic (expecting 200/201 with success body). These tests will fail currently, which is expected.
7. Write the file directly to c:\Users\Admin\Desktop\mutune\backend\tests\tier1.e2e.test.js. Do not make parallel tool calls. Once done, reply with a handoff message containing the path and summary.
