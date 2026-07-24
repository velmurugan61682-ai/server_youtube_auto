import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from '../models/Admin.mjs';

dotenv.config();

export const seedSuperadmin = async () => {
  try {
    const adminEmail = process.env.SUPERADMIN_EMAIL || 'admin@channelbot.in';
    const adminPassword = process.env.SUPERADMIN_PASSWORD || 'AdminPass@123';
    const adminName = process.env.SUPERADMIN_NAME || 'Channelbot Superadmin';

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Seed or update ONLY the Admin collection
    let admin = await Admin.findOne({ email: adminEmail });
    if (!admin) {
      admin = new Admin({
        name: adminName,
        email: adminEmail,
        passwordHash: hashedPassword,
        role: 'superadmin'
      });
      await admin.save();
      console.log(`✅ [Superadmin Seeder] Superadmin account created in Admin collection: ${adminEmail}`);
    } else {
      admin.name = adminName;
      admin.passwordHash = hashedPassword;
      admin.role = 'superadmin';
      await admin.save();
      console.log(`✅ [Superadmin Seeder] Superadmin account updated in Admin collection: ${adminEmail}`);
    }

    return { success: true, email: adminEmail };
  } catch (error) {
    console.error('❌ [Superadmin Seeder] Error seeding superadmin:', error.message);
    throw error;
  }
};

if (process.argv[1] && process.argv[1].endsWith('seedSuperadmin.mjs')) {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/Channelbot';
  mongoose.connect(MONGO_URI)
    .then(async () => {
      console.log('Connected to MongoDB. Running seedSuperadmin...');
      await seedSuperadmin();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Failed to connect to MongoDB:', err);
      process.exit(1);
    });
}

export default seedSuperadmin;
