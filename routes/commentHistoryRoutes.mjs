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

    // ── 1. Resolve channels the user owns ──────────────────────────────────
    const channelFilter = organizationId
      ? { $or: [{ organizationId }, { userId }] }
      : { userId };

    if (channelId) channelFilter.channelId = channelId;

    const ownedChannels = await Channel.find(channelFilter).select('channelId').lean();
    const allowedChannelIds = ownedChannels.map(c => c.channelId);

    if (allowedChannelIds.length === 0) {
      return res.json({
        items: [],
        summary: { total: 0, replied: 0, deleted: 0, hidden: 0, failed: 0, successRate: 0 },
        pagination: { page: pageNum, limit: limitNum, total: 0, pages: 0 }
      });
    }

    // ── 2. Build search regex ───────────────────────────────────────────────
    const searchRegex = search ? new RegExp(search, 'i') : null;

    // ── 3. Fetch AutoReplyLog (type = replied) ──────────────────────────────
    let replyQuery = { userId, channelId: { $in: allowedChannelIds } };
    if (channelId) replyQuery.channelId = channelId;
    if (searchRegex) {
      replyQuery.$or = [
        { username: searchRegex },
        { commentText: searchRegex },
        { replyText: searchRegex }
      ];
    }

    // ── 4. Fetch ModerationLog (type = deleted | hidden) ────────────────────
    let modQuery = { userId, channelId: { $in: allowedChannelIds } };
    if (organizationId) modQuery.organizationId = organizationId;
    if (channelId) modQuery.channelId = channelId;
    if (searchRegex) {
      modQuery.$or = [
        { authorName: searchRegex },
        { commentText: searchRegex }
      ];
    }

    // Pull all records (we merge in-memory then paginate)
    const [allReplies, allMods] = await Promise.all([
      (type === 'all' || type === 'replied' || type === 'failed')
        ? AutoReplyLog.find(replyQuery).sort({ createdAt: -1 }).lean()
        : Promise.resolve([]),
      (type === 'all' || type === 'deleted' || type === 'hidden' || type === 'failed')
        ? ModerationLog.find(modQuery).sort({ createdAt: -1 }).lean()
        : Promise.resolve([])
    ]);

    // ── 5. Resolve video titles ─────────────────────────────────────────────
    const allVideoIds = [
      ...allReplies.map(r => r.videoId),
      ...allMods.map(m => m.videoId)
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

    // ── 8. Merge + deduplicate by commentId (prefer moderation over reply) ──
    // We use a Set keyed on mongo _id (which is already unique per collection)
    let merged = [...modItems, ...replyItems];

    // ── 9. Apply type filter ────────────────────────────────────────────────
    if (type === 'replied')  merged = merged.filter(i => i.type === 'replied');
    if (type === 'deleted')  merged = merged.filter(i => i.type === 'deleted');
    if (type === 'hidden')   merged = merged.filter(i => i.type === 'hidden');
    if (type === 'failed')   merged = merged.filter(i => i.status === 'failed');

    // ── 10. Sort newest-first ───────────────────────────────────────────────
    merged.sort((a, b) => new Date(b.actionDate) - new Date(a.actionDate));

    // ── 11. Compute summary counts from full datasets ───────────────────────
    const totalReplied  = replyItems.filter(i => i.status === 'success').length;
    const totalDeleted  = modItems.filter(i => i.type === 'deleted' && i.status === 'success').length;
    const totalHidden   = modItems.filter(i => i.type === 'hidden' && i.status === 'success').length;
    const totalFailed   = merged.filter(i => i.status === 'failed').length;
    const totalAll      = replyItems.length + modItems.length;
    const totalSuccess  = replyItems.filter(i => i.status === 'success').length + modItems.filter(i => i.status === 'success').length;
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
