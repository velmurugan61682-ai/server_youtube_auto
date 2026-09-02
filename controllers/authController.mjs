import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.mjs';
import Organization from '../models/Organization.mjs';
import logger from '../utils/logger.mjs';

const JWT_SECRET = process.env.JWT_SECRET;
const allowDevAutoLogin = () => process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_AUTO_LOGIN === 'true';

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please provide all fields' });
    }

    const exists = await User.findOne({ email }).lean();
    if (exists) return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 12);

    // Create dedicated organization workspace for tenant isolation
    let orgName = `${name}'s Workspace`;
    const existingOrg = await Organization.findOne({ name: orgName }).lean();
    if (existingOrg) {
      orgName = `${name}'s Workspace (${Math.floor(1000 + Math.random() * 9000)})`;
    }

    const newOrg = new Organization({
      name: orgName,
      status: 'active',
      planType: 'free'
    });
    await newOrg.save();

    const user = new User({
      name,
      email,
      password: hashedPassword,
      organizationId: newOrg._id
    });
    await user.save();

    res.status(201).json({ success: true, message: 'User registered successfully' });
  } catch (error) {
    logger.error('Registration Error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = (email || '').toLowerCase().trim();

    // 1. Guaranteed Single Admin Login Handler
    if (cleanEmail === 'admin@channelbot.in' || cleanEmail === 'admin@youtubeai.test') {
      let adminUser = await User.findOne({
        $or: [{ email: 'admin@channelbot.in' }, { role: 'admin' }]
      });

      if (!adminUser && !allowDevAutoLogin()) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (!password) {
        return res.status(400).json({ error: 'Admin password is required' });
      }
      const hashedPassword = await bcrypt.hash(password, 12);

      if (!adminUser) {
        adminUser = new User({
          name: 'Channelbot Admin',
          email: 'admin@channelbot.in',
          password: hashedPassword,
          role: 'admin',
          createdAt: new Date()
        });
        await adminUser.save();
      } else {
        const isAdminPasswordValid = adminUser.password
          ? await bcrypt.compare(password || '', adminUser.password)
          : false;
        const isAdminHashValid = !isAdminPasswordValid && adminUser.passwordHash
          ? await bcrypt.compare(password || '', adminUser.passwordHash)
          : false;

        if (!isAdminPasswordValid && !isAdminHashValid) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        adminUser.email = 'admin@channelbot.in';
        adminUser.role = 'admin';
        await adminUser.save();
      }

      const token = jwt.sign({
        id: adminUser._id,
        email: adminUser.email,
        role: 'admin',
        isAdmin: true,
        organizationId: adminUser.organizationId
      }, JWT_SECRET, { expiresIn: '7d' });

      const isProd = process.env.NODE_ENV === 'production';
      res.cookie('token', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return res.json({
        success: true,
        token,
        user: { id: adminUser._id, name: adminUser.name, email: adminUser.email, role: 'admin' }
      });
    }

    // 2. Standard Client User Login Handler
    let user = await User.findOne({ email: new RegExp(`^${cleanEmail}$`, 'i') });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }


    let isMatch = false;
    if (user.password) {
      isMatch = await bcrypt.compare(password, user.password);
    }
    if (!isMatch && user.passwordHash) {
      isMatch = await bcrypt.compare(password, user.passwordHash);
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({
      id: user._id,
      email: user.email,
      role: user.role || 'client',
      isAdmin: user.role === 'admin',
      organizationId: user.organizationId
    }, JWT_SECRET, { expiresIn: '7d' });

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role || 'client', organization: user.organization || '', profilePicture: user.profilePicture }
    });
  } catch (error) {
    logger.error('Login Error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
};



import { normalizePlanName } from '../config/planFeatures.mjs';

export const getMe = async (req, res) => {
  try {
    let user = null;

    // Primary lookup by ID from JWT
    if (req.user?.id) {
      try {
        user = await User.findById(req.user.id).select('-password -passwordHash').lean();
      } catch (idErr) {
        logger.warn(`[getMe] User lookup by ID (${req.user.id}) failed: ${idErr.message}`);
      }
    }

    // Fallback: if not found by ID, try by email from JWT payload
    if (!user && req.user?.email) {
      const cleanEmail = req.user.email.trim().toLowerCase();
      logger.warn(`[getMe] User not found by ID (${req.user?.id}), falling back to email lookup: ${cleanEmail}`);
      user = await User.findOne({ email: cleanEmail }).select('-password -passwordHash').lean();
      if (!user) {
        user = await User.findOne({ email: new RegExp(`^${cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).select('-password -passwordHash').lean();
      }
    }

    if (!user) {
      logger.warn(`[getMe] User not found by ID or email. JWT id=${req.user?.id}, email=${req.user?.email}`);
      return res.status(404).json({ error: 'User not found' });
    }

    const rawPlan = user.subscription?.planId || user.subscription?.planType || user.plan || 'free';
    const plan = normalizePlanName(rawPlan);
    const subscriptionStatus = user.subscription?.status || user.subscriptionStatus || 'active';

    res.json({
      ...user,
      plan,
      subscriptionStatus
    });
  } catch (error) {
    logger.error('getMe Error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

export const sso = async (req, res) => {
  try {
    const { sso_username, sso_key } = req.body;
    const allowedKeys = [
      process.env.SSO_KEY,
      process.env.DEV_SSO_KEY
    ].filter(Boolean);

    if (!allowedKeys.length) {
      logger.error('[SSO] No SSO keys configured in environment');
      return res.status(503).json({ error: 'SSO not configured' });
    }

    if (!sso_key || !allowedKeys.includes(sso_key)) {
      logger.warn(`🔑 [SSO Attempt] Invalid SSO key from IP: ${req.ip}`);
      return res.status(401).json({ error: 'Invalid SSO credentials' });
    }

    if (!sso_username) {
      return res.status(400).json({ error: 'sso_username is required' });
    }

    const user = await User.findOne({ email: sso_username }).lean();
    if (!user) {
      logger.warn(`🔑 [SSO Attempt] SSO user not found for email: ${sso_username}`);
      return res.status(401).json({ error: 'SSO user not found' });
    }

    const token = jwt.sign({
      id: user._id,
      email: user.email,
      role: user.role || 'client',
      organizationId: user.organizationId
    }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, profilePicture: user.profilePicture }
    });
  } catch (error) {
    res.status(500).json({ error: 'SSO authentication failed.' });
  }
};

export const logout = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
  res.json({ success: true });
};

export const listOrganizations = async (req, res) => {
  try {
    const orgs = await Organization.find({}).select('name logo').lean();
    res.json(orgs);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

export const switchOrganization = async (req, res) => {
  try {
    const { organizationId } = req.body;
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' });

    // Validate requestor is admin
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin access required' });

    // Verify organization exists
    const org = await Organization.findById(organizationId).lean();
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    // Update user active tenant
    user.organizationId = organizationId;
    await user.save();

    // Re-sign token with updated tenant context
    const token = jwt.sign({
      id: user._id,
      email: user.email,
      role: user.role || 'client',
      organizationId: user.organizationId
    }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, organizationId }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, email, password, profilePicture } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email }).lean();
      if (emailExists) return res.status(400).json({ error: 'Email already taken by another user' });
      user.email = email;
    }

    if (name) user.name = name;
    if (profilePicture !== undefined) {
      // Limit profilePicture to 500KB base64 string to prevent DoS
      if (typeof profilePicture === 'string' && profilePicture.length > 700000) {
        return res.status(400).json({ error: 'Profile picture is too large. Maximum 500KB allowed.' });
      }
      user.profilePicture = profilePicture;
    }
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
      }
      user.password = await bcrypt.hash(password, 12);
    }

    await user.save();

    const updatedUser = user.toObject();
    delete updatedUser.password;
    delete updatedUser.passwordHash;

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    logger.error('Update Profile Error:', error);
    res.status(500).json({ error: 'Profile update failed.' });
  }
};
