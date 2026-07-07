import User from '../models/User.mjs';
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

    // 3. Active Subscription Check
    const isSubscribed = user.subscription && user.subscription.status === 'active';
    const isTrialPromo = user.subscription && user.subscription.id === 'trial_promo_active';

    if (isSubscribed || isTrialPromo) {
      // Ensure subscription isn't expired
      if (user.subscription.currentEnd && new Date() > new Date(user.subscription.currentEnd)) {
        user.subscription.status = 'expired';
        await user.save();
        logger.warn(`User ${user.email} subscription has expired.`);
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
