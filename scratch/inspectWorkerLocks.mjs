import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  console.log('--- ALL WORKER LOCKS ---');
  const locks = await mongoose.connection.db.collection('workerlocks').find({}).toArray();
  console.log(`Count: ${locks.length}`);
  locks.forEach((l, i) => {
    console.log(`\nLock ${i + 1}:`);
    console.log(JSON.stringify(l, null, 2));
  });
  
  process.exit(0);
}

run();
