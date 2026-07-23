import bcrypt from 'bcryptjs';
import User from '../models/User.mjs';
import logger from './logger.mjs';

const SINGLE_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@channelbot.in').toLowerCase().trim();
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminPass@123';
const LEGACY_ADMIN_EMAIL = 'admin@youtubeai.test';

/**
 * Enforce the single admin user policy idempotently.
 * Searches by the configured unique email first and creates the admin only when missing.
 */
export const seedSingleAdmin = async () => {
  try {
    logger.info('[Admin Seeder] Checking single admin user policy...');

    let primaryAdmin = await User.findOne({ email: SINGLE_ADMIN_EMAIL });

    if (!primaryAdmin) {
      const legacyAdmin = await User.findOne({ email: LEGACY_ADMIN_EMAIL });

      if (legacyAdmin) {
        await User.updateOne(
          { _id: legacyAdmin._id },
          {
            $set: {
              email: SINGLE_ADMIN_EMAIL,
              name: legacyAdmin.name || 'ChannelMate Admin',
              role: 'admin'
            }
          }
        );
        primaryAdmin = await User.findById(legacyAdmin._id);
        logger.info(`[Admin Seeder] Migrated legacy admin email to ${SINGLE_ADMIN_EMAIL}.`);
      }
    }

    if (!primaryAdmin) {
      const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
      primaryAdmin = await User.create({
        name: 'ChannelMate Admin',
        email: SINGLE_ADMIN_EMAIL,
        password: hashedPassword,
        passwordHash: hashedPassword,
        role: 'admin'
      });
      logger.info(`[Admin Seeder] Created admin account: ${SINGLE_ADMIN_EMAIL}.`);
    } else if (primaryAdmin.role !== 'admin') {
      await User.updateOne(
        { _id: primaryAdmin._id },
        { $set: { role: 'admin' } }
      );
      logger.info(`[Admin Seeder] Ensured admin role for: ${SINGLE_ADMIN_EMAIL}.`);
    } else {
      logger.info(`[Admin Seeder] Admin account already exists: ${SINGLE_ADMIN_EMAIL}.`);
    }

    const duplicateResult = await User.updateMany(
      { _id: { $ne: primaryAdmin._id }, role: 'admin' },
      { $set: { role: 'client' } }
    );

    if (duplicateResult.modifiedCount > 0) {
      logger.warn(`[Admin Seeder] Demoted ${duplicateResult.modifiedCount} duplicate admin user account(s) without deleting users.`);
    }

    logger.info('[Admin Seeder] Single admin user policy enforcement complete.');
  } catch (error) {
    if (error?.code === 11000) {
      logger.warn(`[Admin Seeder] Admin account already exists for ${SINGLE_ADMIN_EMAIL}; startup remains idempotent.`);
      return;
    }
    logger.error('[Admin Seeder] Enforcement failed:', error);
  }
};