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
/**
 * Initiate subscription for organization
 */
router.post('/create', authMiddleware, async (req, res) => {
  try {
    let { planType } = req.body; // 'free', 'quarterly', 'three_months_999', etc.
    if (!planType) planType = 'free';

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Auto-link legacy or dynamically registered users to default organization if missing
    if (!user.organizationId) {
      const defaultOrg = await Organization.findOne({ name: { $in: ['Channelmate', 'Tech Vaseegrah'] } });
      if (defaultOrg) {
        user.organizationId = defaultOrg._id;
        await user.save();
        logger.info(`[Subscription] Auto-linked user ${user.email} to default organization: Channelmate`);
      } else {
        logger.warn(`[Subscription] User ${user.email} has no organization, and default organization was not found.`);
        return res.status(400).json({ error: 'User is not linked to any organization.' });
      }
    }

    const org = await Organization.findById(user.organizationId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const planId = planIds[planType] || `plan_${planType}_mock`;
    const durationDays = (planType === 'quarterly' || planType === 'three_months_999') ? 90 : 365;
    const durationMs = durationDays * 24 * 60 * 60 * 1000;
    const subId = `sub_${planType}_${Date.now()}`;

    // Save subscription state on organization profile in Mongoose
    org.subscription = {
      status: 'active',
      planType: planType,
      razorpaySubscriptionId: subId,
      currentPeriodEnd: new Date(Date.now() + durationMs)
    };
    await org.save();

    // Cache on user object for backward compatibility
    user.subscription = {
      id: subId,
      planId,
      status: 'active',
      currentStart: new Date(),
      currentEnd: new Date(Date.now() + durationMs)
    };
    await user.save();

    // Save/update Subscription document in Mongoose DB
    await Subscription.findOneAndUpdate(
      { organizationId: org._id },
      {
        userId: user._id,
        organizationId: org._id,
        razorpaySubscriptionId: subId,
        planId,
        planType,
        status: 'active',
        currentStart: new Date(),
        currentEnd: new Date(Date.now() + durationMs)
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      subscriptionId: subId,
      shortUrl: '#',
      status: 'active',
      razorpayKeyId: ''
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
    const { planType: reqPlanType, razorpay_subscription_id } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let org = null;
    let targetPlanType = reqPlanType;

    if (user.organizationId) {
      org = await Organization.findById(user.organizationId);
      if (org) {
        if (!targetPlanType) targetPlanType = org.subscription?.planType || 'free';
        org.subscription.status = 'active';
        org.subscription.planType = targetPlanType;
        org.subscription.razorpaySubscriptionId = razorpay_subscription_id || org.subscription.razorpaySubscriptionId || 'sub_dummy_active';
        org.subscription.currentPeriodEnd = new Date(Date.now() + (targetPlanType === 'quarterly' ? 90 : 365) * 24 * 60 * 60 * 1000);
        await org.save();
      }
    }

    if (!targetPlanType) targetPlanType = user.subscription?.planId || 'free';

    user.subscription.status = 'active';
    user.subscription.id = razorpay_subscription_id || user.subscription?.id || 'sub_dummy_active';
    user.subscription.currentEnd = new Date(Date.now() + (targetPlanType === 'quarterly' ? 90 : 365) * 24 * 60 * 60 * 1000);
    await user.save();

    await Subscription.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        organizationId: org ? org._id : undefined,
        razorpaySubscriptionId: razorpay_subscription_id || 'sub_dummy_active',
        planId: `plan_${targetPlanType}_mock`,
        planType: targetPlanType,
        status: 'active',
        currentStart: new Date(),
        currentEnd: new Date(Date.now() + (targetPlanType === 'quarterly' ? 90 : 365) * 24 * 60 * 60 * 1000)
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

    org.subscription.status = 'cancelled';
    org.subscription.planType = 'free';
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

    let organizationName = 'Channelmate';
    let subStatus = 'active';
    let subPlanType = 'free';
    let subId = user.subscription?.id || 'sub_free';
    let currentEnd = user.subscription?.currentEnd || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    if (user.organizationId) {
      const org = await Organization.findById(user.organizationId);
      if (org) {
        organizationName = org.name;
        if (org.subscription) {
          subStatus = org.subscription.status || 'active';
          subPlanType = org.subscription.planType || 'free';
          subId = org.subscription.razorpaySubscriptionId || subId;
          if (org.subscription.currentPeriodEnd) {
            currentEnd = org.subscription.currentPeriodEnd;
          }
        }
      }
    }

    res.json({
      success: true,
      subscription: {
        id: subId,
        status: subStatus,
        planType: subPlanType,
        currentEnd
      },
      role: user.role,
      organizationName,
      trialExpired: false
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
      'subscription.completed': 'completed',
      'subscription.paused': 'halted',
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
          startDate: currentStart,
          endDate: currentEnd,
          currentStart,
          currentEnd,
          endedAt: targetStatus === 'expired' || targetStatus === 'cancelled' || targetStatus === 'completed' ? new Date() : undefined,
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
              subscriptionId: subId,
              amount,
              currency: paymentPayload.currency || 'INR',
              status: 'captured',
              paymentDate: new Date(),
              invoiceId: payload.invoice?.entity?.id || `inv_${paymentId}`,
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
    } else if (event === 'payment.failed') {
      const paymentPayload = payload.payment?.entity;
      if (paymentPayload) {
        const paymentId = paymentPayload.id;
        logger.warn(`📬 [Razorpay Webhook] Payment failed for ID: ${paymentId}`);
        await Payment.findOneAndUpdate(
          { razorpayPaymentId: paymentId },
          {
            userId: user ? user._id : undefined,
            organizationId: org ? org._id : undefined,
            razorpayPaymentId: paymentId,
            razorpaySubscriptionId: subEntity?.id,
            subscriptionId: subEntity?.id,
            amount: paymentPayload.amount || 0,
            currency: paymentPayload.currency || 'INR',
            status: 'failed',
            paymentDate: new Date(),
            errorDescription: paymentPayload.error_description || 'Payment processing failed'
          },
          { upsert: true, new: true }
        );
      }
    }


    res.status(200).send('OK');
  } catch (err) {
    logger.error('📬 [Razorpay Webhook] processing error:', err);
    res.status(500).send(err.message);
  }
});

export default router;
