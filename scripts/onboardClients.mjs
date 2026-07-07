import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI or MONGO_URI environment variable is missing.');
  process.exit(1);
}

async function onboard() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully.');

    const clients = [
      {
        name: 'Vaseegrah Veda',
        email: 'vaseegrahveda@techvaseegrah.com',
        password: 'VaseegrahVedaSecurePass2026!'
      },
      {
        name: 'Tech Vaseegrah',
        email: 'techvaseegrah@techvaseegrah.com',
        password: 'TechVaseegrahSecurePass2026!'
      }
    ];

    for (const client of clients) {
      let user = await User.findOne({ email: client.email });
      const hashedPassword = await bcrypt.hash(client.password, 10);
      
      const subscriptionEndDate = new Date();
      subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1); // 1 year free trial for initial VIP onboard

      if (!user) {
        user = new User({
          name: client.name,
          email: client.email,
          password: hashedPassword,
          role: 'client',
          subscription: {
            id: 'trial_promo_active',
            planId: 'trial_annual',
            status: 'active',
            currentStart: new Date(),
            currentEnd: subscriptionEndDate
          }
        });
        await user.save();
        console.log(`✅ Onboarded new client: ${client.name} (${client.email})`);
      } else {
        user.role = 'client';
        if (user.subscription.status === 'none') {
          user.subscription = {
            id: 'trial_promo_active',
            planId: 'trial_annual',
            status: 'active',
            currentStart: new Date(),
            currentEnd: subscriptionEndDate
          };
        }
        await user.save();
        console.log(`ℹ️ Client already exists. Securely updated details for: ${client.name} (${client.email})`);
      }
    }

    console.log('🎉 Client onboarding seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Onboarding failed:', error.message);
    process.exit(1);
  }
}

onboard();
