import WorkerLock from '../models/WorkerLock.mjs';
import logger from './logger.mjs';

/**
 * Attempts to acquire a distributed lock.
 * @param {string} lockKey
 * @param {number} durationMs - How long the lock is valid for (default 5 minutes)
 * @returns {Promise<boolean>}
 */
export const acquireLock = async (lockKey, durationMs = 300000) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMs);

  try {
    await WorkerLock.create({
      lockKey,
      lockedAt: now,
      expiresAt
    });
    logger.info(`[Lock Helper] Successfully acquired lock for: ${lockKey}`);
    return true;
  } catch (error) {
    if (error.code === 11000) {
      // Lock already exists. Check if it has expired.
      const lock = await WorkerLock.findOne({ lockKey });
      if (lock && lock.expiresAt < now) {
        try {
          const updated = await WorkerLock.findOneAndUpdate(
            { lockKey, expiresAt: lock.expiresAt },
            { lockedAt: now, expiresAt },
            { new: true }
          );
          if (updated) {
            logger.info(`[Lock Helper] Acquired expired lock for: ${lockKey}`);
            return true;
          }
        } catch (updateError) {
          // Concurrent updates/acquires might fail, returning false
          logger.warn(`[Lock Helper] Concurrent lock acquisition attempt failed for key: ${lockKey}`);
          return false;
        }
      }
      return false;
    }
    logger.error(`[Lock Helper] Error acquiring lock for ${lockKey}: ${error.message}`);
    return false;
  }
};

/**
 * Releases a distributed lock.
 * @param {string} lockKey
 * @returns {Promise<void>}
 */
export const releaseLock = async (lockKey) => {
  try {
    await WorkerLock.deleteOne({ lockKey });
    logger.info(`[Lock Helper] Released lock for: ${lockKey}`);
  } catch (error) {
    logger.error(`[Lock Helper] Error releasing lock for ${lockKey}: ${error.message}`);
  }
};
