import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.mjs';

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || (process.env.NODE_ENV === 'production' ? process.env.JWT_SECRET : 'admin_sec_7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f');

export const adminAuth = async (req, res, next) => {
  let token = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.adminToken) {
    token = req.cookies.adminToken;
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Admin token is missing.' });
  }

  try {
    // Strictly verify token using ADMIN_JWT_SECRET (rejects client tokens signed with standard JWT_SECRET)
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET);

    if (!decoded || !decoded.isAdminToken) {
      return res.status(403).json({ success: false, error: 'Forbidden: Valid Admin JWT token required.' });
    }

    // Verify admin account exists in Admin collection (completely separate from User collection)
    const adminRecord = await Admin.findById(decoded.id).select('-passwordHash').lean();
    if (!adminRecord) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Admin account not found.' });
    }

    req.admin = {
      id: adminRecord._id,
      email: adminRecord.email,
      name: adminRecord.name,
      role: adminRecord.role || 'support',
      isAdmin: true
    };

    next();
  } catch (err) {
    console.error('[Admin Auth Middleware] Invalid admin token:', err.message);
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired admin token.' });
  }
};

export const requireSuperadmin = (req, res, next) => {
  if (!req.admin || req.admin.role !== 'superadmin') {
    return res.status(403).json({ 
      success: false, 
      error: 'Forbidden: Only Superadmin role can perform this action.' 
    });
  }
  next();
};
