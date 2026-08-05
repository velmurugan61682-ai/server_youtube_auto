import LiveChatMode from '../models/LiveChatMode.mjs';
import LiveChatMessage from '../models/LiveChatMessage.mjs';
import Comment from '../models/Comment.mjs';
import Channel from '../models/Channel.mjs';
import Video from '../models/Video.mjs';
import { 
  getYouTubeClient, 
  postLiveChatMessage, 
  fetchLiveChatMessages, 
  fetchChannelLiveStreams,
  deleteLiveChatMessage,
  hideLiveChatUser,
  replyToComment,
  deleteCommentFromYouTube,
  hideComment
} from '../services/youtubeService.mjs';
import { classifyComment } from '../services/aiService.mjs';
import { decrypt } from '../utils/cryptoHelper.mjs';
import logger from '../utils/logger.mjs';
import User from '../models/User.mjs';
import { processSingleComment } from '../services/commentProcessingService.mjs';

/**
 * Helper to verify channel ownership / tenant access
 */
const verifyChannelAccess = async (organizationId, userId, channelId) => {
  const filter = organizationId 
    ? { channelId, $or: [{ organizationId }, { userId }] }
    : { channelId, userId };
  const channel = await Channel.findOne(filter).lean();
  return channel;
};

/**
 * GET /api/live-chat/streams
 * Fetch active/recent YouTube Live streams for a channel
 */
