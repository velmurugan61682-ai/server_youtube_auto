import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI not found in environment variables.");
  process.exit(1);
}

// Inline model schemas/registrations if mongoose is not initialized yet
import User from '../models/User.mjs';
import Organization from '../models/Organization.mjs';
import Channel from '../models/Channel.mjs';
import CommentAutomationRule from '../models/CommentAutomationRule.mjs';
import CommentAutomationLog from '../models/CommentAutomationLog.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import Comment from '../models/Comment.mjs';
import Lead from '../models/Lead.mjs';

async function migrate() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected successfully.");

    // Resolve default organization
    let defaultOrg = await Organization.findOne({ name: { $in: ['ChannelMate', 'Tech Vaseegrah'] } });
    if (!defaultOrg) {
      defaultOrg = await Organization.findOne({});
    }
    if (!defaultOrg) {
      // Create a default organization if none exists
      defaultOrg = new Organization({ name: 'ChannelMate' });
      await defaultOrg.save();
      console.log("Created a default organization 'ChannelMate'.");
    }
    console.log(`Default Organization to use: ${defaultOrg.name} (${defaultOrg._id})`);

    // Helper to get or set organization for a user
    const userOrgCache = {};
    async function getOrganizationIdForUser(userId) {
      if (!userId) return defaultOrg._id;
      const idStr = userId.toString();
      if (userOrgCache[idStr]) return userOrgCache[idStr];

      const user = await User.findById(userId);
      if (!user) return defaultOrg._id;

      if (!user.organizationId) {
        user.organizationId = defaultOrg._id;
        await User.updateOne({ _id: user._id }, { $set: { organizationId: defaultOrg._id } });
        console.log(`Linked user ${user.email} to default organization.`);
      }

      userOrgCache[idStr] = user.organizationId;
      return user.organizationId;
    }

    const collections = [
      { name: 'CommentAutomationRule', model: CommentAutomationRule },
      { name: 'CommentAutomationLog', model: CommentAutomationLog },
      { name: 'ModerationLog', model: ModerationLog },
      { name: 'Comment', model: Comment },
      { name: 'Lead', model: Lead },
    ];

    for (const col of collections) {
      console.log(`Migrating collection: ${col.name}...`);
      const docs = await col.model.find({ organizationId: { $exists: false } });
      console.log(`Found ${docs.length} documents without organizationId.`);

      let updatedCount = 0;
      for (const doc of docs) {
        const orgId = await getOrganizationIdForUser(doc.userId);
        await col.model.updateOne({ _id: doc._id }, { $set: { organizationId: orgId } });
        updatedCount++;
      }
      console.log(`Updated ${updatedCount} documents in ${col.name}.`);
    }

    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed.");
  }
}

migrate();
