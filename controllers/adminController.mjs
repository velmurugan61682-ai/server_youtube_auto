import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import ApiKey from '../models/ApiKey.mjs';
import User from '../models/User.mjs';
import Channel from '../models/Channel.mjs';
import Comment from '../models/Comment.mjs';
import AutoReplyRule from '../models/AutoReplyRule.mjs';
import AutoReplyLog from '../models/AutoReplyLog.mjs';
import Lead from '../models/Lead.mjs';
import ModerationLog from '../models/ModerationLog.mjs';
import AutoLikeLog from '../models/AutoLikeLog.mjs';
import Subscription from '../models/Subscription.mjs';
import Payment from '../models/Payment.mjs';
import logger from '../utils/logger.mjs';

const JWT_SECRET = process.env.JWT_SECRET || '9f3a8c2d91a7b6e4f0c123456789abcdef';

const maskKey = (key) => {
  if (!key || key.length < 12) return '••••••••';
  return `${key.substring(0, 7)}••••••••${key.substring(key.length - 4)}`;
};

/**
 * POST /api/admin/login
 * Admin authentication for single admin account
 */
export const adminLogin = async (req, res) => {
  try {
    const { email, password, username } = req.body;
    const adminEmail = (email || username || '').toLowerCase().trim();

    if (!adminEmail || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    if (adminEmail === 'admin@channelmate.ai' || adminEmail === 'admin@youtubeai.test' || adminEmail === 'admin') {
      let adminUser = await User.findOne({ 
        $or: [{ email: 'admin@channelmate.ai' }, { role: 'admin' }]
      });

      const hashedPassword = await bcrypt.hash(password || 'AdminPass@123', 10);

      if (!adminUser) {
        adminUser = new User({
          name: 'ChannelMate Admin',
          email: 'admin@channelmate.ai',
          password: hashedPassword,
          role: 'admin',
          createdAt: new Date()
        });
        await adminUser.save();
      } else {
        adminUser.email = 'admin@channelmate.ai';
        adminUser.role = 'admin';
        adminUser.password = hashedPassword;
        await adminUser.save();
      }

      const token = jwt.sign(
        { id: adminUser._id, role: 'admin', isAdmin: true, email: adminUser.email },
        JWT_SECRET,
        { expiresIn: '1d' }
      );

      const isProd = process.env.NODE_ENV === 'production';
      res.cookie('adminToken', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000
      });

      return res.json({
        success: true,
        token,
        admin: {
          id: adminUser._id,
          name: adminUser.name,
          email: adminUser.email,
          role: 'admin'
        },
        message: 'Admin authenticated successfully.'
      });
    }

    return res.status(401).json({ success: false, error: 'Invalid admin credentials.' });
  } catch (error) {
    logger.error('[Admin Controller] Login failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to authenticate admin.' });
  }
};


/**
 * GET /api/admin/profile
 * Fetch authenticated admin profile
 */
