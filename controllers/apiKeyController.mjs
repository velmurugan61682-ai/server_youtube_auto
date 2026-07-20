import crypto from 'crypto';
import ApiKey from '../models/ApiKey.mjs';

// Helper to mask API key for security
const maskKey = (key) => {
  if (!key || key.length < 12) return '••••••••';
  return `${key.substring(0, 7)}••••••••${key.substring(key.length - 4)}`;
};

export const getApiKeys = async (req, res) => {
  try {
    const keys = await ApiKey.find({ userId: req.user.id }).sort({ createdAt: -1 });
    
    // Return keys with masked values for security
    const sanitizedKeys = keys.map(k => ({
      _id: k._id,
      name: k.name,
      key: maskKey(k.key),
      isActive: k.isActive,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt
    }));

    res.json(sanitizedKeys);
  } catch (error) {
    console.error('Failed to get API keys:', error);
    res.status(500).json({ error: 'Failed to retrieve API keys.' });
  }
};

export const createApiKey = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Key name is required.' });
    }

    // Generate a secure random API key prefixed with yt_ (for YouTube auto system identification)
    const rawKey = `yt_${crypto.randomBytes(24).toString('hex')}`;

    const newKey = new ApiKey({
      userId: req.user.id,
      name: name.trim(),
      key: rawKey,
      isActive: true
    });

    await newKey.save();

    // Return the full unmasked key ONLY upon creation
    res.status(201).json({
      success: true,
      message: 'API Key generated successfully. Please copy it now, as you will not be able to view it again.',
      apiKey: {
        _id: newKey._id,
        name: newKey.name,
        key: rawKey, // Raw unmasked key
        isActive: newKey.isActive,
        createdAt: newKey.createdAt
      }
    });
  } catch (error) {
    console.error('Failed to create API key:', error);
    res.status(500).json({ error: 'Failed to create API key.' });
  }
};

export const deleteApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedKey = await ApiKey.findOneAndDelete({
      _id: id,
      userId: req.user.id
    });

    if (!deletedKey) {
      return res.status(404).json({ error: 'API Key not found or unauthorized.' });
    }

    res.json({ success: true, message: 'API Key revoked and deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete API key:', error);
    res.status(500).json({ error: 'Failed to delete API key.' });
  }
};
