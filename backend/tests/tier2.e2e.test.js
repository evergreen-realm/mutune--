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
    if (!mockClerkId) {
      return next(new Error('Authentication required'));
    }
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
  generateNoticePDF: jest.fn().mockResolvedValue('https://r2.cloudflare.com/mock-notice.pdf'),
  generateLandlordContractPDF: jest.fn().mockResolvedValue('https://r2.cloudflare.com/mock-contract.pdf')
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

describe('Tier 2 Boundary & Corner Cases Tests', () => {
  
  beforeAll(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
  });

  // =========================================================================
  // Feature 1: User Auth & Onboarding Edge cases
  // =========================================================================
  describe('Feature 1: User Auth & Onboarding Edge cases', () => {
    let adminUser;

    beforeEach(async () => {
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
    });

    test('TC-2.1.1: Duplicate Registration', async () => {
      mockClerkId = 'clerk_admin_001';
      // Attempt to register a user with email that already exists
      const res = await request(app)
        .post('/api/v1/users')
        .send({
          full_name: 'Duplicate Admin',
          email: 'admin@mutune.test',
          phone: '254700000002',
          role: 'admin',
          clerk_id: 'clerk_admin_002'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    test('TC-2.1.2: Invalid Tenant Code Onboarding', async () => {
      const tenantUser = await User.create({
        clerk_id: 'clerk_tenant_001',
        email: 'tenant@mutune.test',
        full_name: 'Tenant User',
        phone: '254712345678',
        role: 'tenant',
        is_active: true,
        user_code: 'USR-TNT-001'
      });

      mockClerkId = 'clerk_tenant_001';
      const res = await request(app)
        .patch('/api/v1/users/me/role')
        .send({
          role: 'tenant',
          tenant_code: 'TNT-FAKE-9999',
          phone: '254712345678'
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    test('TC-2.1.3: Already Claimed Tenant Code', async () => {
      // Create user A who already claimed the code
      const userA = await User.create({
        clerk_id: 'clerk_tenant_001',
        email: 'tenantA@mutune.test',
        full_name: 'Tenant A',
        phone: '254712345678',
        role: 'tenant',
        is_active: true
      });

      const tenant = await Tenant.create({
        tenant_code: 'TNT-MOM-0002',
        full_name: 'Tenant A',
        id_number: '12345678',
        phone: '254712345678',
        email: 'tenantA@mutune.test',
        rent_amount_kes: 15000,
        user_id: userA._id,
        tenancy_status: 'active'
      });

      // Create user B trying to hijack the code
      await User.create({
        clerk_id: 'clerk_tenant_002',
        email: 'tenantB@mutune.test',
        full_name: 'Tenant B',
        phone: '254712345679',
        role: 'tenant',
        is_active: true
      });

      mockClerkId = 'clerk_tenant_002';
      const res = await request(app)
        .patch('/api/v1/users/me/role')
        .send({
          role: 'tenant',
          tenant_code: 'TNT-MOM-0002',
          phone: '254712345679'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    test('TC-2.1.4: Unauthorized Role Elevation', async () => {
      const normalUser = await User.create({
        clerk_id: 'clerk_tenant_001',
        email: 'tenant@mutune.test',
        full_name: 'Tenant User',
        phone: '254712345678',
        role: 'tenant',
        is_active: true
      });

      mockClerkId = 'clerk_tenant_001';
      // Attempt to elevate self to super_admin
      const res = await request(app)
        .patch(`/api/v1/users/${normalUser._id}`)
        .send({
          role: 'super_admin'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test('TC-2.1.5: Deactivating Own Account', async () => {
      mockClerkId = 'clerk_admin_001';
      // Attempt to deactivate own admin account
      const res = await request(app)
        .post(`/api/v1/users/${adminUser._id}/deactivate`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SELF_DEACTIVATE');
    });
  });

  // =========================================================================
  // Feature 2: Property & Unit Lifecycle boundaries
  // =========================================================================
  describe('Feature 2: Property & Unit Lifecycle boundaries', () => {
    let adminUser, landlordUser, property;

    beforeEach(async () => {
      await clearDatabase();
      adminUser = await User.create({
        clerk_id: 'clerk_admin_001',
        email: 'admin@mutune.test',
        full_name: 'Admin User',
        phone: '254700000001',
        role: 'super_admin',
        is_active: true
      });
      landlordUser = await User.create({
        clerk_id: 'clerk_landlord_active',
        email: 'landlord@mutune.test',
        full_name: 'Active Landlord',
        phone: '254711111111',
        role: 'landlord',
        is_active: true
      });
      property = await Property.create({
        name: 'Nyali Breezes',
        property_code: 'PROP-MOM-999',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        landlord_id: landlordUser._id,
        status: 'pending_admin_approval',
        units: [
          { unit_number: '1A', rent_kes: 20000, status: 'vacant' }
        ]
      });
    });

    test('TC-2.2.1: Property Create Without Auth', async () => {
      mockClerkId = null; // simulate unauthenticated
      const res = await request(app)
        .post('/api/v1/properties')
        .send({
          name: 'Anonymous Property',
          type: 'apartment',
          address: { area: 'Nyali', city: 'Mombasa' }
        });

      expect(res.status).toBe(401);
    });

    test('TC-2.2.2: Landlord Scope Violation', async () => {
      mockClerkId = 'clerk_landlord_active';
      // Landlord attempts to approve property
      const res = await request(app)
        .post(`/api/v1/properties/${property._id}/approve`);

      expect(res.status).toBe(403);
    });

    test('TC-2.2.3: Delete Occupied Unit', async () => {
      // Mark unit as occupied in property
      property.units[0].status = 'occupied';
      await property.save();

      // Create an active tenant in the unit
      await Tenant.create({
        tenant_code: 'TNT-MOM-0003',
        full_name: 'Active Tenant',
        id_number: '87654321',
        phone: '254722222222',
        email: 'activetenant@mutune.test',
        current_property_id: property._id,
        current_unit_id: property.units[0]._id,
        rent_amount_kes: 20000,
        tenancy_status: 'active'
      });

      mockClerkId = 'clerk_admin_001';
      // Attempt to delete unit
      const res = await request(app)
        .delete(`/api/v1/properties/${property._id}/units/${property.units[0]._id}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ACTIVE_TENANT');
    });

    test('TC-2.2.4: Agent Propose Non-existent Tier', async () => {
      const nonExistentPropertyId = new mongoose.Types.ObjectId();
      mockClerkId = 'clerk_admin_001';
      // Propose tier on non-existent property
      const res = await request(app)
        .patch(`/api/v1/properties/${nonExistentPropertyId}/agent-review`)
        .send({
          proposed_tier_id: new mongoose.Types.ObjectId().toString()
        });

      expect(res.status).toBe(404);
    });

    test('TC-2.2.5: Invalid Geolocation Coordinates', async () => {
      mockClerkId = 'clerk_admin_001';
      // Out of bounds coordinates: longitude = 190, latitude = 95
      const res = await request(app)
        .patch(`/api/v1/properties/${property._id}/units/${property.units[0]._id}/geolocation`)
        .send({
          coordinates: [190, 95]
        });

      expect([400, 500]).toContain(res.status);
    });
  });

  // =========================================================================
  // Feature 3: Tenant Profile & Lease edge cases
  // =========================================================================
  describe('Feature 3: Tenant Profile & Lease edge cases', () => {
    let adminUser, landlordUser, property, tenant;

    beforeEach(async () => {
      await clearDatabase();
      adminUser = await User.create({
        clerk_id: 'clerk_admin_001',
        email: 'admin@mutune.test',
        full_name: 'Admin User',
        phone: '254700000001',
        role: 'super_admin',
        is_active: true
      });
      landlordUser = await User.create({
        clerk_id: 'clerk_landlord_active',
        email: 'landlord@mutune.test',
        full_name: 'Active Landlord',
        phone: '254711111111',
        role: 'landlord',
        is_active: true
      });
      property = await Property.create({
        name: 'Nyali Heights',
        property_code: 'PROP-MOM-101',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        landlord_id: landlordUser._id,
        status: 'active',
        units: [
          { unit_number: '1A', rent_kes: 20000, status: 'occupied' }
        ]
      });
      tenant = await Tenant.create({
        tenant_code: 'TNT-MOM-1001',
        full_name: 'Occupied Tenant',
        id_number: '99999999',
        phone: '254711222333',
        email: 'occupied@mutune.test',
        current_property_id: property._id,
        current_unit_id: property.units[0]._id,
        rent_amount_kes: 20000,
        tenancy_status: 'active'
      });
    });

    test('TC-2.3.1: Double Assign Occupied Unit', async () => {
      // Create user trying to onboard to unit 1A (which is occupied)
      await User.create({
        clerk_id: 'clerk_new_tenant',
        email: 'newtenant@mutune.test',
        full_name: 'New Tenant',
        phone: '254700000999',
        role: 'tenant',
        is_active: true
      });

      mockClerkId = 'clerk_new_tenant';
      const res = await request(app)
        .patch('/api/v1/users/me/role')
        .send({
          role: 'tenant',
          property_id: property._id.toString(),
          unit_id: property.units[0]._id.toString(),
          phone: '254700000999'
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('UNIT_OCCUPIED');
    });

    test('TC-2.3.2: Check Non-existent Tenant Email', async () => {
      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .get('/api/v1/users/check-tenant-email/nonexistent@mutune.test');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.exists).toBe(false);
    });

    test('TC-2.3.3: Emergency Contact Data Leakage', async () => {
      // Authenticate as a different tenant
      await User.create({
        clerk_id: 'clerk_tenant_other',
        email: 'other@mutune.test',
        full_name: 'Other Tenant',
        phone: '254700000888',
        role: 'tenant',
        is_active: true
      });

      mockClerkId = 'clerk_tenant_other';
      // Attempt to view Tenant profile details
      const res = await request(app)
        .get(`/api/v1/tenants/${tenant._id}`);

      expect(res.status).toBe(403);
    });

    test('TC-2.3.4: Invalid Lease Dates', async () => {
      mockClerkId = 'clerk_admin_001';
      // lease_end (yesterday) is earlier than lease_start (today)
      const start = new Date();
      const end = new Date(Date.now() - 86400000);

      const res = await request(app)
        .post('/api/v1/tenants')
        .send({
          full_name: 'Jane Smith',
          id_number: '11223344',
          phone: '254711223344',
          email: 'janesmith@mutune.test',
          current_property_id: property._id.toString(),
          current_unit_id: property.units[0]._id.toString(),
          rent_amount_kes: 20000,
          lease_start: start.toISOString(),
          lease_end: end.toISOString()
        });

      expect(res.status).toBe(400);
    });

    test('TC-2.3.5: Double Terminate Tenancy', async () => {
      mockClerkId = 'clerk_admin_001';
      // First termination
      await request(app)
        .post(`/api/v1/tenants/${tenant._id}/terminate`)
        .send({ reason: 'Relocating', vacate_date: new Date().toISOString() });

      // Second termination attempt
      const res = await request(app)
        .post(`/api/v1/tenants/${tenant._id}/terminate`)
        .send({ reason: 'Duplicate call', vacate_date: new Date().toISOString() });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ALREADY_TERMINATED');
    });
  });

  // =========================================================================
  // Feature 4: Rent Payments & M-Pesa Callback edge cases
  // =========================================================================
  describe('Feature 4: Rent Payments & M-Pesa Callback edge cases', () => {
    let adminUser, landlordUser, property, tenantUser, tenantProfile, payment;

    beforeEach(async () => {
      await clearDatabase();
      adminUser = await User.create({
        clerk_id: 'clerk_admin_001',
        email: 'admin@mutune.test',
        full_name: 'Admin User',
        phone: '254700000001',
        role: 'super_admin',
        is_active: true
      });
      landlordUser = await User.create({
        clerk_id: 'clerk_landlord_active',
        email: 'landlord@mutune.test',
        full_name: 'Active Landlord',
        phone: '254711111111',
        role: 'landlord',
        is_active: true
      });
      property = await Property.create({
        name: 'Nyali Heights',
        property_code: 'PROP-MOM-001',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        landlord_id: landlordUser._id,
        status: 'active',
        units: [
          { unit_number: '1A', rent_kes: 20000, status: 'occupied' }
        ]
      });
      tenantUser = await User.create({
        clerk_id: 'clerk_tenant_001',
        email: 'janedoe@mutune.test',
        full_name: 'Jane Doe',
        phone: '254712345678',
        role: 'tenant',
        is_active: true
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
      payment = await Payment.create({
        transaction_id: 'ws_CO_MOCK_DISCREP',
        tenant_id: tenantProfile._id,
        property_id: property._id,
        unit_id: property.units[0]._id,
        amount_kes: 20000,
        payment_type: 'rent',
        channel: 'mpesa_stk',
        status: 'pending',
        workflow_state: 'PENDING_VIEWING'
      });
    });

    test('TC-2.4.1: Callback IP Block', async () => {
      // Trigger callback from wrong IP
      const res = await request(app)
        .post('/api/v1/payments/callback')
        .set('X-Forwarded-For', '8.8.8.8')
        .send({
          Body: {
            stkCallback: {
              CheckoutRequestID: 'ws_CO_MOCK_DISCREP',
              ResultCode: 0
            }
          }
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('IP_BLOCKED');
    });

    test('TC-2.4.2: Payment Amount Discrepancy', async () => {
      const callbackPayload = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'MRID_MOCK123',
            CheckoutRequestID: 'ws_CO_MOCK_DISCREP',
            ResultCode: 0,
            ResultDesc: 'Success',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 10000 }, // paid KES 10,000 instead of 20,000
                { Name: 'MpesaReceiptNumber', Value: 'NL12345679' }
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

      await sleep(100);

      const dbPayment = await Payment.findById(payment._id);
      expect(dbPayment.discrepancy_flag).toBe(true);
      expect(dbPayment.workflow_state).toBe('MANUAL_REVIEW');
    });

    test('TC-2.4.3: Override payment > 100,000', async () => {
      // Create agent user
      await User.create({
        clerk_id: 'clerk_agent_001',
        email: 'agent@mutune.test',
        full_name: 'Agent Mutune',
        phone: '254722222222',
        role: 'agent',
        is_active: true
      });

      const largePayment = await Payment.create({
        transaction_id: 'ws_CO_LARGE',
        tenant_id: tenantProfile._id,
        property_id: property._id,
        unit_id: property.units[0]._id,
        amount_kes: 150000,
        payment_type: 'rent',
        channel: 'mpesa_stk',
        status: 'pending',
        workflow_state: 'MANUAL_REVIEW',
        discrepancy_flag: true
      });

      mockClerkId = 'clerk_agent_001';
      const res = await request(app)
        .post(`/api/v1/payments/${largePayment._id}/override`)
        .send({ reason: 'override large payment' });

      // Non-admins cannot override payments at all (route gated by requireRole(['admin', 'super_admin']))
      expect(res.status).toBe(403);
    });

    test('TC-2.4.4: Auto-Initiate with No Balance', async () => {
      // Create a tenant with 0 rent amount and 0 arrears
      await User.create({
        clerk_id: 'clerk_tenant_free',
        email: 'free@mutune.test',
        full_name: 'Free Tenant',
        phone: '254711000000',
        role: 'tenant',
        is_active: true
      });

      const freeTenant = await Tenant.create({
        tenant_code: 'TNT-MOM-FREE',
        user_id: (await User.findOne({ clerk_id: 'clerk_tenant_free' }))._id,
        full_name: 'Free Tenant',
        id_number: '88888888',
        phone: '254711000000',
        email: 'free@mutune.test',
        current_property_id: property._id,
        current_unit_id: property.units[0]._id,
        rent_amount_kes: 0,
        arrears_kes: 0
      });

      mockClerkId = 'clerk_tenant_free';
      const res = await request(app)
        .post('/api/v1/payments/auto-initiate');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('NO_OUTSTANDING_BALANCE');
    });

    test('TC-2.4.5: Duplicate Callback Receipt', async () => {
      const c2bPayload = {
        TransactionType: 'Pay Bill',
        TransID: 'C2B_DUP_TEST_123',
        TransAmount: 20000,
        BusinessShortCode: '174379',
        MSISDN: '254712345678'
      };

      // First C2B callback
      const res1 = await request(app)
        .post('/api/v1/payments/callback')
        .set('X-Forwarded-For', '196.201.214.1')
        .send(c2bPayload);

      expect(res1.status).toBe(200);
      await sleep(100);

      // Second identical callback
      const res2 = await request(app)
        .post('/api/v1/payments/callback')
        .set('X-Forwarded-For', '196.201.214.1')
        .send(c2bPayload);

      expect(res2.status).toBe(200);
      await sleep(100);

      // Confirm only one payment is logged for this receipt ID
      const payments = await Payment.find({ mpesa_receipt: 'C2B_DUP_TEST_123' });
      expect(payments.length).toBe(1);
    });
  });

  // =========================================================================
  // Feature 5: Notices & Delivery boundaries
  // =========================================================================
  describe('Feature 5: Notices & Delivery boundaries', () => {
    let adminUser, landlordUser, property, tenantUser, tenantProfile, notice;

    beforeEach(async () => {
      await clearDatabase();
      adminUser = await User.create({
        clerk_id: 'clerk_admin_001',
        email: 'admin@mutune.test',
        full_name: 'Admin User',
        phone: '254700000001',
        role: 'super_admin',
        is_active: true
      });
      landlordUser = await User.create({
        clerk_id: 'clerk_landlord_active',
        email: 'landlord@mutune.test',
        full_name: 'Active Landlord',
        phone: '254711111111',
        role: 'landlord',
        is_active: true
      });
      property = await Property.create({
        name: 'Nyali Heights',
        property_code: 'PROP-MOM-001',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        landlord_id: landlordUser._id,
        status: 'active',
        units: [
          { unit_number: '1A', rent_kes: 20000, status: 'occupied' }
        ]
      });
      tenantUser = await User.create({
        clerk_id: 'clerk_tenant_001',
        email: 'janedoe@mutune.test',
        full_name: 'Jane Doe',
        phone: '254712345678',
        role: 'tenant',
        is_active: true
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
      notice = await Notice.create({
        notice_type: 'rent_increase',
        property_id: property._id,
        unit_id: property.units[0]._id,
        tenant_id: tenantProfile._id,
        issued_by: adminUser._id,
        title: 'Rent Adjustment',
        body: 'Rent will go up.',
        effective_date: new Date(),
        delivery_method: ['portal'],
        pdf_url: 'https://r2.cloudflare.com/mock-notice.pdf'
      });
    });

    test('TC-2.5.1: Invalid Delivery Method', async () => {
      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .post('/api/v1/notices/generate')
        .send({
          notice_type: 'general',
          property_id: property._id.toString(),
          unit_id: property.units[0]._id.toString(),
          tenant_id: tenantProfile._id.toString(),
          title: 'Title',
          body: 'Body text',
          effective_date: new Date().toISOString(),
          delivery_method: ['whatsapp'] // unsupported delivery method
        });

      expect(res.status).toBe(400);
    });

    test('TC-2.5.2: Cross-Tenant PDF Download', async () => {
      // Authenticate as a different tenant
      await User.create({
        clerk_id: 'clerk_tenant_other',
        email: 'other@mutune.test',
        full_name: 'Other Tenant',
        phone: '254700000888',
        role: 'tenant',
        is_active: true
      });

      mockClerkId = 'clerk_tenant_other';
      const res = await request(app)
        .get(`/api/v1/notices/${notice._id}/download`);

      expect(res.status).toBe(403);
    });

    test('TC-2.5.3: Role-scoped notices list', async () => {
      // Create another tenant & notice
      const tenantUser2 = await User.create({
        clerk_id: 'clerk_tenant_002',
        email: 'tenant2@mutune.test',
        full_name: 'Tenant 2',
        phone: '254712345679',
        role: 'tenant',
        is_active: true
      });
      const tenantProfile2 = await Tenant.create({
        tenant_code: 'TNT-MOM-0002',
        user_id: tenantUser2._id,
        full_name: 'Tenant 2',
        id_number: '12345679',
        phone: '254712345679',
        email: 'tenant2@mutune.test',
        current_property_id: property._id,
        current_unit_id: property.units[0]._id,
        rent_amount_kes: 20000
      });
      const notice2 = await Notice.create({
        notice_type: 'general',
        property_id: property._id,
        unit_id: property.units[0]._id,
        tenant_id: tenantProfile2._id,
        issued_by: adminUser._id,
        title: 'Notice for Tenant 2',
        body: 'Hello Tenant 2',
        effective_date: new Date(),
        delivery_method: ['portal']
      });

      mockClerkId = 'clerk_tenant_001';
      const res = await request(app)
        .get('/api/v1/notices');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      
      const returnedIds = res.body.data.map(n => n._id.toString());
      expect(returnedIds).toContain(notice._id.toString());
      expect(returnedIds).not.toContain(notice2._id.toString());
    });

    test('TC-2.5.4: Notice PDF Generation Fail Fallback', async () => {
      // Force mock PDF service error
      const pdfService = require('../services/pdf');
      pdfService.generateNoticePDF.mockRejectedValueOnce(new Error('R2 Upload Failed'));

      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .post('/api/v1/notices/generate')
        .send({
          notice_type: 'general',
          property_id: property._id.toString(),
          unit_id: property.units[0]._id.toString(),
          tenant_id: tenantProfile._id.toString(),
          title: 'Notice with PDF fail',
          body: 'Content still sent',
          effective_date: new Date().toISOString(),
          delivery_method: ['portal']
        });

      // Still returns 201 Created and creates the notice
      expect(res.status).toBe(201);
      const dbNotice = await Notice.findById(res.body.data._id);
      expect(dbNotice).toBeDefined();
      expect(dbNotice.pdf_url).toBeUndefined(); // no PDF saved due to failure
    });

    test('TC-2.5.5: Bulk notices validation', async () => {
      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .post('/api/v1/notices/bulk')
        .send({
          notice_type: 'general',
          property_id: property._id.toString(),
          title: '', // empty title
          body: '',  // empty body
          effective_date: new Date().toISOString()
        });

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // Feature 6: Agent Geo-Tracking boundary cases
  // =========================================================================
  describe('Feature 6: Agent Geo-Tracking boundary cases', () => {
    let agentUser, property;

    beforeEach(async () => {
      await clearDatabase();
      agentUser = await User.create({
        clerk_id: 'clerk_agent_001',
        email: 'agent@mutune.test',
        full_name: 'Agent Mutune',
        phone: '254722222222',
        role: 'agent',
        is_active: true,
        assigned_areas: ['Nyali']
      });
      property = await Property.create({
        name: 'Nyali Heights',
        property_code: 'PROP-MOM-001',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        status: 'active',
        location: {
          type: 'Point',
          coordinates: [39.7100, -4.0400]
        }
      });
    });

    test('TC-2.6.1: Check-in Outside Assigned Area', async () => {
      mockClerkId = 'clerk_agent_001';
      // Geolocation Coordinates far from Nyali Heights (coordinates 39.71, -4.04)
      const res = await request(app)
        .post('/api/v1/agents/checkin')
        .send({
          property_id: property._id.toString(),
          location: {
            coordinates: [39.5000, -4.2000], // far away
            accuracy: 10
          },
          photo_url: 'https://r2.cloudflare.com/agent-checkin-selfie.jpg'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.location_warning).toBeDefined();
    });

    test('TC-2.6.2: Check-in Low Accuracy GPS', async () => {
      mockClerkId = 'clerk_agent_001';
      const res = await request(app)
        .post('/api/v1/agents/checkin')
        .send({
          property_id: property._id.toString(),
          location: {
            coordinates: [39.7100, -4.0400],
            accuracy: 1500 // accuracy > 1000m fails validation
          },
          photo_url: 'https://r2.cloudflare.com/agent-checkin-selfie.jpg'
        });

      expect(res.status).toBe(400);
    });

    test('TC-2.6.3: Non-Agent Role Check-in', async () => {
      // Non-agent tries to check-in
      await User.create({
        clerk_id: 'clerk_tenant_001',
        email: 'tenant@mutune.test',
        full_name: 'Tenant User',
        phone: '254712345678',
        role: 'tenant',
        is_active: true
      });

      mockClerkId = 'clerk_tenant_001';
      const res = await request(app)
        .post('/api/v1/agents/checkin')
        .send({
          property_id: property._id.toString(),
          location: { coordinates: [39.7100, -4.0400], accuracy: 10 },
          photo_url: 'https://r2.cloudflare.com/agent-checkin-selfie.jpg'
        });

      expect(res.status).toBe(403);
    });

    test('TC-2.6.4: Check-in Photo Missing', async () => {
      mockClerkId = 'clerk_agent_001';
      const res = await request(app)
        .post('/api/v1/agents/checkin')
        .send({
          property_id: property._id.toString(),
          location: {
            coordinates: [39.7100, -4.0400],
            accuracy: 10
          }
          // Missing photo_url
        });

      expect(res.status).toBe(400);
    });

    test('TC-2.6.5: Scope Property List by Area', async () => {
      // Create Mombasa CBD Property
      const cbdProp = await Property.create({
        name: 'Mombasa Plaza',
        property_code: 'PROP-CBD-002',
        type: 'commercial',
        address: { area: 'Mombasa-CBD', city: 'Mombasa' },
        status: 'active'
      });

      // Scope agent only to Mombasa-CBD
      agentUser.assigned_areas = ['Mombasa-CBD'];
      await agentUser.save();

      mockClerkId = 'clerk_agent_001';
      const res = await request(app)
        .get('/api/v1/properties');

      expect(res.status).toBe(200);
      const propertyNames = res.body.data.map(p => p.name);
      expect(propertyNames).toContain('Mombasa Plaza');
      expect(propertyNames).not.toContain('Nyali Heights');
    });
  });

  // =========================================================================
  // Feature 7: Distress Inventory & Auction gating
  // =========================================================================
  describe('Feature 7: Distress Inventory & Auction gating', () => {
    let adminUser, agentUser, property, tenantProfile, paymentOk, paymentPending, item;

    beforeEach(async () => {
      await clearDatabase();
      adminUser = await User.create({
        clerk_id: 'clerk_admin_001',
        email: 'admin@mutune.test',
        full_name: 'Admin User',
        phone: '254700000001',
        role: 'super_admin',
        is_active: true
      });
      agentUser = await User.create({
        clerk_id: 'clerk_agent_001',
        email: 'agent@mutune.test',
        full_name: 'Agent Mutune',
        phone: '254722222222',
        role: 'agent',
        is_active: true
      });
      property = await Property.create({
        name: 'Nyali Heights',
        property_code: 'PROP-MOM-001',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        status: 'active',
        units: [
          { unit_number: '1A', rent_kes: 20000, status: 'occupied' }
        ],
        inventory: [
          {
            name: 'Leather Sofa Set',
            description: 'Executive 5 seater sofa',
            condition: 'good',
            auction_status: 'pending',
            auctionable_marked_at: new Date()
          }
        ]
      });

      // Link unit tenant
      tenantProfile = await Tenant.create({
        tenant_code: 'TNT-MOM-0001',
        full_name: 'Jane Doe',
        id_number: '12345678',
        phone: '254712345678',
        email: 'janedoe@mutune.test',
        current_property_id: property._id,
        current_unit_id: property.units[0]._id,
        rent_amount_kes: 20000
      });

      property.units[0].current_tenant_id = tenantProfile._id;
      property.inventory[0].unit_id = property.units[0]._id;
      await property.save();

      item = property.inventory[0];

      paymentOk = await Payment.create({
        transaction_id: 'ws_CO_MCONF',
        tenant_id: tenantProfile._id,
        property_id: property._id,
        unit_id: property.units[0]._id,
        amount_kes: 20000,
        payment_type: 'rent',
        channel: 'mpesa_stk',
        status: 'confirmed'
      });

      paymentPending = await Payment.create({
        transaction_id: 'ws_CO_MPEND',
        tenant_id: tenantProfile._id,
        property_id: property._id,
        unit_id: property.units[0]._id,
        amount_kes: 20000,
        payment_type: 'rent',
        channel: 'mpesa_stk',
        status: 'pending'
      });
    });

    test('TC-2.7.1: Non-Admin Mark Auctionable', async () => {
      mockClerkId = 'clerk_agent_001';
      // Agent attempts to mark item auctionable
      const res = await request(app)
        .post(`/api/v1/inventory/${property._id}/mark-auctionable`)
        .send({
          item_id: item._id.toString(),
          reason: 'Rent default'
        });

      expect(res.status).toBe(403);
    });

    test('TC-2.7.2: Reclaim with Wrong Tenant Receipt', async () => {
      // Create different tenant and their confirmed payment
      const tenantOther = await Tenant.create({
        tenant_code: 'TNT-MOM-OTHER',
        full_name: 'Other Tenant',
        id_number: '55555555',
        phone: '254711111111',
        email: 'other@mutune.test',
        current_property_id: property._id,
        current_unit_id: new mongoose.Types.ObjectId(),
        rent_amount_kes: 20000
      });
      const paymentOther = await Payment.create({
        transaction_id: 'ws_CO_MCONF_OTHER',
        tenant_id: tenantOther._id,
        property_id: property._id,
        unit_id: tenantOther.current_unit_id,
        amount_kes: 20000,
        payment_type: 'rent',
        channel: 'mpesa_stk',
        status: 'confirmed'
      });

      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .post(`/api/v1/inventory/${property._id}/reclaim`)
        .send({
          item_id: item._id.toString(),
          reclaim_receipt_id: paymentOther._id.toString() // receipt of different tenant
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('WRONG_TENANT');
    });

    test('TC-2.7.3: Reclaim with Unconfirmed Receipt', async () => {
      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .post(`/api/v1/inventory/${property._id}/reclaim`)
        .send({
          item_id: item._id.toString(),
          reclaim_receipt_id: paymentPending._id.toString() // receipt status pending
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('UNCONFIRMED_RECEIPT');
    });

    test('TC-2.7.4: Record Sale on Reclaimed Item', async () => {
      // Mark item as reclaimed first
      item.auction_status = 'reclaimed';
      await property.save();

      mockClerkId = 'clerk_admin_001';
      // Attempt to sell already reclaimed item
      const res = await request(app)
        .post(`/api/v1/inventory/${property._id}/auction-sold`)
        .send({
          item_id: item._id.toString(),
          buyer: 'KRA Buyer',
          sale_amount: 15000
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_RECLAIMED');
    });

    test('TC-2.7.5: Empty Auction Report', async () => {
      // Clear sold auction items
      property.inventory = [];
      await property.save();

      mockClerkId = 'clerk_admin_001';
      const res = await request(app)
        .get('/api/v1/inventory/auction-report');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      // Contains CSV headers list
      expect(res.text).toContain('Property');
    });
  });

  // =========================================================================
  // Feature 8: Late Fee Rules logic boundaries
  // =========================================================================
  describe('Feature 8: Late Fee Rules logic boundaries', () => {
    let adminUser, landlordUser, residentialProperty, commercialProperty, tenantRes, tenantComm;

    beforeEach(async () => {
      await clearDatabase();
      adminUser = await User.create({
        clerk_id: 'clerk_admin_001',
        email: 'admin@mutune.test',
        full_name: 'Admin User',
        phone: '254700000001',
        role: 'super_admin',
        is_active: true
      });
      landlordUser = await User.create({
        clerk_id: 'clerk_landlord_active',
        email: 'landlord@mutune.test',
        full_name: 'Active Landlord',
        phone: '254711111111',
        role: 'landlord',
        is_active: true
      });
      residentialProperty = await Property.create({
        name: 'Nyali Heights',
        property_code: 'PROP-RES-001',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        landlord_id: landlordUser._id,
        status: 'active',
        units: [{ unit_number: '1A', rent_kes: 20000, status: 'occupied' }]
      });
      commercialProperty = await Property.create({
        name: 'Nyali Complex',
        property_code: 'PROP-COM-002',
        type: 'commercial',
        address: { area: 'Nyali', city: 'Mombasa' },
        landlord_id: landlordUser._id,
        status: 'active',
        units: [{ unit_number: 'C1', rent_kes: 80000, status: 'occupied' }]
      });

      tenantRes = await Tenant.create({
        tenant_code: 'TNT-RES-0001',
        full_name: 'Residential Tenant',
        id_number: '11111111',
        phone: '254712345671',
        email: 'res@mutune.test',
        current_property_id: residentialProperty._id,
        current_unit_id: residentialProperty.units[0]._id,
        rent_amount_kes: 20000,
        lease_start: new Date(Date.now() - 60 * 86400000),
        lease_end: new Date(Date.now() + 31536000000),
        tenancy_status: 'active',
        arrears_kes: 0
      });

      tenantComm = await Tenant.create({
        tenant_code: 'TNT-COM-0002',
        full_name: 'Commercial Tenant',
        id_number: '22222222',
        phone: '254712345672',
        email: 'comm@mutune.test',
        current_property_id: commercialProperty._id,
        current_unit_id: commercialProperty.units[0]._id,
        rent_amount_kes: 80000,
        lease_start: new Date(Date.now() - 60 * 86400000),
        lease_end: new Date(Date.now() + 31536000000),
        tenancy_status: 'active',
        arrears_kes: 0
      });
    });

    test('TC-2.8.1: Rule Scope Conflict', async () => {
      // Commercial only late fee rule
      await LateFeeRule.create({
        name: 'Commercial Only Rule',
        grace_days: 0,
        penalty_type: 'percentage',
        penalty_value: 10,
        applies_to: 'commercial',
        is_active: true,
        created_by: adminUser._id
      });

      const lateFeeApplicator = require('../cron/late-fee-applicator');
      await lateFeeApplicator.run();

      const resTenant = await Tenant.findById(tenantRes._id);
      const comTenant = await Tenant.findById(tenantComm._id);

      expect(resTenant.arrears_kes).toBe(0); // Ignored because rule is commercial-only
      expect(comTenant.arrears_kes).toBe(8000); // 10% of 80000 applied
    });

    test('TC-2.8.2: Grace Period Overdue Check', async () => {
      // Grace period set to 28 days (assuming today's date is < 28)
      // Since local time is 19th, grace_days: 25 will be greater than today (19th), so grace period has not passed.
      await LateFeeRule.create({
        name: 'Grace Day Rule',
        grace_days: 28,
        penalty_type: 'fixed',
        penalty_value: 1000,
        applies_to: 'all',
        is_active: true,
        created_by: adminUser._id
      });

      const lateFeeApplicator = require('../cron/late-fee-applicator');
      await lateFeeApplicator.run();

      const resTenant = await Tenant.findById(tenantRes._id);
      expect(resTenant.arrears_kes).toBe(0); // Grace period active
    });

    test('TC-2.8.3: Penalty Cap enforcement', async () => {
      // Apply 10% penalty to KES 80,000 rent. Capped at KES 5,000
      await LateFeeRule.create({
        name: 'Capped Penalty',
        grace_days: 0,
        penalty_type: 'percentage',
        penalty_value: 10,
        max_penalty_per_month: 5000,
        applies_to: 'commercial',
        is_active: true,
        created_by: adminUser._id
      });

      const lateFeeApplicator = require('../cron/late-fee-applicator');
      await lateFeeApplicator.run();

      const comTenant = await Tenant.findById(tenantComm._id);
      expect(comTenant.arrears_kes).toBe(5000); // capped at 5,000 instead of 8,000
    });

    test('TC-2.8.4: Non-Admin Configure Rules', async () => {
      mockClerkId = 'clerk_landlord_active';
      const res = await request(app)
        .post('/api/v1/admin/late-fee-rules')
        .send({
          name: 'Invalid Landlord Rule',
          grace_days: 0,
          penalty_type: 'fixed',
          penalty_value: 1000,
          applies_to: 'all'
        });

      expect(res.status).toBe(403);
    });

    test('TC-2.8.5: Applicator on Inactive Rules', async () => {
      await LateFeeRule.create({
        name: 'Inactive Rule',
        grace_days: 0,
        penalty_type: 'fixed',
        penalty_value: 2000,
        applies_to: 'all',
        is_active: false, // inactive rule
        created_by: adminUser._id
      });

      const lateFeeApplicator = require('../cron/late-fee-applicator');
      await lateFeeApplicator.run();

      const resTenant = await Tenant.findById(tenantRes._id);
      expect(resTenant.arrears_kes).toBe(0); // inactive rule ignored
    });
  });

  // =========================================================================
  // Feature 9: Maintenance Ticket edge cases
  // =========================================================================
  describe('Feature 9: Maintenance Ticket edge cases', () => {
    let adminUser, agentUser1, agentUser2, tenantUser1, tenantUser2, tenantProfile1, tenantProfile2, property, ticket;

    beforeEach(async () => {
      await clearDatabase();
      adminUser = await User.create({
        clerk_id: 'clerk_admin_001',
        email: 'admin@mutune.test',
        full_name: 'Admin User',
        phone: '254700000001',
        role: 'super_admin',
        is_active: true
      });
      agentUser1 = await User.create({
        clerk_id: 'clerk_agent_001',
        email: 'agent1@mutune.test',
        full_name: 'Agent Mombasa',
        phone: '254722222222',
        role: 'agent',
        is_active: true,
        assigned_areas: ['Nyali']
      });
      agentUser2 = await User.create({
        clerk_id: 'clerk_agent_002',
        email: 'agent2@mutune.test',
        full_name: 'Agent Mombasa CBD',
        phone: '254722222223',
        role: 'agent',
        is_active: true,
        assigned_areas: ['Mombasa-CBD'] // CBD agent
      });
      tenantUser1 = await User.create({
        clerk_id: 'clerk_tenant_001',
        email: 'janedoe@mutune.test',
        full_name: 'Jane Doe',
        phone: '254712345678',
        role: 'tenant',
        is_active: true
      });
      tenantUser2 = await User.create({
        clerk_id: 'clerk_tenant_002',
        email: 'tenant2@mutune.test',
        full_name: 'Tenant Two',
        phone: '254712345679',
        role: 'tenant',
        is_active: true
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
      tenantProfile1 = await Tenant.create({
        tenant_code: 'TNT-MOM-0001',
        user_id: tenantUser1._id,
        full_name: 'Jane Doe',
        id_number: '12345678',
        phone: '254712345678',
        email: 'janedoe@mutune.test',
        current_property_id: property._id,
        current_unit_id: property.units[0]._id,
        rent_amount_kes: 20000
      });
      tenantProfile2 = await Tenant.create({
        tenant_code: 'TNT-MOM-0002',
        user_id: tenantUser2._id,
        full_name: 'Tenant Two',
        id_number: '12345679',
        phone: '254712345679',
        email: 'tenant2@mutune.test',
        current_property_id: property._id,
        current_unit_id: property.units[0]._id,
        rent_amount_kes: 20000
      });
      ticket = await MaintenanceTicket.create({
        ticket_code: 'MT-NYL-001',
        property_id: property._id,
        unit_id: property.units[0]._id,
        tenant_id: tenantProfile1._id,
        created_by: tenantUser1._id,
        category: 'plumbing',
        priority: 'medium',
        description: 'Bathroom cabinet leak',
        status: 'open'
      });
    });

    test('TC-2.9.1: Delete In-Progress Ticket', async () => {
      // Set status to in_progress
      ticket.status = 'in_progress';
      await ticket.save();

      mockClerkId = 'clerk_tenant_001';
      // Attempt to delete in_progress ticket
      const res = await request(app)
        .delete(`/api/v1/maintenance/${ticket._id}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TICKET_IN_PROGRESS');
    });

    test('TC-2.9.2: Delete Other Tenant Ticket', async () => {
      mockClerkId = 'clerk_tenant_002'; // Authenticated as Tenant 2
      // Attempt to delete Tenant 1's ticket
      const res = await request(app)
        .delete(`/api/v1/maintenance/${ticket._id}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('TC-2.9.3: Invalid Agent Assignment', async () => {
      mockClerkId = 'clerk_admin_001';
      // Assign ticket (Nyali property) to agent2 (Mombasa-CBD scoped only)
      const res = await request(app)
        .patch(`/api/v1/maintenance/${ticket._id}`)
        .send({
          assigned_agent_id: agentUser2._id.toString()
        });

      expect([400, 403]).toContain(res.status);
    });

    test('TC-2.9.4: Photos limit check', async () => {
      mockClerkId = 'clerk_tenant_001';
      // Submit 6 photos
      const res = await request(app)
        .post('/api/v1/maintenance')
        .send({
          property_id: property._id.toString(),
          unit_id: property.units[0]._id.toString(),
          category: 'plumbing',
          priority: 'medium',
          description: 'Sink leakage description',
          photos: ['url1', 'url2', 'url3', 'url4', 'url5', 'url6']
        });

      expect(res.status).toBe(201);
      // Photos array truncated to 5
      expect(res.body.data.photos.length).toBe(5);
      expect(res.body.data.photos).not.toContain('url6');
    });

    test('TC-2.9.5: Review Rating Out of Bounds', async () => {
      mockClerkId = 'clerk_tenant_001';
      // Satisfaction rating = 6 (out of bounds)
      const res = await request(app)
        .patch(`/api/v1/maintenance/${ticket._id}`)
        .send({
          tenant_satisfaction: 6
        });

      expect([400, 422, 500]).toContain(res.status);
    });
  });

});
