import express from 'express';
import { getDashboardStats } from '../controllers/dashboardController.mjs';
import { authMiddleware } from '../middleware/auth.mjs';

const router = express.Router();

router.get('/stats', authMiddleware, getDashboardStats);

export default router;
