import express from 'express';
import { authMiddleware } from '../middleware/auth.mjs';
import User from '../models/User.mjs';
import Organization from '../models/Organization.mjs';
import Payment from '../models/Payment.mjs';
import Subscription from '../models/Subscription.mjs';
import Transaction from '../models/Transaction.mjs';
import BillingHistory from '../models/BillingHistory.mjs';
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
  one_rupee: process.env.RAZORPAY_PLAN_ONE_RUPEE || 'plan_one_rupee_mock',
  monthly_345: process.env.RAZORPAY_PLAN_MONTHLY_345 || 'plan_monthly_345_mock',
  two_months_600: process.env.RAZORPAY_PLAN_TWO_MONTHS_600 || 'plan_two_months_600_mock',
  three_months_999: process.env.RAZORPAY_PLAN_THREE_MONTHS_999 || 'plan_three_months_999_mock',
  professional: process.env.RAZORPAY_PLAN_PROFESSIONAL || 'plan_professional_mock'
};

/**
 * Initiate subscription for organization
 */
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { planType } = req.body; // 'free', 'one_rupee', 'monthly_345', 'two_months_600', 'three_months_999'
    if (!planType || (planType !== 'free' && !planIds[planType])) {
      return res.status(400).json({ error: 'Invalid plan type selected.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Auto-link legacy or dynamically registered users to default organization if missing
    if (!user.organizationId) {
      const defaultOrg = await Organization.findOne({ name: 'Tech Vaseegrah' });
      if (defaultOrg) {
        user.organizationId = defaultOrg._id;
        await user.save();
        logger.info(`[Subscription] Auto-linked user ${user.email} to default organization: Tech Vaseegrah`);
      } else {
        logger.warn(`[Subscription] User ${user.email} has no organization, and default organization was not found.`);
        return res.status(400).json({ error: 'User is not linked to any organization.' });
      }
    }

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

    // Calculate duration based on subscription type
    let durationMs = 30 * 24 * 60 * 60 * 1000; // default 30 days
    if (planType === 'one_rupee') {
      durationMs = 1 * 24 * 60 * 60 * 1000; // 1 day limit
    } else if (planType === 'two_months_600') {
      durationMs = 60 * 24 * 60 * 60 * 1000; // 60 days
    } else if (planType === 'three_months_999' || planType === 'professional') {
      durationMs = 90 * 24 * 60 * 60 * 1000; // 90 days
    }

    // Save subscription state on organization profile
    org.subscription = {
      status: 'created',
      planType,
      razorpaySubscriptionId: sub.id,
      currentPeriodEnd: new Date(Date.now() + durationMs)
    };
    await org.save();

    // Cache on user object for backward compatibility
    user.subscription = {
      id: sub.id,
      planId,
      status: 'created',
      currentStart: new Date(),
      currentEnd: new Date(Date.now() + durationMs)
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
    const { razorpay_subscription_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_subscription_id) {
      return res.status(400).json({ error: 'Subscription ID is required.' });
    }

    // Verify cryptographic signature if Razorpay is fully configured and not a mock subscription
    const isMock = razorpay_subscription_id.includes('mock');
    const hasCredentials = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET;
    
    if (hasCredentials && !isMock) {
      if (!razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ error: 'Payment ID and signature are required for production verification.' });
      }
      
      const { verifySubscriptionSignature } = await import('../services/razorpayService.mjs');
      const isValid = verifySubscriptionSignature(razorpay_payment_id, razorpay_subscription_id, razorpay_signature);
      if (!isValid) {
        logger.warn(`⚠️ [Razorpay Verification] Cryptographic verification failed for sub: ${razorpay_subscription_id}`);
        return res.status(400).json({ error: 'Invalid payment signature. Verification failed.' });
      }
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let org = null;
    if (user.organizationId) {
      org = await Organization.findById(user.organizationId);
      if (org) {
        org.subscription.status = 'active';
        org.subscription.razorpaySubscriptionId = razorpay_subscription_id;
        await org.save();
      }
    }

    user.subscription.status = 'active';
    user.subscription.id = razorpay_subscription_id;
    await user.save();

    // Create Subscription log
    const planType = org?.subscription?.planType || user.subscription.planType || 'one_rupee';
    const planId = user.subscription.planId || 'plan_one_rupee_mock';
    const durationMs = planType === 'one_rupee' ? 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    const currentEnd = org?.subscription?.currentPeriodEnd || user.subscription.currentEnd || new Date(Date.now() + durationMs);

    await Subscription.findOneAndUpdate(
      { razorpaySubscriptionId: razorpay_subscription_id },
      {
        userId: user._id,
        organizationId: org ? org._id : undefined,
        razorpaySubscriptionId: razorpay_subscription_id,
        planId,
        planType,
        status: 'active',
        currentStart: new Date(),
        currentEnd
      },
      { upsert: true, new: true }
    );

    // Create Payment log (support both sandbox verify or real webhook backup verification)
    const paymentId = razorpay_payment_id || `pay_mock_${Math.random().toString(36).substr(2, 9)}`;
    const amountMap = {
      free: 0,
      one_rupee: 100,
      monthly_345: 34500,
      two_months_600: 60000,
      three_months_999: 99900,
      professional: 99900
    };
    const amount = amountMap[planType] || 0;

    await Payment.findOneAndUpdate(
      { razorpayPaymentId: paymentId },
      {
        userId: user._id,
        organizationId: org ? org._id : undefined,
        razorpayPaymentId: paymentId,
        razorpaySubscriptionId: razorpay_subscription_id,
        razorpaySignature: razorpay_signature || 'mock_signature',
        amount,
        currency: 'INR',
        status: 'captured',
        method: isMock ? 'mock' : 'carded'
      },
      { upsert: true, new: true }
    );

    // Create Transaction log
    await Transaction.create({
      userId: user._id,
      organizationId: org ? org._id : undefined,
      razorpayPaymentId: paymentId,
      razorpaySubscriptionId: razorpay_subscription_id,
      amount,
      type: 'credit',
      status: 'success',
      description: `Payment verified for plan: ${planType}`
    });

    // Create Billing History log
    await BillingHistory.findOneAndUpdate(
      { razorpayPaymentId: paymentId },
      {
        userId: user._id,
        organizationId: org ? org._id : undefined,
        razorpayInvoiceId: `inv_${paymentId}`,
        razorpaySubscriptionId: razorpay_subscription_id,
        razorpayPaymentId: paymentId,
        amount,
        planType,
        invoiceUrl: '',
        billingDate: new Date(),
        status: 'paid'
      },
      { upsert: true, new: true }
    );

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
    
    // Attempt to load from BillingHistory collection first (Optimized database query with indexes)
    const dbInvoices = await BillingHistory.find({
      $or: [
        { userId: user._id },
        org ? { organizationId: org._id } : {}
      ].filter(Boolean)
    }).sort({ billingDate: -1 }).lean();

    if (dbInvoices && dbInvoices.length > 0) {
      const mapped = dbInvoices.map(inv => ({
        id: inv.razorpayInvoiceId || inv._id.toString(),
        invoice_number: inv.razorpayInvoiceId || 'N/A',
        issued_at: Math.floor(new Date(inv.billingDate).getTime() / 1000),
        amount: inv.amount,
        currency: 'INR',
        status: inv.status,
        invoiceUrl: inv.invoiceUrl || ''
      }));
      return res.json({ success: true, invoices: mapped });
    }

    const subId = org?.subscription?.razorpaySubscriptionId || user.subscription?.id;
    if (!subId) {
      return res.json({ success: true, invoices: [] });
    }

    const invoices = await getSubscriptionInvoices(subId);
    res.json({ success: true, invoices });
  } catch (err) {
    logger.error('Error fetching invoices:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Webhook handler for automated renewals, payments, halts, and cancellations
 */
router.post('/webhook', async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (secret) {
    if (!signature) {
      logger.warn('⚠️ [Razorpay Webhook] Missing x-razorpay-signature header. Request rejected.');
      return res.status(400).send('Missing signature');
    }
    const isValid = verifyWebhookSignature(req.rawBody || req.body, signature, secret);
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

      // Update/create Subscription in our new collection
      const planType = org?.subscription?.planType || user?.subscription?.planType || 'free';
      const planId = subEntity.plan_id || user?.subscription?.planId || 'plan_free';

      await Subscription.findOneAndUpdate(
        { razorpaySubscriptionId: subId },
        {
          userId: user ? user._id : org ? org._id : undefined,
          organizationId: org ? org._id : undefined,
          razorpaySubscriptionId: subId,
          planId,
          planType,
          status: targetStatus,
          currentStart,
          currentEnd,
          endedAt: targetStatus === 'expired' || targetStatus === 'cancelled' ? new Date() : undefined,
          cancelledAt: targetStatus === 'cancelled' ? new Date() : undefined
        },
        { upsert: true, new: true }
      );

      // If it's a charged event, log the payment, transaction, and billing history!
      if (event === 'subscription.charged') {
        const paymentPayload = payload.payment?.entity;
        if (paymentPayload) {
          const paymentId = paymentPayload.id;
          const amount = paymentPayload.amount; // already in paise
          const method = paymentPayload.method;

          // A: Payment
          await Payment.findOneAndUpdate(
            { razorpayPaymentId: paymentId },
            {
              userId: user ? user._id : undefined,
              organizationId: org ? org._id : undefined,
              razorpayPaymentId: paymentId,
              razorpaySubscriptionId: subId,
              amount,
              currency: paymentPayload.currency || 'INR',
              status: 'captured',
              method
            },
            { upsert: true, new: true }
          );

          // B: Transaction
          await Transaction.create({
            userId: user ? user._id : undefined,
            organizationId: org ? org._id : undefined,
            razorpayPaymentId: paymentId,
            razorpaySubscriptionId: subId,
            amount,
            type: 'credit',
            status: 'success',
            description: `Subscription charged: ${event}`
          });

          // C: Billing History
          await BillingHistory.findOneAndUpdate(
            { razorpayPaymentId: paymentId },
            {
              userId: user ? user._id : undefined,
              organizationId: org ? org._id : undefined,
              razorpayInvoiceId: payload.invoice?.entity?.id || `inv_${paymentId}`,
              razorpaySubscriptionId: subId,
              razorpayPaymentId: paymentId,
              amount,
              planType,
              invoiceUrl: payload.invoice?.entity?.short_url || '',
              billingDate: new Date(),
              status: 'paid'
            },
            { upsert: true, new: true }
          );
        }
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    logger.error('📬 [Razorpay Webhook] processing error:', err);
    res.status(500).send(err.message);
  }
});

export default router;
