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

    let isSubscribed = user.subscription && user.subscription.status === 'active';
    let isTrialPromo = user.subscription && user.subscription.id === 'trial_promo_active';
    let currentEnd = user.subscription?.currentEnd;

    // Resolve tenant organization subscription status
    if (user.organizationId) {
      const org = await Organization.findById(user.organizationId);
      if (org) {
        isSubscribed = org.subscription && org.subscription.status === 'active';
        currentEnd = org.subscription.currentPeriodEnd;
      }
    }

    // 3. Active Subscription Check
    if (isSubscribed || isTrialPromo) {
      // Ensure subscription isn't expired
      if (currentEnd && new Date() > new Date(currentEnd)) {
        logger.warn(`Subscription has expired.`);
        
        // Update user state locally
        user.subscription.status = 'expired';
        await user.save();

        if (user.organizationId) {
          await Organization.findByIdAndUpdate(user.organizationId, {
            $set: { 'subscription.status': 'expired' }
          });
        }

        return res.status(402).json({ 
          error: 'Your subscription has expired.', 
          subscriptionExpired: true 
        });
      }
      return next();
    }

    logger.warn(`Billing: User ${user.email} blocked due to inactive subscription.`);
    return res.status(402).json({ 
      error: 'Active subscription required. Please subscribe to access this feature.',
      subscriptionRequired: true 
    });
  } catch (error) {
    logger.error('Error in subscription verification middleware:', error);
    res.status(500).json({ error: 'Internal subscription check failed' });
  }
};
