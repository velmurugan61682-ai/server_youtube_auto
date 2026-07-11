import User from '../models/User.mjs';
import Organization from '../models/Organization.mjs';
import logger from '../utils/logger.mjs';

export const requireActiveSubscription = async (req, res, next) => {
  // 1. Development Bypass Check
  if (process.env.DISABLE_SUBSCRIPTION_CHECK === 'true') {
    return next();
  }

  // 2. Admin Bypass Check
  if (req.user && req.user.role === 'admin') {
    return next();
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Resolve tenant organization subscription status
    const userSub = user.subscription;
    const isUserSubActive = userSub && (userSub.status === 'active' || 
      (userSub.status === 'cancelled' && userSub.currentEnd && new Date(userSub.currentEnd) > new Date()));
    let isSubscribed = isUserSubActive;
    let currentEnd = userSub?.currentEnd;

    if (user.organizationId) {
      const org = await Organization.findById(user.organizationId);
      if (org) {
        const orgSub = org.subscription;
        const isOrgSubActive = orgSub && (orgSub.status === 'active' || 
          (orgSub.status === 'cancelled' && orgSub.currentPeriodEnd && new Date(orgSub.currentPeriodEnd) > new Date()));
        isSubscribed = isOrgSubActive;
        currentEnd = orgSub?.currentPeriodEnd;
      }
    }

    // 3. Paid Subscription Expiration Check
    if (isSubscribed) {
      if (currentEnd && new Date() > new Date(currentEnd)) {
        logger.warn(`Paid Razorpay subscription expired for user: ${user.email}`);
        
        user.subscription.status = 'expired';
        await user.save();

        if (user.organizationId) {
          await Organization.findByIdAndUpdate(user.organizationId, {
            $set: { 'subscription.status': 'expired' }
          });
        }

        return res.status(402).json({ 
          error: 'Your Razorpay subscription has expired. Please renew to continue.', 
          subscriptionExpired: true 
        });
      }
      return next();
    }

    // 4. Free Trial Expiration Check (1 Month trial from account registration)
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
    const trialExpirationDate = new Date(user.createdAt.getTime() + oneMonthMs);

    if (new Date() > trialExpirationDate) {
      logger.warn(`Free plan trial expired for user: ${user.email}`);
      return res.status(402).json({ 
        error: 'Your 30-day Free Trial has expired. Please choose a subscription plan to continue.',
        subscriptionRequired: true,
        trialExpired: true
      });
    }

    // Free trial is still active
    return next();
  } catch (error) {
    logger.error('Error in subscription verification middleware:', error);
    res.status(500).json({ error: 'Internal subscription check failed' });
  }
};
