import Channel from '../models/Channel.mjs';
import Comment from '../models/Comment.mjs';
import logger from '../utils/logger.mjs';
import { initiateAuth as initiateOAuth } from './youtubeController.mjs';

/**
 * GET /api/channels
 * Fetch connected channels for current authenticated user/tenant
 */
export const getConnectedChannels = async (req, res) => {
  try {
    const filter = req.user.organizationId 
      ? { $or: [{ organizationId: req.user.organizationId }, { userId: req.user.id }] }
      : { userId: req.user.id };
    
    const channels = await Channel.find(filter)
      .select('title channelId customUrl description thumbnailUrl statistics status apiKey reconnectRequired reconnectReason createdAt')
      .lean();

    return res.json({
      success: true,
      data: channels
    });
  } catch (error) {
    logger.error('Error fetching connected channels:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch connected channels' });
  }
};

/**
 * POST /api/channels/connect
 * Initiate YouTube channel connection via Google OAuth
 */
export const connectChannel = async (req, res) => {
  return initiateOAuth(req, res);
};

/**
 * DELETE /api/channels/:id
 * Disconnect YouTube channel and clear user-scoped comment records
 */
export const disconnectChannel = async (req, res) => {
  try {
    const channelId = req.params.id || req.params.channelId;
    if (!channelId) {
      return res.status(400).json({ success: false, error: 'Channel ID parameter is required' });
    }

    const filter = req.user.organizationId 
      ? { $or: [{ organizationId: req.user.organizationId }, { userId: req.user.id }], channelId }
      : { userId: req.user.id, channelId };

    const deletedChannel = await Channel.findOneAndDelete(filter);
    if (!deletedChannel) {
      return res.status(404).json({ success: false, error: 'Channel not found or unauthorized' });
    }

    await Comment.deleteMany({ channelId });

    return res.json({
      success: true,
      message: 'Channel disconnected successfully',
      data: { channelId }
    });
  } catch (error) {
    logger.error('Error disconnecting channel:', error);
    return res.status(500).json({ success: false, error: 'Failed to disconnect channel' });
  }
};
