import User from '../models/User.mjs';
import Channel from '../models/Channel.mjs';
import logger from '../utils/logger.mjs';
import { getYouTubeClientWithApiKey } from '../services/youtubeService.mjs';
import { encrypt, decrypt } from '../utils/cryptoHelper.mjs';

const maskKey = (key) => {
  const decrypted = decrypt(key);
  return decrypted ? `${decrypted.substring(0, 6)}...${decrypted.slice(-4)}` : '';
};

export const getSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      settings: user.settings,
      credentials: {
        youtubeApiKey: maskKey(user.youtubeApiKey),
        openaiApiKey:  maskKey(user.openaiApiKey),
        gowhatsApiKey: maskKey(user.gowhatsApiKey),
        gowhatsUrl:    user.gowhatsUrl  || '',
        productLink:   user.productLink || '',
      },
      youtubeChannelId: user.youtubeChannelId,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    const user = await User.findByIdAndUpdate(req.user.id, { $set: { settings } }, { returnDocument: 'after' });
    res.json({ success: true, settings: user.settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const saveCredentials = async (req, res) => {
  try {
    const { youtubeApiKey, openaiApiKey, gowhatsApiKey, gowhatsUrl, productLink } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Only update a field if it was supplied and is NOT a masked placeholder
    if (youtubeApiKey && !youtubeApiKey.includes('...')) user.youtubeApiKey = encrypt(youtubeApiKey);
    if (openaiApiKey  && !openaiApiKey.includes('...'))  user.openaiApiKey  = encrypt(openaiApiKey);
    if (gowhatsApiKey && !gowhatsApiKey.includes('...')) user.gowhatsApiKey = encrypt(gowhatsApiKey);
    if (gowhatsUrl  !== undefined) user.gowhatsUrl  = gowhatsUrl;
    if (productLink !== undefined) user.productLink = productLink;

    await user.save();
    res.json({ success: true, message: 'Credentials saved.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateYouTubeSettings = async (req, res) => {
  try {
    const { apiKey, channelId } = req.body;
    if (!channelId) return res.status(400).json({ error: 'Channel ID is required' });

    const user = await User.findById(req.user.id);
    let finalApiKey = apiKey;

    if (apiKey && apiKey.includes('...')) {
      finalApiKey = decrypt(user.youtubeApiKey);
    }

    if (!finalApiKey) {
      await Channel.findOneAndDelete({ userId: req.user.id, apiKey: { $exists: true } });
      user.youtubeApiKey = '';
      user.youtubeChannelId = '';
      await user.save();
      return res.json({ success: true, message: 'YouTube connection removed' });
    }

    const youtube = getYouTubeClientWithApiKey(finalApiKey);
    const response = await youtube.channels.list({ part: 'snippet,contentDetails,statistics', id: channelId });
    if (!response.data.items?.length) return res.status(400).json({ error: 'Channel not found' });

    const channelData = response.data.items[0];
    user.youtubeApiKey = encrypt(finalApiKey);
    user.youtubeChannelId = channelId;
    await user.save();

    const uploadsPlaylistId = channelData.contentDetails?.relatedPlaylists?.uploads || '';
    const channelUpdate = {
      userId: req.user.id,
      channelId,
      title: channelData.snippet.title,
      thumbnailUrl: channelData.snippet.thumbnails?.default?.url || '',
      apiKey: encrypt(finalApiKey),
      uploadsPlaylistId,
      statistics: {
        subscriberCount: channelData.statistics?.subscriberCount || '0',
        videoCount: channelData.statistics?.videoCount || '0',
        viewCount: channelData.statistics?.viewCount || '0',
      }
    };
    if (user.organizationId) {
      channelUpdate.organizationId = user.organizationId;
    }

    await Channel.findOneAndUpdate({ channelId }, {
      $set: channelUpdate
    }, { upsert: true });

    res.json({ success: true, message: 'YouTube details saved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