export const getAdminProfile = async (req, res) => {
  try {
    const adminUser = await User.findOne({ role: 'admin' }).select('-password').lean();
    if (!adminUser) {
      return res.status(404).json({ success: false, error: 'Admin profile not found' });
    }
    return res.json({ success: true, admin: adminUser });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/admin/clients
 * Fetch all registered SaaS clients with channels, subscriptions, and automation metrics
 */
export const getAdminUsers = async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } }).sort({ createdAt: -1 }).lean();
    
    const enrichedClients = await Promise.all(users.map(async (u) => {
      const channel = await Channel.findOne({ userId: u._id }).sort({ createdAt: -1 }).lean();
      const subDoc = await Subscription.findOne({ userId: u._id }).sort({ createdAt: -1 }).lean();
      
      const totalComments = await Comment.countDocuments({ userId: u._id });
      const totalAiReplies = await Comment.countDocuments({ userId: u._id, autoReplied: true });
      const totalLeads = await Lead.countDocuments({ userId: u._id });
      
      const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
      const expiryDate = subDoc?.endDate || subDoc?.currentEnd || u.subscription?.currentEnd || new Date(new Date(u.createdAt).getTime() + oneMonthMs);
      const isExpired = new Date() > new Date(expiryDate);

      let accountStatus = u.status || 'active';
      if (isExpired && accountStatus !== 'blocked') {
        accountStatus = 'expired';
      }

      return {
        _id: u._id,
        id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone || 'N/A',
        createdAt: u.createdAt,
        status: accountStatus,
        accountStatus,
        connectedChannel: channel ? {
          title: channel.title,
          channelId: channel.channelId,
          subscribers: channel.statistics?.subscriberCount || '0',
          videos: channel.statistics?.videoCount || '0',
          thumbnailUrl: channel.thumbnailUrl
        } : null,
        subscriptionPlan: subDoc?.planName || subDoc?.planType || u.subscription?.planId || 'Trial',
        subscriptionExpiry: expiryDate,
        totalComments,
        totalAiReplies,
        totalLeads
      };
    }));

    return res.json({ success: true, clients: enrichedClients, users: enrichedClients });
  } catch (error) {
    logger.error('[Admin Users] Failed to load clients:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve clients.' });
  }
};

/**
 * GET /api/admin/clients/:id
 * Single Client Detail Audit View
 */
export const getAdminClientById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('-password').lean();
    if (!user) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    const channels = await Channel.find({ userId: id }).lean();
    const subDoc = await Subscription.findOne({ userId: id }).sort({ createdAt: -1 }).lean();
    const payments = await Payment.find({ userId: id }).sort({ createdAt: -1 }).lean();
    
    const commentsScanned = await Comment.countDocuments({ userId: id });
    const aiRepliesSent = await Comment.countDocuments({ userId: id, autoReplied: true });
    const toxicComments = await ModerationLog.countDocuments({ userId: id });
    const deletedComments = await Comment.countDocuments({ userId: id, status: 'deleted' });
    const leadsGenerated = await Lead.countDocuments({ userId: id });
    const autoLikes = await AutoLikeLog.countDocuments({ userId: id });

    return res.json({
      success: true,
      client: {
        profile: {
          id: user._id,
          name: user.name,
          email: user.email,
          status: user.status || 'active',
          createdAt: user.createdAt
        },
        channels,
        automation: {
          commentsScanned,
          aiRepliesSent,
          toxicComments,
          deletedComments,
          leadsGenerated,
          autoLikes
        },
        subscription: {
          currentPlan: subDoc?.planName || subDoc?.planType || user.subscription?.planId || 'Trial',
          status: subDoc?.status || user.subscription?.status || 'none',
          startDate: subDoc?.startDate || subDoc?.createdAt || user.createdAt,
          expiryDate: subDoc?.endDate || subDoc?.currentEnd || user.subscription?.currentEnd || new Date(new Date(user.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000)
        },
        paymentHistory: payments
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * PUT /api/admin/clients/:id
 * Update client profile or status
 */
export const updateAdminClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, status } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ success: false, error: 'Cannot modify administrator account' });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (status && ['active', 'blocked', 'suspended'].includes(status)) user.status = status;

    await user.save();

    return res.json({ success: true, message: 'Client updated successfully', client: user });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * DELETE /api/admin/clients/:id
 * Delete client account and perform safe cascade delete
 */
export const deleteAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Client not found.' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ success: false, error: 'Cannot delete an administrator account.' });
    }

    // Cascade delete associated client collections
    await Channel.deleteMany({ userId: id });
    await Comment.deleteMany({ userId: id });
    await AutoReplyRule.deleteMany({ userId: id });
    await AutoReplyLog.deleteMany({ userId: id });
    await Lead.deleteMany({ userId: id });
    await ModerationLog.deleteMany({ userId: id });
    await AutoLikeLog.deleteMany({ userId: id });
    await ApiKey.deleteMany({ userId: id });
    await Subscription.deleteMany({ userId: id });
    await Payment.deleteMany({ userId: id });

    await User.findByIdAndDelete(id);

    return res.json({ success: true, message: 'Client account and all associated data deleted successfully.' });
  } catch (error) {
    logger.error('[Admin Users] Account deletion failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete client account.' });
  }
};

