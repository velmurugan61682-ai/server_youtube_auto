import express from 'express';
import {
  getApiKeys,
  createApiKey,
  updateApiKey,
  deleteApiKey,
  getApiKeyStats,
  getAvailablePermissions
} from '../controllers/apiKeyController.mjs';
import { authMiddleware } from '../middleware/auth.mjs';

const router = express.Router();

// Meta: list all available permission scopes (no auth needed)
router.get('/permissions', getAvailablePermissions);

// CRUD — all require a valid user JWT
router.get('/',           authMiddleware, getApiKeys);
router.post('/',          authMiddleware, createApiKey);
router.put('/:id',        authMiddleware, updateApiKey);
router.delete('/:id',     authMiddleware, deleteApiKey);
router.get('/:id/stats',  authMiddleware, getApiKeyStats);

export default router;
