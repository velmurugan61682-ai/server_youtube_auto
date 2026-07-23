import ApiKey from '../models/ApiKey.mjs';

export const apiKeyAuth = async (req, res, next) => {
  let key = req.headers['x-api-key'] || req.query.apiKey || req.query.api_key || req.query.key;
  const authHeader = req.headers.authorization;

  // Fallback to Bearer token in Authorization header
  if (!key && authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    key = authHeader.substring(7).trim();
  }

  if (!key) {
    return res.status(401).json({ error: 'Unauthorized: API Key is missing. Provide x-api-key header or Bearer token.' });
  }

  try {
    const envAdminKey = (process.env.EXTERNAL_ADMIN_API_KEY || '').trim();
    if (envAdminKey && key === envAdminKey) {
      req.apiKeyDoc = { name: 'Environment Admin API Key', source: 'env' };
      req.user = { id: null };
      req.isAdminKey = true;
      return next();
    }

    const apiKeyDoc = await ApiKey.findOne({ key, isActive: true });
    if (!apiKeyDoc) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or revoked API Key.' });
    }

    // Set context parameters based on key type (scoped vs global admin)
    req.apiKeyDoc = apiKeyDoc;
    if (apiKeyDoc.userId) {
      req.user = { id: apiKeyDoc.userId.toString() };
      req.isAdminKey = false;
    } else {
      req.user = { id: null };
      req.isAdminKey = true;
    }

    // Asynchronously update lastUsedAt to avoid blocking response
    ApiKey.updateOne({ _id: apiKeyDoc._id }, { lastUsedAt: new Date() }).catch(err => {
      console.error('[API Key Middleware] Failed to update lastUsedAt:', err);
    });

    next();
  } catch (error) {
    console.error('[API Key Middleware] Authentication error:', error);
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
};
