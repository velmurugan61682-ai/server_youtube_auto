import '../config/env.mjs';
import mongoose from 'mongoose';

async function fix() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));

    // Get indexes on comments
    const commentsCol = db.collection('comments');
    const commentIndexes = await commentsCol.indexes();
    console.log('Comments Indexes:', commentIndexes);

    // Drop legacy index if it exists
    const hasLegacyIndex = commentIndexes.some(idx => idx.name === 'userId_1_commentId_1');
    if (hasLegacyIndex) {
      console.log('Dropping legacy index: userId_1_commentId_1');
      await commentsCol.dropIndex('userId_1_commentId_1');
      console.log('Legacy index dropped successfully.');
    } else {
      console.log('No legacy index userId_1_commentId_1 found.');
    }
  } catch (err) {
    console.error('Error fixing indexes:', err);
  } finally {
    await mongoose.disconnect();
  }
}

fix();
