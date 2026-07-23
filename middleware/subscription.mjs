import User from '../models/User.mjs';
import Organization from '../models/Organization.mjs';
import Subscription from '../models/Subscription.mjs';
import Channel from '../models/Channel.mjs';
import { getPlanFeatures } from '../config/planFeatures.mjs';
import logger from '../utils/logger.mjs';

/**
 * Middleware to verify that a user/organization has an active subscription or an unexpired 30-day free trial.
 */
export const requireActiveSubscription = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Unauthorized: User missing from request context' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 1. Resolve organization & paid subscription status
    let isSubscribed = false;
    let planType = 'free';
    let currentEnd = null;

    if (user.organizationId) {
      const org = await Organization.findById(user.organizationId);
      if (org && org.subscription) {
        const orgSub = org.subscription;
        const isOrgActive = orgSub.status === 'active' ||
          (orgSub.status === 'cancelled' && orgSub.currentPeriodEnd && new Date(orgSub.currentPeriodEnd) > new Date());
        if (isOrgActive) {
          isSubscribed = true;
          planType = orgSub.planType || 'three_months_999';
          currentEnd = orgSub.currentPeriodEnd;
        }
      }
    }

    // Fallback to standalone Subscription document or User object cache
    if (!isSubscribed) {
      const subDoc = await Subscription.findOne({
        $or: [
          { userId: user._id },
          user.organizationId ? { organizationId: user.organizationId } : null
        ].filter(Boolean),
        status: { $in: ['active', 'cancelled'] }
      }).sort({ createdAt: -1 });

      if (subDoc) {
        const isSubActive = subDoc.status === 'active' ||
          (subDoc.status === 'cancelled' && subDoc.currentEnd && new Date(subDoc.currentEnd) > new Date());
        if (isSubActive) {
          isSubscribed = true;
          planType = subDoc.planType || 'three_months_999';
          currentEnd = subDoc.currentEnd;
        }
      }
    }

    // 2. Paid Subscription Check
    if (isSubscribed) {
      if (currentEnd && new Date() > new Date(currentEnd)) {
        logger.warn(`Paid subscription expired for user: ${user.email}`);
        return res.status(402).json({
          error: 'Your subscription has expired. Please renew to continue.',
          subscriptionRequired: true,
          subscriptionExpired: true
        });
      }
      req.planType = planType;
      return next();
    }

    // 3. Free Trial Expiration Check (30-day trial from User.createdAt)
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const trialExpirationDate = new Date(user.createdAt.getTime() + thirtyDaysMs);

    if (new Date() > trialExpirationDate) {
      logger.warn(`Free trial expired for user: ${user.email}`);
      return res.status(402).json({
        error: 'Your 30-day Free Trial has expired. Please subscribe to continue using ChannelMate.',
        subscriptionRequired: true,
        subscriptionExpired: true
      });
    }

    // Free trial is still active
    req.planType = 'free';
    return next();
  } catch (error) {
    logger.error('Error in subscription verification middleware:', error);
    res.status(500).json({ error: 'Internal subscription check failed' });
  }
};

/**
 * Middleware factory to enforce feature flags for a route based on current subscription plan
 */
export const requireFeature = (featureName) => {
  return async (req, res, next) => {
    try {
      const planType = req.planType || 'free';
      const features = getPlanFeatures(planType);

      if (!features[featureName]) {
        return res.status(403).json({
          error: `Feature "${featureName}" is not available on your current plan (${features.name}). Please upgrade to access this feature.`,
          featureRequired: featureName,
          upgradeRequired: true
        });
      }

      next();
    } catch (error) {
      logger.error('Error checking plan feature flag:', error);
      res.status(500).json({ error: 'Feature access check failed' });
    }
  };
};

/**
 * Middleware helper to enforce channel connection limits (max 1 channel allowed)
 */
export const checkChannelLimit = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const filter = user.organizationId
      ? { $or: [{ organizationId: user.organizationId }, { userId: user._id }] }
      : { userId: user._id };

    const channelCount = await Channel.countDocuments(filter);
    const planType = req.planType || 'free';
    const features = getPlanFeatures(planType);

    if (channelCount >= features.maxChannels) {
      return res.status(403).json({
        error: `Channel limit reached. Your current plan (${features.name}) allows a maximum of ${features.maxChannels} connected channel.`,
        maxChannels: features.maxChannels,
        currentChannels: channelCount,
        limitReached: true
      });
    }

    next();
  } catch (error) {
    logger.error('Error checking channel limit:', error);
    res.status(500).json({ error: 'Channel limit check failed' });
  }
};
