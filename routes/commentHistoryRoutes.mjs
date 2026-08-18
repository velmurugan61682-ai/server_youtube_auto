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

    // ── 1. Resolve channels the user/org owns ──────────────────────────────
    const isAdmin = req.user.role === 'admin' || req.user.isAdmin;
    let channelFilter = {};
    if (isAdmin) {
      channelFilter = channelId ? { channelId } : {};
    } else if (organizationId) {
      channelFilter = channelId
        ? { $and: [{ $or: [{ organizationId }, { userId }] }, { channelId }] }
        : { $or: [{ organizationId }, { userId }] };
    } else {
      channelFilter = channelId ? { userId, channelId } : { userId };
    }

    const ownedChannels = await Channel.find(channelFilter).select('channelId').lean();
    const allowedChannelIds = ownedChannels.map(c => c.channelId);

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
        { commentText: searchRegex }
      ];
    }

    const CommentModel = (await import('../models/Comment.mjs')).default;
    let commentQuery = {
      channelId: { $in: allowedChannelIds },
      $or: [
        { replyText: { $exists: true, $ne: '' } },
        { aiReply: { $exists: true, $ne: '' } },
        { status: { $in: ['deleted', 'hidden', 'flagged', 'replied'] } }
      ]
    };
    if (channelId) commentQuery.channelId = channelId;

    // Pull all records (we merge in-memory then paginate)
    const [allReplies, allMods, allComments] = await Promise.all([
      (type === 'all' || type === 'replied' || type === 'failed')
        ? AutoReplyLog.find(replyQuery).sort({ createdAt: -1 }).lean()
        : Promise.resolve([]),
      (type === 'all' || type === 'deleted' || type === 'hidden' || type === 'failed')
        ? ModerationLog.find(modQuery).sort({ createdAt: -1 }).lean()
        : Promise.resolve([]),
      (type === 'all' || type === 'replied' || type === 'deleted' || type === 'hidden')
        ? CommentModel.find(commentQuery).sort({ publishedAt: -1, createdAt: -1 }).lean()
        : Promise.resolve([])
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
      const execAction = m.executedAction || m.action || 'deleted';
      const historyType = execAction === 'delete' || execAction === 'deleted' ? 'deleted' : 'hidden';
      const isSuccess = m.status === 'Success' || m.status === 'success';
      return {
        id: m._id.toString(),
        type: historyType,
        status: isSuccess ? 'success' : 'failed',
        authorName: m.authorName || 'Anonymous',
        commentText: m.commentText || '',
        replyText: null,
        category: m.category || m.type || 'toxic',
        confidence: m.confidence != null ? m.confidence : (m.toxicityScore != null ? m.toxicityScore * 100 : null),
        reason: m.reason || m.failureReason || null,
        videoTitle: videoMap[m.videoId] || 'Unknown Video',
        triggerKeyword: null,
        actionDate: m.createdAt
      };
    });

    // ── 7b. Normalize Comment records ───────────────────────────────────────
    const commentItems = allComments.map(c => {
      const isDeleted = c.status === 'deleted' || c.status === 'hidden';
      return {
        id: c._id.toString(),
        type: isDeleted ? (c.status === 'deleted' ? 'deleted' : 'hidden') : 'replied',
        status: 'success',
        authorName: c.author || c.authorName || c.username || 'Anonymous',
        commentText: c.text || c.commentText || '',
        replyText: c.replyText || c.aiReply || '',
        category: c.sentiment || null,
        confidence: null,
        reason: null,
        videoTitle: videoMap[c.videoId] || 'Unknown Video',
        triggerKeyword: null,
        actionDate: c.publishedAt || c.createdAt || new Date()
      };
    });

    // ── 8. Merge + deduplicate by authorName + commentText ──────────────────
    const mergedRaw = [...modItems, ...replyItems, ...commentItems];
    const seenHistoryKeys = new Set();
    let merged = [];
    for (const item of mergedRaw) {
      const authorClean = (item.authorName || '').trim().toLowerCase();
      const commentClean = (item.commentText || '').trim().toLowerCase();
      const key = `${authorClean}:${commentClean}`;
      if (commentClean && !seenHistoryKeys.has(key)) {
        seenHistoryKeys.add(key);
        merged.push(item);
      }
    }

    // ── 9. Apply type filter ────────────────────────────────────────────────
    if (type === 'replied')  merged = merged.filter(i => i.type === 'replied');
    if (type === 'deleted')  merged = merged.filter(i => i.type === 'deleted');
    if (type === 'hidden')   merged = merged.filter(i => i.type === 'hidden');
    if (type === 'failed')   merged = merged.filter(i => i.status === 'failed');

    // ── 10. Sort newest-first ───────────────────────────────────────────────
    merged.sort((a, b) => new Date(b.actionDate) - new Date(a.actionDate));

    // ── 11. Compute summary counts from full datasets ───────────────────────
    const totalReplied  = merged.filter(i => i.type === 'replied' && i.status === 'success').length;
    const totalDeleted  = merged.filter(i => i.type === 'deleted' && i.status === 'success').length;
    const totalHidden   = merged.filter(i => i.type === 'hidden' && i.status === 'success').length;
    const totalFailed   = merged.filter(i => i.status === 'failed').length;
    const totalAll      = merged.length;
    const totalSuccess  = merged.filter(i => i.status === 'success').length;
    const successRate   = totalAll > 0 ? Math.round((totalSuccess / totalAll) * 100) : 0;

    // ── 12. Paginate ────────────────────────────────────────────────────────
    const totalFiltered = merged.length;
    const totalPages    = Math.max(1, Math.ceil(totalFiltered / limitNum));
    const offset        = (pageNum - 1) * limitNum;
    const pageItems     = merged.slice(offset, offset + limitNum);

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
