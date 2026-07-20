import express from 'express';
import { getApiKeys, createApiKey, deleteApiKey } from '../controllers/apiKeyController.mjs';
import { authMiddleware } from '../middleware/auth.mjs';

const router = express.Router();

router.get('/', authMiddleware, getApiKeys);
router.post('/', authMiddleware, createApiKey);
router.delete('/:id', authMiddleware, deleteApiKey);

export default router;
