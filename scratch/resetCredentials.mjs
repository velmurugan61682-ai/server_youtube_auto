import '../config/env.mjs';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.mjs';
import Admin from '../models/Admin.mjs';
import ApiKey from '../models/ApiKey.mjs';

async function resetCredentials() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const defaultPassword = 'Password@123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 12);

    // 1. Superadmin / Admin Account
    const adminEmail = 'admin@channelbot.in';
    let adminDoc = await User.findOne({ email: adminEmail });
    if (!adminDoc) {
      adminDoc = new User({
        name: 'ChannelMate Admin',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin'
      });
      await adminDoc.save();
    } else {
      adminDoc.password = hashedPassword;
      adminDoc.role = 'admin';
      await adminDoc.save();
    }

    // Also sync with Admin collection for Admin Portal (/api/admin/login)
    let adminRecord = await Admin.findOne({ email: adminEmail });
    if (!adminRecord) {
      adminRecord = new Admin({
        name: 'ChannelMate Admin',
        email: adminEmail,
        passwordHash: hashedPassword,
        role: 'superadmin'
      });
      await adminRecord.save();
    } else {
      adminRecord.passwordHash = hashedPassword;
      adminRecord.role = 'superadmin';
      await adminRecord.save();
    }

    // 2. Demo Client Account (john@gmail.com)
    let johnDoc = await User.findOne({ email: 'john@gmail.com' });
    if (johnDoc) {
      johnDoc.password = hashedPassword;
      await johnDoc.save();
    }

    // 3. User Example Account (user@example.com)
    let sampleDoc = await User.findOne({ email: 'user@example.com' });
    if (!sampleDoc) {
      sampleDoc = new User({
        name: 'Sample User',
        email: 'user@example.com',
        password: hashedPassword,
        role: 'client'
      });
      await sampleDoc.save();
    } else {
      sampleDoc.password = hashedPassword;
      await sampleDoc.save();
    }

    // 4. External API Key
    const externalKey = 'cm_ext_e7456b75cc7ab05ce7d99c72a8c218f49741a11fa465d414d8507d9f858ff9b8';
    await ApiKey.findOneAndUpdate(
      { key: externalKey },
      { name: 'External Production API Key', key: externalKey, isActive: true },
      { upsert: true, new: true }
    );

    console.log('✅ PASSWORDS & API KEYS UPDATED SUCCESSFULLY!');
    console.log(`🔑 Admin Login -> Email: ${adminEmail} | Password: ${defaultPassword}`);
    console.log(`🔑 Client Login -> Email: user@example.com (or john@gmail.com) | Password: ${defaultPassword}`);
    console.log(`🔑 External API Key -> ${externalKey}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error resetting credentials:', err);
    process.exit(1);
  }
}

resetCredentials();
