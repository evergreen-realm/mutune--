const request = require('supertest');
const app = require('../server');
const mongoose = require('mongoose');

const User = require('../models/User');
const Property = require('../models/Property');
const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const Notice = require('../models/Notice');
const LateFeeRule = require('../models/LateFeeRule');
const MaintenanceTicket = require('../models/MaintenanceTicket');
const Notification = require('../models/Notification');
const Task = require('../models/Task');

jest.setTimeout(30000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock Clerk authentication using the standard pattern
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

// Mock external services
jest.mock('../services/sms', () => ({
  send: jest.fn().mockResolvedValue({ success: true, messageId: 'SMS_MOCK_123' }),
  formatPhone: jest.fn(p => p.replace(/\D/g, '').replace(/^0/, '254'))
}));

jest.mock('../services/pdf', () => ({
  generateNoticePDF: jest.fn().mockResolvedValue('https://r2.cloudflare.com/mock-notice.pdf')
}));

let mockEmailSendError = null;
jest.mock('resend', () => {
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: {
        send: jest.fn().mockImplementation(() => {
          if (mockEmailSendError) {
            return Promise.resolve({ data: null, error: mockEmailSendError });
          }
          return Promise.resolve({ data: { id: 'email_mock_123' }, error: null });
        })
      }
    }))
  };
});

jest.mock('../services/mpesa', () => ({
  initiateSTKPush: jest.fn().mockResolvedValue({
    checkoutRequestId: 'ws_CO_MOCK123456',
    merchantRequestId: 'MRID_MOCK123',
    responseCode: '0',
    responseDescription: 'Success. Request accepted for processing',
    customerMessage: 'STK Push sent to tenant phone'
  }),
  formatPhone: jest.fn(p => p.replace(/\D/g, '').replace(/^0/, '254'))
}));

jest.mock('../services/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true })
}));

// Helper to clear database collections
const clearDatabase = async () => {
  await User.deleteMany({});
  await Property.deleteMany({});
  await Tenant.deleteMany({});
  await Payment.deleteMany({});
  await Notice.deleteMany({});
  await LateFeeRule.deleteMany({});
  await MaintenanceTicket.deleteMany({});
  await Notification.deleteMany({});
  await Task.deleteMany({});
};

