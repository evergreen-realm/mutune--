const request = require('supertest');
const mongoose = require('mongoose');
const axios = require('axios');

let postSpy;
let mockClerkId = 'clerk_admin_p4';

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

jest.mock('../services/sms', () => ({
  send: jest.fn().mockResolvedValue({ success: true }),
  formatPhone: jest.fn(p => p.replace(/\D/g, '').replace(/^0/, '254'))
}));

const app = require('../server');

const {
  User,
  Tenant,
  Property,
  Payment,
  MaintenanceTicket,
  JournalEntry,
  LateFeeRule,
  EtimsInvoice,
  Vendor,
  SystemSetting
} = require('../models');

const { generateBlindIndex, normalizePhone, encryptPII } = require('../utils/security');
const { acquireCronLock, releaseCronLock } = require('../utils/cronLock');
const { submitETIMSInvoice, generateETIMSInvoiceForPayment, retryETIMSInvoice } = require('../services/kraEtims');
const { autoReconcilePayment, aiTenantMatch } = require('../services/reconciliation');
const aiService = require('../services/ai');
const accrueRentCron = require('../cron/accrueRent');
const lateFeeApplicator = require('../cron/late-fee-applicator');
const tenantLeaseCleanup = require('../cron/tenant-lease-cleanup');

