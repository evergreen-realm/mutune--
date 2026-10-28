const cron = require('node-cron');
const Tenant = require('../models/Tenant');
const Property = require('../models/Property');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { acquireCronLock } = require('../utils/cronLock');
const logger = require('../utils/logger');

/**
 * Tenant lease cleanup cron job — runs daily at 00:05 AM EAT (UTC+3).
 * 
 * Jobs performed:
 * 1. Marks tenants whose lease_end_date has passed as 'expired'.
 * 2. For tenants expired > 6 months ago, marks them 'departed' and deactivates their user account.
 * 3. Flags any inventory items in units vacated by departed tenants as auctionable & frees unit on Property.
 * 4. Creates admin notifications for any new expirations or departures.
 */
const runTenantLeaseCleanup = async () => {
  const hasLock = await acquireCronLock('tenant_lease_cleanup');
  if (!hasLock) {
    logger.info('Tenant lease cleanup cron lock already acquired by another container/worker for today, skipping duplicate execution');
    return { success: true, skipped: true, reason: 'Distributed lock held' };
  }

  logger.info('Tenant lease cleanup cron started (EAT UTC+3)');
  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

  try {
    // ── Step 1: Mark newly expired tenants ─────────────────────────────────
    const newlyExpired = await Tenant.find({
      tenancy_status: 'active',
      lease_end: { $lt: now }
    }).lean();

    if (newlyExpired.length > 0) {
      await Tenant.updateMany(
        { _id: { $in: newlyExpired.map(t => t._id) } },
        { $set: { tenancy_status: 'expired' } }
      );
      logger.info('Tenants marked expired', { count: newlyExpired.length });

      // Notify admins
      await Notification.create({
        type: 'payment_alert',
        recipient_role: 'admin',
        recipient_ids: [],
        title: `${newlyExpired.length} Lease(s) Expired`,
        message: `${newlyExpired.length} tenant lease(s) have expired and require follow-up. Check the Tenants page for details.`,
        related_entity_id: null
      });
    }

    // ── Step 2: Depart tenants expired for over 6 months ───────────────────
    const longExpired = await Tenant.find({
      tenancy_status: 'expired',
      lease_end: { $lt: sixMonthsAgo }
    }).lean();

    for (const tenant of longExpired) {
      // Mark departed
      await Tenant.findByIdAndUpdate(tenant._id, {
        $set: {
          tenancy_status: 'departed',
          departed_at: now
        }
      });

      // Deactivate their user account
      if (tenant.user_id) {
        await User.findByIdAndUpdate(tenant.user_id, {
          $set: { is_active: false }
        });
      }

      // ── Step 3: Flag inventory items in their vacated unit as auctionable & vacate unit
      const targetUnitId = tenant.current_unit_id || tenant.unit_id;
      if (tenant.current_property_id && targetUnitId) {
        const property = await Property.findById(tenant.current_property_id);
        if (property) {
          let changed = false;
          const unit = property.units?.id(targetUnitId);
          if (unit && unit.status !== 'vacant') {
            unit.status = 'vacant';
            unit.current_tenant_id = null;
            changed = true;
          }
          for (const item of property.inventory || []) {
            if (
              item.unit_id &&
              item.unit_id.toString() === targetUnitId.toString() &&
              (!item.auction_status || item.auction_status === 'pending') &&
              !item.auctionable_marked_at
            ) {
              item.auction_status = 'pending';
              item.auctionable_marked_at = now;
              item.auctionable_reason = `Auto-flagged: tenant departed after lease expiry (${tenant.full_name})`;
              changed = true;
            }
          }
          if (changed) await property.save();
        }
      }
    }

    if (longExpired.length > 0) {
      logger.info('Tenants marked departed', { count: longExpired.length });

      await Notification.create({
        type: 'payment_alert',
        recipient_role: 'admin',
        recipient_ids: [],
        title: `${longExpired.length} Tenant(s) Auto-Departed`,
        message: `${longExpired.length} tenant(s) with leases expired over 6 months ago have been marked as departed and their accounts deactivated. Inventory items in their units have been flagged for auction.`,
        related_entity_id: null
      });
    }

    logger.info('Tenant lease cleanup cron completed', {
      newlyExpired: newlyExpired.length,
      departed: longExpired.length,
      timestamp_eat: now.toISOString()
    });

    return {
      success: true,
      newlyExpired: newlyExpired.length,
      departed: longExpired.length
    };
  } catch (error) {
    logger.error('Tenant lease cleanup cron failed', { message: error.message, stack: error.stack });
    throw error;
  }
};

const tenantLeaseCleanup = cron.schedule('5 0 * * *', runTenantLeaseCleanup, {
  scheduled: false, // Started manually in server.js after DB connection
  timezone: 'Africa/Nairobi'
});

tenantLeaseCleanup.run = runTenantLeaseCleanup;

module.exports = tenantLeaseCleanup;
