import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const users = await db.collection('users').find({}).toArray();
    console.log('=== CURRENT ALL USERS AND THEIR ORGS ===');
    users.forEach(u => {
      console.log(`ID: ${u._id} | Email: ${u.email} | Name: ${u.name} | OrgId: ${u.organizationId}`);
    });

    const orgs = await db.collection('organizations').find({}).toArray();
    console.log('\n=== CURRENT ORGANIZATIONS ===');
    orgs.forEach(o => {
      console.log(`ID: ${o._id} | Name: ${o.name}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
