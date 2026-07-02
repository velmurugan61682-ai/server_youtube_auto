import '../config/env.mjs';
import mongoose from 'mongoose';
import User from '../models/User.mjs';
import Channel from '../models/Channel.mjs';
import Comment from '../models/Comment.mjs';
import Lead from '../models/Lead.mjs';
import Video from '../models/Video.mjs';
import { classifyComment, analyzeVideo } from '../services/aiService.mjs';
import { processComments } from '../services/commentProcessingService.mjs';
import { getSettings, saveCredentials } from '../controllers/settingsController.mjs';
import { getVideos } from '../controllers/youtubeController.mjs';
import { initCommentJob } from '../jobs/commentJob.mjs';

console.log('✅ ALL IMPORTS AND SYNTAX CHECKS PASSED!');
process.exit(0);
