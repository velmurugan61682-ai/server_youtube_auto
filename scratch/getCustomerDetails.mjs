import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function checkCustomers() {
  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;

    const userCount = await db.collection('users').countDocuments();
    const leadCount = await db.collection('leads').countDocuments();
    const channelCount = await db.collection('channels').countDocuments();

    const users = await db.collection('users').find({}, { projection: { password: 0 } }).toArray();
    const leads = await db.collection('leads').find({}).limit(5).toArray();
    const channels = await db.collection('channels').find({}).toArray();

    console.log('=== SUMMARY ===');
    console.log(`Users: ${userCount}`);
    console.log(`Leads: ${leadCount}`);
    console.log(`Connected Channels: ${channelCount}`);
    console.log('\n=== USERS ===');
    users.forEach(u => console.log(`- ${u.name || u.email} (${u.email}) | Plan: ${u.plan || 'Free'} | Role: ${u.role || 'user'}`));

    console.log('\n=== CHANNELS ===');
    channels.forEach(c => console.log(`- ${c.title || c.channelId} (ID: ${c.channelId}) | Owner: ${c.ownerEmail || c.userId}`));

    console.log('\n=== RECENT LEADS ===');
    leads.forEach(l => console.log(`- ${l.name || l.email || 'Lead'} | ${l.phone || l.email || l.contact || 'No contact'} | Source: ${l.videoTitle || l.source || 'Comment'}`));

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error checking customers:', err.message);
  }
}

checkCustomers();
