const request = require('supertest');
const app = require('../server');
const Property = require('../models/Property');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const UtilityMeter = require('../models/UtilityMeter');
const UtilityReading = require('../models/UtilityReading');
const SystemSetting = require('../models/SystemSetting');

jest.setTimeout(30000);

let mockClerkId = 'clerk_admin_utilities_001';

jest.mock('@clerk/clerk-sdk-node', () => ({
  ClerkExpressRequireAuth: () => (req, res, next) => {
    req.auth = { userId: mockClerkId };
    next();
  },
  clerkClient: {
    users: {
      getUser: jest.fn().mockImplementation((id) => Promise.resolve({ id, publicMetadata: { role: 'admin' } }))
    }
  }
}));

describe('Utilities & MEWASCO Water E2E Integration Suite', () => {
  let adminUser;
  let testProperty;
  let testTenant;
  let testMeter;

  beforeAll(async () => {
    adminUser = await User.create({
      clerk_id: mockClerkId,
      email: 'admin.utilities@mutune.co.ke',
      full_name: 'Utilities Super Admin',
      role: 'super_admin'
    });

    testProperty = await Property.create({
      name: 'Mombasa Coastal Heights',
      property_code: 'MCH-001',
      type: 'apartment',
      address: { line1: 'Links Rd', area: 'Nyali', city: 'Mombasa', country: 'Kenya' },
      landlord_id: adminUser._id,
      units: [
        { unit_number: '1A', rent_kes: 30000, status: 'occupied' },
        { unit_number: '1B', rent_kes: 35000, status: 'vacant' }
      ]
    });

    testTenant = await Tenant.create({
      tenant_code: 'TNT-MOM-001',
      full_name: 'Mombasa Resident',
      phone: '254711223344',
      email: 'resident@nyali.co.ke',
      id_number: '11223344',
      rent_amount_kes: 30000,
      current_property_id: testProperty._id,
      current_unit_id: testProperty.units[0]._id,
      user_id: adminUser._id
    });
  });

  afterAll(async () => {
    await UtilityReading.deleteMany({});
    await UtilityMeter.deleteMany({});
    await Tenant.deleteMany({});
    await Property.deleteMany({});
    await User.deleteMany({});
    await SystemSetting.deleteMany({});
  });

  test('GET /api/v1/utilities/providers returns all supported providers', async () => {
    const res = await request(app).get('/api/v1/utilities/providers');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some(p => p.id === 'MOMBASA_WATER')).toBe(true);
  });

  test('POST /api/v1/utilities/water/calculate-bill computes tiered MEWASCO bill', async () => {
    const res = await request(app)
      .post('/api/v1/utilities/water/calculate-bill')
      .send({
        consumption_m3: 25,
        category: 'domestic',
        provider_id: 'MOMBASA_WATER'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.water_charge_kes).toBeGreaterThan(0);
    expect(res.body.data.sewer_charge_kes).toBeGreaterThan(0);
    expect(res.body.data.total_kes).toBe(res.body.data.water_charge_kes + res.body.data.sewer_charge_kes);
  });

  test('POST /api/v1/utilities/meters registers a water meter', async () => {
    const res = await request(app)
      .post('/api/v1/utilities/meters')
      .send({
        property_id: testProperty._id,
        unit_id: testProperty.units[0]._id,
        meter_type: 'water',
        provider: 'MOMBASA_WATER',
        token_number: 'MW-NYALI-100234',
        tariff_category: 'domestic'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token_number).toBe('MW-NYALI-100234');
    testMeter = res.body.data;
  });

  test('POST /api/v1/utilities/readings logs a single reading', async () => {
    const res = await request(app)
      .post('/api/v1/utilities/readings')
      .send({
        meter_id: testMeter._id,
        property_id: testProperty._id,
        unit_id: testProperty.units[0]._id,
        tenant_id: testTenant._id,
        billing_month: '2026-08',
        previous_reading: 100,
        current_reading: 125,
        rate_per_unit_kes: 60
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.consumption_units).toBe(25);
    expect(res.body.data.total_amount_kes).toBe(1500);
  });

  test('POST /api/v1/utilities/readings/bulk batch imports meter readings', async () => {
    const res = await request(app)
      .post('/api/v1/utilities/readings/bulk')
      .send({
        readings: [
          {
            meter_id: testMeter._id,
            property_id: testProperty._id,
            unit_id: testProperty.units[0]._id,
            tenant_id: testTenant._id,
            billing_month: '2026-07',
            previous_reading: 75,
            current_reading: 100,
            rate_per_unit_kes: 60
          },
          {
            meter_id: testMeter._id,
            property_id: testProperty._id,
            unit_id: testProperty.units[1]._id,
            billing_month: '2026-07',
            previous_reading: 50,
            current_reading: 70,
            rate_per_unit_kes: 50
          }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.imported).toBe(2);
    expect(res.body.data.failed).toBe(0);
  });

  test('GET /api/v1/utilities/water/analytics/:propertyId returns consumption trends', async () => {
    const res = await request(app)
      .get(`/api/v1/utilities/water/analytics/${testProperty._id}`)
      .query({ months: 6 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.property_id).toBe(String(testProperty._id));
    expect(Array.isArray(res.body.data.trend)).toBe(true);
    expect(res.body.data.total_readings).toBeGreaterThanOrEqual(1);
  });

  test('GET and PUT /api/v1/settings/mewasco-tariffs manages tariff tiers', async () => {
    const getRes = await request(app).get('/api/v1/settings/mewasco-tariffs');
    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.data.domestic).toBeDefined();

    const updateRes = await request(app)
      .put('/api/v1/settings/mewasco-tariffs')
      .send({
        tariffs: {
          ...getRes.body.data,
          sewerSurcharge: 0.80
        }
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
  });
});
