import ModerationRule from '../models/ModerationRule.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import Comment from '../models/Comment.mjs';
import Channel from '../models/Channel.mjs';
import logger from '../utils/logger.mjs';

/**
 * Helper to verify user channel ownership / access under tenant organization
 */
const verifyChannelAccess = async (organizationId, userId, channelId) => {
  const filter = organizationId 
    ? { channelId, $or: [{ organizationId }, { userId }] }
    : { channelId, userId };
  const channel = await Channel.findOne(filter).lean();
  return !!channel;
};

/**
 * GET /api/moderation/rules
 * Fetch moderation rules for a given channelId, scoped by req.user.organizationId
 */
export const getModerationRules = async (req, res) => {
  try {
    const { channelId } = req.query;
    const organizationId = req.user.organizationId || req.user.id;
    
    let query = { organizationId };
    if (channelId) {
      query.channelId = channelId;
    }


    let rule = await ModerationRule.findOne({ organizationId, channelId }).lean();
    
    // Seed default rule document if none exists yet
    if (!rule) {
      const defaultRule = new ModerationRule({
        organizationId,
        channelId,
        autoMod: true,
        confidenceThreshold: 85,
        rules: {
          toxicDetection: true,
          spamDetection: true,
          hateSpeech: true,
          abuse: true,
          scam: true,
          sexualContent: true,
          duplicateComments: true,
          linkSpam: true
        },
        action: 'delete'
      });
      await defaultRule.save();
      rule = defaultRule.toObject();
    }

    res.json({ success: true, rule });
  } catch (error) {
    logger.error('Error in getModerationRules:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/moderation/rules
 * Save or update moderation rules for a channelId, scoped by req.user.organizationId
 */
export const updateModerationRules = async (req, res) => {
  try {
    const { channelId, autoMod, confidenceThreshold, rules, action } = req.body;
    const organizationId = req.user.organizationId || req.user.id;


    const updateFields = {};
    if (autoMod !== undefined) updateFields.autoMod = !!autoMod;
    if (confidenceThreshold !== undefined) updateFields.confidenceThreshold = Number(confidenceThreshold);
    if (action && ['delete', 'hold'].includes(action)) updateFields.action = action;
    if (rules && typeof rules === 'object') {
      updateFields.rules = {
        toxicDetection: rules.toxicDetection !== undefined ? !!rules.toxicDetection : true,
        spamDetection: rules.spamDetection !== undefined ? !!rules.spamDetection : true,
        hateSpeech: rules.hateSpeech !== undefined ? !!rules.hateSpeech : true,
        abuse: rules.abuse !== undefined ? !!rules.abuse : true,
        scam: rules.scam !== undefined ? !!rules.scam : true,
        sexualContent: rules.sexualContent !== undefined ? !!rules.sexualContent : true,
        duplicateComments: rules.duplicateComments !== undefined ? !!rules.duplicateComments : true,
        linkSpam: rules.linkSpam !== undefined ? !!rules.linkSpam : true
      };
    }

    const updatedRule = await ModerationRule.findOneAndUpdate(
      { organizationId, channelId },
      { $set: updateFields },
      { upsert: true, returnDocument: 'after' }
    );

    res.json({ success: true, rule: updatedRule });
  } catch (error) {
    logger.error('Error in updateModerationRules:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/moderation/comments
 * Paginated held/deleted comment history for the client dashboard, scoped by organizationId + selected channelId
 */
export const getModeratedComments = async (req, res) => {
  try {
    const { channelId, page = 1, limit = 20, statusFilter } = req.query;
    if (!channelId) {
      return res.status(400).json({ error: 'channelId query parameter is required' });
    }

    const organizationId = req.user.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'User is not assigned to an organization' });
    }

    const hasAccess = await verifyChannelAccess(organizationId, req.user.id, channelId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to the specified channel' });
    }

    const query = {
      organizationId,
      channelId
    };

    if (statusFilter && ['deleted', 'flagged'].includes(statusFilter)) {
      query.status = statusFilter;
    } else {
      query.status = { $in: ['deleted', 'flagged'] };
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const comments = await Comment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await Comment.countDocuments(query);
    const deletedCount = await Comment.countDocuments({ organizationId, channelId, status: 'deleted' });
    const heldCount = await Comment.countDocuments({ organizationId, channelId, status: 'flagged' });

    res.json({
      success: true,
      comments,
      stats: {
        totalModerated: deletedCount + heldCount,
        deleted: deletedCount,
        hidden: heldCount
      },
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    logger.error('Error in getModeratedComments:', error);
    res.status(500).json({ error: error.message });
  }
};
