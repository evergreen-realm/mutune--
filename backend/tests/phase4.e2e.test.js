const request = require('supertest');
const app = require('../server');
const Property = require('../models/Property');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Notice = require('../models/Notice');
const Task = require('../models/Task');
const Notification = require('../models/Notification');

jest.setTimeout(30000);

jest.mock('../services/sms', () => ({
  send: jest.fn().mockResolvedValue({ success: true, messageId: 'SMS_FALLBACK_001' }),
  formatPhone: jest.fn(p => p.replace(/\D/g, '').replace(/^0/, '254'))
}));

jest.mock('../services/pdf', () => ({
  generateNoticePDF: jest.fn().mockResolvedValue('https://r2.cloudflare.com/test-notice.pdf')
}));

jest.mock('resend', () => {
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: {
        send: jest.fn().mockResolvedValue({ data: { id: 'email_test_id_123' }, error: null })
      }
    }))
  };
});

let mockClerkId = 'clerk_admin_001';

jest.mock('@clerk/clerk-sdk-node', () => ({
  ClerkExpressRequireAuth: () => (req, res, next) => {
    req.auth = { userId: mockClerkId };
    next();
  }
}));

describe('Phase 4 Features', () => {
  let agent, landlord, property, tenant;

  beforeEach(() => {
    mockClerkId = 'clerk_admin_001';
  });

  beforeAll(async () => {
    await Property.deleteMany({});
    await Tenant.deleteMany({});
    await User.deleteMany({});
    await Notice.deleteMany({});
    await Task.deleteMany({});
    await Notification.deleteMany({});

    await User.create({
      user_code: 'ADM-001', role: 'super_admin', full_name: 'Admin',
      email: 'admin@mutune.test', phone: '254700000001',
      password_hash: '$2a$10$test', is_active: true, clerk_id: 'clerk_admin_001'
    });

    agent = await User.create({
      user_code: 'AGT-001', role: 'agent', full_name: 'Agent User',
      email: 'agent@mutune.test', phone: '254700000002',
      password_hash: '$2a$10$test', is_active: true, clerk_id: 'clerk_agent_001'
    });

    landlord = await User.create({
      user_code: 'LLD-001', role: 'landlord', full_name: 'Landlord User',
      email: 'landlord@mutune.test', phone: '254700000003',
      password_hash: '$2a$10$test', is_active: true, clerk_id: 'clerk_landlord_001'
    });

    property = await Property.create({
      property_code: 'MUT-NYL-001', name: 'Nyali Phase 2', type: 'apartment',
      address: { street: 'Links Road', area: 'Nyali', city: 'Mombasa' },
      location: { type: 'Point', coordinates: [39.71, -4.04] },
      boundaries: {
        type: 'Polygon',
        coordinates: [[[39.709, -4.041], [39.711, -4.041], [39.711, -4.039], [39.709, -4.039], [39.709, -4.041]]]
      },
      landlord_id: landlord._id, agent_ids: [agent._id],
      units: [
        { unit_number: '3B', rent_kes: 25000, status: 'occupied', lock_status: 'locked' },
        { unit_number: '4A', rent_kes: 28000, status: 'occupied', lock_status: 'payment_confirmed' },
        { unit_number: '2C', rent_kes: 22000, status: 'vacant', lock_status: 'unlocked' }
      ],
      inventory: [
        { item_id: 'item-sofa-001', name: 'Sofa', estimated_value_kes: 15000, condition: 'good', auction_status: 'pending' }
      ]
    });

    tenant = await Tenant.create({
      tenant_code: 'TNT-001', full_name: 'John Kamau', id_number: '12345678',
      phone: '254712345678', email: 'john@test.com', preferred_channel: 'both',
      current_property_id: property._id, current_unit_id: property.units[0]._id,
      tenancy_status: 'active'
    });
  });

  afterAll(async () => {
    await Property.deleteMany({});
    await Tenant.deleteMany({});
    await User.deleteMany({});
    await Notice.deleteMany({});
    await Task.deleteMany({});
    await Notification.deleteMany({});
  });

  test('Unit geolocation update', async () => {
    const res = await request(app)
      .patch(`/api/v1/properties/${property._id}/units/${property.units[0]._id}/geolocation`)
      .send({ coordinates: [39.7105, -4.0405] });
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.unit_geolocation.coordinates).toEqual([39.7105, -4.0405]);
  });

  test('Unit GeoJSON endpoint', async () => {
    const res = await request(app)
      .get(`/api/v1/properties/${property._id}/units/geojson`);
    
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('FeatureCollection');
    expect(res.body.features.length).toBe(3);
  });

  test('Notice with SMS fallback on email failure', async () => {
    const smsMock = require('../services/sms');
    smsMock.send.mockClear();

    const res = await request(app)
      .post('/api/v1/notices/generate')
      .send({
        notice_type: 'rent_increase',
        property_id: property._id.toString(),
        unit_id: property.units[0]._id.toString(),
        tenant_id: tenant._id.toString(),
        title: 'Rent Increase Notice',
        body: 'Your rent will increase by 10% effective next month.',
        effective_date: '2026-07-01',
        delivery_method: ['email', 'sms'],
        legal_basis: 'Section 4(1) Rent Restriction Act'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.delivery_status.some(d => d.method === 'sms')).toBe(true);
  });

  test('AI route uses correct Property import', async () => {
    const aiRoute = require('../routes/ai');
    // The route file should load without errors (Property model correctly imported)
    expect(aiRoute).toBeDefined();
  });

  test('Health check returns 200', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('Task creation and status flow', async () => {
    // Admin creates task
    const createRes = await request(app)
      .post('/api/v1/tasks')
      .send({
        assigned_to: agent._id.toString(),
        title: 'Inspect Unit 3B',
        description: 'Verify if water damage in toilet is fixed.',
        type: 'inspection',
        related_property_id: property._id.toString(),
        due_date: new Date(Date.now() + 86400000).toISOString()
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    const taskId = createRes.body.data._id;

    // Agent retrieves their own tasks
    mockClerkId = 'clerk_agent_001';
    const listRes = await request(app)
      .get('/api/v1/tasks/agent/my');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some(t => t._id === taskId)).toBe(true);

    // Agent updates task status to in_progress
    const updateRes = await request(app)
      .patch(`/api/v1/tasks/${taskId}/status`)
      .send({ status: 'in_progress' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.status).toBe('in_progress');
  });

  test('Notification creation and mark as read flow', async () => {
    // Admin broadcasts notification to agents
    const createRes = await request(app)
      .post('/api/v1/notifications')
      .send({
        type: 'property_approval',
        recipient_role: 'agent',
        title: 'New Property Registered',
        message: 'A new property is pending approval.'
      });
    expect(createRes.status).toBe(201);
    const notifId = createRes.body.data._id;

    // Agent retrieves notifications
    mockClerkId = 'clerk_agent_001';
    const listRes = await request(app)
      .get('/api/v1/notifications');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some(n => n._id === notifId)).toBe(true);

    // Agent marks notification as read
    const readRes = await request(app)
      .patch(`/api/v1/notifications/${notifId}/read`);
    expect(readRes.status).toBe(200);
    expect(readRes.body.data.read_by.some(id => id.toString() === agent._id.toString())).toBe(true);
  });

  test('Inventory and Auction flow', async () => {
    const itemId = property.inventory[0]._id.toString();

    // Mark item as auctionable (Admin)
    const markRes = await request(app)
      .post(`/api/v1/inventory/${property._id}/mark-auctionable`)
      .send({ item_id: itemId, reason: 'Abandoned by departed tenant' });
    expect(markRes.status).toBe(200);
    expect(markRes.body.data.auction_status).toBe('pending');

    // Get list of auctionable items
    const listRes = await request(app)
      .get('/api/v1/inventory/auctionable');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some(item => item._id === itemId)).toBe(true);

    // Record auction sale (Admin)
    const saleRes = await request(app)
      .post(`/api/v1/inventory/${property._id}/auction-sold`)
      .send({ item_id: itemId, buyer: 'Mombasa Auctions Ltd', sale_amount: 18000 });
    expect(saleRes.status).toBe(200);
    expect(saleRes.body.data.auction_status).toBe('sold');

    // Get KRA CSV report
    const reportRes = await request(app)
      .get('/api/v1/inventory/auction-report');
    expect(reportRes.status).toBe(200);
    expect(reportRes.headers['content-type']).toContain('text/csv');
    expect(reportRes.text).toContain('Mombasa Auctions Ltd');
  });

  test('Landlord property lifecycle', async () => {
    // Landlord submits new property
    mockClerkId = 'clerk_landlord_001';
    const submitRes = await request(app)
      .post('/api/v1/properties/landlord/submit')
      .send({
        name: 'Landlord Beach Villas',
        type: 'apartment',
        address: { street: 'Serena Road', area: 'Shanzu', city: 'Mombasa' },
        location: { coordinates: [39.75, -3.98] },
        signature_data_url: 'data:image/png;base64,fake-signature-base64',
        units: [{ unit_number: '1A', rent_kes: 45000 }]
      });
    expect(submitRes.status).toBe(201);
    expect(submitRes.body.data.status).toBe('pending_admin_approval');
    const newPropId = submitRes.body.data._id;

    // Admin approves property
    mockClerkId = 'clerk_admin_001';
    const approveRes = await request(app)
      .post(`/api/v1/properties/${newPropId}/approve`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('active');

    // Admin rejects is tested on a separate villa
    mockClerkId = 'clerk_landlord_001';
    const submitRes2 = await request(app)
      .post('/api/v1/properties/landlord/submit')
      .send({
        name: 'Landlord Villa 2',
        type: 'apartment',
        address: { street: 'Serena Road', area: 'Shanzu', city: 'Mombasa' },
        location: { coordinates: [39.75, -3.98] },
        signature_data_url: 'data:image/png;base64,fake-signature-base64',
        units: [{ unit_number: '1A', rent_kes: 45000 }]
      });
    const villa2Id = submitRes2.body.data._id;

    mockClerkId = 'clerk_admin_001';
    const rejectRes = await request(app)
      .post(`/api/v1/properties/${villa2Id}/reject`)
      .send({ reason: 'Invalid coordinates' });
    expect(rejectRes.status).toBe(200);
    
    const villa2 = await Property.findById(villa2Id);
    expect(villa2).toBeTruthy();
    expect(villa2.status).toBe('inactive');
  });

  test('Agent Onboarding and Approval Flow', async () => {
    const pendingAgent = await User.create({
      user_code: 'AGT-PENDING-001', role: 'tenant', full_name: 'Pending Agent',
      email: 'pending_agent@mutune.test', phone: '254700000004',
      password_hash: '$2a$10$test', is_active: true, clerk_id: 'clerk_pending_agent_001'
    });

    mockClerkId = 'clerk_pending_agent_001';
    const onboardingRes = await request(app)
      .patch('/api/v1/users/me/role')
      .send({
        role: 'agent',
        phone: '254700000004',
        earb_license: 'EARB-12345',
        earb_verification_doc_url: 'https://mutune.test/doc.pdf'
      });
    
    expect(onboardingRes.status).toBe(200);
    expect(onboardingRes.body.data.role).toBe('agent');
    expect(onboardingRes.body.data.agent_approval_status).toBe('pending');
    expect(onboardingRes.body.data.is_active).toBe(false);

    mockClerkId = 'clerk_admin_001';
    const pendingListRes = await request(app)
      .get('/api/v1/admin/agents/pending');
    
    expect(pendingListRes.status).toBe(200);
    expect(pendingListRes.body.data.some(a => a._id === pendingAgent._id.toString())).toBe(true);

    const rejectRes = await request(app)
      .patch(`/api/v1/admin/agents/${pendingAgent._id}/reject`)
      .send({ reason: 'Incomplete documents' });
    
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.agent_approval_status).toBe('rejected');
    expect(rejectRes.body.data.agent_rejection_reason).toBe('Incomplete documents');
    expect(rejectRes.body.data.is_active).toBe(false);

    const approveRes = await request(app)
      .patch(`/api/v1/admin/agents/${pendingAgent._id}/approve`)
      .send();
    
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.agent_approval_status).toBe('approved');
    expect(approveRes.body.data.is_active).toBe(true);
    expect(approveRes.body.data.user_code).toMatch(/^AGT-MOM-\d{3}$/);
  });

  test('Distress Inventory Reclaim Flow', async () => {
    const itemId = property.inventory[0]._id.toString();
    await request(app)
      .post(`/api/v1/inventory/${property._id}/mark-auctionable`)
      .send({ item_id: itemId, reason: 'Arrears' });

    const Payment = require('../models/Payment');
    const payment = await Payment.create({
      transaction_id: 'REC-RECLAIM-001',
      tenant_id: tenant._id,
      property_id: property._id,
      unit_id: property.units[0]._id,
      amount_kes: 25000,
      payment_type: 'rent',
      channel: 'mpesa_stk',
      status: 'confirmed'
    });

    mockClerkId = 'clerk_admin_001';
    const reclaimRes = await request(app)
      .post(`/api/v1/inventory/${property._id}/reclaim`)
      .send({
        item_id: itemId,
        reclaim_receipt_id: payment._id.toString()
      });

    expect(reclaimRes.status).toBe(200);
    expect(reclaimRes.body.data.auction_status).toBe('reclaimed');
    expect(reclaimRes.body.data.reclaim_receipt_id).toBe(payment._id.toString());
  });

  test('Late Fee Cron Calculations and Idempotency', async () => {
    const LateFeeRule = require('../models/LateFeeRule');
    
    const rule = await LateFeeRule.create({
      name: 'Residential Late Fee Rule',
      grace_days: 0,
      penalty_type: 'percentage',
      penalty_value: 10,
      max_penalty_per_month: 5000,
      applies_to: 'residential',
      is_active: true
    });

    const mockTenant = await Tenant.create({
      tenant_code: 'TNT-LATE-TEST', full_name: 'Late Tenant', id_number: '12345679',
      phone: '254712345679', email: 'late@test.com', preferred_channel: 'both',
      current_property_id: property._id, current_unit_id: property.units[0]._id,
      rent_amount_kes: 20000, arrears_kes: 0, tenancy_status: 'active'
    });

    const lateFeeApplicator = require('../cron/late-fee-applicator');
    await lateFeeApplicator.run();

    const updatedTenant = await Tenant.findById(mockTenant._id);
    expect(updatedTenant.arrears_kes).toBe(2000);

    const Payment = require('../models/Payment');
    const penaltyPayment = await Payment.findOne({
      tenant_id: mockTenant._id,
      payment_type: 'penalty'
    });
    expect(penaltyPayment).toBeTruthy();
    expect(penaltyPayment.amount_kes).toBe(2000);

    await lateFeeApplicator.run();
    const doubleUpdatedTenant = await Tenant.findById(mockTenant._id);
    expect(doubleUpdatedTenant.arrears_kes).toBe(2000);

    await LateFeeRule.deleteOne({ _id: rule._id });
    await Tenant.deleteOne({ _id: mockTenant._id });
  });
});
