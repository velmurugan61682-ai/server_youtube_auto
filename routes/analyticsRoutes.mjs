import express from 'express';
import { 
  getAnalytics, 
  getDashboardAnalytics,
  getAnalyticsOverview,
  getTopVideos,
  getSentimentBreakdown
} from '../controllers/analyticsController.mjs';
import { authMiddleware } from '../middleware/auth.mjs';

const router = express.Router();

router.get('/', authMiddleware, getAnalytics);
router.get('/overview', authMiddleware, getAnalyticsOverview);
router.get('/dashboard', authMiddleware, getDashboardAnalytics);
router.get('/top-videos', authMiddleware, getTopVideos);
router.get('/sentiment-breakdown', authMiddleware, getSentimentBreakdown);

export default router;

