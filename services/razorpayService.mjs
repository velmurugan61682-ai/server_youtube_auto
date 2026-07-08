import Razorpay from 'razorpay';
import crypto from 'crypto';
import logger from '../utils/logger.mjs';

const key_id = process.env.RAZORPAY_KEY_ID;
const key_secret = process.env.RAZORPAY_KEY_SECRET;

let razorpay = null;

// Initialize conditionally to prevent startup crashes if environment variables are not yet configured
if (key_id && key_secret) {
  razorpay = new Razorpay({
    key_id,
    key_secret
  });
  logger.info('💳 Razorpay SDK Initialized.');
} else {
  logger.warn('⚠️ Razorpay credentials missing from env. Subscriptions will run in mock mode.');
}

/**
 * Creates a subscription in Razorpay
 */
export const createRazorpaySubscription = async (planId, email) => {
  if (!razorpay) {
    throw new Error('Razorpay integration is not configured. Please specify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the .env file.');
  }

  try {
    let activePlanId = planId;

    // Auto-create/resolve plan in Razorpay if it is a mock ID
    if (activePlanId.includes('mock') || !activePlanId.startsWith('plan_')) {
      logger.info(`Plan ID is a mock placeholder (${planId}). Checking for existing Premium plan in Razorpay account...`);
      try {
        const plans = await razorpay.plans.all({ count: 50 });
        const existingPlan = plans.items?.find(p => p.item?.name === 'Premium Pro Plan');
        if (existingPlan) {
          activePlanId = existingPlan.id;
          logger.info(`Found existing Premium plan on Razorpay: ${activePlanId}`);
        } else {
          logger.info('Creating a new Premium Pro Plan in Razorpay...');
          const newPlan = await razorpay.plans.create({
            period: 'monthly',
            interval: 1,
            item: {
              name: 'Premium Pro Plan',
              amount: 99900, // ₹999.00 in paise
              currency: 'INR',
              description: 'Premium Pro Plan - Unlimited YouTube Channels'
            }
          });
          activePlanId = newPlan.id;
          logger.info(`Created new Premium plan on Razorpay: ${activePlanId}`);
        }
      } catch (err) {
        logger.error('Failed to auto-resolve Razorpay plan. Attempting with original plan ID:', err);
      }
    }

    const subscription = await razorpay.subscriptions.create({
      plan_id: activePlanId,
      customer_notify: 1,
      total_count: 60, // 60 cycles (5 years)
      notes: {
        email
      }
    });
    return subscription;
  } catch (error) {
    logger.error('Error creating Razorpay subscription:', error);
    throw new Error(error.description || error.message || 'Razorpay error');
  }
};

/**
 * Cancels a subscription in Razorpay
 */
export const cancelRazorpaySubscription = async (subscriptionId) => {
  if (!razorpay) {
    throw new Error('Razorpay integration is not configured.');
  }

  try {
    const cancelled = await razorpay.subscriptions.cancel(subscriptionId, {
      cancel_at_cycle_end: 1 // cancel at end of billing cycle
    });
    return cancelled;
  } catch (error) {
    logger.error('Error cancelling Razorpay subscription:', error);
    throw new Error(error.description || error.message || 'Razorpay error');
  }
};

/**
 * Verify Razorpay payment signature
 */
export const verifyWebhookSignature = (body, signature, secret) => {
  if (!secret) return false;
  
  const shasum = crypto.createHmac('sha256', secret);
  shasum.update(JSON.stringify(body));
  const digest = shasum.digest('hex');
  
  return digest === signature;
};

/**
 * Fetch invoices for a subscription
 */
export const getSubscriptionInvoices = async (subscriptionId) => {
  if (!razorpay) {
    return [
      {
        id: 'inv_mock_001',
        amount: 29900, // INR 299.00
        currency: 'INR',
        status: 'issued',
        issued_at: Math.floor((Date.now() - 5 * 24 * 60 * 60 * 1000) / 1000),
        invoice_number: 'INV-2026-001'
      }
    ];
  }
  try {
    const invoices = await razorpay.invoices.all({ subscription_id: subscriptionId });
    return invoices.items || [];
  } catch (error) {
    logger.error('Error fetching Razorpay invoices:', error);
    return [];
  }
};