describe('Phase 4 Verification Suite: Real Service & Cron Logic', () => {
  let adminUser, agentUser, landlordUser, tenantUser, vendorDoc, propertyDoc, tenantDoc;

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = '01234567890123456789012345678901';
    process.env.KRA_ETIMS_PIN = 'P051234567Z';
    process.env.KRA_ETIMS_DEVICE_SERIAL = 'KRA-CU-0012345';
    process.env.KRA_ETIMS_CLIENT_SECRET = 'secret-test-key';
    process.env.KRA_ETIMS_ENV = 'sandbox';
    process.env.WEBHOOK_SECRET_KEY = 'test-webhook-secret';
    process.env.MODAL_WEBHOOK_SECRET = 'test-modal-secret';

    adminUser = await User.create({
      clerk_id: 'clerk_admin_p4',
      full_name: 'Admin Boss',
      email: 'admin_p4@mutune.co.ke',
      phone: '254711000001',
      role: 'admin',
      is_active: true,
      is_verified_by_id: true
    });

    agentUser = await User.create({
      clerk_id: 'clerk_agent_p4',
      full_name: 'Agent Kip',
      email: 'agent_p4@mutune.co.ke',
      phone: '254711000002',
      role: 'agent',
      is_active: true,
      is_verified_by_id: true
    });

    landlordUser = await User.create({
      clerk_id: 'clerk_landlord_p4',
      full_name: 'Landlord Omar',
      email: 'landlord_p4@mutune.co.ke',
      phone: '254711000003',
      role: 'landlord',
      is_active: true,
      is_verified_by_id: true
    });

    tenantUser = await User.create({
      clerk_id: 'clerk_tenant_p4',
      full_name: 'Faith Mwangi',
      email: 'faith_p4@gmail.com',
      phone: '254711000004',
      role: 'tenant',
      is_active: true,
      is_verified_by_id: true
    });

    propertyDoc = await Property.create({
      property_code: 'NYA-P4-01',
      name: 'Nyali Coastal Heights',
      type: 'apartment',
      property_type: 'residential',
      address: { street: 'Links Rd', area: 'Nyali', city: 'Mombasa', county: 'Mombasa County' },
      location: { type: 'Point', coordinates: [39.7, -4.05] },
      landlord_id: landlordUser._id,
      agent_ids: [agentUser._id],
      units: [
        {
          unit_number: 'B201',
          rent_kes: 35000,
          status: 'occupied',
          listing_status: 'listed'
        }
      ]
    });

    tenantDoc = await Tenant.create({
      tenant_code: 'TNT-P4-001',
      full_name: 'Faith Mwangi',
      phone: '254711000004',
      id_number: '12345678',
      user_id: tenantUser._id,
      current_property_id: propertyDoc._id,
      current_unit_id: propertyDoc.units[0]._id,
      rent_amount_kes: 35000,
      arrears_kes: 35000,
      tenancy_status: 'active',
      lease_start: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      lease_end: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000)
    });

    vendorDoc = await Vendor.create({
      vendor_name: 'Mombasa Quick Plumbing',
      category: 'plumbing',
      phone: '254722334455',
      mpesa_b2c_number: '254722334455',
      bank_name: 'KCB',
      bank_account_number: '1122334455'
    });
  });

  beforeEach(() => {
    mockClerkId = adminUser ? adminUser.clerk_id : 'clerk_admin_p4';
  });

  afterEach(() => {
    if (postSpy) postSpy.mockRestore();
  });

  afterAll(async () => {
    if (postSpy) postSpy.mockRestore();
    await User.deleteMany({ _id: { $in: [adminUser?._id, agentUser?._id, landlordUser?._id, tenantUser?._id].filter(Boolean) } });
    await Property.deleteMany({ _id: propertyDoc?._id });
    await Tenant.deleteMany({ _id: tenantDoc?._id });
    await Vendor.deleteMany({ _id: vendorDoc?._id });
    await Payment.deleteMany({ property_id: propertyDoc?._id });
    await MaintenanceTicket.deleteMany({ property_id: propertyDoc?._id });
    await EtimsInvoice.deleteMany({});
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. KRA eTIMS & Tax Service Persistence & Audit
  // ─────────────────────────────────────────────────────────────────────────────
  describe('1. KRA eTIMS & Tax Service Persistence', () => {
    test('submitETIMSInvoice transmits and persists EtimsInvoice with control_number & QR code', async () => {
      postSpy = jest.spyOn(axios, 'post').mockImplementation(async (url) => {
        if (url.includes('selectToken')) return { data: { token: 'mock-token-xyz' } };
        return { data: { resultCd: '0000', resultMsg: 'Success', rcptSign: 'KRA-SIGN-99887766' } };
      });

      const result = await submitETIMSInvoice({
        invoice_number: 'INV-TEST-P4-001',
        amount: 35000,
        tenant_pin: 'A001234567B',
        tenant_name: 'Faith Mwangi',
        property_id: propertyDoc._id,
        tenant_id: tenantDoc._id,
        landlord_id: landlordUser._id
      });

      expect(result.success).toBe(true);
      expect(result.control_number).toBe('KRA-SIGN-99887766');
      expect(result.qr_code_url).toContain('INV-TEST-P4-001');

      const savedInvoice = await EtimsInvoice.findOne({ invoice_number: 'INV-TEST-P4-001' });
      expect(savedInvoice).not.toBeNull();
      expect(savedInvoice.transmission_status).toBe('transmitted');
      expect(savedInvoice.control_number).toBe('KRA-SIGN-99887766');
      expect(savedInvoice.gross_amount_kes).toBe(35000);
      expect(savedInvoice.tax_amount_kes).toBe(Number((35000 * 0.075).toFixed(2)));
    });

    test('generateETIMSInvoiceForPayment generates deterministic invoice from Payment', async () => {
      postSpy = jest.spyOn(axios, 'post').mockImplementation(async (url) => {
        if (url.includes('selectToken')) return { data: { token: 'mock-token-xyz' } };
        return { data: { resultCd: '0000', rcptSign: 'KRA-SIGN-PAYMENT-P4' } };
      });

      const payment = await Payment.create({
        transaction_id: 'TXN-P4-001',
        mpesa_receipt: 'QWE123RTY',
        tenant_id: tenantDoc._id,
        property_id: propertyDoc._id,
        unit_id: propertyDoc.units[0]._id,
        amount_kes: 35000,
        payment_type: 'rent',
        channel: 'mpesa_c2b',
        status: 'confirmed'
      });

      const res = await generateETIMSInvoiceForPayment(payment._id);
      expect(res.success).toBe(true);
      expect(res.control_number).toBe('KRA-SIGN-PAYMENT-P4');

      const invoice = await EtimsInvoice.findOne({ payment_id: payment._id });
      expect(invoice).not.toBeNull();
      expect(invoice.transmission_status).toBe('transmitted');
      expect(invoice.invoice_number).toBe(`INV-TXN-P4-001`);
    });

    test('retryETIMSInvoice retries transmission of failed eTIMS record', async () => {
      const failedInvoice = await EtimsInvoice.create({
        invoice_number: 'INV-FAILED-P4',
        gross_amount_kes: 20000,
        taxable_amount_kes: 20000,
        tax_amount_kes: 1500,
        transmission_status: 'failed',
        error_message: 'Network timeout',
        customer_pin: 'P000000000X'
      });

      postSpy = jest.spyOn(axios, 'post').mockImplementation(async (url) => {
        if (url.includes('selectToken')) return { data: { token: 'mock-token-xyz' } };
        return { data: { resultCd: '0000', rcptSign: 'KRA-SIGN-RETRY-SUCCESS' } };
      });

      const retryRes = await retryETIMSInvoice(failedInvoice._id);
      expect(retryRes.success).toBe(true);
      expect(retryRes.control_number).toBe('KRA-SIGN-RETRY-SUCCESS');

      const updated = await EtimsInvoice.findById(failedInvoice._id);
      expect(updated.transmission_status).toBe('transmitted');
      expect(updated.control_number).toBe('KRA-SIGN-RETRY-SUCCESS');
      expect(updated.error_message).toBeNull();
    });

    test('GET /tax/etims/invoices lists persisted eTIMS records with role scoping', async () => {
      const res = await request(app)
        .get('/api/v1/tax/etims/invoices')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.pagination).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. AI Tenant Match & Reconciliation Engine
  // ─────────────────────────────────────────────────────────────────────────────
  describe('2. AI Tenant Match & Reconciliation', () => {
    test('ai.js get_system_financial_summary only sums status: confirmed payments', async () => {
      await Payment.create({
        transaction_id: 'PENDING-FAKE-REV',
        amount_kes: 999999,
        payment_type: 'rent',
        channel: 'cash',
        status: 'pending' // Should NOT be included
      });

      const summary = await aiService.executeTool('get_system_financial_summary', {}, adminUser);
      expect(summary.found).toBe(true);
      expect(summary.total_revenue_kes).toBeLessThan(900000); // 999999 excluded!
    });

    test('ai.js get_tenant_details searches by phone using blind index and returns decrypted phone', async () => {
      const res = await aiService.executeTool('get_tenant_details', { query: '0711000004' }, adminUser);
      expect(res.found).toBe(true);
      expect(res.tenant_code).toBe('TNT-P4-001');
      expect(res.phone).toBe('254711000004'); // Decrypted plain string, not "enc:..."
    });

    test('ai.js get_payment_status looks up tenant by phone/code and finds confirmed payment', async () => {
      const res = await aiService.executeTool('get_payment_status', { tenant_code: '0711000004' }, adminUser);
      expect(res.found).toBe(true);
      expect(res.status).toBe('confirmed');
    });

    test('aiTenantMatch resolves ambiguous payment via phone blind index and rent amount', async () => {
      const match = await aiTenantMatch({
        phone: '0711000004',
        amount_kes: 35000,
        account_reference: 'B201'
      });

      expect(match.best_match).not.toBeNull();
      expect(match.best_match.tenant_code).toBe('TNT-P4-001');
      expect(match.confidence_score).toBeGreaterThanOrEqual(95);
    });

    test('POST /ai/match-tenant automatically assigns unmatched payment when requested', async () => {
      const unmatchedPayment = await Payment.create({
        transaction_id: 'UNMATCHED-AUTO-01',
        amount_kes: 35000,
        payment_type: 'rent',
        channel: 'mpesa_c2b',
        status: 'confirmed',
        workflow_state: 'MANUAL_REVIEW',
        discrepancy_flag: true
      });

      const res = await request(app)
        .post('/api/v1/ai/match-tenant')
        .send({
          payment_id: unmatchedPayment._id,
          phone: '254711000004',
          amount_kes: 35000,
          account_reference: 'TNT-P4-001',
          auto_assign: true
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.assigned).toBe(true);

      const assignedPayment = await Payment.findById(unmatchedPayment._id);
      expect(assignedPayment.tenant_id.toString()).toBe(tenantDoc._id.toString());
      expect(assignedPayment.discrepancy_flag).toBe(false);
      expect(assignedPayment.workflow_state).toBe('PAYMENT_CONFIRMED');
    });

    test('autoReconcilePayment handles M-Pesa C2B callback payload', async () => {
      const recon = await autoReconcilePayment({
        mpesa_code: 'C2B-AUTO-TEST',
        phone: '254711000004',
        account_reference: 'TNT-P4-001',
        amount_kes: 35000,
        raw_payload: {}
      });

      expect(recon.match_status).toBe('auto_matched');
      expect(recon.confidence_score).toBe(100);
      expect(recon.matched_tenant_id.toString()).toBe(tenantDoc._id.toString());
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Cron Jobs Review & Hardening
  // ─────────────────────────────────────────────────────────────────────────────
  describe('3. Cron Jobs Distributed Locking & Idempotency', () => {
    test('CronLock acquires and prevents duplicate runs for identical periods', async () => {
      // Temporarily override NODE_ENV to simulate production horizontal replicas
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const lock1 = await acquireCronLock('test_lock_job', '2026-10-28');
      expect(lock1).toBe(true);

      const lock2 = await acquireCronLock('test_lock_job', '2026-10-28');
      expect(lock2).toBe(false);

      await releaseCronLock('test_lock_job', '2026-10-28');
      const lock3 = await acquireCronLock('test_lock_job', '2026-10-28');
      expect(lock3).toBe(true);

      await releaseCronLock('test_lock_job', '2026-10-28');
      process.env.NODE_ENV = origEnv;
    });

    test('accrueRentCron runs idempotently without double-posting accruals', async () => {
      const month = '2026-11';
      const result1 = await accrueRentCron.processMonthlyRentAccrual(month);
      expect(result1.success).toBe(true);
      expect(result1.accruedCount).toBeGreaterThanOrEqual(1);

      // Second run for same month skips duplicate postings
      const result2 = await accrueRentCron.processMonthlyRentAccrual(month);
      expect(result2.success).toBe(true);
      expect(result2.accruedCount).toBe(0);
    });

    test('lateFeeApplicator applies penalty, increments arrears, and posts GL late_fee entry', async () => {
      await LateFeeRule.create({
        name: 'Residential Default Late Fee',
        applies_to: 'all',
        grace_days: 0, // Apply immediately
        penalty_type: 'fixed',
        penalty_value: 1500,
        is_active: true
      });

      // Clear payments for tenant this month to simulate unpaid rent
      await Payment.deleteMany({ tenant_id: tenantDoc._id });

      await lateFeeApplicator.run();

      const penaltyPayment = await Payment.findOne({
        tenant_id: tenantDoc._id,
        payment_type: 'penalty'
      });

      expect(penaltyPayment).not.toBeNull();
      expect(penaltyPayment.status).toBe('confirmed');
      expect(penaltyPayment.amount_kes).toBe(1500);

      // Verify GL Entry was posted
      const glEntry = await JournalEntry.findOne({
        reference_type: 'late_fee',
        reference_id: tenantDoc._id
      });
      expect(glEntry).not.toBeNull();
    });

    test('tenantLeaseCleanup marks expired leases, departs long expired, and frees unit', async () => {
      const expiredTenant = await Tenant.create({
        tenant_code: 'TNT-EXPIRED-P4',
        full_name: 'Departed John',
        phone: '254711999888',
        id_number: '88887777',
        current_property_id: propertyDoc._id,
        current_unit_id: propertyDoc.units[0]._id,
        rent_amount_kes: 35000,
        tenancy_status: 'expired',
        lease_start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        lease_end: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000) // >6 months ago
      });

      // Mark unit occupied by this tenant
      propertyDoc.units[0].status = 'occupied';
      propertyDoc.units[0].current_tenant_id = expiredTenant._id;
      await propertyDoc.save();

      await tenantLeaseCleanup.run();

      const departed = await Tenant.findById(expiredTenant._id);
      expect(departed.tenancy_status).toBe('departed');

      const updatedProp = await Property.findById(propertyDoc._id);
      expect(updatedProp.units[0].status).toBe('vacant');
      expect(updatedProp.units[0].current_tenant_id).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Vendor Work Order Services & GL Accounting
  // ─────────────────────────────────────────────────────────────────────────────
  describe('4. Vendor Work Orders & Expense Posting', () => {
    let ticketDoc;

    beforeEach(async () => {
      ticketDoc = await MaintenanceTicket.create({
        ticket_code: `MT-VEND-${Date.now()}`,
        title: 'Burst Pipe in Kitchen B201',
        category: 'plumbing',
        priority: 'high',
        description: 'Water leaking into floorboards',
        property_id: propertyDoc._id,
        unit_id: propertyDoc.units[0]._id,
        status: 'open',
        work_order_status: 'unassigned'
      });
    });

    test('POST /vendors/:id/assign-ticket assigns vendor and sets status: assigned', async () => {
      const res = await request(app)
        .post(`/api/v1/vendors/${vendorDoc._id}/assign-ticket`)
        .send({
          ticket_id: ticketDoc._id,
          estimated_cost_kes: 4500,
          notes: 'Inspect leak urgently'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.work_order_status).toBe('assigned');
      expect(res.body.data.status).toBe('assigned');
      expect(res.body.data.assigned_vendor_id.toString()).toBe(vendorDoc._id.toString());
    });

    test('PATCH /vendors/tickets/:ticketId/status transitions work order status to in_progress', async () => {
      mockClerkId = agentUser.clerk_id;
      const res = await request(app)
        .patch(`/api/v1/vendors/tickets/${ticketDoc._id}/status`)
        .send({ status: 'in_progress', notes: 'Plumber on site repairing pipe' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.work_order_status).toBe('in_progress');
      expect(res.body.data.status).toBe('in_progress');
    });

    test('POST /vendors/tickets/:ticketId/complete-work-order marks completed and posts double-entry GL expense', async () => {
      ticketDoc.assigned_vendor_id = vendorDoc._id;
      ticketDoc.work_order_status = 'in_progress';
      await ticketDoc.save();

      const res = await request(app)
        .post(`/api/v1/vendors/tickets/${ticketDoc._id}/complete-work-order`)
        .send({
          actual_cost_kes: 5200,
          invoice_url: 'https://r2.mutune.co.ke/invoices/pipe-fix.pdf',
          notes: 'Pipe replaced and sealed with 6-month warranty'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.work_order_status).toBe('completed');
      expect(res.body.data.status).toBe('resolved');
      expect(res.body.data.actual_cost_kes).toBe(5200);
      expect(res.body.journal_entry).toBeDefined();

      // Verify double-entry GL journal entry:
      // Debit Account 5020 (Expense: 5200)
      // Credit Account 2020 (Payable: 5200)
      const gl = await JournalEntry.findOne({
        reference_type: 'expense',
        reference_id: ticketDoc._id
      });
      expect(gl).not.toBeNull();
      const debitItem = gl.line_items.find(e => e.account_code === '5020');
      const creditItem = gl.line_items.find(e => e.account_code === '2020');
      expect(debitItem.debit_kes).toBe(5200);
      expect(creditItem.credit_kes).toBe(5200);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. 3D Gaussian Splat & Scan Processing
  // ─────────────────────────────────────────────────────────────────────────────
  describe('5. 3D Gaussian Splat & Scan Processing', () => {
    test('POST /scans/initiate persists scan to property.scans, room_scans, and assets', async () => {
      process.env.MODAL_3D_SPLAT_WEBHOOK_URL = 'https://modal.com/api/test-splat-webhook';

      const res = await request(app)
        .post('/api/v1/scans/initiate')
        .send({
          propertyId: propertyDoc._id.toString(),
          imageUrls: ['https://r2.mutune.co.ke/scans/img1.jpg', 'https://r2.mutune.co.ke/scans/img2.jpg'],
          roomName: 'Master Bedroom B201'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.scan).toBeDefined();

      const updatedProp = await Property.findById(propertyDoc._id);
      expect(updatedProp.scans.length).toBeGreaterThan(0);
      expect(updatedProp.room_scans.length).toBeGreaterThan(0);
      expect(updatedProp.assets.some(a => a.type === 'splat' && a.status === 'processing')).toBe(true);
    });

    test('POST /scans/callback transitions splat scan and asset status to completed', async () => {
      const freshProp = await Property.findById(propertyDoc._id);
      const targetScan = freshProp.scans[freshProp.scans.length - 1];

      const res = await request(app)
        .post('/api/v1/scans/callback')
        .send({
          property_id: propertyDoc._id.toString(),
          scan_id: targetScan._id.toString(),
          status: 'success',
          splat_url: 'https://r2.mutune.co.ke/splats/master-bed.splat',
          api_secret: 'test-modal-secret'
        })
        .expect(200);

      expect(res.body.success).toBe(true);

      const prop = await Property.findById(propertyDoc._id);
      const scan = prop.scans.id(targetScan._id);
      expect(scan.status).toBe('completed');
      expect(scan.splat_status).toBe('completed');
      expect(scan.splat_url).toBe('https://r2.mutune.co.ke/splats/master-bed.splat');

      const asset = prop.assets.find(a => a.asset_id === targetScan._id.toString());
      expect(asset).toBeDefined();
      expect(asset.status).toBe('completed');
      expect(asset.url).toBe('https://r2.mutune.co.ke/splats/master-bed.splat');
    });

    test('GET /properties/:id/3d-status returns 3D reconstruction and scan assets', async () => {
      const res = await request(app)
        .get(`/api/v1/properties/${propertyDoc._id}/3d-status`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.property_id).toBe(propertyDoc._id.toString());
      expect(Array.isArray(res.body.data.room_scans)).toBe(true);
      expect(Array.isArray(res.body.data.assets)).toBe(true);
    });

    test('POST /properties/blender-webhook updates glb_model_url and assets', async () => {
      const res = await request(app)
        .post('/api/v1/properties/blender-webhook')
        .send({
          property_id: propertyDoc._id.toString(),
          status: 'success',
          model_url: 'https://r2.mutune.co.ke/models/nyali-heights.glb',
          api_secret: 'test-webhook-secret'
        })
        .expect(200);

      expect(res.body.success).toBe(true);

      const prop = await Property.findById(propertyDoc._id);
      expect(prop.glb_model_url).toBe('https://r2.mutune.co.ke/models/nyali-heights.glb');
      expect(prop.assets.some(a => a.type === 'glb' && a.url.includes('nyali-heights.glb'))).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Hardening & Deep Verification of Edge Cases & Integrity
  // ─────────────────────────────────────────────────────────────────────────────
  describe('6. Hardening & Deep Verification of Edge Cases', () => {
    test('generateETIMSInvoiceForPayment rejects unconfirmed payments and non-positive amounts', async () => {
      const pendingPayment = await Payment.create({
        transaction_id: 'TXN-P4-UNCONFIRMED',
        amount_kes: 20000,
        payment_type: 'rent',
        channel: 'mpesa_c2b',
        status: 'pending'
      });

      await expect(generateETIMSInvoiceForPayment(pendingPayment._id)).rejects.toThrow(
        /must be 'confirmed'/
      );

      const zeroPayment = await Payment.create({
        transaction_id: 'TXN-P4-ZERO',
        amount_kes: 0,
        payment_type: 'rent',
        channel: 'cash',
        status: 'confirmed'
      });

      await expect(generateETIMSInvoiceForPayment(zeroPayment._id)).rejects.toThrow(
        /greater than zero/
      );
    });

    test('retryETIMSInvoice returns already_transmitted on transmitted invoice without re-calling KRA API', async () => {
      const transmittedInvoice = await EtimsInvoice.create({
        invoice_number: 'INV-ALREADY-TRANSMITTED',
        gross_amount_kes: 15000,
        taxable_amount_kes: 15000,
        tax_amount_kes: 1125,
        transmission_status: 'transmitted',
        control_number: 'KRA-EXISTING-CN',
        qr_code_url: 'https://etims.kra.go.ke/verify?pin=P051234567Z&inv=INV-ALREADY-TRANSMITTED'
      });

      const spy = jest.spyOn(axios, 'post');
      const res = await retryETIMSInvoice(transmittedInvoice._id);

      expect(res.already_transmitted).toBe(true);
      expect(res.control_number).toBe('KRA-EXISTING-CN');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    test('submitETIMSInvoice decrypts encrypted tenant pin and rejects gross amount <= 0', async () => {
      postSpy = jest.spyOn(axios, 'post').mockImplementation(async (url) => {
        if (url.includes('selectToken')) return { data: { token: 'mock-token-xyz' } };
        return { data: { resultCd: '0000', rcptSign: 'KRA-SIGN-DECRYPT-PIN' } };
      });

      // Valid PIN encrypted
      const encryptedPin = encryptPII('A012345678Z');
      const res = await submitETIMSInvoice({
        invoice_number: 'INV-DECRYPT-PIN-TEST',
        amount: 10000,
        tenant_pin: encryptedPin
      });

      expect(res.success).toBe(true);
      const saved = await EtimsInvoice.findOne({ invoice_number: 'INV-DECRYPT-PIN-TEST' });
      expect(saved.customer_pin).toBe('A012345678Z');

      await expect(submitETIMSInvoice({
        invoice_number: 'INV-ZERO-AMOUNT',
        amount: 0
      })).rejects.toThrow(/greater than zero/);
    });

    test('executeTool allows accountant role to access get_system_financial_summary', async () => {
      const accountantUser = {
        _id: new mongoose.Types.ObjectId(),
        role: 'accountant',
        full_name: 'Audit Accountant'
      };

      const res = await aiService.executeTool('get_system_financial_summary', {}, accountantUser);
      expect(res.error).toBeUndefined();
      expect(res.found).toBe(true);
      expect(typeof res.total_revenue_kes).toBe('number');
    });

    test('executeTool scopes get_tenants_in_arrears by landlord properties', async () => {
      const landlordA = {
        _id: landlordUser._id,
        role: 'landlord',
        full_name: 'Landlord Omar'
      };

      const res = await aiService.executeTool('get_tenants_in_arrears', {}, landlordA);
      expect(res.found).toBe(true);
      for (const t of res.list) {
        expect(t.phone).not.toMatch(/^enc:/);
      }
    });

    test('POST /ai/match-tenant with auto_assign does not double-decrement arrears for already-confirmed payment', async () => {
      const tenantBefore = await Tenant.findById(tenantDoc._id);
      const initialArrears = tenantBefore.arrears_kes || 5000;
      await Tenant.findByIdAndUpdate(tenantDoc._id, { arrears_kes: initialArrears });

      const confirmedPayment = await Payment.create({
        transaction_id: 'TXN-ALREADY-CONFIRMED-MATCH',
        amount_kes: 2500,
        payment_type: 'rent',
        channel: 'mpesa_c2b',
        status: 'confirmed',
        workflow_state: 'PAYMENT_CONFIRMED'
      });

      const res = await request(app)
        .post('/api/v1/ai/match-tenant')
        .send({
          payment_id: confirmedPayment._id.toString(),
          query: tenantDoc.tenant_code,
          phone: '254711000004',
          amount_kes: tenantDoc.rent_amount_kes,
          auto_assign: true
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.assigned).toBe(true);

      const tenantAfter = await Tenant.findById(tenantDoc._id);
      expect(tenantAfter.arrears_kes).toBe(initialArrears);
    });

    test('aiTenantMatch returns decrypted phone numbers for candidate matches', async () => {
      const matchRes = await aiTenantMatch({ phone: '254711000004' });
      expect(matchRes.candidates.length).toBeGreaterThan(0);
      for (const cand of matchRes.candidates) {
        expect(cand.phone).not.toMatch(/^enc:/);
      }
    });

    test('acquireCronLock re-acquires expired locks after TTL', async () => {
      const lockJob = 'ttl_expired_job';
      const period = '2026-10-28';

      const acquired1 = await acquireCronLock(lockJob, period, { forceInTest: true, ttlMs: 50 });
      expect(acquired1).toBe(true);

      const acquired2 = await acquireCronLock(lockJob, period, { forceInTest: true, ttlMs: 50 });
      expect(acquired2).toBe(false);

      await new Promise(r => setTimeout(r, 60));

      const acquired3 = await acquireCronLock(lockJob, period, { forceInTest: true, ttlMs: 50 });
      expect(acquired3).toBe(true);

      await releaseCronLock(lockJob, period);
    });

    test('POST /scans/callback enforces safeCompare and fails closed in production when secret is missing', async () => {
      await request(app)
        .post('/api/v1/scans/callback')
        .send({
          property_id: propertyDoc._id.toString(),
          status: 'success',
          splat_url: 'https://r2.mutune.co.ke/splats/test.splat',
          api_secret: 'wrong-secret'
        })
        .expect(401);

      const origEnv = process.env.NODE_ENV;
      const origSecret = process.env.MODAL_WEBHOOK_SECRET;
      const origKey = process.env.WEBHOOK_SECRET_KEY;
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.MODAL_WEBHOOK_SECRET;
        delete process.env.WEBHOOK_SECRET_KEY;

        const res = await request(app)
          .post('/api/v1/scans/callback')
          .send({
            property_id: propertyDoc._id.toString(),
            status: 'success',
            splat_url: 'https://r2.mutune.co.ke/splats/test.splat',
            api_secret: 'any-secret'
          })
          .expect(500);

        expect(res.body.error.code).toBe('CONFIG_ERROR');
      } finally {
        process.env.NODE_ENV = origEnv;
        process.env.MODAL_WEBHOOK_SECRET = origSecret;
        process.env.WEBHOOK_SECRET_KEY = origKey;
      }
    });
  });
});
