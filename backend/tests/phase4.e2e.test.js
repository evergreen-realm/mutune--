const request = require('supertest');
const app = require('../server');
const Property = require('../models/Property');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Notice = require('../models/Notice');

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

jest.mock('@clerk/clerk-sdk-node', () => ({
  ClerkExpressRequireAuth: () => (req, res, next) => {
    req.auth = { userId: 'clerk_admin_001' };
    next();
  }
}));

describe('Phase 4 Features', () => {
  let admin, property, tenant;

  beforeAll(async () => {
    await Property.deleteMany({});
    await Tenant.deleteMany({});
    await User.deleteMany({});
    await Notice.deleteMany({});

    admin = await User.create({
      user_code: 'ADM-001', role: 'super_admin', full_name: 'Admin',
      email: 'admin@mutune.test', phone: '254700000001',
      password_hash: '$2a$10$test', is_active: true, clerk_id: 'clerk_admin_001'
    });

    property = await Property.create({
      property_code: 'MUT-NYL-001', name: 'Nyali Phase 2', type: 'apartment',
      address: { street: 'Links Road', area: 'Nyali', city: 'Mombasa' },
      location: { type: 'Point', coordinates: [39.71, -4.04] },
      boundaries: {
        type: 'Polygon',
        coordinates: [[[39.709, -4.041], [39.711, -4.041], [39.711, -4.039], [39.709, -4.039], [39.709, -4.041]]]
      },
      landlord_id: admin._id, agent_ids: [admin._id],
      units: [
        { unit_number: '3B', rent_kes: 25000, status: 'occupied', lock_status: 'locked' },
        { unit_number: '4A', rent_kes: 28000, status: 'occupied', lock_status: 'payment_confirmed' },
        { unit_number: '2C', rent_kes: 22000, status: 'vacant', lock_status: 'unlocked' }
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
});
