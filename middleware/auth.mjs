import jwt from 'jsonwebtoken';
import logger from '../utils/logger.mjs';

export const authMiddleware = (req, res, next) => {
  const JWT_SECRET = process.env.JWT_SECRET;
  const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || JWT_SECRET;

  const authHeader = req.headers.authorization || req.headers.Authorization;
  let token = null;

  if (authHeader && typeof authHeader === 'string') {
    const trimmedHeader = authHeader.trim();
    if (/^Bearer\s+/i.test(trimmedHeader)) {
      token = trimmedHeader.replace(/^Bearer\s+/i, '').trim();
    }
  }

  // Fallback to cookie if Bearer token is missing
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // Sanitize malformed token strings, quotes, and URL encoding
  if (typeof token === 'string') {
    token = token.trim().replace(/^["']|["']$/g, '');
    try {
      token = decodeURIComponent(token);
    } catch (_) {}
    token = token.trim().replace(/^["']|["']$/g, '');
    if (token === 'null' || token === 'undefined' || token === '') {
      token = null;
    }
  }

  logger.debug(`[Auth] ${req.method} ${req.path}`);

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    // First try the regular client JWT_SECRET
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      ...decoded,
      id: decoded.id || decoded._id,
      role: decoded.role || (decoded.isAdmin ? 'admin' : 'client'),
      isAdmin: decoded.role === 'admin' || !!decoded.isAdmin || !!decoded.isAdminToken
    };
    req.isAdminJwt = !!decoded.isAdminToken || req.user.isAdmin;
    logger.info('✓ JWT verified');
    next();
  } catch (err) {
    // If client secret fails and admin secret is different, try admin secret
    if (ADMIN_JWT_SECRET && ADMIN_JWT_SECRET !== JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, ADMIN_JWT_SECRET);
        req.user = {
          ...decoded,
          id: decoded.id || decoded._id,
          role: decoded.role || 'admin',
          isAdmin: true
        };
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