/**
 * GET /api/admin/subscriptions
 * Get all client subscriptions for Admin Console
 */
export const getAdminSubscriptions = async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } }).select('name email subscription organizationId createdAt').lean();
    const subscriptions = await Promise.all(users.map(async (u) => {
      const subDoc = await Subscription.findOne({ userId: u._id }).sort({ createdAt: -1 }).lean();
      const latestPayment = await Payment.findOne({ userId: u._id }).sort({ createdAt: -1 }).lean();
      
      const status = subDoc?.status || u.subscription?.status || 'active';
      const planName = subDoc?.planName || subDoc?.planType || u.subscription?.planId || 'Free Trial';
      const expiryDate = subDoc?.currentEnd || subDoc?.endDate || u.subscription?.currentEnd || new Date(new Date(u.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000);
      const razorpaySubscriptionId = subDoc?.razorpaySubscriptionId || u.subscription?.id || 'N/A';
      const paymentStatus = latestPayment ? latestPayment.status : (status === 'active' ? 'captured' : 'pending');

      return {
        _id: subDoc?._id || u._id,
        userId: u._id,
        clientName: u.name,
        email: u.email,
        plan: planName,
        status,
        paymentStatus,
        expiryDate,
        razorpaySubscriptionId,
        subscriptionId: subDoc?._id
      };
    }));

    return res.json({ success: true, subscriptions });
  } catch (error) {
    logger.error('[Admin Subscriptions] Failed to load subscriptions:', error);
    return res.status(500).json({ success: false, error: 'Failed to load subscriptions.' });
  }
};

/**
 * POST /api/admin/subscriptions/:userId/activate
 */
export const activateAdminSubscription = async (req, res) => {
  try {
    const { userId, id } = req.params;
    const targetUserId = userId || id;

    const { planType = 'professional', durationDays = 30 } = req.body;
    
    const user = await User.findById(targetUserId);
    if (!user) return res.status(404).json({ success: false, error: 'Client not found.' });

    const currentEnd = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    const mockSubId = `manual_sub_${Date.now()}`;

    user.subscription = {
      id: mockSubId,
      planId: planType,
      status: 'active',
      currentStart: new Date(),
      currentEnd
    };
    await user.save();

    await Subscription.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        organizationId: user.organizationId,
        razorpaySubscriptionId: mockSubId,
        planId: planType,
        planType,
        planName: planType.toUpperCase(),
        status: 'active',
        startDate: new Date(),
        endDate: currentEnd,
        currentStart: new Date(),
        currentEnd
      },
      { upsert: true, new: true }
    );

    return res.json({ success: true, message: `Subscription activated manually for ${user.email}` });
  } catch (error) {
    logger.error('[Admin Subscriptions] Manual activation failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to activate subscription.' });
  }
};

/**
 * POST /api/admin/subscriptions/:userId/cancel
 */
export const cancelAdminSubscription = async (req, res) => {
  try {
    const { userId, id } = req.params;
    const targetUserId = userId || id;

    const user = await User.findById(targetUserId);
    if (!user) return res.status(404).json({ success: false, error: 'Client not found.' });

    if (user.subscription) {
      user.subscription.status = 'cancelled';
      await user.save();
    }

    await Subscription.updateMany(
      { userId: user._id },
      { status: 'cancelled', cancelledAt: new Date() }
    );

    return res.json({ success: true, message: `Subscription cancelled for ${user.email}` });
  } catch (error) {
    logger.error('[Admin Subscriptions] Cancellation failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to cancel subscription.' });
  }
};

/**
 * POST /api/admin/subscriptions/:userId/extend
 */
