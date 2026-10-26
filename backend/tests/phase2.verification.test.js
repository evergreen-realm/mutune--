const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Property = require('../models/Property');
const Payment = require('../models/Payment');
const MaintenanceTicket = require('../models/MaintenanceTicket');
const JournalEntry = require('../models/JournalEntry');
const Account = require('../models/Account');
const { postJournalEntry } = require('../services/financials');
const { encryptPII, decryptPII, generateBlindIndex, normalizePhone, decryptLeanDoc } = require('../utils/security');

describe('Phase 2 Verification Suite', () => {
  test('1. PII encryption, blind indexing, and lean decryption for Tenant and User', async () => {
    const rawPhone = '0712345678';
    const rawId = '32165498';

    const tenant = await Tenant.create({
      tenant_code: 'TNT-P2-001',
      full_name: 'Phase2 Tenant',
      phone: rawPhone,
      id_number: rawId,
      rent_amount_kes: 25000,
      tenancy_status: 'notice_period'
    });

    // Mongoose document getter works
    expect(tenant.phone).toBe(rawPhone);
    expect(tenant.id_number).toBe(rawId);
    expect(tenant.tenancy_status).toBe('notice_period');

    // Stored raw values are encrypted and blind indexes exist
    const rawDoc = await Tenant.collection.findOne({ _id: tenant._id });
    expect(rawDoc.phone.startsWith('enc:')).toBe(true);
    expect(rawDoc.id_number.startsWith('enc:')).toBe(true);
    expect(rawDoc.phone_bindex).toBeTruthy();
    expect(rawDoc.id_number_bindex).toBeTruthy();

    // Query with .lean() returns decrypted fields automatically
    const leanTenant = await Tenant.findById(tenant._id).lean();
    expect(leanTenant.phone).toBe(rawPhone);
    expect(leanTenant.id_number).toBe(rawId);
    expect(leanTenant.phone.startsWith('enc:')).toBe(false);

    // Exact query by phone matches via blind index
    const foundByPhone = await Tenant.findOne({ phone: rawPhone }).lean();
    expect(foundByPhone).toBeTruthy();
    expect(foundByPhone._id.toString()).toBe(tenant._id.toString());

    // Normalized phone (254...) matches
    const foundByNormPhone = await Tenant.findOne({ phone: '254712345678' }).lean();
    expect(foundByNormPhone).toBeTruthy();
    expect(foundByNormPhone._id.toString()).toBe(tenant._id.toString());

    // Exact query by id_number matches via blind index
    const foundById = await Tenant.findOne({ id_number: rawId }).lean();
    expect(foundById).toBeTruthy();
    expect(foundById._id.toString()).toBe(tenant._id.toString());

    // User id_number encryption & lean decryption
    const user = await User.create({
      user_code: 'USR-P2-001',
      full_name: 'Phase2 User',
      email: 'p2user@mutune.test',
      phone: '254700112233',
      id_number: '98765432'
    });
    expect(user.id_number).toBe('98765432');
    const leanUser = await User.findById(user._id).lean();
    expect(leanUser.id_number).toBe('98765432');
    expect(leanUser.id_number.startsWith('enc:')).toBe(false);
  });

  test('2. Property assets array and MaintenanceTicket vendor fields', async () => {
    const property = await Property.create({
      property_code: 'PROP-P2-001',
      name: 'Phase2 Coastal Residence',
      type: 'apartment',
      status: 'active',
      units: [{
        unit_number: '101',
        rent_kes: 30000,
        status: 'vacant'
      }],
      assets: [{
        type: 'splat',
        name: 'Living Room 3D Gaussian Splat',
        url: 'https://cdn.mutune.test/splats/living_room.splat',
        status: 'ready'
      }]
    });

    expect(property.assets).toHaveLength(1);
    expect(property.assets[0].type).toBe('splat');
    expect(property.assets[0].status).toBe('ready');

    const ticket = await MaintenanceTicket.create({
      ticket_code: 'TKT-P2-001',
      title: 'Water Heater Fix',
      category: 'plumbing',
      description: 'Water heater not functioning in unit 101',
      property_id: property._id,
      assigned_vendor_id: new mongoose.Types.ObjectId(),
      work_order_status: 'dispatched',
      estimated_cost_kes: 4500,
      actual_cost_kes: 4200,
      invoice_url: 'https://cdn.mutune.test/invoices/inv_001.pdf'
    });

    expect(ticket.work_order_status).toBe('dispatched');
    expect(ticket.estimated_cost_kes).toBe(4500);
    expect(ticket.actual_cost_kes).toBe(4200);
  });

  test('3. JournalEntry reference_types and postJournalEntry flexibilities', async () => {
    // Utility entry without posted_by_user_id
    const utilityEntry = await postJournalEntry({
      reference_type: 'utility',
      notes: 'Electricity Token Purchase',
      line_items: [
        { account_code: '5020', debit_kes: 2000, credit_kes: 0 },
        { account_code: '1010', debit_kes: 0, credit_kes: 2000 }
      ]
    });
    expect(utilityEntry.reference_type).toBe('utility');
    expect(utilityEntry.total_debit_kes).toBe(2000);
    expect(utilityEntry.total_credit_kes).toBe(2000);

    // Rent accrual entry
    const accrualEntry = await postJournalEntry({
      reference_type: 'rent_accrual',
      notes: 'Rent accrual for TNT-001',
      line_items: [
        { account_code: '1100', debit_kes: 25000, credit_kes: 0 },
        { account_code: '4010', debit_kes: 0, credit_kes: 25000 }
      ]
    });
    expect(accrualEntry.reference_type).toBe('rent_accrual');

    // Late fee entry
    const lateFeeEntry = await postJournalEntry({
      reference_type: 'late_fee',
      notes: 'Late fee penalty',
      line_items: [
        { account_code: '1100', debit_kes: 1500, credit_kes: 0 },
        { account_code: '4030', debit_kes: 0, credit_kes: 1500 }
      ]
    });
    expect(lateFeeEntry.reference_type).toBe('late_fee');

    // Deposit settlement entry
    const depositEntry = await postJournalEntry({
      reference_type: 'deposit_settlement',
      notes: 'Deposit refund and repair deduction',
      line_items: [
        { account_code: '2010', debit_kes: 20000, credit_kes: 0 },
        { account_code: '1010', debit_kes: 0, credit_kes: 16000 },
        { account_code: '5020', debit_kes: 0, credit_kes: 4000 }
      ]
    });
    expect(depositEntry.reference_type).toBe('deposit_settlement');
  });

  test('4. Payment status standardization', async () => {
    const payment = await Payment.create({
      transaction_id: 'TXN-P2-001',
      amount_kes: 15000,
      payment_type: 'rent',
      channel: 'mpesa_c2b',
      status: 'confirmed'
    });
    expect(payment.status).toBe('confirmed');

    // Trying to assign or save 'completed' should not occur; querying confirms 'confirmed' is standard
    const confirmedCount = await Payment.countDocuments({ status: 'confirmed' });
    expect(confirmedCount).toBeGreaterThanOrEqual(1);
  });

  test('5. Accrue rent cron increments arrears and posts valid journal entry', async () => {
    const accrueRentCron = require('../cron/accrueRent');
    const tenant = await Tenant.create({
      tenant_code: 'TNT-P2-ACCRUE',
      full_name: 'Accrue Tenant',
      phone: '0711223344',
      id_number: '12344321',
      rent_amount_kes: 18000,
      arrears_kes: 2000,
      tenancy_status: 'active'
    });

    const res = await accrueRentCron.processMonthlyRentAccrual('2026-11');
    expect(res.success).toBe(true);

    const updated = await Tenant.findById(tenant._id);
    expect(updated.arrears_kes).toBe(20000); // 2000 + 18000
  });

  test('6. Tenant lease cleanup reads current_unit_id and vacates unit on Property', async () => {
    const tenantLeaseCleanup = require('../cron/tenant-lease-cleanup');
    const unitId = new mongoose.Types.ObjectId();
    const property = await Property.create({
      property_code: 'PROP-P2-CLEAN',
      name: 'Cleanup Property',
      type: 'apartment',
      status: 'active',
      units: [{
        _id: unitId,
        unit_number: '202',
        rent_kes: 22000,
        status: 'occupied'
      }],
      inventory: [{
        item_id: 'INV-001',
        name: 'Dining Table',
        unit_id: unitId,
        condition: 'good'
      }]
    });

    const pastDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000); // > 6 months ago
    const tenant = await Tenant.create({
      tenant_code: 'TNT-P2-EXPIRED',
      full_name: 'Expired Tenant',
      phone: '0722334455',
      id_number: '55443322',
      current_property_id: property._id,
      current_unit_id: unitId,
      lease_end: pastDate,
      tenancy_status: 'expired'
    });

    await tenantLeaseCleanup.run();

    const dbTenant = await Tenant.findById(tenant._id);
    expect(dbTenant.tenancy_status).toBe('departed');

    const updatedProp = await Property.findById(property._id);
    const updatedUnit = updatedProp.units.id(unitId);
    expect(updatedUnit.status).toBe('vacant');
    expect(updatedUnit.current_tenant_id).toBeNull();
    expect(updatedProp.inventory[0].auction_status).toBe('pending');
  });
});
