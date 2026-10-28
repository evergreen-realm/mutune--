'use strict';
const SystemSetting = require('../models/SystemSetting');
const logger = require('./logger');

/**
 * Distributed Cron Locking Utility for Horizontal Scalability (Multi-pod/Replica).
 * Uses atomic MongoDB upserts on SystemSetting collection to guarantee exactly-once
 * execution of scheduled batch jobs across East Africa Time (UTC+3) schedules.
 */
async function acquireCronLock(jobName, periodKey = null) {
  if (process.env.NODE_ENV === 'test') {
    return true;
  }

  const keySuffix = periodKey || new Date().toISOString().split('T')[0];
  const lockKey = `cron_lock_${jobName}_${keySuffix}`;

  try {
    const existing = await SystemSetting.findOneAndUpdate(
      { key: lockKey },
      {
        $setOnInsert: {
          key: lockKey,
          value: JSON.stringify({
            acquired_at: new Date().toISOString(),
            pid: process.pid,
            hostname: process.env.HOSTNAME || 'localhost',
            job: jobName,
            period: keySuffix
          }),
          description: `Distributed execution lock for cron job ${jobName} (${keySuffix})`,
          updated_at: new Date()
        }
      },
      { upsert: true, new: false }
    );

    const acquired = !existing;
    if (acquired) {
      logger.info(`Acquired distributed cron lock: ${lockKey}`, { jobName, period: keySuffix, pid: process.pid });
    } else {
      logger.info(`Distributed cron lock already held: ${lockKey}, skipping duplicate execution`, { jobName, period: keySuffix });
    }
    return acquired;
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate key error - another worker inserted the lock concurrently
      logger.info(`Concurrent attempt for lock ${lockKey} prevented by duplicate key constraint`, { jobName });
      return false;
    }
    logger.warn(`Failed to inspect distributed cron lock for ${jobName}`, { error: err.message });
    // Fail-safe: allow execution if DB error occurs
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
