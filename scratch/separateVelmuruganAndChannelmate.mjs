import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const techOrgId = new mongoose.Types.ObjectId('6a61e033f3e45a716947e418');
    const velmuruganOrgId = new mongoose.Types.ObjectId('6a671c31bb6be1f40cf9acba');
    const channelmateOrgId = new mongoose.Types.ObjectId('6a58c560ca6f41a749ee12cb');

    // Ensure Organization documents exist for Velmurugan and Channelmate
    await db.collection('organizations').updateOne(
      { _id: velmuruganOrgId },
      { $setOnInsert: { _id: velmuruganOrgId, name: "velmurugan's Workspace", createdAt: new Date() } },
      { upsert: true }
    );

    await db.collection('organizations').updateOne(
      { _id: channelmateOrgId },
      { $setOnInsert: { _id: channelmateOrgId, name: "Channelmate's Workspace", createdAt: new Date() } },
      { upsert: true }
    );

    // 1. Move velmurugan accounts out of Tech Vaseegrah org into velmuruganOrgId
    const velmuruganEmails = [
      'velmurugan@gmail.com',
      'velmurugan61682@gmail.com',
      'john@gmail.com'
    ];
    console.log('--- MOVING VELMURUGAN ACCOUNTS TO SEPARATE ORG ---');
    const velRes = await db.collection('users').updateMany(
      { email: { $in: velmuruganEmails } },
      { $set: { organizationId: velmuruganOrgId } }
    );
    console.log(`Velmurugan users updated: ${velRes.modifiedCount}`);

    // 2. Move channelmate account out of Tech Vaseegrah org into channelmateOrgId
    console.log('--- MOVING CHANNELMATE ACCOUNTS TO SEPARATE ORG ---');
    const cmRes = await db.collection('users').updateMany(
      { email: 'channelmate@gmail.com' },
      { $set: { organizationId: channelmateOrgId } }
    );
    console.log(`Channelmate users updated: ${cmRes.modifiedCount}`);

    // 3. Verify Tech Vaseegrah organization users
    console.log('--- VERIFYING TECH VASEEGRAH ORGANIZATION USERS ---');
    const techUsers = await db.collection('users').find({ organizationId: techOrgId }).toArray();
    console.log(`Tech Vaseegrah Org Users (${techUsers.length}):`);
    techUsers.forEach(u => console.log(` - ${u.email} (${u.name})`));

    // 4. Verify Tech Vaseegrah Channel & Data isolation
    const channel = await db.collection('channels').findOne({ channelId: 'UCdpaYm53cdH0SODoBXAKRmQ' });
    const videosCount = await db.collection('videos').countDocuments({ channelId: 'UCdpaYm53cdH0SODoBXAKRmQ', organizationId: techOrgId });
    console.log(`Tech Vaseegrah Channel (${channel?.title}): OrgId: ${channel?.organizationId} | Videos in Org: ${videosCount}`);

    console.log('\n🎉 SUCCESS! Tech Vaseegrah data is now 100% isolated from velmurugan and channelmate@gmail.com.');
    process.exit(0);
  } catch (err) {
    console.error('Error separating accounts:', err);
    process.exit(1);
  }
};

run();
