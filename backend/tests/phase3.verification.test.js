const request = require('supertest');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { Webhook } = require('svix');

// Set test environment
process.env.NODE_ENV = 'test';

const User = require('../models/User');
const Property = require('../models/Property');
const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const MaintenanceTicket = require('../models/MaintenanceTicket');
const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');

let mockClerkId = 'clerk_phase3_test';

jest.mock('@clerk/clerk-sdk-node', () => ({
  ClerkExpressRequireAuth: () => (req, res, next) => {
    req.auth = { userId: mockClerkId };
    next();
  },
  clerkClient: {
    users: {
      updateUserMetadata: jest.fn().mockResolvedValue({}),
      getUser: jest.fn().mockImplementation((id) => Promise.resolve({ id, publicMetadata: {} })),
      deleteUser: jest.fn().mockResolvedValue({})
    }
  }
}));

// Mock external services to prevent network calls
jest.mock('../services/sms', () => ({
  send: jest.fn().mockResolvedValue({ success: true }),
  formatPhone: jest.fn(p => p.replace(/\D/g, '').replace(/^0/, '254'))
}));
jest.mock('../services/utilityProvider', () => {
  const actual = jest.requireActual('../services/utilityProvider');
  return {
    ...actual,
    payWaterBill: jest.fn().mockResolvedValue({
      provider: 'MOMBASA_WATER',
      account_number: 'WAT-001',
      amount_kes: 1500,
      status: 'confirmed',
      receipt_number: 'REC-WAT-TEST'
    })
  };
});

const app = require('../server');

