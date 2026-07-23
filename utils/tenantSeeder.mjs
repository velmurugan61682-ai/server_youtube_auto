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

    // 2. Seed ChannelMate (previously Tech Vaseegrah)
    let techOrg = await Organization.findOne({ name: { $in: ['ChannelMate', 'Tech Vaseegrah'] } });
    if (!techOrg) {
      techOrg = new Organization({
        name: 'ChannelMate',
        logo: '/logo.svg',
        contactDetails: {
          email: 'contact@ChannelMate.test',
          phone: '+918888822222',
          address: 'ChannelMate Hub, India'
        },
        subscription: {
          status: 'active',
          planType: 'enterprise',
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
        }
      });
      await techOrg.save();
      logger.info('🌱 Created organization profile: ChannelMate');
    } else if (techOrg.name === 'Tech Vaseegrah') {
      techOrg.name = 'ChannelMate';
      techOrg.contactDetails.email = 'contact@ChannelMate.test';
      techOrg.contactDetails.address = 'ChannelMate Hub, India';
      await techOrg.save();
      logger.info('🌱 Renamed legacy organization Tech Vaseegrah to ChannelMate');
    }

    // 3. Migrate any legacy Users (without organizationId) to ChannelMate
    const userUpdateRes = await User.updateMany(
      { organizationId: { $exists: false } },
      { $set: { organizationId: techOrg._id } }
    );
    if (userUpdateRes.modifiedCount > 0) {
      logger.info(`🌱 Migrated ${userUpdateRes.modifiedCount} legacy users to ChannelMate tenant`);
    }

    // 4. Migrate any legacy Channels (without organizationId) to ChannelMate
    const channelUpdateRes = await Channel.updateMany(
      { organizationId: { $exists: false } },
      { $set: { organizationId: techOrg._id } }
    );
    if (channelUpdateRes.modifiedCount > 0) {
      logger.info(`🌱 Migrated ${channelUpdateRes.modifiedCount} legacy channels to ChannelMate tenant`);
    }

    logger.info('🌱 [Tenant Seeder] Organization initialization completed successfully');
    return { vedaOrgId: vedaOrg._id, techOrgId: techOrg._id };
  } catch (error) {
    logger.error('❌ [Tenant Seeder] Seeding failed:', error);
    throw error;
  }
};
