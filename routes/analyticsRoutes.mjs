import express from 'express';
import { getAnalytics, getDashboardAnalytics } from '../controllers/analyticsController.mjs';
import { authMiddleware } from '../middleware/auth.mjs';

const router = express.Router();

router.get('/', authMiddleware, getAnalytics);
router.get('/dashboard', authMiddleware, getDashboardAnalytics);

export default router;

