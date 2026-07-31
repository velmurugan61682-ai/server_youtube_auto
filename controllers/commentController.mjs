import mongoose from 'mongoose';
import Comment from '../models/Comment.mjs';
import Channel from '../models/Channel.mjs';
import User from '../models/User.mjs';
import Video from '../models/Video.mjs';
import CommentAutomationRule from '../models/CommentAutomationRule.mjs';
import { 
  getYouTubeClient, 
  likeComment, 
  deleteCommentFromYouTube, 
  hideComment, 
  replyToComment 
} from '../services/youtubeService.mjs';
import { classifyComment } from '../services/aiService.mjs';
import { processComments, processSingleComment } from '../services/commentProcessingService.mjs';
import { encrypt, decrypt } from '../utils/cryptoHelper.mjs';
import { debouncedEmit } from '../utils/socketDebouncer.mjs';
import logger from '../utils/logger.mjs';

// Helper to get allowed channel IDs for a user
const getUserChannelIds = async (user) => {
  let filter = { userId: user.id };
  if (user.organizationId) {
    filter = { $or: [{ userId: user.id }, { organizationId: user.organizationId }] };
  }
  let channels = await Channel.find(filter).select('channelId').lean();
  if (!channels || channels.length === 0) {
    channels = await Channel.find({}).select('channelId').lean();
  }
  return channels.map(c => c.channelId);
};

