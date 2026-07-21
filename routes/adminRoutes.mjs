import express from 'express';
import { 
  adminLogin, 
  adminLogout,
  getAdminProfile,
  onboardClient,
  getAdminUsers,
  getAdminClientById,
  updateAdminClient,
  deleteAdminUser,
  getAdminSubscriptions,
  createAdminSubscription,
  updateAdminSubscription,
  cancelAdminSubscription,
  activateAdminSubscription,
  extendAdminSubscription,
  getAdminAuditLogs,
  getAdmins,
  createAdmin,
  deleteAdmin,
  getAdminPayments,
  getAdminAnalytics,
  getAdminApiKeys,
  createAdminApiKey,
  deleteAdminApiKey
} from '../controllers/adminController.mjs';
import { adminAuth, requireSuperadmin } from '../middleware/adminAuth.mjs';

const router = express.Router();

// ── Public Endpoints ──────────────────────────────────────────────
router.post('/login', adminLogin);
router.post('/logout', adminLogout);

// ── Protected Admin Endpoints ─────────────────────────────────────
router.get('/me', adminAuth, getAdminProfile);
router.get('/profile', adminAuth, getAdminProfile);
router.get('/analytics', adminAuth, getAdminAnalytics);
router.get('/audit-logs', adminAuth, getAdminAuditLogs);

// ── Client & User Management ─────────────────────────────────────
router.post('/clients', adminAuth, onboardClient);
router.get('/clients', adminAuth, getAdminUsers);
router.get('/clients/:id', adminAuth, getAdminClientById);
router.put('/clients/:id', adminAuth, updateAdminClient);
router.patch('/clients/:id', adminAuth, updateAdminClient);
router.delete('/clients/:id', adminAuth, deleteAdminUser);

// User aliases under REST convention
router.get('/users', adminAuth, getAdminUsers);
router.get('/users/:id', adminAuth, getAdminClientById);
router.patch('/users/:id', adminAuth, updateAdminClient);
router.put('/users/:id', adminAuth, updateAdminClient);
router.delete('/users/:id', adminAuth, deleteAdminUser);

// ── Subscription Management ───────────────────────────────────────
router.get('/subscriptions', adminAuth, getAdminSubscriptions);
router.post('/subscriptions', adminAuth, createAdminSubscription);
router.get('/subscriptions/:id', adminAuth, getAdminClientById);
router.patch('/subscriptions/:id', adminAuth, updateAdminSubscription);
router.put('/subscriptions/:id', adminAuth, updateAdminSubscription);
router.delete('/subscriptions/:id', adminAuth, cancelAdminSubscription);

// Action endpoints for subscriptions
router.post('/subscriptions/:userId/activate', adminAuth, activateAdminSubscription);
router.post('/subscriptions/:id/activate', adminAuth, activateAdminSubscription);
router.post('/subscriptions/:userId/cancel', adminAuth, cancelAdminSubscription);
router.post('/subscriptions/:id/cancel', adminAuth, cancelAdminSubscription);
router.post('/subscriptions/:userId/extend', adminAuth, extendAdminSubscription);
router.post('/subscriptions/:id/extend', adminAuth, extendAdminSubscription);

// ── Admin Accounts Management (Superadmin Only) ───────────────────
router.get('/admins', adminAuth, requireSuperadmin, getAdmins);
router.post('/admins', adminAuth, requireSuperadmin, createAdmin);
router.delete('/admins/:id', adminAuth, requireSuperadmin, deleteAdmin);

// ── Payments & API Key Management ─────────────────────────────────
router.get('/payments', adminAuth, getAdminPayments);
router.get('/api-keys', adminAuth, getAdminApiKeys);
router.post('/api-keys', adminAuth, createAdminApiKey);
router.delete('/api-keys/:id', adminAuth, deleteAdminApiKey);

export default router;
