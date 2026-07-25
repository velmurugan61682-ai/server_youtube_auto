import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { getAnalytics, getDashboardAnalytics } from '../controllers/analyticsController.mjs';
import User from '../models/User.mjs';

async function testController() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const user = await User.findOne({ email: 'tech@gmail.com' }).lean();

  const req = {
    user: { id: user._id.toString(), organizationId: user.organizationId ? user.organizationId.toString() : null },
    query: {}
  };

  let jsonResult = null;
  const res = {
    json: (data) => {
      jsonResult = data;
      console.log('API Response:', JSON.stringify(data, null, 2));
    },
    status: (code) => {
      console.log('Status code:', code);
      return res;
    }
  };

  console.log('\n--- Testing getAnalytics ---');
  await getAnalytics(req, res);

  console.log('\n--- Testing getDashboardAnalytics ---');
  await getDashboardAnalytics(req, res);

  process.exit(0);
}

testController();
