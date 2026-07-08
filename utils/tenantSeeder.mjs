import Organization from '../models/Organization.mjs';
import User from '../models/User.mjs';
import Channel from '../models/Channel.mjs';
import logger from './logger.mjs';

export const seedOrganizations = async () => {
  try {
    logger.info('🌱 [Tenant Seeder] Initializing organization profiles...');

    // 1. Seed Vaseegrah Veda
    let vedaOrg = await Organization.findOne({ name: 'Vaseegrah Veda' });
    if (!vedaOrg) {
      vedaOrg = new Organization({
        name: 'Vaseegrah Veda',
        logo: '',
        contactDetails: {
          email: 'contact@vaseegrahveda.test',
          phone: '+919999911111',
          address: 'Veda Wellness Centre, India'
        },
        subscription: {
          status: 'active',
          planType: 'professional',
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
        }
      });
      await vedaOrg.save();
      logger.info('🌱 Created organization profile: Vaseegrah Veda');
    }

    // 2. Seed Tech Vaseegrah
    let techOrg = await Organization.findOne({ name: 'Tech Vaseegrah' });
    if (!techOrg) {
      techOrg = new Organization({
        name: 'Tech Vaseegrah',
        logo: '/logo.svg',
        contactDetails: {
          email: 'contact@techvaseegrah.test',
          phone: '+918888822222',
          address: 'Tech Vaseegrah Hub, India'
        },
        subscription: {
          status: 'active',
          planType: 'enterprise',
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
        }
      });
      await techOrg.save();
      logger.info('🌱 Created organization profile: Tech Vaseegrah');
    }

    // 3. Migrate any legacy Users (without organizationId) to Tech Vaseegrah
    const userUpdateRes = await User.updateMany(
      { organizationId: { $exists: false } },
      { $set: { organizationId: techOrg._id } }
    );
    if (userUpdateRes.modifiedCount > 0) {
      logger.info(`🌱 Migrated ${userUpdateRes.modifiedCount} legacy users to Tech Vaseegrah tenant`);
    }

    // 4. Migrate any legacy Channels (without organizationId) to Tech Vaseegrah
    const channelUpdateRes = await Channel.updateMany(
      { organizationId: { $exists: false } },
      { $set: { organizationId: techOrg._id } }
    );
    if (channelUpdateRes.modifiedCount > 0) {
      logger.info(`🌱 Migrated ${channelUpdateRes.modifiedCount} legacy channels to Tech Vaseegrah tenant`);
    }

    logger.info('🌱 [Tenant Seeder] Organization initialization completed successfully');
    return { vedaOrgId: vedaOrg._id, techOrgId: techOrg._id };
  } catch (error) {
    logger.error('❌ [Tenant Seeder] Seeding failed:', error);
    throw error;
  }
};
