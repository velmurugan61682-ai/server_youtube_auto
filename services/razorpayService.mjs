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
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: planId === process.env.RAZORPAY_PLAN_YEARLY ? 5 : 60, // 5 cycles for yearly, 60 for monthly
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
