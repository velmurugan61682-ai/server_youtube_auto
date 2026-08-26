import express from 'express';
import mongoose from 'mongoose';
import { authMiddleware } from '../middleware/auth.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import Channel from '../models/Channel.mjs';
import Video from '../models/Video.mjs';
import logger from '../utils/logger.mjs';

const router = express.Router();

/**
 * @route  GET /api/comment-history
 * @desc   Returns a merged, paginated history of AutoReplyLog + ModerationLog records,
 *         normalized to a common shape. Supports type, search, channelId, page, limit.
 * @access Private
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    const {
      channelId,
      type = 'all',    // all | replied | deleted | hidden | failed
      search = '',
      page = 1,
      limit = 20
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    // ── 1. Resolve target channel IDs ───────────────────────────────────────
    const isAdmin = req.user.role === 'admin' || req.user.isAdmin;
    let allowedChannelIds = [];

    if (channelId) {
      const targetChannel = await Channel.findOne({ channelId }).select('channelId').lean();
      if (targetChannel) {
        allowedChannelIds = [targetChannel.channelId];
      }
    }

    if (allowedChannelIds.length === 0) {
      let channelFilter = {};
      if (isAdmin) {
        channelFilter = {};
      } else if (organizationId) {
        channelFilter = { $or: [{ organizationId }, { userId }] };
      } else {
        channelFilter = { userId };
      }
      const ownedChannels = await Channel.find(channelFilter).select('channelId').lean();
      allowedChannelIds = ownedChannels.map(c => c.channelId);
    }

    if (allowedChannelIds.length === 0) {
      return res.json({
        items: [],
        summary: { total: 0, replied: 0, deleted: 0, hidden: 0, failed: 0, successRate: 0 },
        pagination: { page: pageNum, limit: limitNum, total: 0, pages: 0 }
      });
    }

    // Resolve all userIds in the organization
    const User = (await import('../models/User.mjs')).default;
    const orgUserFilter = organizationId
      ? { $or: [{ organizationId }, { _id: userId }] }
      : { _id: userId };
    const orgUsers = await User.find(orgUserFilter).select('_id').lean();
    const orgUserIds = orgUsers.map(u => u._id);

    // ── 2. Build search regex ───────────────────────────────────────────────
    const searchRegex = search ? new RegExp(search, 'i') : null;

    // ── 3. Fetch AutoReplyLog, ModerationLog, and Comment records ────────────
    let replyQuery = { channelId: { $in: allowedChannelIds } };
    if (channelId) replyQuery.channelId = channelId;
    if (searchRegex) {
      replyQuery.$or = [
        { username: searchRegex },
        { commentText: searchRegex },
        { replyText: searchRegex }
      ];
    }

    let modQuery = { channelId: { $in: allowedChannelIds } };
    if (channelId) modQuery.channelId = channelId;
    if (searchRegex) {
      modQuery.$or = [
        { authorName: searchRegex },
        { commentText: searchRegex },
        { category: searchRegex },
        { reason: searchRegex }
      ];
    }

    const CommentModel = (await import('../models/Comment.mjs')).default;
    let commentQuery = {
      channelId: { $in: allowedChannelIds },
      $or: [
        { replyText: { $exists: true, $ne: '' } },
        { aiReply: { $exists: true, $ne: '' } },
        { status: { $in: ['deleted', 'hidden', 'flagged', 'replied'] } },
        { moderationStatus: { $in: ['deleted', 'hidden', 'heldForReview'] } },
        { isModerated: true },
        { sentiment: 'toxic' }
      ]
    };
    if (channelId) commentQuery.channelId = channelId;
    if (searchRegex) {
      commentQuery.$and = [
        {
          $or: [
            { author: searchRegex },
            { text: searchRegex },
            { commentText: searchRegex },
            { replyText: searchRegex }
          ]
        }
      ];
    }

    // Pull all records across all collections (summary is computed on the complete dataset)
    const [allReplies, allMods, allComments] = await Promise.all([
      AutoReplyLog.find(replyQuery).sort({ createdAt: -1 }).lean(),
      ModerationLog.find(modQuery).sort({ createdAt: -1 }).lean(),
      CommentModel.find(commentQuery).sort({ publishedAt: -1, createdAt: -1 }).lean()
    ]);

    // ── 5. Resolve video titles ─────────────────────────────────────────────
    const allVideoIds = [
      ...allReplies.map(r => r.videoId),
      ...allMods.map(m => m.videoId),
      ...allComments.map(c => c.videoId)
    ].filter(Boolean);

    const uniqueVideoIds = [...new Set(allVideoIds)];
    const videos = await Video.find({ videoId: { $in: uniqueVideoIds } }).select('videoId title').lean();
    const videoMap = {};
    videos.forEach(v => { videoMap[v.videoId] = v.title; });

    // ── 6. Normalize AutoReplyLog records ───────────────────────────────────
    const replyItems = allReplies.map(r => ({
      id: r._id.toString(),
      commentId: r.commentId,
      type: 'replied',
      status: r.status === 'success' ? 'success' : 'failed',
      authorName: r.username || 'Anonymous',
      commentText: r.commentText || '',
      replyText: r.replyText || r.aiReply || '',
      category: null,
      confidence: null,
      reason: r.failureReason || null,
      videoTitle: videoMap[r.videoId] || 'Unknown Video',
      triggerKeyword: r.triggerKeyword || null,
      actionDate: r.createdAt
    }));

    // ── 7. Normalize ModerationLog records ──────────────────────────────────
    const modItems = allMods.map(m => {
      const execAction = (m.executedAction || m.action || 'deleted').toLowerCase();
      const historyType = (execAction === 'delete' || execAction === 'deleted' || execAction === 'remove' || execAction === 'reject') ? 'deleted' : 'hidden';
      const isSuccess = m.status !== 'Failed' && m.status !== 'failed' && !m.failureReason;
      return {
        id: m._id.toString(),
        commentId: m.commentId,
        type: historyType,
        status: isSuccess ? 'success' : 'failed',
        authorName: m.authorName || 'Anonymous',
        commentText: m.commentText || '',
        replyText: null,
        category: m.category || m.type || 'toxic',
        confidence: m.confidence != null ? (m.confidence > 1 ? m.confidence : Math.round(m.confidence * 100)) : (m.toxicityScore != null ? Math.round(m.toxicityScore * 100) : 90),
        reason: m.reason || m.failureReason || 'Toxic comment moderated',
        videoTitle: videoMap[m.videoId] || 'Unknown Video',
        triggerKeyword: null,
        actionDate: m.createdAt || m.updatedAt || new Date()
      };
    });

    // ── 7b. Normalize Comment records ───────────────────────────────────────
    const commentItems = allComments.map(c => {
      const statusLower = (c.status || '').toLowerCase();
      const modStatusLower = (c.moderationStatus || '').toLowerCase();
      const modActionLower = (c.moderationAction || c.actionTaken || '').toLowerCase();

      const isDeleted = statusLower === 'deleted' || modStatusLower === 'deleted' || modActionLower === 'delete' || modActionLower === 'deleted' || c.sentiment === 'toxic' || Boolean(c.deletedAt);
      const isHidden = statusLower === 'hidden' || modStatusLower === 'heldforreview' || modStatusLower === 'hidden' || modActionLower === 'hold' || modActionLower === 'hide';

      const historyType = isDeleted ? 'deleted' : (isHidden ? 'hidden' : 'replied');
      const isSuccess = !c.deleteFailed && c.replyStatus !== 'failed';

      return {
        id: c._id.toString(),
        commentId: c.youtubeId || c.commentId,
        type: historyType,
        status: isSuccess ? 'success' : 'failed',
        authorName: c.author || c.authorName || c.username || 'Anonymous',
        commentText: c.text || c.commentText || '',
        replyText: c.replyText || c.aiReply || '',
        category: c.sentiment || c.moderationReason || (historyType === 'deleted' ? 'toxic' : null),
        confidence: c.confidence != null ? (c.confidence > 1 ? c.confidence : Math.round(c.confidence * 100)) : (c.toxicityScore != null ? Math.round(c.toxicityScore * 100) : null),
        reason: c.deleteReason || c.deleteError || c.moderationReason || (historyType === 'deleted' ? 'Toxic comment removed' : null),
        videoTitle: videoMap[c.videoId] || 'Unknown Video',
        triggerKeyword: null,
        actionDate: c.deletedAt || c.moderatedAt || c.updatedAt || c.publishedAt || c.createdAt || new Date()
      };
    });

    // ── 8. Merge + deduplicate ───────────────────────────────────────────────
    // Priority order: ModerationLog (deleted/hidden) → Comment deleted/hidden → AutoReplyLog replies → Comment replies
    const deletedOrHiddenComments = commentItems.filter(c => c.type === 'deleted' || c.type === 'hidden');
    const replyComments = commentItems.filter(c => c.type === 'replied');
    const mergedRaw = [...modItems, ...deletedOrHiddenComments, ...replyItems, ...replyComments];

    const seenHistoryKeys = new Set();
    let merged = [];
    for (const item of mergedRaw) {
      const dedupKey = item.commentId ? `${item.commentId}_${item.type}` : item.id;
      if (dedupKey && !seenHistoryKeys.has(dedupKey)) {
        seenHistoryKeys.add(dedupKey);
        merged.push(item);
      } else if (!dedupKey) {
        merged.push(item);
      }
    }

    // ── 9. Sort newest-first ───────────────────────────────────────────────
    merged.sort((a, b) => new Date(b.actionDate) - new Date(a.actionDate));

    // ── 10. Compute summary counts from FULL UNFILTERED dataset ─────────────
    const totalReplied  = merged.filter(i => i.type === 'replied' && i.status === 'success').length;
    const totalDeleted  = merged.filter(i => i.type === 'deleted' && i.status === 'success').length;
    const totalHidden   = merged.filter(i => i.type === 'hidden' && i.status === 'success').length;
    const totalFailed   = merged.filter(i => i.status === 'failed').length;
    const totalAll      = merged.length;
    const totalSuccess  = merged.filter(i => i.status === 'success').length;
    const successRate   = totalAll > 0 ? Math.round((totalSuccess / totalAll) * 100) : 0;

    // ── 11. Apply type filter ONLY for paginated item list ──────────────────
    let filtered = merged;
    if (type === 'replied')  filtered = filtered.filter(i => i.type === 'replied');
    if (type === 'deleted')  filtered = filtered.filter(i => i.type === 'deleted');
    if (type === 'hidden')   filtered = filtered.filter(i => i.type === 'hidden');
    if (type === 'failed')   filtered = filtered.filter(i => i.status === 'failed');

    // ── 12. Paginate filtered items ─────────────────────────────────────────
    const totalFiltered = filtered.length;
    const totalPages    = Math.max(1, Math.ceil(totalFiltered / limitNum));
    const offset        = (pageNum - 1) * limitNum;
    const pageItems     = filtered.slice(offset, offset + limitNum);

    return res.json({
      items: pageItems,
      summary: {
        total:       totalAll,
        replied:     totalReplied,
        deleted:     totalDeleted,
        hidden:      totalHidden,
        failed:      totalFailed,
        successRate
      },
      pagination: {
        page:  pageNum,
        limit: limitNum,
        total: totalFiltered,
        pages: totalPages
      }
    });

  } catch (error) {
    logger.error('[Comment History] Error fetching comment history:', error.message);
    return res.status(500).json({ error: 'Failed to fetch comment history' });
  }
});

export default router;
