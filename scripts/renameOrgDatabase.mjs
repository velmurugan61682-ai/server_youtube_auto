import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Organization = (await import('../models/Organization.mjs')).default;
    const User = (await import('../models/User.mjs')).default;
    const Channel = (await import('../models/Channel.mjs')).default;

    // Find target ChannelBot org
    let mainOrg = await Organization.findOne({ name: 'ChannelBot' });
    if (!mainOrg) {
      mainOrg = await Organization.create({ name: 'ChannelBot', slug: 'channelbot-main' });
      console.log('Created main ChannelBot org:', mainOrg._id);
    } else {
      console.log('Found main ChannelBot org:', mainOrg._id);
    }

    // Find all legacy ChannelMate / Channelbot orgs
    const oldOrgs = await Organization.find({ name: { $in: ['ChannelMate', 'Channelbot', 'Tech Vaseegrah'] }, _id: { $ne: mainOrg._id } });
    const oldOrgIds = oldOrgs.map(o => o._id);

    if (oldOrgIds.length > 0) {
      // Re-link users to ChannelBot org
      const userRelink = await User.updateMany(
        { organizationId: { $in: oldOrgIds } },
        { $set: { organizationId: mainOrg._id } }
      );
      console.log(`Re-linked ${userRelink.modifiedCount} user(s) to ChannelBot organization.`);

      // Re-link channels to ChannelBot org
      const channelRelink = await Channel.updateMany(
        { organizationId: { $in: oldOrgIds } },
        { $set: { organizationId: mainOrg._id } }
      );
      console.log(`Re-linked ${channelRelink.modifiedCount} channel(s) to ChannelBot organization.`);

      // Delete old orgs
      await Organization.deleteMany({ _id: { $in: oldOrgIds } });
      console.log(`Deleted ${oldOrgIds.length} legacy organization record(s).`);
    }

    // Rename legacy admin names
    const userRes1 = await User.updateMany(
      { name: 'ChannelBot'},
      { $set: { name: 'ChannelBot Admin' } }
    );

    const userRes2 = await User.updateMany(
      { name: 'ChannelBot' },
      { $set: { name: 'ChannelBot Superadmin' } }
    );

    console.log(`Updated ${userRes1.modifiedCount + userRes2.modifiedCount} admin user name(s)`);

    await mongoose.disconnect();
    console.log('✅ Migration successfully completed!');
  } catch (err) {
    console.error('Error updating DB:', err);
    process.exit(1);
  }
};

run();
