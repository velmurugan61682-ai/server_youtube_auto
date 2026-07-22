import Lead from '../models/Lead.mjs';
import Channel from '../models/Channel.mjs';
import User from '../models/User.mjs';
import Comment from '../models/Comment.mjs';
import { detectWhatsAppNumber, createLead } from '../services/leadService.mjs';

const escapeRegex = (string) => {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};

const getUserChannelIds = async (user) => {
  const filter = user.organizationId 
    ? { $or: [{ organizationId: user.organizationId }, { userId: user.id }] }
    : { userId: user.id };
  const channels = await Channel.find(filter).select('channelId').lean();
  return channels.map(c => c.channelId);
};

const DEFAULT_LEAD_KEYWORDS = [
  'price', 'rate', 'cost', 'amount', 'details', 'detail', 'course', 'join', 'contact', 'phone', 'call', 'whatsapp', 'demo', 'fees',
  'buy', 'order', 'purchase', 'interested', 'dm', 'message', 'number', 'available', 'booking', 'enroll', 'apply',
  'vilai', 'evlo', 'evalo', 'eppadi join', 'contact pannunga', 'whatsapp pannunga'
];

const hasLeadIntent = (text = '') => {
  const lower = String(text).toLowerCase();
  return DEFAULT_LEAD_KEYWORDS.some(keyword => lower.includes(keyword));
};

const backfillMissingLeads = async (userIds, allowedChannelIds) => {
  const comments = await Comment.find({
    userId: { $in: userIds },
    channelId: { $in: allowedChannelIds },
    isBotReply: { $ne: true },
    sentiment: { $ne: 'toxic' },
    status: { $nin: ['deleted', 'flagged'] },
    text: { $exists: true, $ne: '' }
  }).sort({ createdAt: -1 }).limit(150).lean();

  for (const comment of comments) {
    const phone = detectWhatsAppNumber(comment.text);
    if (!phone && !hasLeadIntent(comment.text)) continue;

    if (!comment.organizationId || !comment.youtubeId) continue;

    const idempotencyKey = `${comment.organizationId || comment.userId}_${comment.channelId}_${comment.youtubeId}_lead`;
    const exists = await Lead.exists({
      $or: [
        { idempotencyKey },
        { commentId: comment.youtubeId }
      ]
    });
    if (exists) continue;

    try {
      await createLead({
        userId: comment.userId,
        organizationId: comment.organizationId,
        idempotencyKey,
        channelId: comment.channelId,
        videoId: comment.videoId,
        commentId: comment.youtubeId,
        authorName: comment.author || comment.username || 'Anonymous',
        originalComment: comment.text,
        whatsappNumber: phone || 'None',
        intent: phone ? 'Contact Request' : 'Keyword Match',
        productInterest: 'General',
        language: comment.language || 'Unknown',
        notes: 'Backfilled from existing analyzed comment'
      });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
};

export const getLeads = async (req, res) => {
  try {
    const { status, channelId, search } = req.query;
    const allowedChannelIds = await getUserChannelIds(req.user);
    
    // Resolve organization users
    const filterUser = req.user.organizationId 
      ? { $or: [{ organizationId: req.user.organizationId }, { _id: req.user.id }] }
      : { _id: req.user.id };
    const users = await User.find(filterUser).select('_id').lean();
    const userIds = users.map(u => u._id);

    await backfillMissingLeads(userIds, allowedChannelIds);

    const query = { 
      channelId: { $in: allowedChannelIds },
      userId: { $in: userIds }
    };

    if (status) query.status = status;
    if (channelId) {
      if (allowedChannelIds.includes(channelId)) {
        query.channelId = channelId;
      } else {
        return res.json([]);
      }
    }
    if (search) {
      const escapedSearch = escapeRegex(search);
      query.$or = [
        { authorName: { $regex: escapedSearch, $options: 'i' } },
        { whatsappNumber: { $regex: escapedSearch, $options: 'i' } },
        { originalComment: { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    const leads = await Lead.find(query).sort({ createdAt: -1 }).limit(200).lean();
    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportLeads = async (req, res) => {
  try {
    const allowedChannelIds = await getUserChannelIds(req.user);
    
    // Resolve organization users
    const filterUser = req.user.organizationId 
      ? { $or: [{ organizationId: req.user.organizationId }, { _id: req.user.id }] }
      : { _id: req.user.id };
    const users = await User.find(filterUser).select('_id').lean();
    const userIds = users.map(u => u._id);

    const leads = await Lead.find({ 
      channelId: { $in: allowedChannelIds },
      userId: { $in: userIds }
    }).sort({ createdAt: -1 }).lean();
    if (leads.length === 0) return res.status(404).send('No leads to export');

    const fields = ['authorName', 'whatsappNumber', 'status', 'isHidden', 'whatsappSent', 'videoId', 'channelId', 'createdAt'];
    const csvRows = [fields.join(',')];

    for (const lead of leads) {
      const row = fields.map(field => {
        const val = lead[field];
        if (val instanceof Date) return val.toISOString();
        if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
        return val;
      });
      csvRows.push(row.join(','));
    }

    res.header('Content-Type', 'text/csv');
    res.attachment('leads.csv');
    res.send(csvRows.join('\n'));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
