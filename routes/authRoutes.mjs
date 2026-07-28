import express from 'express';
import { body, validationResult } from 'express-validator';
import { register, login, getMe, logout, listOrganizations, switchOrganization, updateProfile } from '../controllers/authController.mjs';
import { handleSsoLogin } from '../controllers/ssoController.mjs';
import { authMiddleware } from '../middleware/auth.mjs';

const router = express.Router();

const validateRegister = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }
    next();
  }
];

const validateLogin = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }
    next();
  }
];

import { initiateAuth, handleCallback } from '../controllers/youtubeController.mjs';

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.get('/me', authMiddleware, getMe);
router.post('/logout', logout);
router.get('/sso', handleSsoLogin);
router.post('/sso', handleSsoLogin);
router.get('/sso-login', handleSsoLogin);
router.post('/sso-login', handleSsoLogin);
router.get('/organizations', authMiddleware, listOrganizations);
router.post('/switch-org', authMiddleware, switchOrganization);
router.put('/profile', authMiddleware, updateProfile);

// Google & YouTube OAuth Integration Routes
const googleAuthHandler = (req, res, next) => {
  // Support Bearer token passed in Header, Cookie, or Query param
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return authMiddleware(req, res, () => initiateAuth(req, res, next));
};

router.all('/google', googleAuthHandler);
router.all('/google/login', googleAuthHandler);
router.get('/google/callback', handleCallback);

export default router;
