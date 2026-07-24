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

    const videos = await Video.find({}).lean();
    console.log('Total videos in DB:', videos.length);

    // Apply mapping
    const processedVideos = videos.map(v => {
      // Current logic in client
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

    const isShortVideoCurrent = (video) => {
      if (video.isPost) return false;
      if (video.duration && video.durationSeconds < 60) return true;
      const text = `${video.title || ''} ${video.description || ''} ${video.url || ''}`.toLowerCase();
      return text.includes('#shorts') || text.includes('/shorts/') || text.includes('shorts');
    };

    const currentShorts = processedVideos.filter(isShortVideoCurrent);
    const currentLongs = processedVideos.filter(v => !v.isPost && !isShortVideoCurrent(v));
    const currentPosts = processedVideos.filter(v => v.isPost);

    console.log('\n--- CURRENT CLIENT FILTER RESULTS ---');
    console.log('Shorts count:', currentShorts.length);
    console.log('Long videos count:', currentLongs.length);
    console.log('Posts count:', currentPosts.length);

    console.log('\nCurrent Shorts details:');
    for (const v of currentShorts.slice(0, 15)) {
      console.log(`- [Short] Title: ${v.title} | Duration: ${v.duration} (seconds: ${v.durationSeconds}) | isPost: ${v.isPost}`);
    }

    // Now try robust mapping where isPost is set correctly
    const processedVideosRobust = videos.map(v => {
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

    const isShortVideoRobust = (video) => {
      if (video.isPost) return false;
      if (video.duration && video.durationSeconds < 60) return true;
      const text = `${video.title || ''} ${video.description || ''} ${video.url || ''}`.toLowerCase();
      return text.includes('#shorts') || text.includes('/shorts/') || text.includes('shorts');
    };

    const robustShorts = processedVideosRobust.filter(isShortVideoRobust);
    const robustLongs = processedVideosRobust.filter(v => !v.isPost && !isShortVideoRobust(v));
    const robustPosts = processedVideosRobust.filter(v => v.isPost);

    console.log('\n--- ROBUST CLIENT FILTER RESULTS ---');
    console.log('Shorts count:', robustShorts.length);
    console.log('Long videos count:', robustLongs.length);
    console.log('Posts count:', robustPosts.length);

    console.log('\nRobust Shorts details (first 15):');
    for (const v of robustShorts.slice(0, 15)) {
      console.log(`- [Short] Title: ${v.title} | Duration: ${v.duration} (seconds: ${v.durationSeconds})`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