describe('Phase 3 Verification: RBAC, Multi-Tenant Scoping & Security Hardening', () => {
  let caretakerUser, accountantUser, tenantUser, landlordAUser, landlordBUser, adminUser;
  let propA, propB;
  let ticketA, ticketB;

  beforeAll(async () => {
    // 1. Create Properties
    propA = await Property.create({
      name: 'Alpha Heights',
      property_code: 'MUT-ALP-001',
      type: 'apartment',
      property_type: 'residential',
      address: { area: 'Nyali', city: 'Mombasa', county: 'Mombasa' },
      location: { type: 'Point', coordinates: [39.7, -4.0] },
      units: [
        { unit_number: 'A1', rent_kes: 25000, status: 'occupied' },
        { unit_number: 'A2', rent_kes: 25000, status: 'vacant' }
      ]
    });

    propB = await Property.create({
      name: 'Beta Towers',
      property_code: 'MUT-BET-002',
      type: 'apartment',
      property_type: 'residential',
      address: { area: 'Bamburi', city: 'Mombasa', county: 'Mombasa' },
      location: { type: 'Point', coordinates: [39.71, -4.01] },
      units: [
        { unit_number: 'B1', rent_kes: 30000, status: 'occupied' },
        { unit_number: 'B2', rent_kes: 30000, status: 'vacant' }
      ]
    });

    // 2. Create Users for different roles
    caretakerUser = await User.create({
      clerk_id: 'clerk_caretaker_p3',
      email: 'caretaker_p3@mutunerent.com',
      full_name: 'Care Taker',
      role: 'caretaker',
      is_active: true,
      assigned_properties: [propA._id],
      assigned_property_ids: [propA._id]
    });

    accountantUser = await User.create({
      clerk_id: 'clerk_accountant_p3',
      email: 'accountant_p3@mutunerent.com',
      full_name: 'Chief Accountant',
      role: 'accountant',
      is_active: true
    });

    landlordAUser = await User.create({
      clerk_id: 'clerk_landlordA_p3',
      email: 'landlordA_p3@mutunerent.com',
      full_name: 'Landlord Alpha',
      role: 'landlord',
      is_active: true
    });

    landlordBUser = await User.create({
      clerk_id: 'clerk_landlordB_p3',
      email: 'landlordB_p3@mutunerent.com',
      full_name: 'Landlord Beta',
      role: 'landlord',
      is_active: true
    });

    // Link properties to landlords
    propA.landlord_id = landlordAUser._id;
    await propA.save();
    propB.landlord_id = landlordBUser._id;
    await propB.save();

    tenantUser = await User.create({
      clerk_id: 'clerk_tenant_p3',
      email: 'tenant_p3@mutunerent.com',
      full_name: 'Resident Tenant',
      role: 'tenant',
      is_active: true,
      current_property_id: propA._id,
      current_unit_id: propA.units[0]._id
    });

    adminUser = await User.create({
      clerk_id: 'clerk_admin_p3',
      email: 'admin_p3@mutunerent.com',
      full_name: 'Platform Admin',
      role: 'admin',
      is_active: true
    });

    // Create Maintenance Tickets
    ticketA = await MaintenanceTicket.create({
      ticket_code: 'MT-ALP-001',
      title: 'Plumbing Leak A1',
      property_id: propA._id,
      unit_id: propA.units[0]._id,
      unit_code: 'A1',
      category: 'plumbing',
      priority: 'high',
      description: 'Water leaking under the kitchen sink',
      status: 'open',
      created_by: tenantUser._id
    });

    ticketB = await MaintenanceTicket.create({
      ticket_code: 'MT-BET-001',
      title: 'Electrical Spark B1',
      property_id: propB._id,
      unit_id: propB.units[0]._id,
      unit_code: 'B1',
      category: 'electrical',
      priority: 'emergency',
      description: 'Sparking main breaker in unit B1',
      status: 'open',
      created_by: adminUser._id
    });
  });

  afterAll(async () => {
    await Property.deleteMany({ _id: { $in: [propA._id, propB._id] } });
    await User.deleteMany({ _id: { $in: [caretakerUser._id, accountantUser._id, landlordAUser._id, landlordBUser._id, tenantUser._id, adminUser._id] } });
    await MaintenanceTicket.deleteMany({ _id: { $in: [ticketA._id, ticketB._id] } });
    await Payment.deleteMany({ property_id: { $in: [propA._id, propB._id] } });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. CARETAKER SCOPED ACCESS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. Caretaker Scoped Access', () => {
    beforeEach(() => {
      mockClerkId = caretakerUser.clerk_id;
    });

    test('Caretaker GET /properties receives only assigned properties', async () => {
      const res = await request(app).get('/api/v1/properties');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const propIds = res.body.data.map(p => p._id.toString());
      expect(propIds).toContain(propA._id.toString());
      expect(propIds).not.toContain(propB._id.toString());
    });

    test('Caretaker GET /properties/:id succeeds on assigned property', async () => {
      const res = await request(app).get(`/api/v1/properties/${propA._id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id.toString()).toBe(propA._id.toString());
    });

    test('Caretaker GET /properties/:id returns 403 on unassigned property', async () => {
      const res = await request(app).get(`/api/v1/properties/${propB._id}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test('Caretaker POST /maintenance succeeds on assigned property', async () => {
      const res = await request(app)
        .post('/api/v1/maintenance')
        .send({
          property_id: propA._id.toString(),
          unit_code: 'A2',
          category: 'structural',
          urgency: 'medium',
          title: 'Door alignment',
          description: 'Caretaker inspects front door hinges'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.property_id.toString()).toBe(propA._id.toString());
    });

    test('Caretaker POST /maintenance is blocked (403) on unassigned property', async () => {
      const res = await request(app)
        .post('/api/v1/maintenance')
        .send({
          property_id: propB._id.toString(),
          unit_code: 'B2',
          category: 'structural',
          urgency: 'medium',
          title: 'Unassigned ticket',
          description: 'Caretaker attempts to log ticket for unassigned property'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test('Caretaker GET /maintenance only returns tickets for assigned property', async () => {
      const res = await request(app).get('/api/v1/maintenance');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const returnedTickets = res.body.data;
      const returnedPropIds = returnedTickets.map(t => (t.property_id?._id || t.property_id).toString());
      expect(returnedPropIds).toContain(propA._id.toString());
      expect(returnedPropIds).not.toContain(propB._id.toString());
    });

    test('Caretaker PATCH /maintenance/:id succeeds on assigned property ticket', async () => {
      const res = await request(app)
        .patch(`/api/v1/maintenance/${ticketA._id}`)
        .send({ status: 'in_progress' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('in_progress');
    });

    test('Caretaker PATCH /maintenance/:id is blocked (403) on unassigned property ticket', async () => {
      const res = await request(app)
        .patch(`/api/v1/maintenance/${ticketB._id}`)
        .send({ status: 'in_progress' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test('Caretaker assigned via assigned_property_ids ONLY (with empty assigned_properties) correctly accesses assigned property', async () => {
      // Emulate user created via admin API where only assigned_property_ids is set
      const legacyCaretaker = await User.create({
        clerk_id: 'clerk_caretaker_legacy',
        email: 'caretaker_legacy@mutunerent.com',
        full_name: 'Legacy Caretaker',
        role: 'caretaker',
        is_active: true,
        assigned_property_ids: [propA._id],
        assigned_properties: [] // empty array as defaulted by Mongoose schema
      });

      mockClerkId = legacyCaretaker.clerk_id;

      const propRes = await request(app).get('/api/v1/properties');
      expect(propRes.status).toBe(200);
      const propIds = propRes.body.data.map(p => p._id.toString());
      expect(propIds).toContain(propA._id.toString());
      expect(propIds).not.toContain(propB._id.toString());

      // Reset mockClerkId back to primary caretaker
      mockClerkId = caretakerUser.clerk_id;
    });

    test('Caretaker PATCH /maintenance/:id is blocked (403) on ticket with no assigned property', async () => {
      const unassignedTicket = await MaintenanceTicket.create({
        ticket_code: 'MT-NO-PROP-999',
        property_id: null,
        unit_id: new mongoose.Types.ObjectId(),
        created_by: tenantUser._id,
        category: 'other',
        priority: 'low',
        description: 'Unassigned ticket',
        status: 'open'
      });

      const res = await request(app)
        .patch(`/api/v1/maintenance/${unassignedTicket._id}`)
        .send({ status: 'in_progress' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. ACCOUNTANT READ/WRITE ACCESS & RESTRICTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. Accountant Role Permissions', () => {
    test('Accountant has read/write access to /financials and /ledger', async () => {
      mockClerkId = accountantUser.clerk_id;

      // 1. GET /financials/trial-balance
      const tbRes = await request(app).get('/api/v1/financials/trial-balance');
      expect(tbRes.status).toBe(200);
      expect(tbRes.body.success).toBe(true);

      // 2. GET /financials/accounts
      const accRes = await request(app).get('/api/v1/financials/accounts');
      expect(accRes.status).toBe(200);
      expect(accRes.body.success).toBe(true);

      // 3. POST /financials/journal-entries
      const postEntryRes = await request(app)
        .post('/api/v1/financials/journal-entries')
        .send({
          reference_type: 'manual',
          notes: 'Accountant test entry',
          property_id: propA._id,
          line_items: [
            { account_code: '1010', debit_kes: 5000, credit_kes: 0, description: 'Bank debit' },
            { account_code: '4010', debit_kes: 0, credit_kes: 5000, description: 'Revenue credit' }
          ]
        });
      expect(postEntryRes.status).toBe(201);
      expect(postEntryRes.body.success).toBe(true);

      // 4. GET /ledger
      const ledgerRes = await request(app).get('/api/v1/ledger');
      expect(ledgerRes.status).toBe(200);
      expect(ledgerRes.body.success).toBe(true);

      // 5. GET /tax/etims/summary
      const taxSumRes = await request(app).get('/api/v1/tax/etims/summary');
      expect(taxSumRes.status).toBe(200);
      expect(taxSumRes.body.success).toBe(true);

      // 6. GET /settings/trial-balance
      const setTbRes = await request(app).get('/api/v1/settings/trial-balance');
      expect(setTbRes.status).toBe(200);
      expect(setTbRes.body.success).toBe(true);
    });

    test('Tenant role is blocked (403) from accessing /financials and /ledger', async () => {
      mockClerkId = tenantUser.clerk_id;

      const finRes = await request(app).get('/api/v1/financials/trial-balance');
      expect(finRes.status).toBe(403);

      const ledRes = await request(app).get('/api/v1/ledger');
      expect(ledRes.status).toBe(403);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. TENANT ALLOWED ON POST /utilities/water/pay
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3. Tenant Role on Utility Bill Pay', () => {
    test('Tenant role can call POST /utilities/water/pay without 403 Forbidden', async () => {
      mockClerkId = tenantUser.clerk_id;

      const res = await request(app)
        .post('/api/v1/utilities/water/pay')
        .send({
          account_number: 'WAT-TENANT-001',
          amount_kes: 1500,
          property_id: propA._id.toString()
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Water utility bill paid successfully');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. LANDLORD TAX SCOPING PREVENTS CROSS-LANDLORD LEAKS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4. Landlord Tax Scoping', () => {
    beforeAll(async () => {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const [year, mon] = currentMonth.split('-').map(Number);
      const testDate = new Date(year, mon - 1, 15);

      // Create Payment on Landlord A's property
      await Payment.create({
        transaction_id: 'TXN-ALP-001',
        property_id: propA._id,
        amount_kes: 50000,
        payment_type: 'rent',
        channel: 'mpesa_c2b',
        status: 'confirmed',
        created_at: testDate
      });

      // Create Payment on Landlord B's property
      await Payment.create({
        transaction_id: 'TXN-BET-001',
        property_id: propB._id,
        amount_kes: 120000,
        payment_type: 'rent',
        channel: 'mpesa_c2b',
        status: 'confirmed',
        created_at: testDate
      });
    });

    test('Landlord A tax summary only computes tax on PropA rent (KES 50,000), not PropB', async () => {
      mockClerkId = landlordAUser.clerk_id;
      const res = await request(app).get('/api/v1/tax/etims/summary');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.residential_gross_rent_kes).toBe(50000);
      expect(res.body.data.mri_tax_kes).toBe(3750); // 7.5% of 50000
    });

    test('Landlord A MRI-01 CSV return only includes PropA, not PropB', async () => {
      mockClerkId = landlordAUser.clerk_id;
      const res = await request(app).get('/api/v1/tax/etims/mri-return');

      expect(res.status).toBe(200);
      expect(res.text).toContain('Alpha Heights');
      expect(res.text).not.toContain('Beta Towers');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. ONBOARDING ROLE RESTRICTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('5. Onboarding Role Security', () => {
    let unassignedUser;

    beforeEach(async () => {
      unassignedUser = await User.create({
        clerk_id: `clerk_unassigned_${Date.now()}`,
        email: `unassigned_${Date.now()}@example.com`,
        full_name: 'Fresh Signup',
        is_active: true
      });
      mockClerkId = unassignedUser.clerk_id;
    });

    afterEach(async () => {
      if (unassignedUser) await User.deleteOne({ _id: unassignedUser._id });
    });

    test('Self-assigning "admin" is rejected with 400 validation error or 403 forbidden', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me/role')
        .send({ role: 'admin', phone: '254711223344' });

      expect([400, 403]).toContain(res.status);
      expect(res.body.success).toBe(false);

      const refreshed = await User.findById(unassignedUser._id);
      expect(refreshed.role).not.toBe('admin');
    });

    test('Self-assigning "super_admin" is rejected', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me/role')
        .send({ role: 'super_admin', phone: '254711223344' });

      expect([400, 403]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    test('Self-assigning allowed roles like "agent" succeeds via PATCH /me/role', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me/role')
        .send({
          role: 'agent',
          phone: '254711223344',
          earb_license: 'EARB-12345',
          earb_verification_doc_url: 'https://r2.cloudflare.com/earb.pdf',
          assigned_areas: ['Nyali']
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('agent');
    });

    test('POST /users/complete-onboarding alias rejects admin self-assignment', async () => {
      const res = await request(app)
        .post('/api/v1/users/complete-onboarding')
        .send({ role: 'admin', phone: '254711223344' });

      expect([400, 403]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. WEBHOOK SIGNATURE & SECRET VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════
  describe('6. Webhook Signature & Secret Verification', () => {
    test('Clerk webhook verifies valid Svix signature and rejects invalid Svix signature', async () => {
      const rawSecret = 'test_secret_for_svix_verification_12345_key';
      const secret = 'whsec_' + Buffer.from(rawSecret).toString('base64');
      process.env.CLERK_WEBHOOK_SECRET = secret;

      const payload = {
        type: 'user.created',
        data: { id: 'clerk_webhook_test_user', email_addresses: [{ email_address: 'hook@test.com' }] }
      };
      const rawPayload = JSON.stringify(payload);

      // 1. Send with invalid signature
      const badRes = await request(app)
        .post('/api/v1/users/clerk-webhook')
        .set('Content-Type', 'application/json')
        .set('svix-id', 'msg_test_123')
        .set('svix-timestamp', `${Math.floor(Date.now() / 1000)}`)
        .set('svix-signature', 'v1,invalid_signature_hash')
        .send(rawPayload);

      expect(badRes.status).toBe(400);
      expect(badRes.body.error.code).toBe('INVALID_SIGNATURE');

      // 2. Send with valid Svix signature
      const wh = new Webhook(secret);
      const timestamp = new Date();
      const validSignature = wh.sign('msg_test_valid_123', timestamp, rawPayload);

      const goodRes = await request(app)
        .post('/api/v1/users/clerk-webhook')
        .set('Content-Type', 'application/json')
        .set('svix-id', 'msg_test_valid_123')
        .set('svix-timestamp', `${Math.floor(timestamp.getTime() / 1000)}`)
        .set('svix-signature', validSignature)
        .send(rawPayload);

      expect(goodRes.status).toBe(200);
      expect(goodRes.body.success).toBe(true);

      delete process.env.CLERK_WEBHOOK_SECRET;
    });

    test('Bank payment webhook rejects unauthorized calls and verifies secret/signature', async () => {
      const secret = 'intasend_webhook_secret_key_123';
      process.env.INTASEND_WEBHOOK_SECRET = secret;

      // 1. Without credentials -> 401
      const badRes = await request(app)
        .post('/api/v1/bank-payments/webhook')
        .send({ invoice_id: 'INV-001', state: 'PENDING' });

      expect(badRes.status).toBe(401);
      expect(badRes.body.error.code).toBe('UNAUTHORIZED_WEBHOOK');

      // 2. With valid secret header -> 200
      const goodRes = await request(app)
        .post('/api/v1/bank-payments/webhook')
        .set('x-webhook-secret', secret)
        .send({ invoice_id: 'INV-001', state: 'PROCESSING' });

      expect(goodRes.status).toBe(200);
      expect(goodRes.body.success).toBe(true);

      // 3. With HMAC signature -> 200
      const payload = JSON.stringify({ invoice_id: 'INV-002', state: 'PROCESSING' });
      const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      const sigRes = await request(app)
        .post('/api/v1/bank-payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-intasend-signature', signature)
        .send(payload);

      expect(sigRes.status).toBe(200);
      expect(sigRes.body.success).toBe(true);

      delete process.env.INTASEND_WEBHOOK_SECRET;
    });

    test('Daraja B2C callback verifies webhook secret when configured', async () => {
      const secret = 'daraja_b2c_secret_test';
      process.env.DARAJA_WEBHOOK_SECRET = secret;

      // Bad secret -> 401
      const badRes = await request(app)
        .post('/api/v1/disbursement/b2c/result')
        .set('X-Forwarded-For', '196.201.214.1')
        .set('x-webhook-secret', 'wrong_secret')
        .send({ ResultCode: 0 });

      expect(badRes.status).toBe(401);

      // Good secret -> 200
      const goodRes = await request(app)
        .post('/api/v1/disbursement/b2c/result')
        .set('X-Forwarded-For', '196.201.214.1')
        .set('x-webhook-secret', secret)
        .send({ ResultCode: 0 });

      expect(goodRes.status).toBe(200);
      expect(goodRes.body.ResultCode).toBe(0);

      delete process.env.DARAJA_WEBHOOK_SECRET;
    });

    test('Payments balance callback verifies webhook secret when configured', async () => {
      const secret = 'mpesa_balance_secret_test';
      process.env.MPESA_BALANCE_SECRET = secret;

      // Bad secret -> 401
      const badRes = await request(app)
        .post('/api/v1/payments/balance/result')
        .set('X-Forwarded-For', '196.201.214.1')
        .set('x-webhook-secret', 'wrong_secret')
        .send({ ResultCode: 0 });

      expect(badRes.status).toBe(401);

      // Good secret -> 200
      const goodRes = await request(app)
        .post('/api/v1/payments/balance/result')
        .set('X-Forwarded-For', '196.201.214.1')
        .set('x-webhook-secret', secret)
        .send({ ResultCode: 0 });

      expect(goodRes.status).toBe(200);
      expect(goodRes.body.ResultCode).toBe(0);

      delete process.env.MPESA_BALANCE_SECRET;
    });

    test('In production, webhooks fail closed (500 CONFIG_ERROR) when secrets are missing', async () => {
      const origEnv = process.env.NODE_ENV;
      const origDaraja = process.env.DARAJA_WEBHOOK_SECRET;
      const origBalance = process.env.MPESA_BALANCE_SECRET;
      const origIntasend = process.env.INTASEND_WEBHOOK_SECRET;

      try {
        process.env.NODE_ENV = 'production';
        delete process.env.DARAJA_WEBHOOK_SECRET;
        delete process.env.MPESA_BALANCE_SECRET;
        delete process.env.INTASEND_WEBHOOK_SECRET;
        delete process.env.WEBHOOK_SECRET;

        // 1. Daraja B2C
        const b2cRes = await request(app)
          .post('/api/v1/disbursement/b2c/result')
          .set('X-Forwarded-For', '196.201.214.1')
          .send({ ResultCode: 0 });
        expect(b2cRes.status).toBe(500);
        expect(b2cRes.body.error.code).toBe('CONFIG_ERROR');

        // 2. Daraja Balance
        const balRes = await request(app)
          .post('/api/v1/payments/balance/result')
          .set('X-Forwarded-For', '196.201.214.1')
          .send({ ResultCode: 0 });
        expect(balRes.status).toBe(500);
        expect(balRes.body.error.code).toBe('CONFIG_ERROR');

        // 3. Bank payment webhook
        const bankRes = await request(app)
          .post('/api/v1/bank-payments/webhook')
          .send({ invoice_id: 'INV-PROD' });
        expect(bankRes.status).toBe(500);
        expect(bankRes.body.error.code).toBe('CONFIG_ERROR');
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origDaraja) process.env.DARAJA_WEBHOOK_SECRET = origDaraja;
        if (origBalance) process.env.MPESA_BALANCE_SECRET = origBalance;
        if (origIntasend) process.env.INTASEND_WEBHOOK_SECRET = origIntasend;
      }
    });
  });
});