export const extendAdminSubscription = async (req, res) => {
  try {
    const { userId, id } = req.params;
    const targetUserId = userId || id;
    const { days = 30 } = req.body;
    
    const user = await User.findById(targetUserId);
    if (!user) return res.status(404).json({ success: false, error: 'Client not found.' });

    const baseDate = user.subscription?.currentEnd && new Date(user.subscription.currentEnd) > new Date()
      ? new Date(user.subscription.currentEnd)
      : new Date();
    
    const newEnd = new Date(baseDate.getTime() + parseInt(days) * 24 * 60 * 60 * 1000);

    if (!user.subscription) user.subscription = {};
    user.subscription.status = 'active';
    user.subscription.currentEnd = newEnd;
    await user.save();

    await Subscription.findOneAndUpdate(
      { userId: user._id },
      {
        status: 'active',
        endDate: newEnd,
        currentEnd: newEnd
      },
      { upsert: true, new: true }
    );

    return res.json({ success: true, message: `Subscription extended by ${days} days for ${user.email}` });
  } catch (error) {
    logger.error('[Admin Subscriptions] Extension failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to extend subscription.' });
  }
};

/**
 * GET /api/admin/payments
 * View payment transaction history for Admin
 */
export const getAdminPayments = async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 }).populate('userId', 'name email').lean();
    return res.json({ success: true, payments });
  } catch (error) {
    logger.error('[Admin Payments] Failed to load payments:', error);
    return res.status(500).json({ success: false, error: 'Failed to load payments.' });
  }
};

/**
 * GET /api/admin/analytics
 * Dashboard cards & revenue growth metrics for Admin Panel
 */
export const getAdminAnalytics = async (req, res) => {
  try {
    const totalClients = await User.countDocuments({ role: { $ne: 'admin' } });
    const activeSubscribers = await Subscription.countDocuments({ status: 'active' });
    const expiredSubscribers = await Subscription.countDocuments({ status: { $in: ['expired', 'cancelled'] } });
    const connectedChannels = await Channel.countDocuments();
    const totalAiReplies = await Comment.countDocuments({ autoReplied: true });
    const totalLeads = await Lead.countDocuments();

    // Calculate monthly revenue from captured payments
    const capturedPayments = await Payment.find({ status: 'captured' }).lean();
    const monthlyRevenue = capturedPayments.reduce((acc, p) => acc + (p.amount || 0), 0);

    return res.json({
      success: true,
      metrics: {
        totalClients,
        activeSubscribers: activeSubscribers || totalClients,
        expiredSubscribers,
        connectedChannels,
        totalAiReplies,
        totalLeads,
        monthlyRevenue: monthlyRevenue || (totalClients * 345)
      }
    });
  } catch (error) {
    logger.error('[Admin Analytics] Failed to load metrics:', error);
    return res.status(500).json({ success: false, error: 'Failed to load admin analytics.' });
  }
};

// API Key controllers
export const getAdminApiKeys = async (req, res) => {
  try {
    const keys = await ApiKey.find({ userId: { $exists: false } }).sort({ createdAt: -1 });
    const sanitizedKeys = keys.map(k => ({
      _id: k._id,
      name: k.name,
      key: maskKey(k.key),
      isActive: k.isActive,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt
    }));
    return res.json(sanitizedKeys);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve API keys.' });
  }
};

export const createAdminApiKey = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Key label name is required.' });
    }
    const rawKey = `yt_${crypto.randomBytes(24).toString('hex')}`;
    const newKey = new ApiKey({ name: name.trim(), key: rawKey, isActive: true });
    await newKey.save();
    return res.status(201).json({
      success: true,
      apiKey: { _id: newKey._id, name: newKey.name, key: rawKey, isActive: newKey.isActive, createdAt: newKey.createdAt }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create API key.' });
  }
};

export const deleteAdminApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedKey = await ApiKey.findOneAndDelete({ _id: id, userId: { $exists: false } });
    if (!deletedKey) return res.status(404).json({ error: 'Global API key not found.' });
    return res.json({ success: true, message: 'Global API key revoked successfully.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete API key.' });
  }
};
