import crypto from 'crypto';
import ApiKey, { VALID_PERMISSIONS } from '../models/ApiKey.mjs';
import { getKeyRateLimitStats } from '../middleware/apiKeyAuth.mjs';

// Helper to mask API key for security (shown in list views)
const maskKey = (key) => {
  if (!key || key.length < 12) return '••••••••';
  return `${key.substring(0, 7)}••••••••${key.substring(key.length - 4)}`;
};

// ── GET /api/api-keys ─────────────────────────────────────────────────────────
export const getApiKeys = async (req, res) => {
  try {
    const filter = req.user?.id ? { $or: [{ userId: req.user.id }, { userId: null }, { userId: { $exists: false } }] } : {};
    const keys = await ApiKey.find(filter).sort({ createdAt: -1 });

    const sanitizedKeys = keys.map(k => ({
      _id: k._id,
      name: k.name,
      description: k.description || '',
      key: maskKey(k.key),
      rawKey: k.key,
      permissions: k.permissions || [],
      rateLimit: k.rateLimit || { requestsPerHour: 500 },
      expiresAt: k.expiresAt || null,
      isActive: k.isActive,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt || null,
      usageCount: k.usageCount || 0
    }));

    res.json({ success: true, count: sanitizedKeys.length, apiKeys: sanitizedKeys });
  } catch (error) {
    console.error('Failed to get API keys:', error);
    res.status(500).json({ error: 'Failed to retrieve API keys.' });
  }
};

// ── POST /api/api-keys ────────────────────────────────────────────────────────
export const createApiKey = async (req, res) => {
  try {
    const { name, description, permissions, rateLimit, expiresAt } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Key name is required.' });
    }

    // Validate permissions
    const requestedPerms = Array.isArray(permissions) ? permissions : VALID_PERMISSIONS;
    const invalidPerms = requestedPerms.filter(p => !VALID_PERMISSIONS.includes(p));
    if (invalidPerms.length > 0) {
      return res.status(400).json({
        error: `Invalid permissions: ${invalidPerms.join(', ')}`,
        validPermissions: VALID_PERMISSIONS
      });
    }

    // Validate rate limit
    const rph = (rateLimit && typeof rateLimit.requestsPerHour === 'number')
      ? Math.min(Math.max(1, rateLimit.requestsPerHour), 10000)
      : 500;

    // Validate expiry
    let parsedExpiry = null;
    if (expiresAt) {
      parsedExpiry = new Date(expiresAt);
      if (isNaN(parsedExpiry.getTime()) || parsedExpiry <= new Date()) {
        return res.status(400).json({ error: 'expiresAt must be a valid future date.' });
      }
    }

    // Generate a secure random API key prefixed with yt_
    const rawKey = `yt_${crypto.randomBytes(28).toString('hex')}`;

    const newKey = new ApiKey({
      userId: req.user.id,
      name: name.trim(),
      description: (description || '').trim(),
      key: rawKey,
      permissions: requestedPerms,
      rateLimit: { requestsPerHour: rph },
      expiresAt: parsedExpiry,
      isActive: true
    });

    await newKey.save();

    // Return the FULL unmasked key ONLY at creation time
    res.status(201).json({
      success: true,
      message: 'API Key generated successfully. Copy it now — it will not be shown again.',
      apiKey: {
        _id: newKey._id,
        name: newKey.name,
        description: newKey.description,
        key: rawKey,
        permissions: newKey.permissions,
        rateLimit: newKey.rateLimit,
        expiresAt: newKey.expiresAt,
        isActive: newKey.isActive,
        createdAt: newKey.createdAt
      }
    });
  } catch (error) {
    console.error('Failed to create API key:', error);
    res.status(500).json({ error: 'Failed to create API key.' });
  }
};

