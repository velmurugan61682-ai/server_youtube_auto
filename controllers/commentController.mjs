import Comment from '../models/Comment.mjs';
import Channel from '../models/Channel.mjs';
import User from '../models/User.mjs';
import Video from '../models/Video.mjs';
import { 
  getYouTubeClient, 
  likeComment, 
  deleteCommentFromYouTube, 
  hideComment, 
  replyToComment 
} from '../services/youtubeService.mjs';
import { classifyComment } from '../services/aiService.mjs';
import { processComments } from '../services/commentProcessingService.mjs';
import { encrypt, decrypt } from '../utils/cryptoHelper.mjs';
import { debouncedEmit } from '../utils/socketDebouncer.mjs';

// Helper to get allowed channel IDs for a user based on their organization
const getUserChannelIds = async (user) => {
  const filter = user.organizationId 
    ? { $or: [{ organizationId: user.organizationId }, { userId: user.id }] }
    : { userId: user.id };
  const channels = await Channel.find(filter).select('channelId');
  return channels.map(c => c.channelId);
};

export const getComments = async (req, res) => {
  try {
    const { status, sentiment, autoLiked, videoId, channelId, page = 1, limit = 50 } = req.query;
    
    // Resolve tenant channels
    const allowedChannelIds = await getUserChannelIds(req.user);
    
    // Resolve organization users
    const filterUser = req.user.organizationId 
      ? { $or: [{ organizationId: req.user.organizationId }, { _id: req.user.id }] }
      : { _id: req.user.id };
    const users = await User.find(filterUser).select('_id');
    const userIds = users.map(u => u._id);
    
    const query = { 
      channelId: { $in: allowedChannelIds },
      userId: { $in: userIds }
    };
    
    if (videoId) {
      // Find the video and verify it belongs to allowed channelIds and userIds to prevent cross-channel/cross-user leakages
      const videoDoc = await Video.findOne({ videoId, channelId: { $in: allowedChannelIds }, userId: { $in: userIds } });
      if (!videoDoc) {
        return res.json({ comments: [], pagination: { total: 0, pages: 0, currentPage: 1, limit: parseInt(limit) } });
      }
      query.videoId = videoId;
      query.channelId = videoDoc.channelId; // Load comments strictly belonging to this video's channel
    } else if (channelId) {
      if (allowedChannelIds.includes(channelId)) {
        query.channelId = channelId;
      } else {
        return res.json({ comments: [], pagination: { total: 0, pages: 0, currentPage: 1, limit: parseInt(limit) } });
      }
    }
    
    if (status) query.status = status;
    if (sentiment) query.sentiment = sentiment;
    if (autoLiked !== undefined) query.autoLiked = autoLiked === 'true';

    // ✅ PERFORMANCE: Added pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const comments = await Comment.find(query)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Comment.countDocuments(query);
    
    res.json({
      comments,
      pagination: {
        total,
        pages: Math.ceil(total / parseInt(limit)),
        currentPage: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const takeAction = async (req, res) => {
  const { id } = req.params;
  const { action, replyText } = req.body;

  try {
    const allowedChannelIds = await getUserChannelIds(req.user);
    const comment = await Comment.findOne({ _id: id, channelId: { $in: allowedChannelIds } });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const filter = req.user.organizationId 
      ? { $or: [{ organizationId: req.user.organizationId }, { userId: req.user.id }], channelId: comment.channelId }
      : { userId: req.user.id, channelId: comment.channelId };
    const channel = await Channel.findOne(filter);
    if (!channel) return res.status(404).json({ error: 'No channel connected' });

    if (channel.apiKey && action !== 'approve') {
      return res.status(400).json({
        success: false,
        error: 'Action not supported for API key channels.'
      });
    }

    let youtube;
    if (!channel.apiKey) {
      const decryptedTokens = {
        access_token: decrypt(channel.accessToken),
        refresh_token: channel.refreshToken ? decrypt(channel.refreshToken) : undefined,
        expiry_date: channel.expiryDate
      };
      youtube = getYouTubeClient(decryptedTokens, null, channel._id);
    }

    if (action === 'like') {
      if (channel.apiKey) {
        return res.status(400).json({ error: 'OAuth required for liking comments.' });
      }
      await likeComment(youtube, comment.youtubeId);
      comment.autoLiked = true;
    } else if (action === 'delete') {
      if (channel.apiKey) {
        return res.status(400).json({ error: 'OAuth required for deleting comments.' });
      }
      await deleteCommentFromYouTube(youtube, comment.youtubeId);
      comment.status = 'deleted';
    } else if (action === 'hide') {
      if (channel.apiKey) {
        return res.status(400).json({ error: 'OAuth required for hiding comments.' });
      }
      await hideComment(youtube, comment.youtubeId);
      comment.status = 'hidden';
    } else if (action === 'reply') {
      if (!replyText) return res.status(400).json({ error: 'Reply text is required' });
      if (channel.apiKey) {
        return res.status(400).json({ error: 'OAuth required for replying to comments.' });
      }
      await replyToComment(youtube, comment.youtubeId, replyText);
      comment.autoReplied = true;
      comment.replyText = replyText;
    } else if (action === 'approve') {
      comment.status = 'approved';
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    comment.aiActionTaken = true;
    await comment.save();

    const io = req.app.get('io');
    if (io) {
      const roomName = comment.userId.toString();
      io.to(roomName).emit('stats_updated');
      debouncedEmit(io, roomName, 'stats_updated');
    }

    res.json({ success: true, comment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const editComment = async (req, res) => {
  const { id } = req.params;
  const { sentiment, status, note } = req.body;

  try {
    const allowedChannelIds = await getUserChannelIds(req.user);
    const comment = await Comment.findOne({ _id: id, channelId: { $in: allowedChannelIds } });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    if (sentiment) comment.sentiment = sentiment;
    if (status) comment.status = status;
    if (note !== undefined) comment.note = note;
    
    if (status === 'approved') comment.aiActionTaken = true;

    await comment.save();
    const io = req.app.get('io');
    if (io) {
      const roomName = comment.userId.toString();
      io.to(roomName).emit('stats_updated');
      debouncedEmit(io, roomName, 'stats_updated');
    }
    
    res.json({ success: true, comment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const reanalyzeComments = async (req, res) => {
  try {
    const { sentimentFilter } = req.body;
    const allowedChannelIds = await getUserChannelIds(req.user);
    const comments = await Comment.find({ channelId: { $in: allowedChannelIds }, ...(sentimentFilter && { sentiment: sentimentFilter }) });
    
    const runReanalysis = async () => {
      for (const comment of comments) {
        const aiResult = await classifyComment(comment.text);
        comment.sentiment = aiResult.sentiment;
        await comment.save();
      }
      const io = req.app.get('io');
      if (io) io.to(req.user.id.toString()).emit('stats_updated');
    };

    runReanalysis();
    res.json({ success: true, message: 'Re-analysis started in background' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const manualSync = async (req, res) => {
  try {
    const { videoId } = req.params;
    const { channelId } = req.query;
    const filter = req.user.organizationId 
      ? { $or: [{ organizationId: req.user.organizationId }, { userId: req.user.id }], channelId }
      : { userId: req.user.id, channelId };
    const channel = await Channel.findOne(filter);
    if (!channel) return res.status(404).json({ error: 'No channel connected' });

    const io = req.app.get('io');
    if (channel.apiKey) {
      await processComments(channel, null, decrypt(channel.apiKey), io, videoId);
    } else {
      await processComments(channel, {
        access_token: decrypt(channel.accessToken),
        refresh_token: decrypt(channel.refreshToken),
        expiry_date: channel.expiryDate,
      }, null, io, videoId);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
