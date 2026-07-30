import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.mjs';
import Channel from '../models/Channel.mjs';
import Organization from '../models/Organization.mjs';

dotenv.config();

async function inspect() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { family: 4 });
    console.log('Connected to DB successfully!');
    
    const users = await User.find({}).lean();
    console.log(`Total users: ${users.length}`);
    for (const u of users) {
      console.log(`User: ${u.email}`);
      console.log(` - Role: ${u.role}`);
      console.log(` - OrgId: ${u.organizationId}`);
      console.log(` - CreatedAt: ${u.createdAt}`);
      console.log(` - Subscription:`, JSON.stringify(u.subscription, null, 2));
      
      if (u.organizationId) {
        const org = await Organization.findById(u.organizationId).lean();
        if (org) {
          console.log(` - Org Name: ${org.name}`);
          console.log(` - Org Subscription:`, JSON.stringify(org.subscription, null, 2));
        } else {
          console.log(` - Org NOT found for orgId: ${u.organizationId}`);
        }
      }
    }

    const channels = await Channel.find({}).lean();
    console.log(`Total channels: ${channels.length}`);
    for (const c of channels) {
      console.log(`Channel: ${c.title} (${c.channelId})`);
      console.log(` - UserId: ${c.userId}`);
      console.log(` - OrgId: ${c.organizationId}`);
      console.log(` - Status: ${c.status}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Inspection failed:', err);
    process.exit(1);
  }
}

inspect();