// ── PUT /api/api-keys/:id ─────────────────────────────────────────────────────
export const updateApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, permissions, rateLimit, expiresAt, isActive } = req.body;

    const filter = (req.user?.role === 'admin' || req.user?.role === 'superadmin' || req.user?.isAdmin || !req.user?.id)
      ? { _id: id }
      : { _id: id, $or: [{ userId: req.user.id }, { userId: null }, { userId: { $exists: false } }] };

    const keyDoc = await ApiKey.findOne(filter);
    if (!keyDoc) {
      return res.status(404).json({ error: 'API Key not found or unauthorized.' });
    }

    // Apply updates
    if (name && typeof name === 'string' && name.trim()) keyDoc.name = name.trim();
    if (typeof description === 'string') keyDoc.description = description.trim();
    if (typeof isActive === 'boolean') keyDoc.isActive = isActive;

    if (Array.isArray(permissions)) {
      const invalidPerms = permissions.filter(p => !VALID_PERMISSIONS.includes(p));
      if (invalidPerms.length > 0) {
        return res.status(400).json({
          error: `Invalid permissions: ${invalidPerms.join(', ')}`,
          validPermissions: VALID_PERMISSIONS
        });
      }
      keyDoc.permissions = permissions;
    }

    if (rateLimit && typeof rateLimit.requestsPerHour === 'number') {
      keyDoc.rateLimit.requestsPerHour = Math.min(Math.max(1, rateLimit.requestsPerHour), 10000);
    }

    if (expiresAt !== undefined) {
      if (expiresAt === null) {
        keyDoc.expiresAt = null;
      } else {
        const parsed = new Date(expiresAt);
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({ error: 'expiresAt must be a valid date or null.' });
        }
        keyDoc.expiresAt = parsed;
      }
    }

    await keyDoc.save();

    res.json({
      success: true,
      message: 'API Key updated successfully.',
      apiKey: {
        _id: keyDoc._id,
        name: keyDoc.name,
        description: keyDoc.description,
        key: maskKey(keyDoc.key),
        rawKey: keyDoc.key,
        permissions: keyDoc.permissions,
        rateLimit: keyDoc.rateLimit,
        expiresAt: keyDoc.expiresAt,
        isActive: keyDoc.isActive,
        createdAt: keyDoc.createdAt,
        lastUsedAt: keyDoc.lastUsedAt
      }
    });
  } catch (error) {
    console.error('Failed to update API key:', error);
    res.status(500).json({ error: 'Failed to update API key.' });
  }
};

// ── DELETE /api/api-keys/:id ──────────────────────────────────────────────────
export const deleteApiKey = async (req, res) => {
  try {
    const { id } = req.params;

    const filter = (req.user?.role === 'admin' || req.user?.role === 'superadmin' || req.user?.isAdmin || !req.user?.id)
      ? { _id: id }
      : { _id: id, $or: [{ userId: req.user.id }, { userId: null }, { userId: { $exists: false } }] };

    const deletedKey = await ApiKey.findOneAndDelete(filter);
    if (!deletedKey) {
      return res.status(404).json({ error: 'API Key not found or unauthorized.' });
    }

    res.json({ success: true, message: 'API Key revoked and deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete API key:', error);
    res.status(500).json({ error: 'Failed to delete API key.' });
  }
};

// ── GET /api/api-keys/:id/stats ───────────────────────────────────────────────
export const getApiKeyStats = async (req, res) => {
  try {
    const { id } = req.params;

    const filter = (req.user?.role === 'admin' || req.user?.role === 'superadmin' || req.user?.isAdmin || !req.user?.id)
      ? { _id: id }
      : { _id: id, $or: [{ userId: req.user.id }, { userId: null }, { userId: { $exists: false } }] };

    const keyDoc = await ApiKey.findOne(filter).lean();
    if (!keyDoc) {
      return res.status(404).json({ error: 'API Key not found or unauthorized.' });
    }

    const rph = keyDoc.rateLimit?.requestsPerHour || 500;
    const rateLimitStats = getKeyRateLimitStats(id, rph);

    res.json({
      success: true,
      stats: {
        _id: keyDoc._id,
        name: keyDoc.name,
        usageCount: keyDoc.usageCount || 0,
        lastUsedAt: keyDoc.lastUsedAt || null,
        currentWindow: rateLimitStats
      }
    });
  } catch (error) {
    console.error('Failed to get API key stats:', error);
    res.status(500).json({ error: 'Failed to retrieve API key stats.' });
  }
};

// ── GET /api/api-keys/permissions ─────────────────────────────────────────────
export const getAvailablePermissions = (_req, res) => {
  res.json({
    success: true,
    permissions: VALID_PERMISSIONS.map(p => ({
      scope: p,
      label: p.replace(':', ' — ').replace(/\b\w/g, l => l.toUpperCase()),
      description: PERMISSION_DESCRIPTIONS[p] || ''
    }))
  });
};

const PERMISSION_DESCRIPTIONS = {
  'leads:read':      'Read leads captured from YouTube comments',
  'leads:write':     'Create new leads via the external API',
  'users:read':      'Read the full list of registered users (admin keys only)',
  'customers:read':  'Read detailed customer profiles with metrics',
  'comments:read':   'Read YouTube comment data',
  'analytics:read':  'Read channel and content analytics'
};
