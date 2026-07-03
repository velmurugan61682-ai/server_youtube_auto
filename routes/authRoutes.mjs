import express from 'express';
import { register, login, getMe, logout, sso } from '../controllers/authController.mjs';
import { authMiddleware } from '../middleware/auth.mjs';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authMiddleware, getMe);
router.post('/logout', logout);
router.post('/sso', sso);

export default router;
