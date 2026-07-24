import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAnalytics } from '../controllers/analyticsController.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to Database');

    // Mock request and response objects
    const req = {
      user: {
        id: '6a61ab6013a05a496c6ec738',
        email: 'tech@gmail.com',
        role: 'client',
        organizationId: '6a58b3fca56b7151cdd2d250'
      },
      query: {
        // Date range matching "Last 30 Days"
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      }
    };

    const res = {
      json: (data) => {
        console.log('Controller output:');
        console.log(JSON.stringify(data, null, 2));
      },
      status: (code) => ({
        json: (data) => {
          console.error(`Status code: ${code}`);
          console.error(data);
        }
      })
    };

    await getAnalytics(req, res);

    process.exit(0);
  } catch (err) {
    console.error('Error running controller test:', err);
    process.exit(1);
  }
}

run();
