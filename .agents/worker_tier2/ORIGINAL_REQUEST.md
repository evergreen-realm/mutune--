## 2026-06-19T12:25:54Z
Create the E2E test file backend/tests/tier2.e2e.test.js containing the Tier 2 Boundary & Corner Cases tests (45 tests total, 5 per feature across 9 features).

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
4. Organize tests into describe blocks per feature boundary case:
   - Feature 1: User Auth & Onboarding Edge cases
   - Feature 2: Property & Unit Lifecycle boundaries
   - Feature 3: Tenant Profile & Lease edge cases
   - Feature 4: Rent Payments & M-Pesa Callback edge cases (e.g. callback IP block, duplicate callback receipt)
   - Feature 5: Notices & Delivery boundaries (bulk notices validation check)
   - Feature 6: Agent Geo-Tracking boundary cases (out-of-area checkins)
   - Feature 7: Distress Inventory & Auction gating (non-admin actions, wrong receipt reclaims)
   - Feature 8: Late Fee Rules logic boundaries (inactive rules, grace days checks)
   - Feature 9: Maintenance Ticket edge cases (photo limits, out-of-bounds ratings)
5. Keep tests concise and clean. Each test case should perform the request, check assertions on status/body, and check database state.
6. Write the file directly to c:\Users\Admin\Desktop\mutune\backend\tests\tier2.e2e.test.js. Do not make parallel tool calls. Once done, reply with a handoff message containing the path and summary.
