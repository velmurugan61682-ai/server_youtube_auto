import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  console.log('--- ALL COLLECTIONS AND DOCUMENT COUNTS ---');
  const collections = await mongoose.connection.db.listCollections().toArray();
  
  for (const col of collections) {
    const count = await mongoose.connection.db.collection(col.name).countDocuments({});
    console.log(`${col.name}: ${count}`);
  }
  
  process.exit(0);
}

run();
