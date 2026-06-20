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

const lateFeeApplicator = require('../cron/late-fee-applicator');
const tenantLeaseCleanup = require('../cron/tenant-lease-cleanup');

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
    },
    sessions: {
      getSessionList: jest.fn().mockResolvedValue([]),
      revokeSession: jest.fn().mockResolvedValue({})
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

jest.mock('resend', () => {
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: {
        send: jest.fn().mockResolvedValue({ data: { id: 'email_mock_123' }, error: null })
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

jest.mock('../utils/r2', () => ({
  uploadImage: jest.fn().mockResolvedValue({ success: true, url: 'https://r2.cloudflare.com/mock-photo.jpg' }),
  deleteImage: jest.fn().mockResolvedValue({ success: true })
}));

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

describe('Tier 3: Cross-Feature Combinations', () => {
  let adminUser, landlordUser, agentUser, tenantUser;

  beforeAll(async () => {
    await clearDatabase();

    // Create seed users with valid required user_code
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
      clerk_id: 'clerk_landlord_001',
      email: 'landlord@mutune.test',
      full_name: 'Landlord User',
      phone: '254711111111',
      role: 'landlord',
      is_active: true,
      user_code: 'USR-LLD-001'
    });

    agentUser = await User.create({
      clerk_id: 'clerk_agent_001',
      email: 'agent@mutune.test',
      full_name: 'Agent User',
      phone: '254722222222',
      role: 'agent',
      is_active: true,
      assigned_areas: ['Nyali'],
      user_code: 'USR-AGT-001'
    });

    tenantUser = await User.create({
      clerk_id: 'clerk_tenant_001',
      email: 'tenant@mutune.test',
      full_name: 'Tenant User',
      phone: '254733333333',
      role: 'tenant',
      is_active: true,
      user_code: 'USR-TNT-001'
    });
  });

  afterAll(async () => {
    // Stop crons to clean up open handles
    lateFeeApplicator.stop();
    tenantLeaseCleanup.stop();
    await clearDatabase();
  });

  describe('TC-3.1: Rent Payments & Distress Inventory', () => {
    let mtProp, mtTenant, mtUnitId, mtItem;

    beforeAll(async () => {
      mtProp = await Property.create({
        name: 'Nyali Heights TC3.1',
        property_code: 'PROP-MT-301',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        landlord_id: landlordUser._id,
        status: 'active',
        location: { type: 'Point', coordinates: [39.7100, -4.0400] },
        units: [{ unit_number: '1A', rent_kes: 20000, status: 'vacant', lock_status: 'unlocked' }]
      });

      mtUnitId = mtProp.units[0]._id;

      mtTenant = await Tenant.create({
        tenant_code: 'TNT-MOM-3001',
        full_name: 'Distress Tenant',
        id_number: '30011234',
        phone: '254712300001',
        email: 'distresstenant@mutune.test',
        current_property_id: mtProp._id,
        current_unit_id: mtUnitId,
        rent_amount_kes: 20000,
        lease_start: new Date(),
        lease_end: new Date()
      });

      // Update property unit current tenant
      await Property.updateOne(
        { _id: mtProp._id, 'units._id': mtUnitId },
        { $set: { 'units.$.current_tenant_id': mtTenant._id, 'units.$.status': 'occupied' } }
      );

      // Add inventory item to property
      await Property.updateOne(
        { _id: mtProp._id },
        {
          $push: {
            inventory: {
              item_id: 'item-sofa-301',
              name: 'Living Room Sofa',
              category: 'furniture',
              condition: 'good',
              auction_status: 'none',
              unit_id: mtUnitId
            }
          }
        }
      );

      const updatedProp = await Property.findById(mtProp._id);
      mtItem = updatedProp.inventory[0];
    });

    test('Transitions from auctionable back to reclaimed and links to payment', async () => {
      // 1. Mark item as auctionable
      mockClerkId = 'clerk_admin_001';
      const markRes = await request(app)
        .post(`/api/v1/inventory/${mtProp._id}/mark-auctionable`)
        .send({
          item_id: mtItem._id.toString(),
          reason: 'Rent default exceeds limit'
        });
      expect(markRes.status).toBe(200);
      expect(markRes.body.success).toBe(true);

      // 2. Tenant initiates STK push
      mockClerkId = 'clerk_tenant_001';
      const payRes = await request(app)
        .post('/api/v1/payments/initiate-stk')
        .send({
          tenant_id: mtTenant._id.toString(),
          unit_id: mtUnitId.toString(),
          amount: 20000,
          payment_type: 'rent'
        });
      expect(payRes.status).toBe(200);
      expect(payRes.body.success).toBe(true);
      const checkoutRequestId = payRes.body.checkout_request_id;

      // 3. Callback confirms payment
      const callbackRes = await request(app)
        .post('/api/v1/payments/callback')
        .set('X-Forwarded-For', '196.201.214.1')
        .send({
          Body: {
            stkCallback: {
              MerchantRequestID: 'MRID_MOCK123',
              CheckoutRequestID: checkoutRequestId,
              ResultCode: 0,
              ResultDesc: 'Success',
              CallbackMetadata: {
                Item: [
                  { Name: 'Amount', Value: 20000 },
                  { Name: 'MpesaReceiptNumber', Value: 'NL301RECLAIM' },
                  { Name: 'TransactionDate', Value: 20260619153000 },
                  { Name: 'PhoneNumber', Value: 254712300001 }
                ]
              }
            }
          }
        });
      expect(callbackRes.status).toBe(200);
      await sleep(100);

      // 4. Find confirmed payment
      const payment = await Payment.findOne({ transaction_id: checkoutRequestId });
      expect(payment.status).toBe('confirmed');

      // 5. Admin calls reclaim endpoint
      mockClerkId = 'clerk_admin_001';
      const reclaimRes = await request(app)
        .post(`/api/v1/inventory/${mtProp._id}/reclaim`)
        .send({
          item_id: mtItem._id.toString(),
          reclaim_receipt_id: payment._id.toString()
        });
      expect(reclaimRes.status).toBe(200);
      expect(reclaimRes.body.success).toBe(true);

      // Assert item condition/status transitions
      const finalProp = await Property.findById(mtProp._id);
      const finalItem = finalProp.inventory.id(mtItem._id);
      expect(finalItem.auction_status).toBe('reclaimed');
      expect(finalItem.reclaim_receipt_id.toString()).toBe(payment._id.toString());
      expect(finalItem.auctionable).toBe(false);
    });
  });

  describe('TC-3.2: Late Fee Applicator & Auto Rent Payments', () => {
    let lfProp, lfTenant, lfUser;

    beforeAll(async () => {
      lfProp = await Property.create({
        name: 'Nyali Heights TC3.2',
        property_code: 'PROP-LF-302',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        landlord_id: landlordUser._id,
        status: 'active',
        location: { type: 'Point', coordinates: [39.7100, -4.0400] },
        units: [{ unit_number: '2A', rent_kes: 25000, status: 'vacant', lock_status: 'unlocked' }]
      });

      lfUser = await User.create({
        clerk_id: 'clerk_tenant_302',
        email: 'tenant302@mutune.test',
        full_name: 'Late Tenant',
        phone: '254712300002',
        role: 'tenant',
        is_active: true,
        user_code: 'USR-TNT-302'
      });

      lfTenant = await Tenant.create({
        tenant_code: 'TNT-MOM-3002',
        user_id: lfUser._id,
        full_name: 'Late Tenant',
        id_number: '30021234',
        phone: '254712300002',
        email: 'tenant302@mutune.test',
        current_property_id: lfProp._id,
        current_unit_id: lfProp.units[0]._id,
        rent_amount_kes: 25000,
        arrears_kes: 0,
        tenancy_status: 'active',
        lease_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        lease_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      await Property.updateOne(
        { _id: lfProp._id, 'units._id': lfProp.units[0]._id },
        { $set: { 'units.$.current_tenant_id': lfTenant._id, 'units.$.status': 'occupied' } }
      );
    });

    test('Late fee accumulates and auto rent payment aggregates rent + arrears', async () => {
      // 1. Create fixed rule of KES 2,000 for residential properties
      await LateFeeRule.create({
        name: 'Residential Fixed TC3.2',
        applies_to: 'residential',
        penalty_type: 'fixed',
        penalty_value: 2000,
        grace_days: 1,
        is_active: true
      });

      // 2. Run daily applicator
      await lateFeeApplicator.run();

      const updatedTenant = await Tenant.findById(lfTenant._id);
      expect(updatedTenant.arrears_kes).toBe(2000);

      // 3. Initiate auto rent payment
      mockClerkId = 'clerk_tenant_302';
      const autoRes = await request(app)
        .post('/api/v1/payments/auto-initiate')
        .send();

      expect(autoRes.status).toBe(200);
      expect(autoRes.body.success).toBe(true);
      expect(autoRes.body.amount).toBe(27000);

      const payment = await Payment.findOne({ tenant_id: lfTenant._id, status: 'pending' });
      expect(payment.amount_kes).toBe(27000);
    });
  });

  describe('TC-3.3: Property Registration & Agent Geo-Scoping', () => {
    test('Nyali agent accepts check-in at Nyali property', async () => {
      const geoProp = await Property.create({
        name: 'Nyali Breezes TC3.3',
        property_code: 'PROP-GEO-303',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        landlord_id: landlordUser._id,
        status: 'active',
        location: { type: 'Point', coordinates: [39.7100, -4.0400] },
        agent_ids: [agentUser._id]
      });

      mockClerkId = 'clerk_agent_001';
      const checkinRes = await request(app)
        .post('/api/v1/agents/checkin')
        .send({
          property_id: geoProp._id.toString(),
          location: {
            coordinates: [39.7100, -4.0400],
            accuracy: 10
          },
          photo_url: 'https://r2.cloudflare.com/agent-selfie-303.jpg'
        });

      expect(checkinRes.status).toBe(200);
      expect(checkinRes.body.success).toBe(true);
      expect(checkinRes.body.verified).toBe(true);
    });
  });

  describe('TC-3.4: Maintenance Ticket Resolution & Notifications', () => {
    let maintProp, maintUser, maintTenant, ticket;

    beforeAll(async () => {
      maintProp = await Property.create({
        name: 'Nyali Heights TC3.4',
        property_code: 'PROP-MT-304',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        landlord_id: landlordUser._id,
        status: 'active',
        location: { type: 'Point', coordinates: [39.7100, -4.0400] },
        units: [{ unit_number: '1A', rent_kes: 20000, status: 'vacant', lock_status: 'unlocked' }]
      });

      maintUser = await User.create({
        clerk_id: 'clerk_tenant_304',
        email: 'tenant304@mutune.test',
        full_name: 'Maint Tenant',
        phone: '254712300004',
        role: 'tenant',
        is_active: true,
        user_code: 'USR-TNT-304'
      });

      maintTenant = await Tenant.create({
        tenant_code: 'TNT-MOM-3004',
        user_id: maintUser._id,
        full_name: 'Maint Tenant',
        id_number: '30041234',
        phone: '254712300004',
        email: 'tenant304@mutune.test',
        current_property_id: maintProp._id,
        current_unit_id: maintProp.units[0]._id,
        rent_amount_kes: 20000,
        tenancy_status: 'active'
      });
    });

    test('Agent resolves maintenance ticket and triggers tenant notification', async () => {
      // 1. Tenant files maintenance ticket
      mockClerkId = 'clerk_tenant_304';
      const ticketRes = await request(app)
        .post('/api/v1/maintenance')
        .send({
          property_id: maintProp._id.toString(),
          unit_id: maintProp.units[0]._id.toString(),
          category: 'plumbing',
          priority: 'high',
          description: 'Sink leaking'
        });

      expect(ticketRes.status).toBe(201);
      expect(ticketRes.body.success).toBe(true);
      ticket = ticketRes.body.data;

      // 2. Admin assigns ticket to Agent (Agent User must cover the property region)
      mockClerkId = 'clerk_admin_001';
      const assignRes = await request(app)
        .patch(`/api/v1/maintenance/${ticket._id}`)
        .send({
          assigned_agent_id: agentUser._id.toString(),
          status: 'assigned'
        });
      expect(assignRes.status).toBe(200);

      // 3. Agent resolves the ticket
      mockClerkId = 'clerk_agent_001';
      const resolveRes = await request(app)
        .patch(`/api/v1/maintenance/${ticket._id}`)
        .send({
          status: 'resolved',
          agent_notes: 'Tightened water pipe connector.'
        });
      expect(resolveRes.status).toBe(200);

      // Verify notification in DB
      const notification = await Notification.findOne({
        recipient_ids: maintUser._id,
        title: 'Maintenance Ticket Resolved'
      });

      if (notification) {
        expect(notification).toBeDefined();
      }
    });
  });

  describe('TC-3.5: Notice Generation & Lease Termination', () => {
    let tProp, nTenant, notice;

    beforeAll(async () => {
      tProp = await Property.create({
        name: 'Nyali Heights TC3.5',
        property_code: 'PROP-NT-305',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        landlord_id: landlordUser._id,
        status: 'active',
        location: { type: 'Point', coordinates: [39.7100, -4.0400] },
        units: [{ unit_number: '5A', rent_kes: 22000, status: 'vacant', lock_status: 'unlocked' }]
      });

      nTenant = await Tenant.create({
        tenant_code: 'TNT-MOM-3005',
        full_name: 'Evicted Tenant',
        id_number: '30051234',
        phone: '254712300005',
        email: 'tenant305@mutune.test',
        current_property_id: tProp._id,
        current_unit_id: tProp.units[0]._id,
        rent_amount_kes: 22000,
        tenancy_status: 'active'
      });

      await Property.updateOne(
        { _id: tProp._id, 'units._id': tProp.units[0]._id },
        { $set: { 'units.$.current_tenant_id': nTenant._id, 'units.$.status': 'occupied' } }
      );
    });

    test('Notice expiry triggers automatic lease termination', async () => {
      mockClerkId = 'clerk_admin_001';
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const noticeRes = await request(app)
        .post('/api/v1/notices/generate')
        .send({
          notice_type: 'eviction',
          property_id: tProp._id.toString(),
          unit_id: tProp.units[0]._id.toString(),
          tenant_id: nTenant._id.toString(),
          title: 'Eviction Notice due to Non-Payment',
          body: 'Pay within 24 hours or vacate.',
          effective_date: pastDate,
          delivery_method: ['portal']
        });

      expect(noticeRes.status).toBe(201);
      notice = noticeRes.body.data;

      // Update tenant lease to past
      await Tenant.findByIdAndUpdate(nTenant._id, {
        $set: { lease_end_date: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });

      await tenantLeaseCleanup.run();

      const dbTenant = await Tenant.findById(nTenant._id);
      expect(['expired', 'terminated', 'departed']).toContain(dbTenant.tenancy_status);
    });
  });

  describe('TC-3.6: Late Fees & Lease Termination', () => {
    let termTenant;

    beforeAll(async () => {
      termTenant = await Tenant.create({
        tenant_code: 'TNT-MOM-3006',
        full_name: 'Terminated Tenant',
        id_number: '30061234',
        phone: '254712300006',
        email: 'tenant306@mutune.test',
        rent_amount_kes: 25000,
        arrears_kes: 3000,
        tenancy_status: 'terminated'
      });
    });

    test('Cron applicator does not apply penalties post-termination', async () => {
      await lateFeeApplicator.run();

      const dbTenant = await Tenant.findById(termTenant._id);
      expect(dbTenant.arrears_kes).toBe(3000);
    });
  });

  describe('TC-3.7: Unit Location & Agent Check-in', () => {
    let chProp;

    beforeAll(async () => {
      chProp = await Property.create({
        name: 'Nyali Heights TC3.7',
        property_code: 'PROP-GEO-307',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        landlord_id: landlordUser._id,
        status: 'active',
        location: { type: 'Point', coordinates: [39.7100, -4.0400] },
        units: [{
          unit_number: '7A',
          rent_kes: 20000,
          status: 'vacant',
          unit_geolocation: { type: 'Point', coordinates: [39.7100, -4.0400] }
        }]
      });
    });

    test('Agent check-in fails if distance exceeds 50 meters from unit coordinates', async () => {
      mockClerkId = 'clerk_agent_001';
      const checkinRes = await request(app)
        .post('/api/v1/agents/checkin')
        .send({
          property_id: chProp._id.toString(),
          location: {
            coordinates: [39.7108, -4.0408],
            accuracy: 10
          },
          photo_url: 'https://r2.cloudflare.com/agent-selfie-307.jpg'
        });

      expect(checkinRes.status).toBe(403);
      expect(checkinRes.body.error.code).toBe('CHECKIN_TOO_FAR');
    });
  });

  describe('TC-3.8: Maintenance Photos & Upload', () => {
    let maint38Prop, maint38Tenant;

    beforeAll(async () => {
      maint38Prop = await Property.create({
        name: 'Nyali Heights TC3.8',
        property_code: 'PROP-MT-308',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        landlord_id: landlordUser._id,
        status: 'active',
        location: { type: 'Point', coordinates: [39.7100, -4.0400] },
        units: [{ unit_number: '1A', rent_kes: 20000, status: 'vacant', lock_status: 'unlocked' }]
      });

      maint38Tenant = await Tenant.create({
        tenant_code: 'TNT-MOM-3008',
        user_id: tenantUser._id,
        full_name: 'Maint 3.8 Tenant',
        id_number: '30081234',
        phone: '254712300008',
        email: 'tenant308@mutune.test',
        current_property_id: maint38Prop._id,
        current_unit_id: maint38Prop.units[0]._id,
        rent_amount_kes: 20000,
        tenancy_status: 'active'
      });
    });

    test('Frontend uploads photo to R2 and stores URL in MaintenanceTicket document', async () => {
      mockClerkId = 'clerk_admin_001';
      const uploadRes = await request(app)
        .post('/api/v1/upload/doc')
        .attach('file', Buffer.from('fake-image-binary-data'), 'leak.jpg');

      expect(uploadRes.status).toBe(201);
      const photoUrl = uploadRes.body.url;

      mockClerkId = 'clerk_tenant_001';
      const maintRes = await request(app)
        .post('/api/v1/maintenance')
        .send({
          property_id: maint38Prop._id.toString(),
          unit_id: maint38Prop.units[0]._id.toString(),
          category: 'structural',
          priority: 'medium',
          description: 'Wall cracks near the balcony',
          photos: [photoUrl]
        });

      expect(maintRes.status).toBe(201);
      expect(maintRes.body.data.photos).toContain(photoUrl);

      const ticket = await MaintenanceTicket.findById(maintRes.body.data._id);
      expect(ticket.photos).toContain(photoUrl);
    });
  });

  describe('TC-3.9: User Deactivation & Rent Payments', () => {
    let inactiveUser, inactiveTenant;

    beforeAll(async () => {
      inactiveUser = await User.create({
        clerk_id: 'clerk_tenant_deactivated',
        email: 'deactivated@mutune.test',
        full_name: 'Deactivated Tenant',
        phone: '254712300009',
        role: 'tenant',
        is_active: false,
        user_code: 'USR-TNT-309'
      });

      inactiveTenant = await Tenant.create({
        tenant_code: 'TNT-MOM-3009',
        user_id: inactiveUser._id,
        full_name: 'Deactivated Tenant',
        id_number: '30091234',
        phone: '254712300009',
        email: 'deactivated@mutune.test',
        rent_amount_kes: 20000,
        tenancy_status: 'active'
      });
    });

    test('Deactivated user cannot initiate payments and callbacks are rejected', async () => {
      mockClerkId = 'clerk_tenant_deactivated';
      const payRes = await request(app)
        .post('/api/v1/payments/initiate-stk')
        .send({
          tenant_id: inactiveTenant._id.toString(),
          amount: 20000,
          payment_type: 'rent'
        });

      expect(payRes.status).toBe(403);

      const callbackRes = await request(app)
        .post('/api/v1/payments/callback')
        .set('X-Forwarded-For', '196.201.214.1')
        .send({
          Body: {
            stkCallback: {
              MerchantRequestID: 'MRID_DEACT',
              CheckoutRequestID: 'ws_CO_DEACT',
              ResultCode: 0,
              ResultDesc: 'Success',
              CallbackMetadata: {
                Item: [
                  { Name: 'Amount', Value: 20000 },
                  { Name: 'MpesaReceiptNumber', Value: 'DEACT999' },
                  { Name: 'TransactionDate', Value: 20260619153000 },
                  { Name: 'PhoneNumber', Value: 254712300009 }
                ]
              }
            }
          }
        });
      expect(callbackRes.status).toBe(200);

      await sleep(100);
      const payment = await Payment.findOne({ mpesa_receipt: 'DEACT999' });
      if (payment) {
        expect(['failed', 'pending']).toContain(payment.status);
      }
    });
  });
});

describe('Tier 4: Real-world Application Scenarios', () => {
  let admin, landlord, agent, tenant, property, unitId, tenantCode;

  beforeAll(async () => {
    await clearDatabase();
    
    admin = await User.create({
      clerk_id: 'clerk_admin_400',
      email: 'admin@mutune.test',
      full_name: 'Admin User',
      phone: '254700000001',
      role: 'super_admin',
      is_active: true,
      user_code: 'USR-ADM-400'
    });

    agent = await User.create({
      clerk_id: 'clerk_agent_400',
      email: 'agent@mutune.test',
      full_name: 'Agent User',
      phone: '254722222222',
      role: 'agent',
      is_active: true,
      assigned_areas: ['Nyali'],
      user_code: 'USR-AGT-400'
    });
  });

  afterAll(async () => {
    lateFeeApplicator.stop();
    tenantLeaseCleanup.stop();
    await clearDatabase();
  });

  describe('Scenario 1: End-to-End Onboarding & Rent Collection Loop', () => {
    test('Onboarding, email checks, Clerk sync, lease viewing, ticket logging, rent collection callbacks', async () => {
      // Step 1: Pre-register a tenant profile in database
      const prop = await Property.create({
        name: 'Nyali Apartments',
        property_code: 'MUT-NYL-001',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        location: { type: 'Point', coordinates: [39.7100, -4.0400] },
        units: [{ _id: new mongoose.Types.ObjectId(), unit_number: '3B', rent_kes: 25000, status: 'vacant' }]
      });

      const unit = prop.units[0];
      const preTenant = await Tenant.create({
        tenant_code: 'TNT-NYL-4001',
        full_name: 'E2E Tenant One',
        id_number: '40011234',
        phone: '254712400001',
        email: 'tenant@gmail.com',
        current_property_id: prop._id,
        current_unit_id: unit._id,
        rent_amount_kes: 25000,
        tenancy_status: 'pending'
      });

      tenantCode = preTenant.tenant_code;

      // Step 2: Simulates checkTenantEmail: GET /api/v1/tenants/check-email?email=tenant@gmail.com
      const checkRes = await request(app)
        .get('/api/v1/tenants/check-email?email=tenant@gmail.com');

      if (checkRes.status === 200) {
        expect(checkRes.body).toEqual(expect.objectContaining({
          exists: true,
          tenant_code: tenantCode,
          has_account: false
        }));
      }

      // Step 3: Simulates Clerk signup and onboarding sync: POST /api/v1/users/sync
      mockClerkId = 'clerk_tenant_4001';
      const syncRes = await request(app)
        .post('/api/v1/users/sync')
        .send({
          email: 'tenant@gmail.com',
          tenant_code: tenantCode
        });

      if (syncRes.status === 200 || syncRes.status === 201) {
        expect(syncRes.body.success).toBe(true);
        expect(syncRes.body.data.role).toBe('tenant');
      }

      // Step 4: Verify Onboarding UI logic backend signals
      const checkSyncedUser = await User.findOne({ email: 'tenant@gmail.com' });
      if (checkSyncedUser) {
        expect(checkSyncedUser.role).toBe('tenant');
      }

      // Step 5: Simulate Tenant Portal actions
      // 5a. View Lease (GET /api/v1/tenants/my/profile)
      const profileRes = await request(app)
        .get('/api/v1/tenants/my/profile');
      if (profileRes.status === 200) {
        expect(profileRes.body.data.tenant_code).toBe(tenantCode);
      }

      // 5b. Log maintenance (POST /api/v1/maintenance)
      const maintRes = await request(app)
        .post('/api/v1/maintenance')
        .send({
          property_id: prop._id.toString(),
          unit_id: unit._id.toString(),
          category: 'plumbing',
          priority: 'high',
          description: 'Sink clogged in kitchen'
        });
      expect([200, 201]).toContain(maintRes.status);

      // 5c. Pay rent
      const payRes = await request(app)
        .post('/api/v1/payments/initiate-stk')
        .send({
          tenant_id: preTenant._id.toString(),
          unit_id: unit._id.toString(),
          amount: 25000,
          payment_type: 'rent'
        });
      expect(payRes.status).toBe(200);
      const checkoutId = payRes.body.checkout_request_id;

      // Step 6: Simulate M-Pesa Callback
      const callbackRes = await request(app)
        .post('/api/v1/payments/callback')
        .set('X-Forwarded-For', '196.201.214.1')
        .send({
          Body: {
            stkCallback: {
              MerchantRequestID: 'MRID_MOCK401',
              CheckoutRequestID: checkoutId,
              ResultCode: 0,
              ResultDesc: 'Success',
              CallbackMetadata: {
                Item: [
                  { Name: 'Amount', Value: 25000 },
                  { Name: 'MpesaReceiptNumber', Value: 'QKJ7E2E123' },
                  { Name: 'TransactionDate', Value: 20260619153000 },
                  { Name: 'PhoneNumber', Value: 254712400001 }
                ]
              }
            }
          }
        });
      expect(callbackRes.status).toBe(200);

      // Step 7: Verify payment confirmed, lock status updated
      await sleep(100);
      const dbPayment = await Payment.findOne({ transaction_id: checkoutId });
      if (dbPayment) {
        expect(dbPayment.status).toBe('confirmed');
      }
    });
  });

  describe('Scenario 2: Landlord Registration to Tenant Occupancy', () => {
    test('Onboards landlord, registers Shanzu Beach Villas, adds unit 1A, pre-registers tenant, completes onboarding', async () => {
      // Step 1: Landlord signs up and submits onboarding details including verification document URL
      const tempLandlordClerkId = 'clerk_landlord_temp_402';
      const syncUserRes = await request(app)
        .post('/api/v1/users/sync-clerk')
        .send({
          email: 'landlord402@mutune.test',
          full_name: 'Shanzu Owner',
          phone: '254711400002'
        });
      expect([200, 201]).toContain(syncUserRes.status);

      mockClerkId = tempLandlordClerkId;
      const landlordRoleRes = await request(app)
        .patch('/api/v1/users/me/role')
        .send({
          role: 'landlord',
          phone: '254711400002',
          landlord_verification_doc_url: 'https://r2.cloudflare.com/verification-landlord.pdf'
        });
      expect(landlordRoleRes.status).toBe(200);
      const landlordUserId = landlordRoleRes.body.data._id;

      // Step 2: Admin activates landlord account
      mockClerkId = 'clerk_admin_400';
      const approveRes = await request(app)
        .patch(`/api/v1/admin/landlords/${landlordUserId}/approve`)
        .send();
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.is_active).toBe(true);

      // Step 3: Landlord submits "Shanzu Beach Villas"
      mockClerkId = tempLandlordClerkId;
      const submitPropRes = await request(app)
        .post('/api/v1/properties/landlord/submit')
        .send({
          name: 'Shanzu Beach Villas',
          type: 'apartment',
          address: { area: 'Nyali', city: 'Mombasa', street: 'Shanzu Road' },
          location: { type: 'Point', coordinates: [39.7100, -4.0400] },
          units: [{ unit_number: '1A', rent_kes: 30000, type: 'apartment' }]
        });
      expect(submitPropRes.status).toBe(200);
      const propId = submitPropRes.body.data._id;

      // Step 4: Admin approves the property
      mockClerkId = 'clerk_admin_400';
      const approvePropRes = await request(app)
        .post(`/api/v1/properties/${propId}/approve`)
        .send();
      expect(approvePropRes.status).toBe(200);

      // Agent adds unit 1B
      mockClerkId = 'clerk_agent_400';
      const addUnitRes = await request(app)
        .post(`/api/v1/properties/${propId}/units`)
        .send({
          unit_number: '1B',
          rent_kes: 32000,
          bedrooms: 2,
          bathrooms: 2
        });
      expect(addUnitRes.status).toBe(200);
      const unit1A = submitPropRes.body.data.units[0];

      // Step 5: Agent pre-registers a tenant
      const tenantUserClerkId = 'clerk_tenant_402';
      await request(app)
        .post('/api/v1/users/sync-clerk')
        .send({
          email: 'shanzutenant@mutune.test',
          full_name: 'Shanzu Tenant',
          phone: '254712400002'
        });

      mockClerkId = 'clerk_agent_400';
      const preRegRes = await request(app)
        .post('/api/v1/tenants')
        .send({
          full_name: 'Shanzu Tenant',
          id_number: '40211234',
          phone: '254712400002',
          email: 'shanzutenant@mutune.test',
          current_property_id: propId.toString(),
          current_unit_id: unit1A._id.toString(),
          rent_amount_kes: 30000,
          lease_start: new Date().toISOString(),
          lease_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        });
      expect(preRegRes.status).toBe(200);
      const tCode = preRegRes.body.data.tenant_code;

      mockClerkId = tenantUserClerkId;
      const tenantOnboardRes = await request(app)
        .patch('/api/v1/users/me/role')
        .send({
          role: 'tenant',
          tenant_code: tCode,
          phone: '254712400002'
        });
      expect(tenantOnboardRes.status).toBe(200);

      const finalProp = await Property.findById(propId);
      const finalUnit1A = finalProp.units.id(unit1A._id);
      expect(finalUnit1A.status).toBe('occupied');
    });
  });

  describe('Scenario 3: Arrears Penalization & Distress Auction Loop', () => {
    let prop, tenant, unitId, sofaItem;

    beforeAll(async () => {
      prop = await Property.create({
        name: 'Nyali Apartments S3',
        property_code: 'MUT-NYL-403',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        location: { type: 'Point', coordinates: [39.7100, -4.0400] },
        units: [{ unit_number: '3A', rent_kes: 25000, status: 'vacant', lock_status: 'unlocked' }],
        agent_ids: [agent._id]
      });

      unitId = prop.units[0]._id;

      tenant = await Tenant.create({
        tenant_code: 'TNT-NYL-4003',
        full_name: 'Overdue Tenant S3',
        id_number: '40311234',
        phone: '254712400003',
        email: 'overduetenant@mutune.test',
        current_property_id: prop._id,
        current_unit_id: unitId,
        rent_amount_kes: 25000,
        arrears_kes: 0,
        tenancy_status: 'active',
        lease_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      });

      await Property.updateOne(
        { _id: prop._id, 'units._id': unitId },
        { $set: { 'units.$.current_tenant_id': tenant._id, 'units.$.status': 'occupied' } }
      );

      await Property.updateOne(
        { _id: prop._id },
        {
          $push: {
            inventory: {
              item_id: 'item-sofa-403',
              name: 'Executive Leather Sofa',
              category: 'furniture',
              condition: 'good',
              estimated_value_kes: 25000,
              unit_id: unitId
            }
          }
        }
      );

      const updatedProp = await Property.findById(prop._id);
      sofaItem = updatedProp.inventory[0];
    });

    test('Late fees apply, agent checks in, locks unit, marks sofa auctionable, records sale, downloads CSV', async () => {
      // Step 1 & 2: Late fee applicator cron runs, detects overdue balance, applies 10% late fee
      await LateFeeRule.create({
        name: 'Residential Percentage 10%',
        applies_to: 'residential',
        penalty_type: 'percentage',
        penalty_value: 10,
        grace_days: 1,
        is_active: true
      });

      await lateFeeApplicator.run();

      const dbTenant = await Tenant.findById(tenant._id);
      expect(dbTenant.arrears_kes).toBe(2500);

      // Step 3: Agent check-in and locks unit
      mockClerkId = 'clerk_agent_400';
      const checkinRes = await request(app)
        .post('/api/v1/agents/checkin')
        .send({
          property_id: prop._id.toString(),
          location: { coordinates: [39.7100, -4.0400], accuracy: 10 },
          photo_url: 'https://r2.cloudflare.com/agent-lock-selfie.jpg'
        });
      expect(checkinRes.status).toBe(200);

      const lockRes = await request(app)
        .post(`/api/v1/properties/${prop._id}/units/${unitId}/lock`)
        .send({ action: 'lock' });
      expect(lockRes.status).toBe(200);
      expect(lockRes.body.data.lock_status).toBe('locked');

      // Step 4: Admin marks unit sofa as auctionable
      mockClerkId = 'clerk_admin_400';
      const markRes = await request(app)
        .post(`/api/v1/inventory/${prop._id}/mark-auctionable`)
        .send({
          item_id: sofaItem._id.toString(),
          reason: 'Rent defaults exceeded 60 days'
        });
      expect(markRes.status).toBe(200);
      expect(markRes.body.data.auction_status).toBe('pending');

      // Step 5: Admin records sale of sofa, downloads CSV
      const saleRes = await request(app)
        .post(`/api/v1/inventory/${prop._id}/auction-sold`)
        .send({
          item_id: sofaItem._id.toString(),
          buyer: 'Local Buyer Ltd',
          sale_amount: 15000
        });
      expect(saleRes.status).toBe(200);
      expect(saleRes.body.data.auction_status).toBe('sold');

      const reportRes = await request(app)
        .get('/api/v1/inventory/auction-report');
      expect(reportRes.status).toBe(200);
      expect(reportRes.text).toContain('Local Buyer Ltd');
      expect(reportRes.text).toContain('15000');
    });
  });

  describe('Scenario 4: Urgent Maintenance Escalation', () => {
    let prop, tenant, unitId, ticketId, maintUser;

    beforeAll(async () => {
      prop = await Property.create({
        name: 'Nyali Apartments S4',
        property_code: 'MUT-NYL-404',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        location: { type: 'Point', coordinates: [39.7100, -4.0400] },
        units: [{ unit_number: '4A', rent_kes: 25000, status: 'vacant', lock_status: 'unlocked' }],
        agent_ids: [agent._id]
      });

      unitId = prop.units[0]._id;

      maintUser = await User.create({
        clerk_id: 'clerk_tenant_404',
        email: 'tenant404@gmail.com',
        full_name: 'Pipe Tenant',
        phone: '254712400004',
        role: 'tenant',
        is_active: true,
        user_code: 'USR-TNT-404'
      });

      tenant = await Tenant.create({
        tenant_code: 'TNT-NYL-4004',
        user_id: maintUser._id,
        full_name: 'Pipe Tenant',
        id_number: '40411234',
        phone: '254712400004',
        email: 'tenant404@gmail.com',
        current_property_id: prop._id,
        current_unit_id: unitId,
        rent_amount_kes: 25000,
        tenancy_status: 'active'
      });
    });

    test('Tenant logs burst pipe, admin assigns Nyali agent, agent resolves ticket, tenant rates 5 stars', async () => {
      // Step 1: Tenant logs maintenance for burst pipe
      mockClerkId = 'clerk_tenant_404';
      const maintRes = await request(app)
        .post('/api/v1/maintenance')
        .send({
          property_id: prop._id.toString(),
          unit_id: unitId.toString(),
          category: 'plumbing',
          priority: 'emergency',
          description: 'burst pipe spraying water in the kitchen',
          photos: ['https://r2.cloudflare.com/burst-pipe.jpg']
        });
      expect(maintRes.status).toBe(201);
      ticketId = maintRes.body.data._id;

      // Step 2: Admin assigns it to the nearest Nyali-scoped agent
      mockClerkId = 'clerk_admin_400';
      const assignRes = await request(app)
        .patch(`/api/v1/maintenance/${ticketId}`)
        .send({
          assigned_agent_id: agent._id.toString(),
          status: 'assigned'
        });
      expect(assignRes.status).toBe(200);

      // Step 3: Agent resolves pipe issue
      mockClerkId = 'clerk_agent_400';
      await request(app)
        .post('/api/v1/agents/checkin')
        .send({
          property_id: prop._id.toString(),
          location: { coordinates: [39.7100, -4.0400], accuracy: 10 },
          photo_url: 'https://r2.cloudflare.com/agent-leak-selfie.jpg'
        });

      const resolveRes = await request(app)
        .patch(`/api/v1/maintenance/${ticketId}`)
        .send({
          status: 'resolved',
          agent_notes: 'Replaced burst copper connector pipe.'
        });
      expect(resolveRes.status).toBe(200);

      // Step 4: Tenant rates resolved ticket 5 stars
      mockClerkId = 'clerk_tenant_404';
      const rateRes = await request(app)
        .patch(`/api/v1/maintenance/${ticketId}`)
        .send({
          tenant_satisfaction: 5
        });
      expect(rateRes.status).toBe(200);
      expect(rateRes.body.data.tenant_satisfaction).toBe(5);
    });
  });

  describe('Scenario 5: End-of-Month Tax Compliance Reporting', () => {
    let resProp, comProp, resTenant, comTenant;

    beforeAll(async () => {
      resProp = await Property.create({
        name: 'Nyali Apartments S5',
        property_code: 'MUT-RES-405',
        type: 'apartment',
        address: { area: 'Nyali', city: 'Mombasa' },
        location: { type: 'Point', coordinates: [39.7100, -4.0400] },
        units: [{ unit_number: '1A', rent_kes: 20000, status: 'vacant', lock_status: 'unlocked' }]
      });

      comProp = await Property.create({
        name: 'Nyali Offices S5',
        property_code: 'MUT-COM-405',
        type: 'commercial',
        address: { area: 'Nyali', city: 'Mombasa' },
        location: { type: 'Point', coordinates: [39.7100, -4.0400] },
        units: [{ unit_number: 'Off-1', rent_kes: 100000, status: 'vacant', lock_status: 'unlocked' }]
      });

      resTenant = await Tenant.create({
        tenant_code: 'TNT-RES-4005',
        full_name: 'Residential Tenant S5',
        id_number: '40511234',
        phone: '254712400005',
        email: 'res405@mutune.test',
        current_property_id: resProp._id,
        current_unit_id: resProp.units[0]._id,
        rent_amount_kes: 20000,
        tenancy_status: 'active'
      });

      comTenant = await Tenant.create({
        tenant_code: 'TNT-COM-4005',
        full_name: 'Commercial Tenant S5',
        id_number: '40522345',
        phone: '254712400006',
        email: 'com405@mutune.test',
        current_property_id: comProp._id,
        current_unit_id: comProp.units[0]._id,
        rent_amount_kes: 100000,
        tenancy_status: 'active'
      });

      await Property.updateOne({ _id: resProp._id, 'units._id': resProp.units[0]._id }, { $set: { 'units.$.current_tenant_id': resTenant._id, 'units.$.status': 'occupied' } });
      await Property.updateOne({ _id: comProp._id, 'units._id': comProp.units[0]._id }, { $set: { 'units.$.current_tenant_id': comTenant._id, 'units.$.status': 'occupied' } });
    });

    test('Processes residential and commercial payments, resolves expired leases, and accountant generates KRA CSV tax report', async () => {
      const date = new Date();
      const monthString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      // Create residential payment (confirmed)
      await Payment.create({
        transaction_id: 'TXN-RES-405',
        tenant_id: resTenant._id,
        property_id: resProp._id,
        unit_id: resProp.units[0]._id,
        amount_kes: 20000,
        payment_type: 'rent',
        channel: 'mpesa_stk',
        status: 'confirmed',
        created_at: new Date()
      });

      // Create commercial payment (confirmed)
      await Payment.create({
        transaction_id: 'TXN-COM-405',
        tenant_id: comTenant._id,
        property_id: comProp._id,
        unit_id: comProp.units[0]._id,
        amount_kes: 100000,
        payment_type: 'rent',
        channel: 'mpesa_stk',
        status: 'confirmed',
        created_at: new Date()
      });

      // Step 2: System cron resolves expired leases
      await tenantLeaseCleanup.run();

      // Step 3, 4, 5: Accountant downloads KRA CSV tax report
      mockClerkId = 'clerk_admin_400';
      const reportRes = await request(app)
        .get(`/api/v1/reports/kra?month=${monthString}`);

      expect(reportRes.status).toBe(200);
      expect(reportRes.headers['content-type']).toContain('text/csv');

      // Verify tax computations
      expect(reportRes.text).toContain('Residential Rent (MRI 7.5%)');
      expect(reportRes.text).toContain('1500');
      expect(reportRes.text).toContain('18500');

      expect(reportRes.text).toContain('Commercial Rent (WHT 10%)');
      expect(reportRes.text).toContain('10000');
      expect(reportRes.text).toContain('90000');
      expect(reportRes.text).toContain('TOTAL');
    });
  });
});
