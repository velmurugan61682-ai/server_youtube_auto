import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    // Fix: clear reconnectRequired for Tech Vaseegrah channel
    const channelId = 'UCdpaYm53cdH0SODoBXAKRmQ';
    const result = await db.collection('channels').updateOne(
      { channelId },
      { $set: { reconnectRequired: false, reconnectReason: '', status: 'connected' } }
    );
    console.log('Channel reconnectRequired cleared:', result.modifiedCount, 'documents updated');

    // Check channel document
    const channel = await db.collection('channels').findOne({ channelId });
    console.log('\nChannel Status:');
    console.log(' - Title:', channel?.title);
    console.log(' - Status:', channel?.status);
    console.log(' - userId:', channel?.userId);
    console.log(' - organizationId:', channel?.organizationId);
    console.log(' - reconnectRequired:', channel?.reconnectRequired);
    console.log(' - hasAccessToken:', !!channel?.accessToken);
    console.log(' - hasRefreshToken:', !!channel?.refreshToken);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
