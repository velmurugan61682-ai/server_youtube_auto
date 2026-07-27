import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const modelsDir = path.join(__dirname, '../models');

async function testAllModels() {
  const startTime = Date.now();
  console.log('--------------------------------------------------');
  console.log('🔍 Starting Comprehensive Mongoose & MongoDB Audit');
  console.log('--------------------------------------------------');

  if (!process.env.MONGODB_URI) {
    console.error('❌ Error: MONGODB_URI environment variable is missing!');
    process.exit(1);
  }

  // 1. Test Database Connection
  console.log(`Connecting to MongoDB...`);
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      family: 4
    });
    console.log(`✅ MongoDB Connection Successful! Host: ${conn.connection.host}, Database: ${conn.connection.name}`);
  } catch (err) {
    console.error(`❌ MongoDB Connection Failed: ${err.message}`);
    process.exit(1);
  }

  // 2. Discover and Load All Model Files
  const files = fs.readdirSync(modelsDir);
  console.log(`\nFound ${files.length} model files in models/ directory:`);

  const results = [];

  for (const file of files) {
    const filePath = path.join(modelsDir, file);
    const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');
    try {
      const module = await import(fileUrl);
      const Model = module.default;

      if (!Model || !Model.modelName) {
        results.push({
          file,
          status: '⚠️ Warning',
          modelName: 'N/A',
          collection: 'N/A',
          docCount: 'N/A',
          error: 'Default export is not a Mongoose model'
        });
        continue;
      }

      const modelName = Model.modelName;
      const collectionName = Model.collection.name;
      
      // Perform a quick database count query
      let docCount = 0;
      let queryStatus = 'OK';
      let errorMsg = null;
      try {
        docCount = await Model.countDocuments();
      } catch (qErr) {
        queryStatus = 'Query Error';
        errorMsg = qErr.message;
      }

      // Inspect schema indexes
      const indexes = Model.schema.indexes();

      results.push({
        file,
        status: queryStatus === 'OK' ? '✅ Active' : '❌ Error',
        modelName,
        collection: collectionName,
        docCount: queryStatus === 'OK' ? docCount : 'Error',
        indexCount: indexes.length,
        error: errorMsg
      });

    } catch (importErr) {
      results.push({
        file,
        status: '❌ Load Failed',
        modelName: 'N/A',
        collection: 'N/A',
        docCount: 'N/A',
        indexCount: 'N/A',
        error: importErr.message
      });
    }
  }

  const duration = Date.now() - startTime;

  console.log('\n========================================================================');
  console.log('                        MONGOOSE MODELS AUDIT REPORT                    ');
  console.log('========================================================================');
  console.table(results.map(r => ({
    'File Name': r.file,
    'Status': r.status,
    'Model Name': r.modelName,
    'Collection': r.collection,
    'Doc Count': r.docCount,
    'Indexes Defined': r.indexCount,
    'Details / Error': r.error || 'Working properly'
  })));

  const totalWorking = results.filter(r => r.status.includes('Active')).length;
  console.log(`\nSummary:`);
  console.log(`- Total Model Files: ${files.length}`);
  console.log(`- Successfully Connected & Queried: ${totalWorking}/${files.length}`);
  console.log(`- Execution Time: ${duration} ms`);

  await mongoose.disconnect();
  process.exit(0);
}

testAllModels();