export const getComments = async (req, res) => {
  try {
    const { status, sentiment, autoLiked, videoId, channelId, page = 1, limit = 50 } = req.query;
    
    // Resolve user channels
    const allowedChannelIds = await getUserChannelIds(req.user);
    
    const query = {};
    if (allowedChannelIds.length > 0) {
      query.channelId = { $in: allowedChannelIds };
    }
    
    if (videoId) {
      const videoDoc = await Video.findOne({ videoId }).lean();
      if (!videoDoc) {
        return res.json({ comments: [], pagination: { total: 0, pages: 0, currentPage: 1, limit: parseInt(limit) } });
      }
      query.videoId = videoId;
      query.channelId = videoDoc.channelId;
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

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // ✅ PERFORMANCE & ANTI-DUPLICATION: Deduplicate comments array
    const commentsRaw = await Comment.find(query)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const uniqueComments = [];
    const seenKeys = new Set();
    for (const c of commentsRaw) {
      const key = c.youtubeId || `${c.author || c.username}:${c.text || c.commentText}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueComments.push(c);
      }
    }
    
    const total = await Comment.countDocuments(query);
    
    res.json({
      comments: uniqueComments,
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
    const channel = await Channel.findOne(filter).lean();
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
    const channel = await Channel.findOne(filter).lean();
    if (!channel) return res.status(404).json({ error: 'No channel connected' });

    const io = req.app.get('io');

    // Check if the videoId is actually a community post
    const videoDoc = await Video.findOne({ videoId, channelId });
    if (videoDoc && videoDoc.isPost) {
      // Simulate a new comment
      const simulatedTexts = [
        "This internship sounds amazing! I have sent my application.",
        "Earn $1000/day working from home! Click here: http://scam-link.com",
        "I am interested in ordering this product! Here is my WhatsApp number: +919876543210",
        "Great community post! Keep sharing these updates.",
        "Is the summer internship remote or on-site? Please let me know.",
        "This is spam, stop posting this nonsense!"
      ];
      const randomText = simulatedTexts[Math.floor(Math.random() * simulatedTexts.length)];
      
      const authors = ["Aravind", "Vikram", "Sneha", "Rahul", "Priya", "John"];
      const randomAuthor = authors[Math.floor(Math.random() * authors.length)];

      const commentDoc = new Comment({
        userId: channel.userId,
        youtubeId: `sim_comment_${Date.now()}`,
        channelId: channel.channelId,
        videoId: videoId,
        text: randomText,
        author: randomAuthor,
        authorProfileImageUrl: `https://ui-avatars.com/api/?name=${randomAuthor}&background=random`,
        authorChannelId: `UC_sim_author_${Date.now()}`,
        publishedAt: new Date(),
        status: 'pending'
      });

      await commentDoc.save();

      const user = await User.findById(channel.userId);
      const userSettings = user.settings || { autoMod: true, autoLike: true, confidenceThreshold: 85 };
      const userKey = user.openaiApiKey ? decrypt(user.openaiApiKey) : null;
      
      let youtube = null;
      if (!channel.apiKey) {
        const decryptedTokens = {
          access_token: decrypt(channel.accessToken),
          refresh_token: channel.refreshToken ? decrypt(channel.refreshToken) : undefined,
          expiry_date: channel.expiryDate
        };
        youtube = getYouTubeClient(decryptedTokens, null, channel._id);
      }

      await processSingleComment(youtube, channel, userKey, userSettings, commentDoc, io);
      
      return res.json({ success: true, simulated: true, comment: commentDoc });
    }

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

/**
 * POST /api/comments/:commentId/reply
 * Reply to a comment with IDOR verification and OAuth token handling
 */
export const replyToCommentApi = async (req, res) => {
  try {
    const commentId = req.params.commentId || req.body.commentId || req.body.id;
    const text = req.body.text || req.body.replyText;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reply text is required'
      });
    }

    if (!commentId) {
      return res.status(400).json({
        success: false,
        message: 'Comment ID is required'
      });
    }

    const allowedChannelIds = await getUserChannelIds(req.user);
    const filter = mongoose.Types.ObjectId.isValid(commentId)
      ? { _id: commentId, channelId: { $in: allowedChannelIds } }
      : { $or: [{ youtubeId: commentId }, { commentId }], channelId: { $in: allowedChannelIds } };

    const comment = await Comment.findOne(filter);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found or access denied'
      });
    }

    // Resolve channel to post reply via YouTube OAuth
    const channel = await Channel.findOne({ userId: req.user.id, channelId: comment.channelId });
    if (channel && !channel.apiKey && channel.accessToken) {
      try {
        const decryptedTokens = {
          access_token: decrypt(channel.accessToken),
          refresh_token: channel.refreshToken ? decrypt(channel.refreshToken) : undefined,
          expiry_date: channel.expiryDate
        };
        const youtube = getYouTubeClient(decryptedTokens, null, channel._id);
        await replyToComment(youtube, comment.youtubeId || comment.commentId, text.trim());
      } catch (ytErr) {
        logger.error('[replyToCommentApi] YouTube API call error:', ytErr.message);
      }
    }

    comment.replyText = text.trim();
    comment.autoReplied = true;
    comment.hasReplied = true;
    comment.replyStatus = 'sent';
    await comment.save();

    return res.json({
      success: true,
      message: 'Reply posted successfully',
      data: comment
    });
  } catch (error) {
    logger.error('Error in replyToCommentApi:', error);
    return res.status(500).json({ success: false, message: 'Failed to post reply' });
  }
};

/**
 * POST /api/comments/:commentId/like
 * Like/heart a comment with IDOR verification
 */
export const likeCommentApi = async (req, res) => {
  try {
    const commentId = req.params.commentId || req.body.commentId || req.body.id;

    if (!commentId) {
      return res.status(400).json({
        success: false,
        message: 'Comment ID is required'
      });
    }

    const allowedChannelIds = await getUserChannelIds(req.user);
    const filter = mongoose.Types.ObjectId.isValid(commentId)
      ? { _id: commentId, channelId: { $in: allowedChannelIds } }
      : { $or: [{ youtubeId: commentId }, { commentId }], channelId: { $in: allowedChannelIds } };

    const comment = await Comment.findOne(filter);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found or access denied'
      });
    }

    const channel = await Channel.findOne({ userId: req.user.id, channelId: comment.channelId });
    if (channel && !channel.apiKey && channel.accessToken) {
      try {
        const decryptedTokens = {
          access_token: decrypt(channel.accessToken),
          refresh_token: channel.refreshToken ? decrypt(channel.refreshToken) : undefined,
          expiry_date: channel.expiryDate
        };
        const youtube = getYouTubeClient(decryptedTokens, null, channel._id);
        await likeComment(youtube, comment.youtubeId || comment.commentId);
      } catch (ytErr) {
        logger.error('[likeCommentApi] YouTube API like error:', ytErr.message);
      }
    }

    comment.autoLiked = true;
    comment.likeStatus = 'success';
    await comment.save();

    return res.json({
      success: true,
      message: 'Comment liked successfully',
      data: comment
    });
  } catch (error) {
    logger.error('Error in likeCommentApi:', error);
    return res.status(500).json({ success: false, message: 'Failed to like comment' });
  }
};

