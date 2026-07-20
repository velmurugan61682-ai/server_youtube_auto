import express from 'express';
import { 
  adminLogin, 
  getAdminProfile,
  getAdminUsers,
  getAdminClientById,
  updateAdminClient,
  deleteAdminUser,
  getAdminSubscriptions,
  activateAdminSubscription,
  cancelAdminSubscription,
  extendAdminSubscription,
  getAdminPayments,
  getAdminAnalytics,
  getAdminApiKeys,
  createAdminApiKey,
  deleteAdminApiKey
} from '../controllers/adminController.mjs';
import { adminAuth } from '../middleware/adminAuth.mjs';

const router = express.Router();

// Public Admin Login
router.post('/login', adminLogin);

// Protected Admin Endpoints
router.get('/profile', adminAuth, getAdminProfile);
router.get('/analytics', adminAuth, getAdminAnalytics);

// Client Management
router.get('/clients', adminAuth, getAdminUsers);
router.get('/clients/:id', adminAuth, getAdminClientById);
router.put('/clients/:id', adminAuth, updateAdminClient);
router.delete('/clients/:id', adminAuth, deleteAdminUser);

// Legacy aliases
router.get('/users', adminAuth, getAdminUsers);
router.delete('/users/:id', adminAuth, deleteAdminUser);

// Subscription Management
router.get('/subscriptions', adminAuth, getAdminSubscriptions);
router.post('/subscriptions/:userId/activate', adminAuth, activateAdminSubscription);
router.post('/subscriptions/:id/activate', adminAuth, activateAdminSubscription);

router.post('/subscriptions/:userId/cancel', adminAuth, cancelAdminSubscription);
router.post('/subscriptions/:id/cancel', adminAuth, cancelAdminSubscription);

router.post('/subscriptions/:userId/extend', adminAuth, extendAdminSubscription);
router.post('/subscriptions/:id/extend', adminAuth, extendAdminSubscription);

// Payment Management & API Keys
router.get('/payments', adminAuth, getAdminPayments);
router.get('/api-keys', adminAuth, getAdminApiKeys);
router.post('/api-keys', adminAuth, createAdminApiKey);
router.delete('/api-keys/:id', adminAuth, deleteAdminApiKey);

export default router;
