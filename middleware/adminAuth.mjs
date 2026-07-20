import jwt from 'jsonwebtoken';

export const adminAuth = (req, res, next) => {
  const JWT_SECRET = process.env.JWT_SECRET;
  const authHeader = req.headers.authorization;
  let token = authHeader && authHeader.split(' ')[1];

  // Fallback to cookie
  if (!token && req.cookies) {
    token = req.cookies.adminToken;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Admin token is missing.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ error: 'Forbidden: Access denied. Admin privileges required.' });
    }
    
    req.admin = decoded;
    next();
  } catch (err) {
    console.error('[Admin Auth Middleware] Invalid admin token:', err.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired admin token.' });
  }
};
