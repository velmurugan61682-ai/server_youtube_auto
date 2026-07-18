import express from 'express';
import { body, validationResult } from 'express-validator';
import { register, login, getMe, logout, sso, listOrganizations, switchOrganization, updateProfile } from '../controllers/authController.mjs';
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

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.get('/me', authMiddleware, getMe);
router.post('/logout', logout);
router.post('/sso', sso);
router.get('/organizations', authMiddleware, listOrganizations);
router.post('/switch-org', authMiddleware, switchOrganization);
router.put('/profile', authMiddleware, updateProfile);

export default router;
