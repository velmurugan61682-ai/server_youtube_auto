import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const missingVideoIds = ['5vBY8Jj5Wds', 'LF55pVitnxY'];
  const testUsernames = [
    /@velmurugan-fr8cn/i,
    /@VelMurugan-v2g/i,
    /^velmurugan/i,
    /velmurugan-fr8cn/i,
    /VelMurugan-v2g/i
  ];

  console.log('=== CLEANING UP UNKNOWN VIDEO & TEST USER DATA ===');

  // 1. Remove AutoReplyLogs for missing video IDs or test users
  const ar1 = await db.collection('autoreplylogs').deleteMany({
    $or: [
      { videoId: { $in: missingVideoIds } },
      { username: { $in: testUsernames } },
      { username: { $regex: /velmurugan/i } }
    ]
  });
  console.log('Deleted AutoReplyLogs:', ar1.deletedCount);

  // 2. Remove ModerationLogs for missing video IDs or test users
  const ml1 = await db.collection('moderationlogs').deleteMany({
    $or: [
      { videoId: { $in: missingVideoIds } },
      { authorName: { $in: testUsernames } },
      { authorName: { $regex: /velmurugan/i } }
    ]
  });
  console.log('Deleted ModerationLogs:', ml1.deletedCount);

  // 3. Remove Leads for missing video IDs or test users
  const l1 = await db.collection('leads').deleteMany({
    $or: [
      { videoId: { $in: missingVideoIds } },
      { authorName: { $in: testUsernames } },
      { authorName: { $regex: /velmurugan/i } }
    ]
  });
  console.log('Deleted Leads:', l1.deletedCount);

  // 4. Remove Comments for missing video IDs or test users
  const c1 = await db.collection('comments').deleteMany({
    $or: [
      { videoId: { $in: missingVideoIds } },
      { author: { $regex: /velmurugan/i } },
      { username: { $regex: /velmurugan/i } }
    ]
  });
  console.log('Deleted Comments:', c1.deletedCount);

  // 5. Remove AutoLikeLogs for missing video IDs or test users
  const al1 = await db.collection('autolikelogs').deleteMany({
    $or: [
      { videoId: { $in: missingVideoIds } }
    ]
  });
  console.log('Deleted AutoLikeLogs:', al1.deletedCount);

  // 6. Clean up test rules if any
  const r1 = await db.collection('autoreplyrules').deleteMany({
    videoIds: { $elemMatch: { $in: missingVideoIds } }
  });
  console.log('Deleted test AutoReplyRules:', r1.deletedCount);

  console.log('\n=== CLEANUP COMPLETED SUCCESSFULLY ===');
  process.exit(0);
};

run().catch(e => { console.error(e); process.exit(1); });
