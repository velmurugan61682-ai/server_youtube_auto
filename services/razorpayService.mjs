import Razorpay from 'razorpay';
import crypto from 'crypto';
import logger from '../utils/logger.mjs';

const getKeyId = () => process.env.RAZORPAY_KEY_ID;
const getKeySecret = () => process.env.RAZORPAY_KEY_SECRET;

export const getRazorpayClient = () => {
  const key_id = getKeyId();
  const key_secret = getKeySecret();
  if (!key_id || !key_secret) {
    logger.warn('Razorpay configuration missing: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are not set in environment.');
    return null;
  }
  return new Razorpay({ key_id, key_secret });
};

/**
 * Creates a real production AutoPay subscription in Razorpay
 * Uses process.env.RAZORPAY_PLAN_ID (default: plan_TSmDpAjzlWzqVp)
 */
export const createRazorpaySubscription = async (planId, email) => {
  const client = getRazorpayClient();
  if (!client) {
    throw new Error('Razorpay integration is not configured. Please specify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
  }

  try {
    const activePlanId = process.env.RAZORPAY_PLAN_ID || planId || 'plan_TSmDpAjzlWzqVp';

    logger.info(`[Razorpay Service] Creating recurring subscription with Plan ID: ${activePlanId}`);

    const subscription = await client.subscriptions.create({
      plan_id: activePlanId,
      total_count: 12,
      quantity: 1,
      customer_notify: 1,
      notes: {
        email: email || ''
      }
    });

    logger.info(`[Razorpay Service] Subscription created successfully: ${subscription.id}`);
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
  const client = getRazorpayClient();
  if (!client) {
    throw new Error('Razorpay integration is not configured.');
  }

  try {
    const cancelled = await client.subscriptions.cancel(subscriptionId, {
      cancel_at_cycle_end: 1
    });
    return cancelled;
  } catch (error) {
    logger.error('Error cancelling Razorpay subscription:', error);
    throw new Error(error.description || error.message || 'Razorpay error');
  }
};

/**
 * Verify Razorpay payment signature for webhooks
 */
export const verifyWebhookSignature = (rawBody, signature, secret) => {
  const webhookSecret = secret || process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) return false;
  
  let data = rawBody;
  if (typeof rawBody !== 'string' && !Buffer.isBuffer(rawBody)) {
    try {
      data = JSON.stringify(rawBody);
    } catch (e) {
      data = String(rawBody);
    }
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(data)
    .digest('hex');
  
  return expectedSignature === signature;
};

/**
 * Verify Razorpay subscription payment signature (standard checkout modal verification)
 * Format: razorpay_payment_id + "|" + razorpay_subscription_id
 */
export const verifySubscriptionSignature = (paymentId, subscriptionId, signature) => {
  const secret = getKeySecret();
  if (!secret) return false;
  
  const text = `${paymentId}|${subscriptionId}`;
  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(text)
    .digest('hex');
    
  return generatedSignature === signature;
};

/**
 * Fetch invoices for a subscription
 */
export const getSubscriptionInvoices = async (subscriptionId) => {
  const client = getRazorpayClient();
  if (!client) return [];
  try {
    const invoices = await client.invoices.all({ subscription_id: subscriptionId });
    return invoices.items || [];
  } catch (error) {
    logger.error('Error fetching Razorpay invoices:', error);
    return [];
  }
};
