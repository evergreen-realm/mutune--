'use strict';
const SystemSetting = require('../models/SystemSetting');
const logger = require('./logger');

/**
 * Distributed Cron Locking Utility for Horizontal Scalability (Multi-pod/Replica).
 * Uses atomic MongoDB upserts on SystemSetting collection to guarantee exactly-once
 * execution of scheduled batch jobs across East Africa Time (UTC+3) schedules.
 */
async function acquireCronLock(jobName, periodKey = null, options = {}) {
  const isTest = process.env.NODE_ENV === 'test';
  const shouldEnforce = options.forceInTest || process.env.ENABLE_TEST_CRON_LOCK === 'true' || !isTest;

  if (!shouldEnforce) {
    return true;
  }

  const keySuffix = periodKey || new Date().toISOString().split('T')[0];
  const lockKey = `cron_lock_${jobName}_${keySuffix}`;
  const now = Date.now();
  const ttlMs = options.ttlMs || (30 * 60 * 1000); // 30 minutes default TTL

  try {
    const existing = await SystemSetting.findOneAndUpdate(
      { key: lockKey },
      {
        $setOnInsert: {
          key: lockKey,
          value: JSON.stringify({
            acquired_at: new Date(now).toISOString(),
            pid: process.pid,
            hostname: process.env.HOSTNAME || 'localhost',
            job: jobName,
            period: keySuffix
          }),
          description: `Distributed execution lock for cron job ${jobName} (${keySuffix})`,
          updated_at: new Date(now)
        }
      },
      { upsert: true, new: false }
    );

    if (!existing) {
      logger.info(`Acquired distributed cron lock: ${lockKey}`, { jobName, period: keySuffix, pid: process.pid });
      return true;
    }

    // Check if existing lock has expired beyond TTL
    let isExpired = false;
    try {
      const val = typeof existing.value === 'string' ? JSON.parse(existing.value) : existing.value;
      const acquiredTime = new Date(val?.acquired_at || existing.updated_at).getTime();
      if (now - acquiredTime > ttlMs) {
        isExpired = true;
      }
    } catch (e) {
      if (now - new Date(existing.updated_at).getTime() > ttlMs) isExpired = true;
    }

    if (isExpired) {
      const renewed = await SystemSetting.findOneAndUpdate(
        { key: lockKey, updated_at: existing.updated_at },
        {
          $set: {
            value: JSON.stringify({
              acquired_at: new Date(now).toISOString(),
              pid: process.pid,
              hostname: process.env.HOSTNAME || 'localhost',
              job: jobName,
              period: keySuffix,
              reacquired_after_expiry: true
            }),
            updated_at: new Date(now)
          }
        },
        { new: true }
      );
      if (renewed) {
        logger.info(`Re-acquired expired distributed cron lock: ${lockKey}`, { jobName, period: keySuffix });
        return true;
      }
    }

    logger.info(`Distributed cron lock already held: ${lockKey}, skipping duplicate execution`, { jobName, period: keySuffix });
    return false;
  } catch (err) {
    if (err.code === 11000) {
      logger.info(`Concurrent attempt for lock ${lockKey} prevented by duplicate key constraint`, { jobName });
      return false;
    }
    logger.warn(`Failed to inspect distributed cron lock for ${jobName}`, { error: err.message });
    return true;
  }
}

async function releaseCronLock(jobName, periodKey = null) {
  const keySuffix = periodKey || new Date().toISOString().split('T')[0];
  const lockKey = `cron_lock_${jobName}_${keySuffix}`;
  try {
    await SystemSetting.deleteOne({ key: lockKey });
    logger.info(`Released distributed cron lock: ${lockKey}`);
  } catch (err) {
    logger.warn(`Failed to release distributed cron lock for ${jobName}`, { error: err.message });
  }
}

module.exports = {
  acquireCronLock,
  releaseCronLock,
  CronLock: {
    acquire: acquireCronLock,
    release: releaseCronLock
  }
};
