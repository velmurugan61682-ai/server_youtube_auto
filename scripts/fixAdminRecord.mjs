import '../config/env.mjs';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const NEW_EMAIL = process.env.ADMIN_EMAIL || 'admin@channelbot.ai';
const NEW_PASS = process.env.ADMIN_PASSWORD || 'AdminPass@123';

await mongoose.connect(MONGODB_URI);
console.log('✅ Connected to MongoDB');

const db = mongoose.connection.db;
const col = db.collection('admins');

// Remove ALL stale admin records (old emails like admin@channelbot.in)
const deleted = await col.deleteMany({ email: { $ne: NEW_EMAIL } });
console.log(`🗑  Deleted ${deleted.deletedCount} stale admin record(s).`);

// Upsert the correct admin record
const hashed = await bcrypt.hash(NEW_PASS, 10);
const result = await col.findOneAndUpdate(
  { email: NEW_EMAIL },
  {
    $set: {
      email: NEW_EMAIL,
      passwordHash: hashed,
      role: 'superadmin',
      name: 'ChannelBot Admin',
      updatedAt: new Date()
    },
    $setOnInsert: { createdAt: new Date() }
  },
  { upsert: true, returnDocument: 'after' }
);

console.log('✅ Admin record ready:');
console.log('   Email :', NEW_EMAIL);
console.log('   Role  : superadmin');
console.log('   _id   :', result?._id || result?.value?._id || 'created');

await mongoose.disconnect();
console.log('✅ Done — you can now log in with:', NEW_EMAIL, '/', NEW_PASS);
process.exit(0);