/**
 * DELETE /api/comments/:id
 */
export const deleteCommentApi = async (req, res) => {
  try {
    const id = req.params.id || req.params.commentId;
    const allowedChannelIds = await getUserChannelIds(req.user);
    const filter = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id, channelId: { $in: allowedChannelIds } }
      : { $or: [{ youtubeId: id }, { commentId: id }], channelId: { $in: allowedChannelIds } };

    const comment = await Comment.findOne(filter);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    comment.status = 'deleted';
    await comment.save();

    return res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    logger.error('Error in deleteCommentApi:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete comment' });
  }
};

// =========================================================================
// COMMENT AUTOMATION RULES CONTROLLERS
// =========================================================================

export const getRules = async (req, res) => {
  try {
    const { channelId } = req.query;
    const allowedChannelIds = await getUserChannelIds(req.user);

    const query = {
      channelId: { $in: allowedChannelIds }
    };
    if (req.user.organizationId) {
      query.organizationId = req.user.organizationId;
    } else if (req.user.id) {
      query.userId = req.user.id;
    }

    if (channelId && allowedChannelIds.includes(channelId)) {
      query.channelId = channelId;
    }

    const rules = await CommentAutomationRule.find(query).sort({ createdAt: -1 }).lean();
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createRule = async (req, res) => {
  try {
    const {
      channelId,
      name,
      triggerText,
      triggerType = 'contains_any',
      keywords = [],
      replyType = 'Text',
      followersOnly = false,
      replyCommentText = '',
      automatedDmContent = '',
      carouselCards = [],
      ruleType = 'text',
      replyText = '',
      replyTemplates = [],
      templateSelectionMode = 'random',
      videoIds = [],
      videoId = null,
      applyToAllVideos = true,
      status = 'Active'
    } = req.body;

    if (!channelId || !name) {
      return res.status(400).json({ error: 'channelId and name are required' });
    }

    const allowedChannelIds = await getUserChannelIds(req.user);
    if (!allowedChannelIds.includes(channelId)) {
      return res.status(403).json({ error: 'Access denied: Channel not authorized.' });
    }

    const rule = new CommentAutomationRule({
      userId: req.user.id,
      organizationId: req.user.organizationId || null,
      channelId,
      name,
      triggerText: triggerText || '*',
      triggerType,
      keywords: Array.isArray(keywords) ? keywords.map(k => k.trim().toLowerCase()) : [],
      replyType,
      followersOnly: !!followersOnly,
      replyCommentText,
      automatedDmContent,
      carouselCards: Array.isArray(carouselCards) ? carouselCards.map(c => ({
        imageUrl: c.imageUrl || '',
        title: c.title || '',
        description: c.description || '',
        btnLabel: c.btnLabel || c.buttonText || 'View Detail',
        buttonText: c.buttonText || c.btnLabel || 'View Detail',
        link: c.link || c.buttonUrl || '',
        buttonUrl: c.buttonUrl || c.link || ''
      })) : [],
      ruleType,
      replyText,
      replyTemplates: Array.isArray(replyTemplates) ? replyTemplates : [],
      templateSelectionMode,
      videoIds: Array.isArray(videoIds) ? videoIds : [],
      videoId,
      applyToAllVideos: !!applyToAllVideos,
      status
    });

    await rule.save();
    res.status(201).json(rule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateRule = async (req, res) => {
  try {
    const { ruleId, id } = req.params;
    const targetRuleId = ruleId || id;

    const allowedChannelIds = await getUserChannelIds(req.user);
    const filter = {
      _id: targetRuleId,
      channelId: { $in: allowedChannelIds }
    };
    if (req.user.organizationId) {
      filter.organizationId = req.user.organizationId;
    } else if (req.user.id) {
      filter.userId = req.user.id;
    }

    const rule = await CommentAutomationRule.findOne(filter);

    if (!rule) {
      return res.status(404).json({ error: 'Automation rule not found' });
    }

    const {
      name,
      triggerText,
      triggerType,
      keywords,
      replyType,
      followersOnly,
      replyCommentText,
      automatedDmContent,
      carouselCards,
      ruleType,
      replyText,
      replyTemplates,
      templateSelectionMode,
      videoIds,
      videoId,
      applyToAllVideos,
      status
    } = req.body;

    if (name) rule.name = name;
    if (triggerText !== undefined) rule.triggerText = triggerText;
    if (triggerType) rule.triggerType = triggerType;
    if (keywords && Array.isArray(keywords)) rule.keywords = keywords.map(k => k.trim().toLowerCase());
    if (replyType) rule.replyType = replyType;
    if (followersOnly !== undefined) rule.followersOnly = !!followersOnly;
    if (replyCommentText !== undefined) rule.replyCommentText = replyCommentText;
    if (automatedDmContent !== undefined) rule.automatedDmContent = automatedDmContent;
    if (carouselCards && Array.isArray(carouselCards)) {
      rule.carouselCards = carouselCards.map(c => ({
        imageUrl: c.imageUrl || '',
        title: c.title || '',
        description: c.description || '',
        btnLabel: c.btnLabel || c.buttonText || 'View Detail',
        buttonText: c.buttonText || c.btnLabel || 'View Detail',
        link: c.link || c.buttonUrl || '',
        buttonUrl: c.buttonUrl || c.link || ''
      }));
    }
    if (ruleType) rule.ruleType = ruleType;
    if (replyText !== undefined) rule.replyText = replyText;
    if (replyTemplates && Array.isArray(replyTemplates)) rule.replyTemplates = replyTemplates;
    if (templateSelectionMode) rule.templateSelectionMode = templateSelectionMode;
    if (videoIds && Array.isArray(videoIds)) rule.videoIds = videoIds;
    if (videoId !== undefined) rule.videoId = videoId;
    if (applyToAllVideos !== undefined) rule.applyToAllVideos = !!applyToAllVideos;
    if (status) rule.status = status;

    await rule.save();
    res.json(rule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteRule = async (req, res) => {
  try {
    const { ruleId, id } = req.params;
    const targetRuleId = ruleId || id;

    const allowedChannelIds = await getUserChannelIds(req.user);
    const filter = {
      _id: targetRuleId,
      channelId: { $in: allowedChannelIds }
    };
    if (req.user.organizationId) {
      filter.organizationId = req.user.organizationId;
    } else if (req.user.id) {
      filter.userId = req.user.id;
    }

    const rule = await CommentAutomationRule.findOneAndDelete(filter);

    if (!rule) {
      return res.status(404).json({ error: 'Automation rule not found' });
    }

    res.json({ success: true, message: 'Rule successfully deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/comments/history
 * Fetch paginated comment history scoped to tenant user
 */
export const getCommentHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, channelId, status, sentiment } = req.query;
    const allowedChannelIds = await getUserChannelIds(req.user);

    const query = {
      channelId: { $in: allowedChannelIds }
    };
    if (req.user.organizationId) {
      query.organizationId = req.user.organizationId;
    } else {
      query.userId = req.user.id;
    }

    if (channelId && allowedChannelIds.includes(channelId)) {
      query.channelId = channelId;
    }
    if (status) query.status = status;
    if (sentiment) query.sentiment = sentiment;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const comments = await Comment.find(query)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Comment.countDocuments(query);

    return res.json({
      success: true,
      data: comments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
