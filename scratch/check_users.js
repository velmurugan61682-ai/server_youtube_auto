import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const UserSchema = new mongoose.Schema({
  email: String,
  name: String
});
const User = mongoose.model('User', UserSchema);

const run = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    const users = await User.find();
    users.forEach((u) => {
      console.log(`Name: "${u.name}" | Email: ${u.email} | ID: ${u._id}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
};

run();
