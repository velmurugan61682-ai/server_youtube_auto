import LiveChatMode from '../models/LiveChatMode.mjs';
import LiveChatMessage from '../models/LiveChatMessage.mjs';
import Channel from '../models/Channel.mjs';
import { getYouTubeClient, postLiveChatMessage, fetchLiveChatMessages } from '../services/youtubeService.mjs';
import { classifyComment } from '../services/aiService.mjs';
import { decrypt } from '../utils/cryptoHelper.mjs';
import logger from '../utils/logger.mjs';

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
      { upsert: true, new: true }
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

      // If mode === 'bot', generate AI response for user questions if safe
      if (currentMode === 'bot' && !item.isOwner && !channel.apiKey) {
        const aiRes = await classifyComment(item.messageText);
        if (aiRes.suggestedReply && aiRes.sentiment !== 'toxic') {
          const postRes = await postLiveChatMessage(youtube, liveChatId, aiRes.suggestedReply);
          if (postRes.success) {
            const botMsgDoc = new LiveChatMessage({
              organizationId,
              channelId,
              liveChatId,
              messageId: postRes.messageId || `bot_${Date.now()}`,
              authorName: 'AI Bot Agent',
              messageText: aiRes.suggestedReply,
              isOwner: true,
              isBotReply: true,
              senderType: 'bot',
              publishedAt: new Date()
            });
            await botMsgDoc.save();
            if (io) {
              io.to(organizationId.toString()).emit('live_chat_message', botMsgDoc);
            }
          }
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
