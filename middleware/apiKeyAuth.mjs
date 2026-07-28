import ApiKey from '../models/ApiKey.mjs';

// ── In-Memory Rate Limit Store ────────────────────────────────────────────────
// Map<keyId, { count: number, windowStart: number }>
const rateLimitStore = new Map();

/**
 * Checks and enforces the per-key rate limit.
 * Returns { allowed: boolean, remaining: number, resetAt: Date }
 */
const checkRateLimit = (keyId, requestsPerHour) => {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour in ms

  let entry = rateLimitStore.get(keyId);

  if (!entry || now - entry.windowStart >= windowMs) {
    // Start a fresh window
    entry = { count: 0, windowStart: now };
  }

  entry.count += 1;
  rateLimitStore.set(keyId, entry);

  const remaining = Math.max(0, requestsPerHour - entry.count);
  const resetAt = new Date(entry.windowStart + windowMs);

  return {
    allowed: entry.count <= requestsPerHour,
    remaining,
    resetAt,
    limit: requestsPerHour,
    used: entry.count
  };
};

/**
 * Get current stats for a key without consuming a request.
 * Returns null if key is not yet in the store.
 */
export const getKeyRateLimitStats = (keyId, requestsPerHour) => {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const entry = rateLimitStore.get(keyId);
  if (!entry || now - entry.windowStart >= windowMs) {
    return { used: 0, remaining: requestsPerHour, limit: requestsPerHour };
  }
  return {
    used: entry.count,
    remaining: Math.max(0, requestsPerHour - entry.count),
    limit: requestsPerHour,
    resetAt: new Date(entry.windowStart + windowMs)
  };
};

// ── Main API Key Auth Middleware ──────────────────────────────────────────────
export const apiKeyAuth = async (req, res, next) => {
  let key = req.headers['x-api-key'];
  const authHeader = req.headers.authorization;

  // Fallback to Bearer token in Authorization header (avoid query params — keys appear in logs)
  if (!key && authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    key = authHeader.substring(7).trim();
  }

  if (!key) {
    return res.status(401).json({
      error: 'Unauthorized: API Key is missing.',
      hint: 'Provide x-api-key header or Authorization: Bearer <key>'
    });
  }

  try {
    // ── Environment Admin Key (bypass DB lookup) ─────────────────────────────
    const envAdminKey = (process.env.EXTERNAL_ADMIN_API_KEY || '').trim();
    if (envAdminKey && key === envAdminKey) {
      req.apiKeyDoc = { name: 'Environment Admin API Key', source: 'env' };
      req.user = { id: null };
      req.isAdminKey = true;
      req.apiKeyPermissions = ['leads:read', 'leads:write', 'users:read', 'customers:read', 'comments:read', 'analytics:read'];
      req.hasPermission = (_scope) => true; // Admin key has all permissions
      return next();
    }

    // ── Database Key Lookup ──────────────────────────────────────────────────
    const apiKeyDoc = await ApiKey.findOne({ key, isActive: true });

    if (!apiKeyDoc) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or revoked API Key.' });
    }

    // ── Expiry Check ─────────────────────────────────────────────────────────
    if (apiKeyDoc.expiresAt && new Date() > apiKeyDoc.expiresAt) {
      return res.status(403).json({
        error: 'Forbidden: This API Key has expired.',
        expiredAt: apiKeyDoc.expiresAt
      });
    }

    // ── Rate Limit Check ─────────────────────────────────────────────────────
    const rph = apiKeyDoc.rateLimit?.requestsPerHour || 500;
    const rl = checkRateLimit(apiKeyDoc._id.toString(), rph);

    res.set('X-RateLimit-Limit', rl.limit);
    res.set('X-RateLimit-Remaining', rl.remaining);
    res.set('X-RateLimit-Reset', rl.resetAt ? rl.resetAt.toISOString() : '');

    if (!rl.allowed) {
      return res.status(429).json({
        error: 'Too Many Requests: Rate limit exceeded.',
        limit: rl.limit,
        used: rl.used,
        resetAt: rl.resetAt
      });
    }

    // ── Attach context ───────────────────────────────────────────────────────
    req.apiKeyDoc = apiKeyDoc;
    req.apiKeyPermissions = apiKeyDoc.permissions || [];
    req.isAdminKey = !apiKeyDoc.userId;

    if (apiKeyDoc.userId) {
      req.user = { id: apiKeyDoc.userId.toString() };
    } else {
      req.user = { id: null };
    }

    // Permission helper — call req.hasPermission('leads:read') in controllers/routes
    req.hasPermission = (scope) => req.apiKeyPermissions.includes(scope);

    // Async side-effects: update lastUsedAt + increment usageCount
    ApiKey.updateOne(
      { _id: apiKeyDoc._id },
      { lastUsedAt: new Date(), $inc: { usageCount: 1 } }
    ).catch(err => {
      console.error('[API Key Middleware] Failed to update usage stats:', err);
    });

    next();
  } catch (error) {
    console.error('[API Key Middleware] Authentication error:', error);
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
};

// ── Permission Scope Guard Factory ───────────────────────────────────────────
/**
 * Middleware factory: requirePermission('leads:read')
 * Use after apiKeyAuth in route definitions.
 */
export const requirePermission = (scope) => (req, res, next) => {
  if (req.isAdminKey) return next(); // Admin keys bypass permission checks
  if (!req.hasPermission || !req.hasPermission(scope)) {
    return res.status(403).json({
      error: `Forbidden: This API Key does not have the '${scope}' permission.`,
      requiredPermission: scope,
      grantedPermissions: req.apiKeyPermissions || []
    });
  }
  next();
};
