import bcrypt from 'bcryptjs';
import User from '../models/User.mjs';
import logger from './logger.mjs';

const SINGLE_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@channelmate.ai';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminPass@123';

/**
 * Enforce Single Admin Account Policy
 * Ensures strictly ONE admin account exists in MongoDB (admin@channelmate.ai with password AdminPass@123).
 * Automatically migrates legacy admin emails (e.g. admin@youtubeai.test) and deletes duplicate admins.
 */
export const seedSingleAdmin = async () => {
  try {
    logger.info('🛡️ [Admin Seeder] Checking Single Admin Enforcement Policy...');

    // 1. Check if legacy admin exists and rename/update to primary admin email
    const legacyAdmin = await User.findOne({ email: 'admin@youtubeai.test' });
    if (legacyAdmin) {
      // Use updateOne to avoid E11000 when the target email already exists
      await User.updateOne(
        { _id: legacyAdmin._id },
        { $set: {
          email: SINGLE_ADMIN_EMAIL.toLowerCase(),
          name: 'ChannelMate Admin',
          role: 'admin',
          password: await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10)
        }}
      ).catch(err => {
        if (err.code === 11000) {
          logger.warn(`[Admin Seeder] Legacy admin migration skipped — ${SINGLE_ADMIN_EMAIL} already exists.`);
        } else { throw err; }
      });
      logger.info(`🛡️ [Admin Seeder] Migrated legacy admin@youtubeai.test to ${SINGLE_ADMIN_EMAIL}`);
    }

    // 2. Find all users with role === 'admin' or matching admin email
    const existingAdmins = await User.find({ 
      $or: [
        { role: 'admin' }, 
        { email: SINGLE_ADMIN_EMAIL.toLowerCase() }
      ] 
    });

    const primaryAdmin = existingAdmins.find(a => a.email.toLowerCase() === SINGLE_ADMIN_EMAIL.toLowerCase());
    const duplicateAdmins = existingAdmins.filter(a => a.email.toLowerCase() !== SINGLE_ADMIN_EMAIL.toLowerCase());

    // 3. Automatically purge any duplicate admin accounts
    if (duplicateAdmins.length > 0) {
      const duplicateIds = duplicateAdmins.map(a => a._id);
      logger.warn(`🛡️ [Admin Seeder] Purging ${duplicateAdmins.length} duplicate admin account(s)...`);
      await User.deleteMany({ _id: { $in: duplicateIds } });
    }

    const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);

    // 4. Ensure single primary admin exists with fresh password (upsert — safe against duplicates)
    await User.findOneAndUpdate(
      { email: SINGLE_ADMIN_EMAIL.toLowerCase() },
      { $set: {
        name: 'ChannelMate Admin',
        email: SINGLE_ADMIN_EMAIL.toLowerCase(),
        password: hashedPassword,
        role: 'admin'
      }},
      { upsert: true, new: true }
    );
    logger.info(`🛡️ [Admin Seeder] Admin account ensured: ${SINGLE_ADMIN_EMAIL} (Password: ${DEFAULT_ADMIN_PASSWORD})`);

    logger.info('🛡️ [Admin Seeder] Single Admin Policy enforcement complete. Total Admins = 1.');
  } catch (error) {
    logger.error('❌ [Admin Seeder] Enforcement failed:', error);
  }
};
