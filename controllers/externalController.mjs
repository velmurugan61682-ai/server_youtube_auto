import Lead from '../models/Lead.mjs';
import User from '../models/User.mjs';
import Channel from '../models/Channel.mjs';
import Comment from '../models/Comment.mjs';
import Subscription from '../models/Subscription.mjs';
import Payment from '../models/Payment.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import AutoLikeLog from '../models/AutoLikeLog.mjs';

// GET /api/external/users
// Fetch all registered users (Admin API Key required)
export const getExternalUsers = async (req, res) => {
  try {
    if (!req.isAdminKey) {
      return res.status(403).json({ error: 'Forbidden: Admin API key required to view users list.' });
    }

    const users = await User.find({}).select('-password -passwordHash -youtubeApiKey -openaiApiKey -gowhatsApiKey').sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('[External API] Failed to fetch users:', error);
    res.status(500).json({ error: 'Failed to retrieve registered users.' });
  }
};


const toInt = (value, fallback, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

const buildCustomerDetails = async (user) => {
  const userId = user._id;
  const [channels, subscription, payments, metrics, recentLeads, recentComments] = await Promise.all([
    Channel.find({ userId }).select('-apiKey -accessToken -refreshToken').sort({ createdAt: -1 }).lean(),
    Subscription.findOne({ $or: [{ user: userId }, { userId }] }).sort({ createdAt: -1 }).lean(),
    Payment.find({ userId }).sort({ createdAt: -1 }).limit(10).lean(),
    Promise.all([
      Comment.countDocuments({ userId }),
      Comment.countDocuments({ userId, sentiment: 'toxic' }),
      Lead.countDocuments({ userId }),
      Lead.countDocuments({ userId, whatsappSent: true }),
      AutoReplyLog.countDocuments({ userId, status: { $in: ['success', 'Success'] } }),
      AutoLikeLog.countDocuments({ userId, autoLiked: true }),
      ModerationLog.countDocuments({ userId, status: { $in: ['Success', 'success'] } })
    ]),
    Lead.find({ userId }).sort({ createdAt: -1 }).limit(10).lean(),
    Comment.find({ userId }).select('-detectedWords').sort({ createdAt: -1 }).limit(10).lean()
  ]);

  const [totalComments, toxicComments, leadsGenerated, whatsappLeadsSent, autoRepliesSent, autoLikes, autoModerationActions] = metrics;
  const currentSubscription = subscription || user.subscription || {};

  return {
    id: user._id,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    organization: user.organization || '',
    organizationId: user.organizationId,
    status: user.status || 'active',
    role: user.role,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    subscription: {
      plan: currentSubscription.plan || currentSubscription.planId || user.subscription?.planId || 'free',
      status: currentSubscription.status || user.subscription?.status || 'none',
      currentEnd: currentSubscription.currentEnd || currentSubscription.renewalDate || currentSubscription.endDate || user.subscription?.currentEnd
    },
    youtube: {
      connectedChannelCount: channels.length,
      connectedChannels: channels.map(channel => ({
        channelId: channel.channelId,
        title: channel.title,
        thumbnailUrl: channel.thumbnailUrl,
        connectedAt: channel.createdAt,
        lastSyncedAt: channel.lastSyncedAt,
        reconnectRequired: channel.reconnectRequired || false,
        statistics: channel.statistics || {}
      }))
    },
    metrics: { totalComments, toxicComments, leadsGenerated, whatsappLeadsSent, autoRepliesSent, autoLikes, autoModerationActions },
    recent: { leads: recentLeads, comments: recentComments, payments }
  };
};

// GET /api/external/customers/details
// Admin API key returns all customers; scoped tenant key returns only that tenant customer.
export const getExternalCustomerDetails = async (req, res) => {
  try {
    const { search = '', status = 'all', page = 1, limit = 50 } = req.query;
    const pageNum = toInt(page, 1, 10000);
    const limitNum = toInt(limit, 50, 100);
    const skip = (pageNum - 1) * limitNum;

    const filter = req.isAdminKey ? { role: { $ne: 'superadmin' } } : { _id: req.user.id };
    if (req.isAdminKey && search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { organization: { $regex: search, $options: 'i' } },
        { tenantId: { $regex: search, $options: 'i' } }
      ];
    }
    if (req.isAdminKey && status && status !== 'all') filter.status = status;

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select('-password -passwordHash -youtubeApiKey -openaiApiKey -gowhatsApiKey')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean()
    ]);

    const customers = await Promise.all(users.map(buildCustomerDetails));

    return res.json({
      success: true,
      count: customers.length,
      customers,
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    console.error('[External API] Failed to fetch customer details:', error);
    return res.status(500).json({ error: 'Failed to retrieve customer details.' });
  }
};

// GET /api/external/leads
// Fetch customer leads (system-wide for admin keys, scoped for tenant keys)
export const getExternalLeads = async (req, res) => {
  try {
    let leads;
    if (req.isAdminKey) {
      // Admin keys fetch ALL leads across the system and populate owner user details
      leads = await Lead.find({}).populate('userId', 'name email').sort({ createdAt: -1 });
    } else {
      // Scoped keys fetch leads belonging only to the key owner
      leads = await Lead.find({ userId: req.user.id }).sort({ createdAt: -1 });
    }
    
    res.json({
      success: true,
      count: leads.length,
      leads
    });
  } catch (error) {
    console.error('[External API] Failed to fetch leads:', error);
    res.status(500).json({ error: 'Failed to retrieve customer leads.' });
  }
};

// POST /api/external/leads
// Store a new customer lead from an external service
export const createExternalLead = async (req, res) => {
  try {
    const {
      userId,
      name,
      authorName,
      message,
      originalComment,
      email,
      whatsappNumber,
      intent,
      productInterest,
      notes,
      channelId,
      videoId,
      status
    } = req.body;

    // Determine owner ID: admin keys must specify the target user ID in request body
    const targetUserId = req.isAdminKey ? userId : req.user.id;
    if (!targetUserId) {
      return res.status(400).json({ error: 'Missing owner ID. Admin API keys must specify a target userId in the request body.' });
    }

    const owner = await User.findById(targetUserId).select('_id organizationId').lean();
    if (!owner) {
      return res.status(404).json({ error: 'Target customer not found.' });
    }

    const leadName = name || authorName || 'External Lead';
    const leadComment = message || originalComment || notes || 'Created via External API';

    const newLead = new Lead({
      userId: targetUserId,
      organizationId: owner.organizationId || owner._id,
      authorName: leadName,
      originalComment: leadComment,
      email: email || undefined,
      whatsappNumber: whatsappNumber || undefined,
      intent: intent || undefined,
      productInterest: productInterest || undefined,
      notes: notes || undefined,
      channelId: channelId || 'API',
      videoId: videoId || 'API',
      status: status || 'pending'
    });

    await newLead.save();

    res.status(201).json({
      success: true,
      message: 'Lead created successfully.',
      lead: {
        _id: newLead._id,
        userId: newLead.userId,
        authorName: newLead.authorName,
        originalComment: newLead.originalComment,
        email: newLead.email,
        whatsappNumber: newLead.whatsappNumber,
        intent: newLead.intent,
        productInterest: newLead.productInterest,
        notes: newLead.notes,
        channelId: newLead.channelId,
        videoId: newLead.videoId,
        status: newLead.status,
        commentId: newLead.commentId,
        createdAt: newLead.createdAt
      }
    });
  } catch (error) {
    console.error('[External API] Failed to create lead:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Duplicate entry: A lead with this comment ID already exists.' });
    }

    res.status(500).json({ error: 'Failed to store customer lead.' });
  }
};
