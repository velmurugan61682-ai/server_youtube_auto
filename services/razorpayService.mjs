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

let razorpay = getRazorpayClient();

/**
 * Creates a subscription in Razorpay
 */
export const createRazorpaySubscription = async (planId, email) => {
  const client = getRazorpayClient() || razorpay;
  if (!client) {
    throw new Error('Razorpay integration is not configured. Please specify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the .env file.');
  }

  try {
    let activePlanId = planId;

    // Auto-create/resolve plan in Razorpay if it is a mock ID
    if (activePlanId.includes('mock') || !activePlanId.startsWith('plan_')) {
      logger.info(`Plan ID is a mock placeholder (${planId}). Resolving corresponding plan details in Razorpay...`);
      try {
        const plans = await client.plans.all({ count: 50 });
        
        let planDetails = {
          name: 'Pro Plan (999)',
          amount: 99900,
          period: 'monthly',
          interval: 1,
          description: '1 Month Pro Plan - Unlimited YouTube Channels'
        };
        
        if (planId.includes('one_rupee')) {
          planDetails = {
            name: '1 Rupee Plan',
            amount: 100, // ₹1 in paise
            period: 'monthly',
            interval: 1,
            description: '1 Rupee Plan - 1 Channel Connection'
          };
        } else if (planId.includes('monthly_345') || planId === 'monthly') {
          planDetails = {
            name: '1 Month Plan (345)',
            amount: 34500, // ₹345 in paise
            period: 'monthly',
            interval: 1,
            description: '1 Month Plan - 5 Channels Connection'
          };
        } else if (planId.includes('two_months_600')) {
          planDetails = {
            name: '2 Months Plan (600)',
            amount: 60000, // ₹600 in paise
            period: 'monthly',
            interval: 2,
            description: '2 Months Plan - 10 Channels Connection'
          };
        } else if (planId.includes('three_months_999') || planId === 'quarterly' || planId.includes('professional') || planId.includes('pro')) {
          planDetails = {
            name: 'Pro Plan (999)',
            amount: 99900, // ₹999 in paise
            period: 'monthly',
            interval: 1,
            description: '1 Month Pro Plan - Unlimited Channels Connection'
          };
        } else if (planId === 'yearly' || planId.includes('yearly_2999')) {
          planDetails = {
            name: 'Yearly Plan (2999)',
            amount: 299900, // ₹2999 in paise
            period: 'yearly',
            interval: 1,
            description: 'Yearly Plan - Unlimited Channels Connection & Priority AI'
          };
        }


        const existingPlan = plans.items?.find(p => p.item?.name === planDetails.name);
        if (existingPlan) {
          activePlanId = existingPlan.id;
          logger.info(`Found existing plan on Razorpay: ${activePlanId}`);
        } else {
          logger.info(`Creating a new plan (${planDetails.name}) on Razorpay...`);
          const newPlan = await razorpay.plans.create({
            period: planDetails.period,
            interval: planDetails.interval,
            item: {
              name: planDetails.name,
              amount: planDetails.amount,
              currency: 'INR',
              description: planDetails.description
            }
          });
          activePlanId = newPlan.id;
          logger.info(`Created new plan on Razorpay: ${activePlanId}`);
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
  const client = getRazorpayClient() || razorpay;
  if (!client) {
    throw new Error('Razorpay integration is not configured.');
  }

  try {
    const cancelled = await client.subscriptions.cancel(subscriptionId, {
      cancel_at_cycle_end: 1 // cancel at end of billing cycle
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
  const client = getRazorpayClient() || razorpay;
  if (!client) return [];
  try {
    const invoices = await client.invoices.all({ subscription_id: subscriptionId });
    return invoices.items || [];
  } catch (error) {
    logger.error('Error fetching Razorpay invoices:', error);
    return [];
  }
};
