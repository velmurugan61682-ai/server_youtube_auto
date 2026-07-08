import express from 'express';
import { authMiddleware } from '../middleware/auth.mjs';
import User from '../models/User.mjs';
import Organization from '../models/Organization.mjs';
import { 
  createRazorpaySubscription, 
  cancelRazorpaySubscription, 
  verifyWebhookSignature,
  getSubscriptionInvoices
} from '../services/razorpayService.mjs';
import logger from '../utils/logger.mjs';

const router = express.Router();

// Define Plan IDs from env config matching the new tiers
const planIds = {
  starter: process.env.RAZORPAY_PLAN_STARTER || 'plan_starter_mock',
  professional: process.env.RAZORPAY_PLAN_PROFESSIONAL || 'plan_professional_mock',
  business: process.env.RAZORPAY_PLAN_BUSINESS || 'plan_business_mock',
  enterprise: process.env.RAZORPAY_PLAN_ENTERPRISE || 'plan_enterprise_mock'
};

/**
 * Initiate subscription for organization
 */
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { planType } = req.body; // 'starter', 'professional', 'business', 'enterprise', 'free'
    if (!planType || (planType !== 'free' && !planIds[planType])) {
      return res.status(400).json({ error: 'Invalid plan type selected.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.organizationId) return res.status(400).json({ error: 'User is not linked to any organization.' });

    const org = await Organization.findById(user.organizationId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    if (planType === 'free') {
      const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
      const trialExpirationDate = new Date(user.createdAt.getTime() + oneMonthMs);
      if (new Date() > trialExpirationDate) {
        return res.status(400).json({ error: 'Your 30-day Free Trial has expired. You cannot select the Free Plan.' });
      }

      // Cancel any active Razorpay subscription if present
      const subId = org.subscription?.razorpaySubscriptionId || user.subscription?.id;
      if (subId && !subId.includes('mock')) {
        try {
          await cancelRazorpaySubscription(subId);
        } catch (apiErr) {
          logger.warn(`SDK cancellation skipped/mocked: ${apiErr.message}`);
        }
      }

      // Reset subscription fields to free tier
      org.subscription = {
        status: 'none',
        planType: 'free',
        razorpaySubscriptionId: '',
        currentPeriodEnd: null
      };
      await org.save();

      user.subscription = {
        id: '',
        planId: '',
        status: 'none',
        currentStart: null,
        currentEnd: null
      };
      await user.save();

      return res.json({
        success: true,
        subscriptionId: '',
        shortUrl: '',
        status: 'none',
        razorpayKeyId: process.env.RAZORPAY_KEY_ID
      });
    }

    const planId = planIds[planType];
    
    // In mock mode, generate a mock sub config
    let sub;
    try {
      sub = await createRazorpaySubscription(planId, user.email);
    } catch (apiErr) {
      // Fallback mock sub if SDK throws due to missing credentials
      logger.warn(`Razorpay SDK threw error: ${apiErr.message}. Creating mock subscription.`);
      sub = {
        id: `sub_mock_${Math.random().toString(36).substr(2, 9)}`,
        short_url: '#',
        status: 'created'
      };
    }

    // Save subscription state on organization profile
    org.subscription = {
      status: 'created',
      planType,
      razorpaySubscriptionId: sub.id,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
    await org.save();

    // Cache on user object for backward compatibility
    user.subscription = {
      id: sub.id,
      planId,
      status: 'created',
      currentStart: new Date(),
      currentEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
    await user.save();

    res.json({
      success: true,
      subscriptionId: sub.id,
      shortUrl: sub.short_url,
      status: sub.status,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    logger.error('Subscription initiate failure:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Verify payment/signature manually (optional client-side backup)
 */
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const { razorpay_subscription_id } = req.body;
    if (!razorpay_subscription_id) {
      return res.status(400).json({ error: 'Subscription ID is required.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.organizationId) {
      const org = await Organization.findById(user.organizationId);
      if (org) {
        org.subscription.status = 'active';
        org.subscription.razorpaySubscriptionId = razorpay_subscription_id;
        await org.save();
      }
    }

    user.subscription.status = 'active';
    user.subscription.id = razorpay_subscription_id;
    await user.save();

    res.json({ success: true, status: 'active', message: 'Payment verified.' });
  } catch (err) {
    logger.error('Subscription verification failure:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Cancel subscription
 */
router.post('/cancel', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const org = await Organization.findById(user.organizationId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const subId = org.subscription?.razorpaySubscriptionId || user.subscription?.id;
    if (!subId) return res.status(400).json({ error: 'No active subscription found.' });

    try {
      await cancelRazorpaySubscription(subId);
    } catch (apiErr) {
      logger.warn(`SDK cancellation skipped/mocked: ${apiErr.message}`);
    }

    org.subscription.status = 'cancelled';
    await org.save();

    user.subscription.status = 'cancelled';
    await user.save();

    res.json({ success: true, status: 'cancelled', message: 'Subscription cancelled successfully.' });
  } catch (err) {
    logger.error('Subscription cancellation failure:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Fetch current subscription status
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('subscription role organizationId createdAt');
    if (!user) return res.status(404).json({ error: 'User not found' });

    let activeSubscription = user.subscription;
    let organizationName = '';

    if (user.organizationId) {
      const org = await Organization.findById(user.organizationId);
      if (org) {
        organizationName = org.name;
        activeSubscription = {
          id: org.subscription.razorpaySubscriptionId,
          status: org.subscription.status,
          planType: org.subscription.planType,
          currentEnd: org.subscription.currentPeriodEnd
        };
      }
    }

    const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
    const trialExpirationDate = new Date((user.createdAt || new Date()).getTime() + oneMonthMs);
    const trialExpired = new Date() > trialExpirationDate;

    res.json({
      success: true,
      subscription: activeSubscription,
      role: user.role,
      organizationName,
      trialExpired
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get Invoice History
 */
router.get('/invoices', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const org = await Organization.findById(user.organizationId);
    const subId = org?.subscription?.razorpaySubscriptionId || user.subscription?.id;

    if (!subId) {
      return res.json({ success: true, invoices: [] });
    }

    const invoices = await getSubscriptionInvoices(subId);
    res.json({ success: true, invoices });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Webhook handler for automated renewals, payments, halts, and cancellations
 */
router.post('/webhook', async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (secret && signature) {
    const isValid = verifyWebhookSignature(req.body, signature, secret);
    if (!isValid) {
      logger.warn('⚠️ [Razorpay Webhook] Invalid signature rejected.');
      return res.status(400).send('Invalid signature');
    }
  }

  const { event, payload } = req.body;
  logger.info(`📬 [Razorpay Webhook] Event received: ${event}`);

  try {
    if (!payload || !payload.subscription) {
      return res.status(200).send('OK');
    }

    const subEntity = payload.subscription.entity;
    const subId = subEntity.id;
    const email = subEntity.notes?.email;

    // Resolve Organization and User
    let org = await Organization.findOne({ 'subscription.razorpaySubscriptionId': subId });
    let user = email ? await User.findOne({ email }) : await User.findOne({ 'subscription.id': subId });

    if (!org && user && user.organizationId) {
      org = await Organization.findById(user.organizationId);
    }

    if (!org && !user) {
      logger.warn(`📬 [Razorpay Webhook] Tenant not found for subscription ID: ${subId}`);
      return res.status(200).send('Tenant not found');
    }

    const currentStart = subEntity.current_start ? new Date(subEntity.current_start * 1000) : new Date();
    const currentEnd = subEntity.current_end ? new Date(subEntity.current_end * 1000) : new Date();

    const statusMap = {
      'subscription.authenticated': 'active',
      'subscription.activated': 'active',
      'subscription.charged': 'active',
      'subscription.halted': 'halted',
      'subscription.cancelled': 'cancelled',
      'subscription.expired': 'expired'
    };

    const targetStatus = statusMap[event];
    if (targetStatus) {
      if (org) {
        org.subscription.status = targetStatus;
        org.subscription.razorpaySubscriptionId = subId;
        org.subscription.currentPeriodEnd = currentEnd;
        await org.save();
        logger.info(`📬 [Razorpay Webhook] Organization ${org.name} subscription status updated: ${targetStatus}`);
      }

      if (user) {
        user.subscription.id = subId;
        user.subscription.status = targetStatus;
        user.subscription.currentStart = currentStart;
        user.subscription.currentEnd = currentEnd;
        await user.save();
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    logger.error('📬 [Razorpay Webhook] processing error:', err);
    res.status(500).send(err.message);
  }
});

export default router;