export const getLiveStreams = async (req, res) => {
  try {
    const { channelId } = req.query;
    if (!channelId) {
      return res.status(400).json({ error: 'channelId is required' });
    }

    const organizationId = req.user.organizationId;
    const channel = await verifyChannelAccess(organizationId, req.user.id, channelId);
    if (!channel) {
      return res.status(403).json({ error: 'Access denied: Channel not authorized' });
    }

    if (channel.reconnectRequired || (!channel.accessToken && !channel.apiKey)) {
      logger.info(`[LIVE STREAM] Skipping live streams fetch for reconnect-required channel: ${channel.title || channelId}`);
      return res.json([]);
    }

    let youtube;
    if (channel.apiKey) {
      youtube = getYouTubeClient({ access_token: '' }, null, channel._id);
    } else {
      const oauthTokens = {
        access_token: decrypt(channel.accessToken),
        refresh_token: channel.refreshToken ? decrypt(channel.refreshToken) : undefined,
        expiry_date: channel.expiryDate
      };
      youtube = getYouTubeClient(oauthTokens, null, channel._id);
    }

    let streams = [];
    try {
      streams = await fetchChannelLiveStreams(youtube, channelId, { allowSearchFallback: true });
    } catch (err) {
      logger.warn(`Could not fetch live streams directly from YT API: ${err.message}`);
    }

    // Persist/upsert live streams to DB cleanly without duplicates
    if (streams.length > 0) {
      for (const s of streams) {
        await Video.findOneAndUpdate(
          { channelId, videoId: s.videoId },
          {
            $set: {
              userId: req.user.id,
              channelId,
              videoId: s.videoId,
              title: s.title,
              description: s.description,
              thumbnail: (s.thumbnail || '').replace(/_live\.jpg$/i, '.jpg'),
              isLive: true,
              liveBroadcastContent: 'live',
              liveChatId: s.liveChatId || '',
              publishedAt: s.publishedAt,
              statistics: {
                viewCount: s.concurrentViewers,
                likeCount: s.likeCount,
                commentCount: s.commentCount
              }
            }
          },
          { upsert: true, returnDocument: 'after' }
        );
      }
    } else {
      // Fallback query saved live videos from DB
      const dbLiveVideos = await Video.find({
        channelId,
        $or: [
          { isLive: true },
          { liveBroadcastContent: { $in: ['live', 'completed', 'upcoming'] } },
          { title: { $regex: /^LIVE\s*\||LIVE STREAM|WAS LIVE/i } }
        ]
      }).sort({ publishedAt: -1, createdAt: -1 }).lean();
      if (dbLiveVideos.length > 0) {
        streams = dbLiveVideos.map(v => ({
          videoId: v.videoId,
          title: v.title,
          description: v.description || '',
          thumbnail: v.thumbnail || '',
          liveChatId: v.liveChatId || `lc_${v.videoId}`,
          concurrentViewers: v.statistics?.viewCount || 0,
          likeCount: v.statistics?.likeCount || 0,
          commentCount: v.statistics?.commentCount || 0,
          publishedAt: v.publishedAt || v.createdAt,
          liveBroadcastContent: v.liveBroadcastContent || (v.isLive ? 'live' : 'completed'),
          isLive: Boolean(v.isLive || v.liveBroadcastContent === 'live')
        }));
      }
    }

    res.json({
      success: true,
      streams
    });
  } catch (error) {
    logger.error('Error in getLiveStreams controller:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/live-chat/toggle-mode
 * Toggle bot / human handoff mode per liveChatId
 */
export const toggleMode = async (req, res) => {
  try {
    const { liveChatId, channelId, mode } = req.body;
    if (!liveChatId || !channelId || !mode || !['bot', 'human'].includes(mode)) {
      return res.status(400).json({ error: 'liveChatId, channelId, and valid mode (bot or human) are required' });
    }

    const organizationId = req.user.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'User is not assigned to an organization' });
    }

    const channel = await verifyChannelAccess(organizationId, req.user.id, channelId);
    if (!channel) {
      return res.status(403).json({ error: 'Access denied: Channel not authorized' });
    }

    const modeDoc = await LiveChatMode.findOneAndUpdate(
      { organizationId, channelId, liveChatId },
      {
        $set: {
          mode,
          handledBy: mode === 'human' ? req.user.id : null
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    const io = req.app.get('io');
    if (io) {
      const orgRoom = organizationId.toString();
      io.to(orgRoom).emit('live_chat_mode_changed', {
        liveChatId,
        channelId,
        mode,
        handledBy: mode === 'human' ? req.user.id : null
      });
    }

    res.json({ success: true, mode: modeDoc });
  } catch (error) {
    logger.error('Error in toggleMode controller:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/live-chat/messages
 * Fetch paginated live chat messages history
 */
export const getMessages = async (req, res) => {
  try {
    const { channelId, liveChatId, page = 1, limit = 50 } = req.query;
    if (!channelId || !liveChatId) {
      return res.status(400).json({ error: 'channelId and liveChatId query parameters are required' });
    }

    const organizationId = req.user.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'User is not assigned to an organization' });
    }

    const channel = await verifyChannelAccess(organizationId, req.user.id, channelId);
    if (!channel) {
      return res.status(403).json({ error: 'Access denied: Channel not authorized' });
    }

    const modeDoc = await LiveChatMode.findOne({ organizationId, channelId, liveChatId }).lean();
    const currentMode = modeDoc ? modeDoc.mode : 'bot';

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const query = { organizationId, channelId, liveChatId };

    const messages = await LiveChatMessage.find(query)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await LiveChatMessage.countDocuments(query);

    res.json({
      success: true,
      mode: currentMode,
      messages,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    logger.error('Error in getMessages controller:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/live-chat/send
 * Post a human agent message to YouTube Live Chat
 */
export const sendMessage = async (req, res) => {
  try {
    const { channelId, liveChatId, messageText } = req.body;
    if (!channelId || !liveChatId || !messageText) {
      return res.status(400).json({ error: 'channelId, liveChatId, and messageText are required' });
    }

    const organizationId = req.user.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'User is not assigned to an organization' });
    }

    const channel = await verifyChannelAccess(organizationId, req.user.id, channelId);
    if (!channel) {
      return res.status(403).json({ error: 'Access denied: Channel not authorized' });
    }

    if (channel.apiKey) {
      return res.status(400).json({ error: 'OAuth channel credentials required to post live chat messages.' });
    }

    const oauthTokens = {
      access_token: decrypt(channel.accessToken),
      refresh_token: channel.refreshToken ? decrypt(channel.refreshToken) : undefined,
      expiry_date: channel.expiryDate
    };
    const youtube = getYouTubeClient(oauthTokens, null, channel._id);

    const postResult = await postLiveChatMessage(youtube, liveChatId, messageText);
    if (!postResult.success) {
      return res.status(400).json({ error: postResult.reason });
    }

    const msgDoc = new LiveChatMessage({
      organizationId,
      channelId,
      liveChatId,
      messageId: postResult.messageId || `agent_${Date.now()}`,
      authorName: req.user.email || 'Human Agent',
      messageText,
      isOwner: true,
      senderType: 'human_agent',
      publishedAt: new Date()
    });
    await msgDoc.save();

    const io = req.app.get('io');
    if (io) {
      io.to(organizationId.toString()).emit('live_chat_message', msgDoc);
    }

    res.json({ success: true, message: msgDoc });
  } catch (error) {
    logger.error('Error in sendMessage controller:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/live-chat/delete
 * Delete a live chat message or comment
 */
export const deleteLiveMessage = async (req, res) => {
  try {
    const { channelId, liveChatId, messageId, commentId } = req.body;
    const organizationId = req.user.organizationId;

    if (messageId) {
      await LiveChatMessage.deleteOne({ messageId, organizationId });
      const io = req.app.get('io');
      if (io && organizationId) {
        io.to(organizationId.toString()).emit('live_chat_message_deleted', { messageId });
      }
    }

    if (commentId) {
      await Comment.updateOne({ _id: commentId }, { $set: { status: 'deleted' } });
    }

    res.json({ success: true, message: 'Message/Comment deleted successfully' });
  } catch (error) {
    logger.error('Error in deleteLiveMessage:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/live-chat/hide
 * Hide a live chat message or comment
 */
export const hideLiveMessage = async (req, res) => {
  try {
    const { channelId, liveChatId, messageId, commentId } = req.body;
    const organizationId = req.user.organizationId;

    if (messageId) {
      await LiveChatMessage.updateOne({ messageId, organizationId }, { $set: { senderType: 'hidden' } });
      const io = req.app.get('io');
      if (io && organizationId) {
        io.to(organizationId.toString()).emit('live_chat_message_hidden', { messageId });
      }
    }

    if (commentId) {
      await Comment.updateOne({ _id: commentId }, { $set: { status: 'hidden' } });
    }

    res.json({ success: true, message: 'Message/Comment hidden successfully' });
  } catch (error) {
    logger.error('Error in hideLiveMessage:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/live-chat/reply
 * Reply to a live chat message or comment
 */
export const replyLiveMessage = async (req, res) => {
  try {
    const { channelId, liveChatId, messageId, commentId, replyText } = req.body;
    if (!replyText) {
      return res.status(400).json({ error: 'replyText is required' });
    }

    const organizationId = req.user.organizationId;
    const channel = await verifyChannelAccess(organizationId, req.user.id, channelId);

    if (commentId && channel && !channel.apiKey) {
      const commentDoc = await Comment.findById(commentId);
      if (commentDoc) {
        const oauthTokens = {
          access_token: decrypt(channel.accessToken),
          refresh_token: channel.refreshToken ? decrypt(channel.refreshToken) : undefined,
          expiry_date: channel.expiryDate
        };
        const youtube = getYouTubeClient(oauthTokens, null, channel._id);
        await replyToComment(youtube, commentDoc.youtubeId, replyText);
        commentDoc.autoReplied = true;
        commentDoc.replyText = replyText;
        commentDoc.hasReplied = true;
        await commentDoc.save();
      }
    } else if (liveChatId && channel && !channel.apiKey) {
      const oauthTokens = {
        access_token: decrypt(channel.accessToken),
        refresh_token: channel.refreshToken ? decrypt(channel.refreshToken) : undefined,
        expiry_date: channel.expiryDate
      };
      const youtube = getYouTubeClient(oauthTokens, null, channel._id);
      await postLiveChatMessage(youtube, liveChatId, replyText);
    }

    res.json({ success: true, message: 'Reply sent successfully' });
  } catch (error) {
    logger.error('Error in replyLiveMessage:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/live-chat/sync
 * Poll / sync live chat messages from YouTube API and generate bot replies if mode === 'bot'
 */
export const syncLiveChat = async (req, res) => {
  try {
    const { channelId, liveChatId, pageToken } = req.body;
    if (!channelId || !liveChatId) {
      return res.status(400).json({ error: 'channelId and liveChatId are required' });
    }

    const organizationId = req.user.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'User is not assigned to an organization' });
    }

    const channel = await verifyChannelAccess(organizationId, req.user.id, channelId);
    if (!channel) {
      return res.status(403).json({ error: 'Access denied: Channel not authorized' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let youtube;
    if (channel.apiKey) {
      youtube = getYouTubeClient({ access_token: '' }, null, channel._id);
    } else {
      const oauthTokens = {
        access_token: decrypt(channel.accessToken),
        refresh_token: channel.refreshToken ? decrypt(channel.refreshToken) : undefined,
        expiry_date: channel.expiryDate
      };
      youtube = getYouTubeClient(oauthTokens, null, channel._id);
    }

    const chatData = await fetchLiveChatMessages(youtube, liveChatId, pageToken);
    const modeDoc = await LiveChatMode.findOne({ organizationId, channelId, liveChatId }).lean();
    const currentMode = modeDoc ? modeDoc.mode : 'bot';

    const savedMessages = [];
    const io = req.app.get('io');

    for (const item of chatData.items) {
      const exists = await LiveChatMessage.exists({ messageId: item.messageId, organizationId });
      if (exists) continue;

      const msgDoc = new LiveChatMessage({
        organizationId,
        channelId,
        liveChatId,
        messageId: item.messageId,
        authorName: item.authorName,
        authorChannelId: item.authorChannelId,
        authorProfileImageUrl: item.authorProfileImageUrl,
        messageText: item.messageText,
        isOwner: item.isOwner,
        senderType: 'user',
        publishedAt: item.publishedAt
      });
      await msgDoc.save();
      savedMessages.push(msgDoc);

      if (io) {
        io.to(organizationId.toString()).emit('live_chat_message', msgDoc);
      }

      // If not owner and bot mode active, save to Comment collection and run standard moderation/reply pipeline!
      if (!item.isOwner && currentMode === 'bot') {
        try {
          const liveVideo = await Video.findOne({ channelId, liveChatId }).lean();
          const videoId = liveVideo ? liveVideo.videoId : `live_${liveChatId}`;
          const decryptedApiKey = user.openaiApiKey ? decrypt(user.openaiApiKey) : null;
          const userSettings = user.settings || {};

          const commentDoc = new Comment({
            userId: channel.userId,
            organizationId,
            youtubeId: item.messageId,
            commentId: item.messageId,
            channelId,
            videoId,
            text: item.messageText,
            commentText: item.messageText,
            author: item.authorName,
            username: item.authorName,
            authorProfileImageUrl: item.authorProfileImageUrl,
            authorChannelId: item.authorChannelId,
            publishedAt: item.publishedAt,
            status: 'pending',
            isLiveChat: true,
            liveChatId
          });

          await commentDoc.save();

          // Execute processing single comment pipeline
          await processSingleComment(youtube, channel, decryptedApiKey, userSettings, commentDoc, io);
        } catch (pipelineErr) {
          logger.error(`[syncLiveChat] Live message pipeline processing failed for ${item.messageId}: ${pipelineErr.message}`);
        }
      }
    }

    res.json({
      success: true,
      mode: currentMode,
      newMessagesCount: savedMessages.length,
      nextPageToken: chatData.nextPageToken,
      pollingIntervalMillis: chatData.pollingIntervalMillis
    });
  } catch (error) {
    logger.error('Error in syncLiveChat controller:', error);
    res.status(500).json({ error: error.message });
  }
};
