import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  console.log('Connecting to:', process.env.MONGODB_URI);
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!');

    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const col of collections) {
      console.log(`\nIndexes for collection: ${col.name}`);
      const indexes = await mongoose.connection.db.collection(col.name).indexes();
      console.log(JSON.stringify(indexes, null, 2));
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
