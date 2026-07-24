import mongoose from 'mongoose';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const require = createRequire(import.meta.url);

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const Channel = (await import('../models/Channel.mjs')).default;
  const User = (await import('../models/User.mjs')).default;
  const Organization = (await import('../models/Organization.mjs')).default;
  const Comment = (await import('../models/Comment.mjs')).default;

  // 1. Find channels with null/missing organizationId
  const badChannels = await Channel.find({ $or: [{ organizationId: null }, { organizationId: { $exists: false } }] }).lean();
  console.log('Channels missing orgId:', badChannels.length);

  for (const ch of badChannels) {
    const user = await User.findById(ch.userId).lean();
    console.log('Channel:', ch.channelId, '| Owner:', user?.email, '| User orgId:', user?.organizationId);

    let orgId = user?.organizationId;

    if (!orgId) {
      // Find or create a default organization
      let org = await Organization.findOne({ name: { $in: ['Channelbot', 'Tech Vaseegrah', 'Default'] } }).lean();
      if (!org) {
        const newOrg = await Organization.create({ name: 'Channelbot', slug: 'Channelbot-default' });
        orgId = newOrg._id;
        console.log('Created new default org:', orgId);
      } else {
        orgId = org._id;
        console.log('Using existing org:', org.name, '|', orgId);
      }
      // Link user to org
      if (user) {
        await User.updateOne({ _id: user._id }, { $set: { organizationId: orgId } });
        console.log('Linked user', user.email, 'to org', orgId);
      }
    }

    // Fix channel orgId
    await Channel.updateOne({ _id: ch._id }, { $set: { organizationId: orgId } });
    console.log('Fixed channel', ch.channelId, '-> orgId:', orgId);
  }

  // 2. Fix comments with null organizationId that belong to users with orgId
  const badComments = await Comment.countDocuments({ $or: [{ organizationId: null }, { organizationId: { $exists: false } }] });
  console.log('\nComments missing orgId:', badComments);

  const users = await User.find({ organizationId: { $ne: null, $exists: true } }).select('_id organizationId').lean();
  for (const u of users) {
    const res = await Comment.updateMany(
      { userId: u._id, $or: [{ organizationId: null }, { organizationId: { $exists: false } }] },
      { $set: { organizationId: u.organizationId } }
    );
    if (res.modifiedCount > 0) console.log('Fixed', res.modifiedCount, 'comments for user', u._id);
  }

  // 3. Report final state
  const allChannels = await Channel.find({}).select('channelId title organizationId reconnectRequired').lean();
  console.log('\n=== FINAL CHANNEL STATE ===');
  allChannels.forEach(c => console.log(`  ${c.title} (${c.channelId}) orgId=${c.organizationId} reconnect=${c.reconnectRequired}`));

  const commentCounts = await Comment.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  console.log('\n=== COMMENT STATUS COUNTS ===');
  commentCounts.forEach(c => console.log(`  ${c._id}: ${c.count}`));

  await mongoose.disconnect();
  console.log('\nDone.');
};

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
