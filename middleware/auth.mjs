import jwt from 'jsonwebtoken';
import logger from '../utils/logger.mjs';

export const authMiddleware = (req, res, next) => {
  const JWT_SECRET = process.env.JWT_SECRET;
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

  console.log(`🛡️ [Auth Middleware] ${req.method} ${req.path} - Token source: ${authHeader ? 'Header' : (token ? 'Cookie' : 'NONE')}`);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    logger.info('✓ JWT verified');
    next();
  } catch (err) {
    logger.warn(`Invalid token attempt: ${err.message}`);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', expired: true });
    }
    return res.status(401).json({ error: 'Unauthorized', details: err.message });
  }
};