describe('Tier 1 Feature Coverage Tests', () => {
  
  beforeAll(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  // ==========================================
  // Feature 1: User Authentication, Role Sync & Onboarding
  // ==========================================
  describe('Feature 1: User Authentication, Role Sync & Onboarding', () => {
    beforeAll(async () => {
      await clearDatabase();
    });

    test('TC-1.1.1: Sync Clerk User Creation', async () => {
      mockClerkId = 'clerk_new_tenant';
      const res = await request(app)
        .post('/api/v1/users/sync-clerk')
        .send({
          email: 'newtenant@mutune.test',
          full_name: 'New Tenant',
          phone: '254700000099'
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);

      const dbUser = await User.findOne({ clerk_id: 'clerk_new_tenant' });
      expect(dbUser).toBeDefined();
      expect(dbUser.email).toBe('newtenant@mutune.test');
      expect(dbUser.role).toBe('tenant');
    });

    test('TC-1.1.2: Clerk Webhook Update', async () => {
      const res = await request(app)
        .post('/api/v1/users/webhook')
        .set('x-webhook-secret', process.env.CLERK_WEBHOOK_SECRET || '')
        .send({
          type: 'user.updated',
          data: {
            id: 'clerk_new_tenant',
            email_addresses: [{ email_address: 'newtenant_updated@mutune.test' }],
            first_name: 'New',
            last_name: 'Tenant Updated',
            phone_numbers: [{ phone_number: '+254700000098' }],
            public_metadata: { role: 'tenant' }
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbUser = await User.findOne({ clerk_id: 'clerk_new_tenant' });
      expect(dbUser.email).toBe('newtenant_updated@mutune.test');
      expect(dbUser.full_name).toBe('New Tenant Updated');
    });

    test('TC-1.1.3: Tenant Code Linking', async () => {
      // Create tenant profile in DB first
      const tenant = await Tenant.create({
        tenant_code: 'TNT-MOM-0001',
        full_name: 'New Tenant Updated',
        id_number: '12345678',
        phone: '254700000098',
        email: 'newtenant_updated@mutune.test',
        current_unit_id: new mongoose.Types.ObjectId(),
        rent_amount_kes: 15000,
        lease_start: new Date(),
        lease_end: new Date()
      });

      mockClerkId = 'clerk_new_tenant';
      const res = await request(app)
        .patch('/api/v1/users/me/role')
        .send({
          role: 'tenant',
          tenant_code: 'TNT-MOM-0001',
          phone: '254700000098'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedTenant = await Tenant.findById(tenant._id);
      const dbUser = await User.findOne({ clerk_id: 'clerk_new_tenant' });
      expect(updatedTenant.user_id.toString()).toBe(dbUser._id.toString());
      expect(updatedTenant.tenancy_status).toBe('active');
    });

    test('TC-1.1.4: Agent Onboarding Request', async () => {
      // Pre-create agent user so requireAuth can load it
      await User.create({
        clerk_id: 'clerk_new_agent',
        email: 'newagent@mutune.test',
        full_name: 'New Agent',
        phone: '254700000077',
        is_active: true,
        user_code: 'USR-AGT-999'
      });

      mockClerkId = 'clerk_new_agent';
      const res = await request(app)
        .patch('/api/v1/users/me/role')
        .send({
          role: 'agent',
          phone: '254700000077',
          assigned_areas: ['Nyali'],
          earb_license: 'EARB-12345'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbUser = await User.findOne({ clerk_id: 'clerk_new_agent' });
      expect(dbUser.role).toBe('agent');
      expect(dbUser.agent_approval_status).toBe('pending');
      expect(dbUser.is_active).toBe(false);
    });

    test('TC-1.1.5: Landlord Onboarding Request', async () => {
      // Pre-create landlord user so requireAuth can load it
      await User.create({
        clerk_id: 'clerk_new_landlord',
        email: 'newlandlord@mutune.test',
        full_name: 'New Landlord',
        phone: '254700000066',
        is_active: true,
        user_code: 'USR-LLD-999'
      });

      mockClerkId = 'clerk_new_landlord';
      const res = await request(app)
        .patch('/api/v1/users/me/role')
        .send({
          role: 'landlord',
          phone: '254700000066',
          landlord_verification_doc_url: 'https://mutune.test/doc.pdf'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbUser = await User.findOne({ clerk_id: 'clerk_new_landlord' });
      expect(dbUser.role).toBe('landlord');
      expect(dbUser.landlord_approval_status).toBe('pending');
      expect(dbUser.is_active).toBe(false);
    });
  });

  // ==========================================
  // Feature 2: Property & Unit Lifecycle
  // ==========================================
  describe('Feature 2: Property & Unit Lifecycle', () => {
    let landlordUser, adminUser, property;

    beforeAll(async () => {
      await clearDatabase();
      landlordUser = await User.create({
        clerk_id: 'clerk_landlord_active',
        email: 'landlord@mutune.test',
        full_name: 'Active Landlord',
        phone: '254711111111',
        role: 'landlord',
        is_active: true,
        user_code: 'USR-LLD-001'
      });
      adminUser = await User.create({
        clerk_id: 'clerk_admin_001',
        email: 'admin@mutune.test',
        full_name: 'Admin User',
        phone: '254700000001',
        role: 'super_admin',
        is_active: true,
        user_code: 'USR-ADM-001'
      });
    });

    test('TC-1.2.1: Landlord Submit Property', async () => {
      mockClerkId = 'clerk_landlord_active';
      const res = await request(app)
        .post('/api/v1/properties/landlord/submit')
        .send({
          name: 'Nyali Heights',
          type: 'apartment',
          address: {
            area: 'Nyali',
            city: 'Mombasa',
            street: 'Links Rd'
          },
          units: [
            { unit_number: '1A', rent_kes: 20000, type: 'bedsitter' },
            { unit_number: '1B', rent_kes: 25000, type: 'bedsitter' }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      property = await Property.findOne({ name: 'Nyali Heights' });
      expect(property).toBeDefined();
      expect(property.status).toBe('pending_admin_approval');
      expect(property.units.length).toBe(2);
    });

    test('TC-1.2.2: Admin Approve Property', async () => {
      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .post(`/api/v1/properties/${property._id}/approve`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const approvedProp = await Property.findById(property._id);
      expect(approvedProp.status).toBe('active');
    });

    test('TC-1.2.3: Admin Reject Property', async () => {
      // Create another property pending approval
      const otherProp = await Property.create({
        name: 'Rejected Heights',
        property_code: 'PROP-REJ-001',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        landlord_id: landlordUser._id,
        status: 'pending_admin_approval',
        units: [{ unit_number: 'R1', rent_kes: 10000 }]
      });

      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .post(`/api/v1/properties/${otherProp._id}/reject`)
        .send({ reason: 'Invalid signature documentation.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const rejectedProp = await Property.findById(otherProp._id);
      expect(rejectedProp.status).toBe('inactive');
    });

    test('TC-1.2.4: Add Unit to Property', async () => {
      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .post(`/api/v1/properties/${property._id}/units`)
        .send({
          unit_number: '2A',
          rent_kes: 22000,
          bedrooms: 1,
          bathrooms: 1
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedProp = await Property.findById(property._id);
      const addedUnit = updatedProp.units.find(u => u.unit_number === '2A');
      expect(addedUnit).toBeDefined();
      expect(addedUnit.rent_kes).toBe(22000);
      expect(addedUnit.status).toBe('vacant');
    });

    test('TC-1.2.5: Delete Vacant Unit', async () => {
      const updatedProp = await Property.findById(property._id);
      const unitToDelete = updatedProp.units.find(u => u.unit_number === '2A');

      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .delete(`/api/v1/properties/${property._id}/units/${unitToDelete._id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const finalProp = await Property.findById(property._id);
      const deletedUnit = finalProp.units.find(u => u.unit_number === '2A');
      expect(deletedUnit).toBeUndefined();
    });
  });

  // ==========================================
  // Feature 3: Tenant Profile & Lease
  // ==========================================
  describe('Feature 3: Tenant Profile & Lease', () => {
    let adminUser, landlordUser, property, tenant;

    beforeAll(async () => {
      await clearDatabase();
      adminUser = await User.create({
        clerk_id: 'clerk_admin_001',
        email: 'admin@mutune.test',
        full_name: 'Admin User',
        phone: '254700000001',
        role: 'super_admin',
        is_active: true,
        user_code: 'USR-ADM-001'
      });
      landlordUser = await User.create({
        clerk_id: 'clerk_landlord_active',
        email: 'landlord@mutune.test',
        full_name: 'Active Landlord',
        phone: '254711111111',
        role: 'landlord',
        is_active: true,
        user_code: 'USR-LLD-001'
      });
      property = await Property.create({
        name: 'Nyali Heights',
        property_code: 'PROP-MOM-001',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        landlord_id: landlordUser._id,
        status: 'active',
        units: [
          { unit_number: '1A', rent_kes: 20000, status: 'vacant' },
          { unit_number: '1B', rent_kes: 25000, status: 'vacant' }
        ]
      });
    });

    test('TC-1.3.1: Pre-onboard Tenant', async () => {
      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .post('/api/v1/tenants')
        .send({
          full_name: 'Jane Doe',
          id_number: '12345678',
          phone: '254712345678',
          email: 'janedoe@mutune.test',
          current_property_id: property._id.toString(),
          current_unit_id: property.units[0]._id.toString(),
          rent_amount_kes: 20000,
          lease_start: new Date().toISOString(),
          lease_end: new Date(Date.now() + 31536000000).toISOString()
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tenant_code).toMatch(/^TNT-MOM-/);

      tenant = await Tenant.findOne({ id_number: '12345678' });
      expect(tenant).toBeDefined();
    });

    test('TC-1.3.2: Fetch Vacant Units', async () => {
      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .get('/api/v1/properties/units/vacant');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    test('TC-1.3.3: Link Tenant to User', async () => {
      // Create user to link
      const tenantUser = await User.create({
        clerk_id: 'clerk_tenant_001',
        email: 'janedoe@mutune.test',
        full_name: 'Jane Doe',
        phone: '254712345678',
        role: 'tenant',
        is_active: true,
        user_code: 'USR-TNT-001'
      });

      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .post(`/api/v1/tenants/${tenant._id}/link-user`)
        .send({ user_id: tenantUser._id.toString() });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedTenant = await Tenant.findById(tenant._id);
      expect(updatedTenant.user_id.toString()).toBe(tenantUser._id.toString());
      expect(updatedTenant.tenancy_status).toBe('active');

      const updatedProp = await Property.findById(property._id);
      const unit = updatedProp.units.id(property.units[0]._id);
      expect(unit.status).toBe('occupied');
    });

    test('TC-1.3.4: Tenant Payment History', async () => {
      mockClerkId = 'clerk_tenant_001';
      const res = await request(app)
        .get(`/api/v1/tenants/${tenant._id}/payment-history`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('TC-1.3.5: Terminate Tenancy', async () => {
      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .post(`/api/v1/tenants/${tenant._id}/terminate`)
        .send({ reason: 'Relocating to another town' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const terminatedTenant = await Tenant.findById(tenant._id);
      expect(terminatedTenant.tenancy_status).toBe('terminated');

      const updatedProp = await Property.findById(property._id);
      const unit = updatedProp.units.id(property.units[0]._id);
      expect(unit.status).toBe('vacant');
    });
  });

  // ==========================================
  // Feature 4: Rent Payments & Safaricom M-Pesa Integration
  // ==========================================
  describe('Feature 4: Rent Payments & Safaricom M-Pesa Integration', () => {
    let adminUser, landlordUser, property, tenantUser, tenantProfile, payment;

    beforeAll(async () => {
      await clearDatabase();
      adminUser = await User.create({
        clerk_id: 'clerk_admin_001',
        email: 'admin@mutune.test',
        full_name: 'Admin User',
        phone: '254700000001',
        role: 'super_admin',
        is_active: true,
        user_code: 'USR-ADM-001'
      });
      landlordUser = await User.create({
        clerk_id: 'clerk_landlord_active',
        email: 'landlord@mutune.test',
        full_name: 'Active Landlord',
        phone: '254711111111',
        role: 'landlord',
        is_active: true,
        user_code: 'USR-LLD-001'
      });
      property = await Property.create({
        name: 'Nyali Heights',
        property_code: 'PROP-MOM-001',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        landlord_id: landlordUser._id,
        status: 'active',
        units: [
          { unit_number: '1A', rent_kes: 20000, status: 'vacant', lock_status: 'unlocked' }
        ]
      });
      tenantUser = await User.create({
        clerk_id: 'clerk_tenant_001',
        email: 'janedoe@mutune.test',
        full_name: 'Jane Doe',
        phone: '254712345678',
        role: 'tenant',
        is_active: true,
        user_code: 'USR-TNT-001'
      });
      tenantProfile = await Tenant.create({
        tenant_code: 'TNT-MOM-0001',
        user_id: tenantUser._id,
        full_name: 'Jane Doe',
        id_number: '12345678',
        phone: '254712345678',
        email: 'janedoe@mutune.test',
        current_property_id: property._id,
        current_unit_id: property.units[0]._id,
        rent_amount_kes: 20000,
        lease_start: new Date(),
        lease_end: new Date()
      });
    });

    test('TC-1.4.1: Initiate STK Push', async () => {
      mockClerkId = 'clerk_tenant_001';
      const res = await request(app)
        .post('/api/v1/payments/initiate-stk')
        .send({
          tenant_id: tenantProfile._id.toString(),
          unit_id: property.units[0]._id.toString(),
          amount: 20000,
          payment_type: 'rent'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.checkout_request_id).toBe('ws_CO_MOCK123456');
      expect(res.body.status).toBe('pending');

      payment = await Payment.findOne({ tenant_id: tenantProfile._id });
      expect(payment).toBeDefined();
      expect(payment.status).toBe('pending');
    });

    test('TC-1.4.2: M-Pesa STK Callback SUCCESS', async () => {
      const callbackPayload = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'MRID_MOCK123',
            CheckoutRequestID: 'ws_CO_MOCK123456',
            ResultCode: 0,
            ResultDesc: 'The service request was processed successfully.',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 20000 },
                { Name: 'MpesaReceiptNumber', Value: 'NL12345678' },
                { Name: 'TransactionDate', Value: 20260619153000 },
                { Name: 'PhoneNumber', Value: 254712345678 }
              ]
            }
          }
        }
      };

      const res = await request(app)
        .post('/api/v1/payments/callback')
        .set('X-Forwarded-For', '196.201.214.1')
        .send(callbackPayload);

      expect(res.status).toBe(200);
      expect(res.body.ResultCode).toBe(0);

      // Yield event loop for async callback handler
      await sleep(500);

      const dbPayment = await Payment.findById(payment._id);
      expect(dbPayment.status).toBe('confirmed');
      expect(dbPayment.mpesa_receipt).toBe('NL12345678');
      expect(dbPayment.discrepancy_flag).toBe(false);

      const dbTenant = await Tenant.findById(tenantProfile._id);
      expect(dbTenant.payment_history.length).toBe(1);
    });

    test('TC-1.4.3: M-Pesa STK Callback FAILURE', async () => {
      // Create another pending payment
      const payment2 = await Payment.create({
        transaction_id: 'ws_CO_MOCK_FAIL',
        tenant_id: tenantProfile._id,
        property_id: property._id,
        unit_id: property.units[0]._id,
        amount_kes: 20000,
        payment_type: 'rent',
        channel: 'mpesa_stk',
        status: 'pending',
        workflow_state: 'PENDING_VIEWING'
      });

      const callbackPayload = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'MRID_FAIL',
            CheckoutRequestID: 'ws_CO_MOCK_FAIL',
            ResultCode: 1032,
            ResultDesc: 'Request cancelled by user.'
          }
        }
      };

      const res = await request(app)
        .post('/api/v1/payments/callback')
        .set('X-Forwarded-For', '196.201.214.1')
        .send(callbackPayload);

      expect(res.status).toBe(200);
      expect(res.body.ResultCode).toBe(0);

      await sleep(500);

      const dbPayment = await Payment.findById(payment2._id);
      expect(dbPayment.status).toBe('failed');
      expect(dbPayment.discrepancy_flag).toBe(true);
    });

    test('TC-1.4.4: M-Pesa C2B Callback (Unmatched)', async () => {
      const c2bPayload = {
        TransactionType: 'Pay Bill',
        TransID: 'C2B87654321',
        TransAmount: 25000,
        BusinessShortCode: '174379',
        BillRefNumber: 'REF-UNKNOWN',
        OrgAccountBalance: 500000,
        MSISDN: '254712345678',
        FirstName: 'Jane',
        LastName: 'Doe'
      };

      const res = await request(app)
        .post('/api/v1/payments/callback')
        .set('X-Forwarded-For', '196.201.214.1')
        .send(c2bPayload);

      expect(res.status).toBe(200);
      expect(res.body.ResultCode).toBe(0);

      await sleep(500);

      const unmatched = await Payment.findOne({ mpesa_receipt: 'C2B87654321' });
      expect(unmatched).toBeDefined();
      expect(unmatched.channel).toBe('mpesa_c2b');
      expect(unmatched.discrepancy_flag).toBe(true);
      expect(unmatched.status).toBe('confirmed');
    });

    test('TC-1.4.5: Admin Manual Override', async () => {
      // Create a failed/unmatched payment
      const paymentToOverride = await Payment.create({
        transaction_id: 'C2B-OVERRIDE-TEST',
        tenant_id: tenantProfile._id,
        property_id: property._id,
        unit_id: property.units[0]._id,
        amount_kes: 20000,
        payment_type: 'rent',
        channel: 'mpesa_c2b',
        status: 'pending',
        workflow_state: 'MANUAL_REVIEW',
        discrepancy_flag: true
      });

      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .post(`/api/v1/payments/${paymentToOverride._id}/override`)
        .send({ reason: 'Tenant verified bank payment statement.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const finalPayment = await Payment.findById(paymentToOverride._id);
      expect(finalPayment.status).toBe('confirmed');
      expect(finalPayment.verification_method).toBe('manual_override');
    });
  });

  // ==========================================
  // Feature 5: Notices & Delivery
  // ==========================================
  describe('Feature 5: Notices & Delivery', () => {
    let adminUser, landlordUser, property, tenantUser, tenantProfile, generatedNotice;

    beforeAll(async () => {
      await clearDatabase();
      adminUser = await User.create({
        clerk_id: 'clerk_admin_001',
        email: 'admin@mutune.test',
        full_name: 'Admin User',
        phone: '254700000001',
        role: 'super_admin',
        is_active: true,
        user_code: 'USR-ADM-001'
      });
      landlordUser = await User.create({
        clerk_id: 'clerk_landlord_active',
        email: 'landlord@mutune.test',
        full_name: 'Active Landlord',
        phone: '254711111111',
        role: 'landlord',
        is_active: true,
        user_code: 'USR-LLD-001'
      });
      property = await Property.create({
        name: 'Nyali Heights',
        property_code: 'PROP-MOM-001',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        landlord_id: landlordUser._id,
        status: 'active',
        units: [{ unit_number: '1A', rent_kes: 20000, status: 'occupied' }]
      });
      tenantUser = await User.create({
        clerk_id: 'clerk_tenant_001',
        email: 'janedoe@mutune.test',
        full_name: 'Jane Doe',
        phone: '254712345678',
        role: 'tenant',
        is_active: true,
        user_code: 'USR-TNT-001'
      });
      tenantProfile = await Tenant.create({
        tenant_code: 'TNT-MOM-0001',
        user_id: tenantUser._id,
        full_name: 'Jane Doe',
        id_number: '12345678',
        phone: '254712345678',
        email: 'janedoe@mutune.test',
        current_property_id: property._id,
        current_unit_id: property.units[0]._id,
        rent_amount_kes: 20000,
        lease_start: new Date(),
        lease_end: new Date()
      });
    });

    test('TC-1.5.1: Generate Notice', async () => {
      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .post('/api/v1/notices/generate')
        .send({
          notice_type: 'rent_increase',
          property_id: property._id.toString(),
          unit_id: property.units[0]._id.toString(),
          tenant_id: tenantProfile._id.toString(),
          title: 'Rent Adjustment Notice',
          body: 'Dear Tenant, please note rent will increase by KES 2,000 from next month.',
          effective_date: new Date(Date.now() + 30 * 86400000).toISOString(),
          delivery_method: ['portal']
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      generatedNotice = await Notice.findById(res.body.data._id);
      expect(generatedNotice).toBeDefined();
      expect(generatedNotice.title).toBe('Rent Adjustment Notice');
    });

    test('TC-1.5.2: PDF Generation', async () => {
      expect(generatedNotice.pdf_url).toBe('https://r2.cloudflare.com/mock-notice.pdf');
    });

    test('TC-1.5.3: Email Delivery Dispatch', async () => {
      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .post('/api/v1/notices/generate')
        .send({
          notice_type: 'general',
          property_id: property._id.toString(),
          unit_id: property.units[0]._id.toString(),
          tenant_id: tenantProfile._id.toString(),
          title: 'Building Cleaning Notice',
          body: 'We will be cleaning the hallways on Friday morning.',
          effective_date: new Date().toISOString(),
          delivery_method: ['email']
        });

      expect(res.status).toBe(201);
      const notice = await Notice.findById(res.body.data._id);
      const emailStatus = notice.delivery_status.find(d => d.method === 'email');
      expect(emailStatus.status).toBe('sent');
    });

    test('TC-1.5.4: Email Failure SMS Fallback', async () => {
      mockEmailSendError = { message: 'Failed to contact SMTP' };
      await Tenant.findByIdAndUpdate(tenantProfile._id, { $set: { preferred_channel: 'email' } });

      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .post('/api/v1/notices/generate')
        .send({
          notice_type: 'general',
          property_id: property._id.toString(),
          unit_id: property.units[0]._id.toString(),
          tenant_id: tenantProfile._id.toString(),
          title: 'Emergency Water Maintenance',
          body: 'Water will be shut down for repairs.',
          effective_date: new Date().toISOString(),
          delivery_method: ['email']
        });

      expect(res.status).toBe(201);

      mockEmailSendError = null;

      const notice = await Notice.findById(res.body.data._id);
      const emailStatus = notice.delivery_status.find(d => d.method === 'email');
      expect(emailStatus.status).toBe('failed');

      const smsStatus = notice.delivery_status.find(d => d.method === 'sms');
      expect(smsStatus).toBeDefined();
      expect(smsStatus.status).toBe('sent');
    });

    test('TC-1.5.5: Bulk Notices Endpoint (POST /api/v1/notices/bulk)', async () => {
      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .post('/api/v1/notices/bulk')
        .send({
          notice_type: 'general',
          property_id: property._id.toString(),
          title: 'Bulk Notice',
          body: 'This is an announcement to all units in the property.',
          effective_date: new Date().toISOString()
        });

      expect([200, 201]).toContain(res.status);
    });
  });

  // ==========================================
  // Feature 6: Agent Geo-Tracking & Performance
  // ==========================================
  describe('Feature 6: Agent Geo-Tracking & Performance', () => {
    let agentUser, adminUser, property;

    beforeAll(async () => {
      await clearDatabase();
      agentUser = await User.create({
        clerk_id: 'clerk_agent_001',
        email: 'agent@mutune.test',
        full_name: 'Agent Mutune',
        phone: '254722222222',
        role: 'agent',
        is_active: true,
        user_code: 'USR-AGT-001',
        assigned_property_ids: []
      });
      adminUser = await User.create({
        clerk_id: 'clerk_admin_001',
        email: 'admin@mutune.test',
        full_name: 'Admin User',
        phone: '254700000001',
        role: 'super_admin',
        is_active: true,
        user_code: 'USR-ADM-001'
      });
      property = await Property.create({
        name: 'Nyali Heights',
        property_code: 'PROP-MOM-001',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        landlord_id: adminUser._id,
        status: 'active',
        location: {
          type: 'Point',
          coordinates: [39.71, -4.04]
        },
        units: []
      });

      agentUser.assigned_property_ids = [property._id];
      await agentUser.save();
    });

    test('TC-1.6.1: Agent Check-in', async () => {
      mockClerkId = 'clerk_agent_001';
      const res = await request(app)
        .post('/api/v1/agents/checkin')
        .send({
          property_id: property._id.toString(),
          location: {
            coordinates: [39.71, -4.04],
            accuracy: 10
          },
          photo_url: 'https://r2.cloudflare.com/agent-checkin-selfie.jpg'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.verified).toBe(true);
    });

    test('TC-1.6.2: Fetch Agent Last Location', async () => {
      mockClerkId = 'clerk_agent_001';
      const res = await request(app)
        .get('/api/v1/agents/location');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.location.coordinates).toEqual([39.71, -4.04]);
    });

    test('TC-1.6.3: Fetch All Agent Locations', async () => {
      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .get('/api/v1/agents/all-locations');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].last_location.coordinates).toEqual([39.71, -4.04]);
    });

    test('TC-1.6.4: Fetch Agent Performance', async () => {
      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .get('/api/v1/admin/agent-performance');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('TC-1.6.5: Check-in User Location Update', async () => {
      const updatedAgent = await User.findById(agentUser._id);
      expect(updatedAgent.last_location).toBeDefined();
      expect(updatedAgent.last_location.coordinates).toEqual([39.71, -4.04]);
      expect(updatedAgent.last_checkin_photo).toBe('https://r2.cloudflare.com/agent-checkin-selfie.jpg');
    });
  });

  // ==========================================
  // Feature 7: Distress Inventory & Auction System
  // ==========================================
  describe('Feature 7: Distress Inventory & Auction System', () => {
    let adminUser, property, itemId;

    beforeAll(async () => {
      await clearDatabase();
      adminUser = await User.create({
        clerk_id: 'clerk_admin_001',
        email: 'admin@mutune.test',
        full_name: 'Admin User',
        phone: '254700000001',
        role: 'super_admin',
        is_active: true,
        user_code: 'USR-ADM-001'
      });
      property = await Property.create({
        name: 'Nyali Heights',
        property_code: 'PROP-MOM-001',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        landlord_id: adminUser._id,
        status: 'active',
        units: [],
        inventory: []
      });
    });

    test('TC-1.7.1: Add Inventory Item', async () => {
      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .post(`/api/v1/inventory/${property._id}/add-item`)
        .send({
          name: 'Executive Sofa Set',
          description: 'Brown leather 5-seater sofa',
          condition: 'good',
          estimated_value_kes: 35000
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Executive Sofa Set');

      const updatedProp = await Property.findById(property._id);
      expect(updatedProp.inventory.length).toBe(1);
      itemId = updatedProp.inventory[0]._id;
    });

    test('TC-1.7.2: Mark Item Auctionable', async () => {
      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .post(`/api/v1/inventory/${property._id}/mark-auctionable`)
        .send({
          item_id: itemId.toString(),
          reason: 'Rent default exceeds 60 days'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.auction_status).toBe('pending');
      expect(res.body.data.auctionable_marked_at).toBeDefined();
    });

    test('TC-1.7.3: Fetch Auctionable Items', async () => {
      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .get('/api/v1/inventory/auctionable');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].name).toBe('Executive Sofa Set');
    });

    test('TC-1.7.4: Record Auction Sale', async () => {
      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .post(`/api/v1/inventory/${property._id}/auction-sold`)
        .send({
          item_id: itemId.toString(),
          buyer: 'Kiptoo Auction Buyers',
          sale_amount: 32000
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.auction_status).toBe('sold');
      expect(res.body.data.auction_buyer).toBe('Kiptoo Auction Buyers');
      expect(res.body.data.auction_sale_amount).toBe(32000);
    });

    test('TC-1.7.5: Distress Reclaim Flow', async () => {
      const updatedProp = await Property.findById(property._id);
      updatedProp.inventory.push({
        name: 'Reclaimable TV Set',
        description: 'Sony 42 inch TV',
        condition: 'good',
        estimated_value_kes: 15000,
        auction_status: 'pending',
        auctionable_marked_at: new Date()
      });
      await updatedProp.save();

      const savedProp = await Property.findById(property._id);
      const reclaimItem = savedProp.inventory.find(i => i.name === 'Reclaimable TV Set');

      const reclaimReceiptId = new mongoose.Types.ObjectId();

      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .post(`/api/v1/inventory/${property._id}/reclaim`)
        .send({
          item_id: reclaimItem._id.toString(),
          reclaim_receipt_id: reclaimReceiptId.toString()
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.auction_status).toBe('reclaimed');
      expect(res.body.data.reclaim_receipt_id.toString()).toBe(reclaimReceiptId.toString());
    });
  });

  // ==========================================
  // Feature 8: Late Fee Rules
  // ==========================================
  describe('Feature 8: Late Fee Rules', () => {
    let adminUser, landlordUser, property, tenantUser, tenantProfile, lateFeeRule;

    beforeAll(async () => {
      await clearDatabase();
      adminUser = await User.create({
        clerk_id: 'clerk_admin_001',
        email: 'admin@mutune.test',
        full_name: 'Admin User',
        phone: '254700000001',
        role: 'super_admin',
        is_active: true,
        user_code: 'USR-ADM-001'
      });
      landlordUser = await User.create({
        clerk_id: 'clerk_landlord_active',
        email: 'landlord@mutune.test',
        full_name: 'Active Landlord',
        phone: '254711111111',
        role: 'landlord',
        is_active: true,
        user_code: 'USR-LLD-001'
      });
      property = await Property.create({
        name: 'Nyali Heights',
        property_code: 'PROP-MOM-001',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        landlord_id: landlordUser._id,
        status: 'active',
        units: [{ unit_number: '1A', rent_kes: 20000, status: 'occupied' }]
      });
      tenantUser = await User.create({
        clerk_id: 'clerk_tenant_001',
        email: 'janedoe@mutune.test',
        full_name: 'Jane Doe',
        phone: '254712345678',
        role: 'tenant',
        is_active: true,
        user_code: 'USR-TNT-001'
      });
      tenantProfile = await Tenant.create({
        tenant_code: 'TNT-MOM-0001',
        user_id: tenantUser._id,
        full_name: 'Jane Doe',
        id_number: '12345678',
        phone: '254712345678',
        email: 'janedoe@mutune.test',
        current_property_id: property._id,
        current_unit_id: property.units[0]._id,
        rent_amount_kes: 20000,
        lease_start: new Date(Date.now() - 60 * 86400000),
        lease_end: new Date(Date.now() + 31536000000),
        tenancy_status: 'active',
        arrears_kes: 0
      });
    });

    test('TC-1.8.1: Create Late Fee Rule', async () => {
      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .post('/api/v1/admin/late-fee-rules')
        .send({
          name: 'Residential Late Penalty',
          grace_days: 0,
          penalty_type: 'percentage',
          penalty_value: 5,
          max_penalty_per_month: 5000,
          applies_to: 'all',
          is_active: true
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      
      lateFeeRule = await LateFeeRule.findById(res.body.data._id);
      expect(lateFeeRule).toBeDefined();
    });

    test('TC-1.8.2: Update Late Fee Rule', async () => {
      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .patch(`/api/v1/admin/late-fee-rules/${lateFeeRule._id}`)
        .send({ grace_days: 0 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.grace_days).toBe(0);
    });

    test('TC-1.8.3: Execute Late Fee Cron', async () => {
      const lateFeeApplicator = require('../cron/late-fee-applicator');
      await Payment.deleteMany({});
      
      await lateFeeApplicator.run();

      const updatedTenant = await Tenant.findById(tenantProfile._id);
      expect(updatedTenant.arrears_kes).toBe(1000);

      const penaltyPayment = await Payment.findOne({
        tenant_id: tenantProfile._id,
        payment_type: 'penalty'
      });
      expect(penaltyPayment).toBeDefined();
      expect(penaltyPayment.amount_kes).toBe(1000);
      expect(penaltyPayment.status).toBe('confirmed');
    });

    test('TC-1.8.4: Late Fee Applicator Idempotency', async () => {
      const lateFeeApplicator = require('../cron/late-fee-applicator');
      await lateFeeApplicator.run();

      const updatedTenant = await Tenant.findById(tenantProfile._id);
      expect(updatedTenant.arrears_kes).toBe(1000);

      const penaltyPayments = await Payment.find({
        tenant_id: tenantProfile._id,
        payment_type: 'penalty'
      });
      expect(penaltyPayments.length).toBe(1);
    });

    test('TC-1.8.5: Delete Late Fee Rule', async () => {
      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .delete(`/api/v1/admin/late-fee-rules/${lateFeeRule._id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbRule = await LateFeeRule.findById(lateFeeRule._id);
      expect(dbRule).toBeNull();
    });
  });

  // ==========================================
  // Feature 9: Maintenance Ticket Workflow
  // ==========================================
  describe('Feature 9: Maintenance Ticket Workflow', () => {
    let adminUser, agentUser, tenantUser, tenantProfile, property, ticket;

    beforeAll(async () => {
      await clearDatabase();
      adminUser = await User.create({
        clerk_id: 'clerk_admin_001',
        email: 'admin@mutune.test',
        full_name: 'Admin User',
        phone: '254700000001',
        role: 'super_admin',
        is_active: true,
        user_code: 'USR-ADM-001'
      });
      agentUser = await User.create({
        clerk_id: 'clerk_agent_001',
        email: 'agent@mutune.test',
        full_name: 'Agent Mutune',
        phone: '254722222222',
        role: 'agent',
        is_active: true,
        user_code: 'USR-AGT-001',
        assigned_property_ids: []
      });
      tenantUser = await User.create({
        clerk_id: 'clerk_tenant_001',
        email: 'janedoe@mutune.test',
        full_name: 'Jane Doe',
        phone: '254712345678',
        role: 'tenant',
        is_active: true,
        user_code: 'USR-TNT-001'
      });
      property = await Property.create({
        name: 'Nyali Heights',
        property_code: 'PROP-MOM-001',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        landlord_id: adminUser._id,
        status: 'active',
        units: [{ unit_number: '1A', rent_kes: 20000, status: 'occupied' }]
      });
      tenantProfile = await Tenant.create({
        tenant_code: 'TNT-MOM-0001',
        user_id: tenantUser._id,
        full_name: 'Jane Doe',
        id_number: '12345678',
        phone: '254712345678',
        email: 'janedoe@mutune.test',
        current_property_id: property._id,
        current_unit_id: property.units[0]._id,
        rent_amount_kes: 20000,
        lease_start: new Date(),
        lease_end: new Date()
      });

      agentUser.assigned_property_ids = [property._id];
      await agentUser.save();
    });

    test('TC-1.9.1: Tenant File Maintenance', async () => {
      mockClerkId = 'clerk_tenant_001';
      const res = await request(app)
        .post('/api/v1/maintenance')
        .send({
          property_id: property._id.toString(),
          unit_id: property.units[0]._id.toString(),
          category: 'plumbing',
          priority: 'medium',
          description: 'Sink leaking under bathroom cabinet.'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('open');

      ticket = await MaintenanceTicket.findById(res.body.data._id);
      expect(ticket).toBeDefined();
    });

    test('TC-1.9.2: Assign Maintenance Ticket', async () => {
      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .patch(`/api/v1/maintenance/${ticket._id}`)
        .send({
          assigned_agent_id: agentUser._id.toString(),
          status: 'assigned'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('assigned');
      expect(res.body.data.assigned_agent_id.toString()).toBe(agentUser._id.toString());
    });

    test('TC-1.9.3: Agent Update Maintenance Status', async () => {
      mockClerkId = 'clerk_agent_001';
      const res = await request(app)
        .patch(`/api/v1/maintenance/${ticket._id}`)
        .send({
          status: 'in_progress',
          agent_notes: 'Inspected leak, purchasing replacement gasket.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('in_progress');
      expect(res.body.data.agent_notes).toBe('Inspected leak, purchasing replacement gasket.');
    });

    test('TC-1.9.4: Resolve Maintenance Ticket', async () => {
      mockClerkId = 'clerk_agent_001';
      const res = await request(app)
        .patch(`/api/v1/maintenance/${ticket._id}`)
        .send({
          status: 'resolved',
          agent_notes: 'Replaced gasket, sink is fully sealed.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('resolved');
      expect(res.body.data.resolved_at).toBeDefined();
    });

    test('TC-1.9.5: Tenant Cancel Open Ticket', async () => {
      const ticketToCancel = await MaintenanceTicket.create({
        ticket_code: 'MT-CANCEL-TEST',
        property_id: property._id,
        unit_id: property.units[0]._id,
        tenant_id: tenantProfile._id,
        created_by: tenantUser._id,
        category: 'electrical',
        priority: 'low',
        description: 'Light bulb flickering.',
        status: 'open'
      });

      mockClerkId = 'clerk_tenant_001';
      const res = await request(app)
        .delete(`/api/v1/maintenance/${ticketToCancel._id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbTicket = await MaintenanceTicket.findById(ticketToCancel._id);
      expect(dbTicket).toBeNull();
    });
  });

});
