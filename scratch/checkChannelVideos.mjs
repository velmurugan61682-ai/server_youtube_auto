import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Video from '../models/Video.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const parseISO8601Duration = (durationStr) => {
  if (!durationStr) return { seconds: 0, formatted: '00:00' };
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const matches = durationStr.match(regex);
  if (!matches) {
    return { seconds: 0, formatted: durationStr };
  }
  const hours = parseInt(matches[1] || 0, 10);
  const minutes = parseInt(matches[2] || 0, 10);
  const seconds = parseInt(matches[3] || 0, 10);
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  let formatted = '';
  if (hours > 0) {
    formatted += hours + ':';
    formatted += String(minutes).padStart(2, '0') + ':';
  } else {
    formatted += minutes + ':';
  }
  formatted += String(seconds).padStart(2, '0');
  return { seconds: totalSeconds, formatted };
};

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to Database');

    const channelId = 'UCdpaYm53cdH0SODoBXAKRmQ';
    const videos = await Video.find({ channelId }).lean();
    console.log(`Total videos for channel ${channelId}:`, videos.length);

    // Filter current logic
    const processed = videos.map(v => {
      if (v.isPost) {
        return { ...v, durationSeconds: 0, formattedDuration: '' };
      }
      const { seconds, formatted } = parseISO8601Duration(v.duration);
      return {
        ...v,
        durationSeconds: seconds,
        formattedDuration: v.duration ? formatted : '--:--'
      };
    });

    const isShortCurrent = (v) => {
      if (v.isPost) return false;
      if (v.duration && v.durationSeconds < 60) return true;
      const text = `${v.title || ''} ${v.description || ''} ${v.url || ''}`.toLowerCase();
      return text.includes('#shorts') || text.includes('/shorts/') || text.includes('shorts');
    };

    const currentShorts = processed.filter(isShortCurrent);
    const currentLongs = processed.filter(v => !v.isPost && !isShortCurrent(v));
    const currentPosts = processed.filter(v => v.isPost);

    console.log('\n--- CURRENT FILTER FOR THIS CHANNEL ---');
    console.log('Shorts:', currentShorts.length);
    console.log('Long Videos:', currentLongs.length);
    console.log('Posts:', currentPosts.length);

    console.log('\nList of current Shorts for this channel:');
    for (const v of currentShorts) {
      console.log(`- Title: ${v.title} | duration: ${v.duration} | durationSeconds: ${v.durationSeconds} | isPost: ${v.isPost}`);
    }

    // Filter robust logic
    const processedRobust = videos.map(v => {
      const isPost = v.isPost || v.duration === 'Post' || v.duration === 'P0D';
      if (isPost) {
        return { ...v, isPost: true, durationSeconds: 0, formattedDuration: '' };
      }
      const { seconds, formatted } = parseISO8601Duration(v.duration);
      return {
        ...v,
        isPost: false,
        durationSeconds: seconds,
        formattedDuration: v.duration ? formatted : '--:--'
      };
    });

    const isShortRobust = (v) => {
      if (v.isPost) return false;
      if (v.duration && v.durationSeconds < 60) return true;
      const text = `${v.title || ''} ${v.description || ''} ${v.url || ''}`.toLowerCase();
      return text.includes('#shorts') || text.includes('/shorts/') || text.includes('shorts');
    };

    const robustShorts = processedRobust.filter(isShortRobust);
    const robustLongs = processedRobust.filter(v => !v.isPost && !isShortRobust(v));
    const robustPosts = processedRobust.filter(v => v.isPost);

    console.log('\n--- ROBUST FILTER FOR THIS CHANNEL ---');
    console.log('Shorts:', robustShorts.length);
    console.log('Long Videos:', robustLongs.length);
    console.log('Posts:', robustPosts.length);

    console.log('\nList of robust Shorts for this channel:');
    for (const v of robustShorts) {
      console.log(`- Title: ${v.title} | duration: ${v.duration} | durationSeconds: ${v.durationSeconds}`);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
