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
    const organizationId = req.user.organizationId || (mongoose.Types.ObjectId.isValid(req.user.id) ? req.user.id : new mongoose.Types.ObjectId());
    
    let targetChannelId = channelId;
    if (!targetChannelId) {
      const activeChannel = await Channel.findOne({ userId: req.user.id }).lean();
      if (activeChannel) {
        targetChannelId = activeChannel.channelId;
      }
    }

    // Default safe rules object if no channel exists or no rule created
    const defaultRulesObj = {
      toxicDetection: true,
      spamDetection: true,
      hateSpeech: true,
      abuse: true,
      scam: true,
      sexualContent: true,
      duplicateComments: true,
      linkSpam: true
    };

    if (!targetChannelId) {
      return res.json({
        success: true,
        rule: {
          organizationId,
          channelId: null,
          autoMod: true,
          confidenceThreshold: 85,
          rules: defaultRulesObj,
          action: 'delete'
        },
        message: 'No connected channel found. Returning default rules.'
      });
    }

    let rule = await ModerationRule.findOne({ 
      $or: [
        { organizationId, channelId: targetChannelId },
        { userId: req.user.id, channelId: targetChannelId }
      ]
    }).lean();
    
    // Seed default rule document if none exists yet
    if (!rule) {
      try {
        const defaultRule = new ModerationRule({
          organizationId,
          userId: req.user.id,
          channelId: targetChannelId,
          autoMod: true,
          confidenceThreshold: 85,
          rules: defaultRulesObj,
          action: 'delete'
        });
        await defaultRule.save();
        rule = defaultRule.toObject();
      } catch (validationErr) {
        logger.warn(`ModerationRule creation fallback: ${validationErr.message}`);
        rule = {
          organizationId,
          channelId: targetChannelId,
          autoMod: true,
          confidenceThreshold: 85,
          rules: defaultRulesObj,
          action: 'delete'
        };
      }
    }

    return res.json({ success: true, rule });
  } catch (error) {
    logger.error('Error in getModerationRules:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch moderation rules' });
  }
};

/**
 * POST / PUT /api/moderation/rules
 * Save or update moderation rules for a channelId, scoped by req.user.organizationId
 */
export const updateModerationRules = async (req, res) => {
  try {
    const { channelId, autoMod, confidenceThreshold, rules, action } = req.body;
    const organizationId = req.user.organizationId || (mongoose.Types.ObjectId.isValid(req.user.id) ? req.user.id : new mongoose.Types.ObjectId());

    let targetChannelId = channelId;
    if (!targetChannelId) {
      const activeChannel = await Channel.findOne({ userId: req.user.id }).lean();
      if (activeChannel) {
        targetChannelId = activeChannel.channelId;
      }
    }

    if (!targetChannelId) {
      return res.status(400).json({
        success: false,
        message: 'channelId is required to update moderation rules'
      });
    }

    const updateFields = {
      channelId: targetChannelId,
      userId: req.user.id
    };
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
      { organizationId, channelId: targetChannelId },
      { $set: updateFields },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    return res.json({ success: true, rule: updatedRule });
  } catch (error) {
    logger.error('Error in updateModerationRules:', error);
    return res.status(500).json({ success: false, error: error.message });
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

/**
 * GET /api/moderation/logs
 * Fetch audit logs of automated or manual moderation actions
 */
export const getModerationLogs = async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organizationId || userId;
    const { page = 1, limit = 20 } = req.query;

    const query = {
      $or: [{ organizationId }, { userId }]
    };

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));

    const logs = await ModerationLog.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const total = await ModerationLog.countDocuments(query);

    return res.json({
      success: true,
      logs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    logger.error('Error in getModerationLogs:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch moderation logs' });
  }
};
