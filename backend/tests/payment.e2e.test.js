const request = require('supertest');
const app = require('../server');
const Payment = require('../models/Payment');
const Property = require('../models/Property');
const Tenant = require('../models/Tenant');
const User = require('../models/User');

jest.setTimeout(30000);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

jest.mock('../services/mpesa', () => ({
  initiateSTKPush: jest.fn().mockResolvedValue({
    checkoutRequestId: 'ws_CO_TEST123456789',
    merchantRequestId: 'MRID_TEST001',
    responseCode: '0',
    responseDescription: 'Success. Request accepted for processing',
    customerMessage: 'Success. Request accepted for processing'
  }),
  formatPhone: jest.fn((phone) => phone.replace(/\D/g, '').replace(/^0/, '254'))
}));

jest.mock('../services/sms', () => ({
  send: jest.fn().mockResolvedValue({ success: true, messageId: 'SMS_TEST_001', status: 'Sent' }),
  formatPhone: jest.fn((phone) => phone.replace(/\D/g, '').replace(/^0/, '254'))
}));

jest.mock('@clerk/clerk-sdk-node', () => ({
  ClerkExpressRequireAuth: () => (req, res, next) => {
    req.auth = { userId: 'test_clerk_id_001' };
    next();
  },
  clerkClient: {
    users: {
      updateUserMetadata: jest.fn().mockResolvedValue({}),
      getUser: jest.fn().mockResolvedValue({ id: 'test_clerk_id_001', publicMetadata: {} })
    }
  }
}));

describe('Payment E2E Flow', () => {
  let agent, property, tenant;

  beforeAll(async () => {
    await Payment.deleteMany({});
    await Property.deleteMany({});
    await Tenant.deleteMany({});
    await User.deleteMany({});

    agent = await User.create({
      user_code: 'AGT-E2E-001', role: 'agent', full_name: 'E2E Agent',
      email: 'e2e-agent@mutune.test', phone: '254700000001',
      password_hash: '$2a$10$fakehashfortestingpurposesonly123456789012345678901234567890',
      is_active: true, assigned_areas: ['Nyali'], assigned_property_ids: [], clerk_id: 'test_clerk_id_001'
    });

    property = await Property.create({
      property_code: 'MUT-E2E-001', name: 'E2E Test Apartments', type: 'apartment',
      address: { street: 'E2E Road', area: 'Nyali', city: 'Mombasa' },
      location: { type: 'Point', coordinates: [39.71, -4.04] },
      landlord_id: agent._id, agent_ids: [agent._id],
      units: [{ unit_number: 'E2E-1A', rent_kes: 25000, status: 'vacant', lock_status: 'unlocked' }]
    });

    agent.assigned_property_ids = [property._id];
    await agent.save();

    tenant = await Tenant.create({
      tenant_code: 'TNT-E2E-001', full_name: 'E2E Tenant', id_number: '87654321',
      phone: '254712345678', email: 'e2e-tenant@mutune.test',
      lease_start: new Date(), lease_end: new Date(Date.now() + 31536000000),
      rent_amount_kes: 25000, current_property_id: property._id,
      current_unit_id: property.units[0]._id
    });
  });

  afterAll(async () => {
    await Payment.deleteMany({});
    await Property.deleteMany({});
    await Tenant.deleteMany({});
    await User.deleteMany({});
  });

  test('Step 1: STK Push initiation creates pending payment', async () => {
    const res = await request(app)
      .post('/api/v1/payments/initiate-stk')
      .send({ tenant_id: tenant._id.toString(), unit_id: property.units[0]._id.toString(), amount: 25000, payment_type: 'rent' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.checkout_request_id).toBeTruthy();
    expect(res.body.status).toBe('pending');

    const payment = await Payment.findOne({ tenant_id: tenant._id });
    expect(payment).toBeTruthy();
    expect(payment.status).toBe('pending');
    expect(payment.workflow_state).toBe('PENDING_VIEWING');
    expect(payment.amount_kes).toBe(25000);
  });

  test('Step 2: M-Pesa callback confirms payment and updates state', async () => {
    const payment = await Payment.findOne({ tenant_id: tenant._id });
    const checkoutId = payment.transaction_id;

    const callback = {
      Body: {
        stkCallback: {
          MerchantRequestID: 'MRID-E2E-001',
          CheckoutRequestID: checkoutId,
          ResultCode: 0,
          ResultDesc: 'Success',
          CallbackMetadata: {
            Item: [
              { Name: 'Amount', Value: 25000 },
              { Name: 'MpesaReceiptNumber', Value: 'QKJ7E2E123' },
              { Name: 'PhoneNumber', Value: '254712345678' },
              { Name: 'TransactionDate', Value: '20250701103000' }
            ]
          }
        }
      }
    };

    const res = await request(app)
      .post('/api/v1/payments/callback')
      .set('X-Forwarded-For', '196.201.214.1')
      .send(callback);
    expect(res.status).toBe(200);
    expect(res.body.ResultCode).toBe(0);
    // Poll database for up to 3 seconds until payment is processed asynchronously
    let updated;
    for (let i = 0; i < 30; i++) {
      updated = await Payment.findById(payment._id);
      if (updated && updated.status === 'confirmed') break;
      await sleep(100);
    }

    expect(updated.status).toBe('confirmed');
    expect(updated.workflow_state).toBe('PAYMENT_CONFIRMED');
    expect(updated.mpesa_receipt).toBe('QKJ7E2E123');
    expect(updated.discrepancy_flag).toBe(false);
    expect(updated.verification_method).toBe('auto_mpesa');

    const prop = await Property.findById(property._id);
    expect(prop.units[0].lock_status).toBe('payment_confirmed');

    let ten;
    for (let i = 0; i < 30; i++) {
      ten = await Tenant.findById(tenant._id);
      if (ten && ten.payment_history.length === 1) break;
      await sleep(100);
    }
    expect(ten.payment_history.length).toBe(1);
    expect(ten.payment_history[0].amount_kes).toBe(25000);
    expect(ten.payment_history[0].status).toBe('paid');
  });

  test('Step 3: Failed callback flags discrepancy', async () => {
    const failPayment = await Payment.create({
      transaction_id: `MUT-FAIL-${Date.now()}`, tenant_id: tenant._id,
      property_id: property._id, unit_id: property.units[0]._id.toString(),
      amount_kes: 25000, channel: 'mpesa_stk', status: 'pending', workflow_state: 'PENDING_VIEWING',
      payment_type: 'rent'
    });

    const callback = {
      Body: {
        stkCallback: {
          MerchantRequestID: 'MRID-FAIL',
          CheckoutRequestID: failPayment.transaction_id,
          ResultCode: 1032,
          ResultDesc: 'Transaction cancelled by user',
          CallbackMetadata: { Item: [] }
        }
      }
    };

    await request(app)
      .post('/api/v1/payments/callback')
      .set('X-Forwarded-For', '196.201.214.1')
      .send(callback);
    await sleep(200);
    const updated = await Payment.findById(failPayment._id);
    expect(updated.status).toBe('failed');
    expect(updated.workflow_state).toBe('MANUAL_REVIEW');
    expect(updated.discrepancy_flag).toBe(true);
    expect(updated.discrepancy_reason).toContain('Transaction cancelled');
  });

  test('Step 4: IP whitelist blocks unauthorized callback', async () => {
    const res = await request(app).post('/api/v1/payments/callback').set('X-Forwarded-For', '192.168.1.1').send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('IP_BLOCKED');
  });
});
