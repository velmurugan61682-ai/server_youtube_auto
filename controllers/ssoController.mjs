import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.mjs';
import Organization from '../models/Organization.mjs';
import logger from '../utils/logger.mjs';

const JWT_SECRET = process.env.JWT_SECRET;
const DEFAULT_SSO_KEY = 'ciphergate_gowhats_secure_sso_key_2024';

export const handleSsoLogin = async (req, res) => {
  try {
    const sso_username = req.query.sso_username || req.body.sso_username;
    const sso_key = req.query.sso_key || req.body.sso_key;
    const role = req.query.role || req.body.role || 'client';
    const redirect = req.query.redirect || req.body.redirect || 'videos';
    const embed = req.query.embed || req.body.embed || 'true';
    const hide_shell = req.query.hide_shell || req.body.hide_shell || 'true';

    logger.info(`[SSO Request] Attempting SSO login for sso_username: "${sso_username}", role: "${role}", redirect: "${redirect}"`);

    // 1. Validate SSO Shared Secret Key
    const expectedKey = process.env.CIPHERGATE_SSO_KEY || DEFAULT_SSO_KEY;
    if (!sso_key || sso_key.trim() !== expectedKey.trim()) {
      logger.warn(`[SSO Auth Failure] Invalid or missing sso_key provided for user: "${sso_username}"`);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid or missing SSO secret key.'
      });
    }

    if (!sso_username) {
      return res.status(400).json({
        success: false,
        error: 'Missing required sso_username parameter.'
      });
    }

    // 2. Normalize email format
    const cleanUsername = String(sso_username).trim().toLowerCase();
    const email = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@ciphergate.in`;

    // 3. Resolve or Auto-Create User & Organization Workspace
    let user = await User.findOne({ email });

    if (!user) {
      logger.info(`[SSO Auto-Provision] Creating new SSO user and workspace for: ${email}`);
      const hashedPassword = await bcrypt.hash(`sso_${Date.now()}_${Math.random()}`, 12);
      
      const newOrg = new Organization({
        name: `${cleanUsername.split('@')[0]}'s Workspace`,
        status: 'active',
        planType: 'pro'
      });
      await newOrg.save();

      user = new User({
        name: cleanUsername.split('@')[0].toUpperCase(),
        email,
        password: hashedPassword,
        role: role === 'admin' ? 'admin' : 'client',
        organizationId: newOrg._id
      });
      await user.save();
    } else {
      // Ensure organizationId is assigned
      if (!user.organizationId) {
        const newOrg = new Organization({
          name: `${user.name}'s Workspace`,
          status: 'active',
          planType: 'pro'
        });
        await newOrg.save();
        user.organizationId = newOrg._id;
        await user.save();
      }
    }

    // 4. Issue JWT Token Session
    const token = jwt.sign({
      id: user._id,
      email: user.email,
      role: user.role || 'client',
      organizationId: user.organizationId,
      isSso: true
    }, JWT_SECRET, { expiresIn: '7d' });

    // Set secure auth cookie
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    logger.info(`[SSO Success] Auto-logged in SSO user: ${user.email} (ID: ${user._id})`);

    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId
      },
      embed: String(embed) === 'true',
      hide_shell: String(hide_shell) === 'true',
      redirect: redirect === 'videos' ? '/videos' : (redirect.startsWith('/') ? redirect : `/${redirect}`)
    });
  } catch (error) {
    logger.error(`[SSO Error] Server error during SSO processing: ${error.message}`);
    return res.status(500).json({ success: false, error: 'Internal server error during SSO login.' });
  }
};
