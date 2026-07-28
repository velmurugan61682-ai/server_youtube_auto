import jwt from 'jsonwebtoken';
import logger from '../utils/logger.mjs';

export const authMiddleware = (req, res, next) => {
  const JWT_SECRET = process.env.JWT_SECRET;
  const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || JWT_SECRET;

  const authHeader = req.headers.authorization;
  let token = authHeader && authHeader.split(' ')[1];

  // Fallback to cookie if Bearer token is missing
  if (!token && req.cookies) {
    token = req.cookies.token;
  }

  // Sanitize malformed token strings
  if (token === 'null' || token === 'undefined') {
    token = null;
  }

  logger.debug(`[Auth] ${req.method} ${req.path}`);

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    // First try the regular client JWT_SECRET
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    req.isAdminJwt = !!decoded.isAdminToken;
    logger.info('✓ JWT verified');
    next();
  } catch (err) {
    // If client secret fails and admin secret is different, try admin secret
    if (ADMIN_JWT_SECRET && ADMIN_JWT_SECRET !== JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, ADMIN_JWT_SECRET);
        req.user = decoded;
        req.isAdminJwt = true;
        logger.info('✓ Admin JWT verified');
        return next();
      } catch (_adminErr) {
        // Fall through to original error handling
      }
    }

    logger.warn(`Invalid token attempt: ${err.message}`);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Authentication required', expired: true });
    }
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
};
