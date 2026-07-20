import { authMiddleware } from './auth.mjs';

/**
 * Middleware to restrict route access strictly to users with role === 'admin'
 */
export const requireAdminRole = [
  authMiddleware,
  (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Access restricted to Admin users only.' });
    }
    next();
  }
];
