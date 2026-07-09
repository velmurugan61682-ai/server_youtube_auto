import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import mongoose from 'mongoose';
import Lead from '../models/Lead.mjs';
import User from '../models/User.mjs';
import Channel from '../models/Channel.mjs';

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  console.log('Connecting to:', uri);
  await mongoose.connect(uri);
  console.log('Connected!\n');

  // Find john
  const john = await User.findOne({ email: 'john@gmail.com' });
  if (!john) {
    console.error('John user not found!');
    process.exit(1);
  }

  // Find channel
  const channel = await Channel.findOne({ userId: john._id });
  if (!channel) {
    console.error('Channel not found for John!');
    process.exit(1);
  }

  console.log(`Seeding leads for User: ${john.email} (${john._id}), Channel: ${channel.title} (${channel.channelId})`);

  // Clear existing mock leads if any
  await Lead.deleteMany({ commentId: { $in: ['mock_comment_1', 'mock_comment_2'] } });

  const mockLeads = [
    {
      userId: john._id,
      channelId: channel.channelId,
      videoId: '5vBY8Jj5Wds',
      commentId: 'mock_comment_1',
      authorName: 'Arun Kumar',
      originalComment: 'Please send course details to my whatsapp +91 9876543210',
      whatsappNumber: '919876543210',
      intent: 'Purchase Intent',
      productInterest: 'React Course',
      language: 'Tamil',
      notes: 'Emotion: happy | Urgency: high | Lead Score: 90',
      status: 'pending',
      whatsappSent: false
    },
    {
      userId: john._id,
      channelId: channel.channelId,
      videoId: '5vBY8Jj5Wds',
      commentId: 'mock_comment_2',
      authorName: 'Deepa S',
      originalComment: 'I want to join the program. Phone: 9876500000',
      whatsappNumber: '919876500000',
      intent: 'Interested',
      productInterest: 'Fullstack Program',
      language: 'English',
      notes: 'Emotion: excited | Urgency: medium | Lead Score: 85',
      status: 'sent',
      whatsappSent: true
    }
  ];

  for (const l of mockLeads) {
    const lead = new Lead(l);
    await lead.save();
    console.log(`Saved mock lead for ${l.authorName}`);
  }

  console.log('\nSeeding completed successfully!');
  await mongoose.disconnect();
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
