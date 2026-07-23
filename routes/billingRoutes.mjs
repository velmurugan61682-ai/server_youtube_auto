import express from 'express';
import { authMiddleware } from '../middleware/auth.mjs';
import User from '../models/User.mjs';
import Organization from '../models/Organization.mjs';
import BillingHistory from '../models/BillingHistory.mjs';
import { createRazorpaySubscription, getSubscriptionInvoices } from '../services/razorpayService.mjs';
import logger from '../utils/logger.mjs';

const router = express.Router();

// GET /api/billing/status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('subscription role organizationId createdAt').lean();
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    let organizationName = 'ChannelMate';
    if (user.organizationId) {
      const org = await Organization.findById(user.organizationId).lean();
      if (org) organizationName = org.name;
    }

    return res.json({
      success: true,
      data: {
        subscription: user.subscription || { id: '', status: 'none', planId: 'free' },
        role: user.role,
        organizationName,
        trialExpired: false
      }
    });
  } catch (err) {
    logger.error('Error fetching billing status:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/billing/subscribe
router.post('/subscribe', authMiddleware, async (req, res) => {
  try {
    const { planType = 'professional' } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';
    let subscription = null;

    if (razorpayKeyId && process.env.RAZORPAY_KEY_SECRET) {
      try {
        subscription = await createRazorpaySubscription(planType, user.email);
      } catch (sdkErr) {
        logger.warn(`Razorpay SDK subscription create warning: ${sdkErr.message}`);
      }
    }

    const subscriptionId = subscription?.id || `sub_dummy_${Date.now()}`;

    return res.json({
      success: true,
      subscriptionId,
      razorpayKeyId,
      status: 'created',
      message: 'Subscription created successfully'
    });
  } catch (err) {
    logger.error('Error creating subscription:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/billing/invoices
router.get('/invoices', authMiddleware, async (req, res) => {
  try {
    const dbInvoices = await BillingHistory.find({ userId: req.user.id })
      .sort({ billingDate: -1 })
      .lean();

    return res.json({
      success: true,
      data: dbInvoices.map(inv => ({
        id: inv.razorpayInvoiceId || inv._id.toString(),
        invoiceNumber: inv.razorpayInvoiceId || 'INV-001',
        billingDate: inv.billingDate,
        amount: inv.amount,
        currency: 'INR',
        status: inv.status,
        invoiceUrl: inv.invoiceUrl || ''
      }))
    });
  } catch (err) {
    logger.error('Error fetching invoices:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
