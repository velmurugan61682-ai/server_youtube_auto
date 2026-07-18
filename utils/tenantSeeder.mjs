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

    // 2. Seed Channelmate (previously Tech Vaseegrah)
    let techOrg = await Organization.findOne({ name: { $in: ['Channelmate', 'Tech Vaseegrah'] } });
    if (!techOrg) {
      techOrg = new Organization({
        name: 'Channelmate',
        logo: '/logo.svg',
        contactDetails: {
          email: 'contact@channelmate.test',
          phone: '+918888822222',
          address: 'Channelmate Hub, India'
        },
        subscription: {
          status: 'active',
          planType: 'enterprise',
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
        }
      });
      await techOrg.save();
      logger.info('🌱 Created organization profile: Channelmate');
    } else if (techOrg.name === 'Tech Vaseegrah') {
      techOrg.name = 'Channelmate';
      techOrg.contactDetails.email = 'contact@channelmate.test';
      techOrg.contactDetails.address = 'Channelmate Hub, India';
      await techOrg.save();
      logger.info('🌱 Renamed legacy organization Tech Vaseegrah to Channelmate');
    }

    // 3. Migrate any legacy Users (without organizationId) to Channelmate
    const userUpdateRes = await User.updateMany(
      { organizationId: { $exists: false } },
      { $set: { organizationId: techOrg._id } }
    );
    if (userUpdateRes.modifiedCount > 0) {
      logger.info(`🌱 Migrated ${userUpdateRes.modifiedCount} legacy users to Channelmate tenant`);
    }

    // 4. Migrate any legacy Channels (without organizationId) to Channelmate
    const channelUpdateRes = await Channel.updateMany(
      { organizationId: { $exists: false } },
      { $set: { organizationId: techOrg._id } }
    );
    if (channelUpdateRes.modifiedCount > 0) {
      logger.info(`🌱 Migrated ${channelUpdateRes.modifiedCount} legacy channels to Channelmate tenant`);
    }

    logger.info('🌱 [Tenant Seeder] Organization initialization completed successfully');
    return { vedaOrgId: vedaOrg._id, techOrgId: techOrg._id };
  } catch (error) {
    logger.error('❌ [Tenant Seeder] Seeding failed:', error);
    throw error;
  }
};
