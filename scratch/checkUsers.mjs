import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema);

await mongoose.connect(process.env.MONGODB_URI, { family: 4, serverSelectionTimeoutMS: 10000 });
console.log('Connected to DB:', mongoose.connection.name, '| DB Host:', mongoose.connection.host);

const users = await User.find({}).select('_id email name role createdAt').lean();
console.log(`\nTotal users: ${users.length}`);
users.forEach(u => console.log(JSON.stringify({ id: u._id?.toString(), email: u.email, name: u.name, role: u.role, created: u.createdAt })));

await mongoose.disconnect();
process.exit(0);
