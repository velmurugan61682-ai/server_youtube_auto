import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { generateReply } from '../services/deepseekService.js';
import CommentLog from '../models/CommentLog.js';

dotenv.config();

const sampleComments = [
  {
    type: 'Tamil',
    text: 'மிகவும் அருமையான பதிவு, நன்றி!'
  },
  {
    type: 'English',
    text: 'Excellent explanation! Keep up the good work.'
  },
  {
    type: 'Tanglish',
    text: 'semma video bro'
  }
];

const videoContext = {
  title: 'React Course for Beginners',
  description: 'A complete guide to React for web development.'
};

async function testReplies() {
  console.log('--- STARTING MULTILINGUAL REPLY TESTS ---');
  
  for (const sample of sampleComments) {
    console.log(`\nTesting comment (${sample.type}): "${sample.text}"`);
    try {
      const replyResult = await generateReply(sample.text, videoContext);
      
      console.log(`Detected Language: ${replyResult.detectedLanguage}`);
      console.log(`Generated Reply:   "${replyResult.reply}"`);
      console.log(`Is Object:         ${typeof replyResult === 'object'}`);

      // Create model instance to test setter
      const log = new CommentLog({
        commentId: `test-comment-${Date.now()}-${Math.random()}`,
        videoId: 'test-video-123',
        commenterName: 'Test User',
        originalText: sample.text,
        category: 'normal',
        replyText: replyResult.reply,
        detectedLanguage: replyResult.detectedLanguage
      });

      console.log(`Mongoose doc replyText:        "${log.replyText}"`);
      console.log(`Mongoose doc detectedLanguage: "${log.detectedLanguage}"`);
    } catch (err) {
      console.error(`Error processing ${sample.type} reply:`, err);
    }
  }

  console.log('\n--- VERIFICATION COMPLETED ---');
  process.exit(0);
}

testReplies();
