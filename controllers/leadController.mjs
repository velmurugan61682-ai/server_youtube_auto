import Lead from '../models/Lead.mjs';
import Channel from '../models/Channel.mjs';

const getUserChannelIds = async (user) => {
  const filter = user.organizationId 
    ? { $or: [{ organizationId: user.organizationId }, { userId: user.id }] }
    : { userId: user.id };
  const channels = await Channel.find(filter).select('channelId');
  return channels.map(c => c.channelId);
};

export const getLeads = async (req, res) => {
  try {
    const { status, channelId, search } = req.query;
    const allowedChannelIds = await getUserChannelIds(req.user);
    const query = { channelId: { $in: allowedChannelIds } };

    if (status) query.status = status;
    if (channelId) {
      if (allowedChannelIds.includes(channelId)) {
        query.channelId = channelId;
      } else {
        return res.json([]);
      }
    }
    if (search) {
      query.$or = [
        { authorName: { $regex: search, $options: 'i' } },
        { whatsappNumber: { $regex: search, $options: 'i' } },
        { originalComment: { $regex: search, $options: 'i' } }
      ];
    }

    const leads = await Lead.find(query).sort({ createdAt: -1 }).limit(200);
    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportLeads = async (req, res) => {
  try {
    const allowedChannelIds = await getUserChannelIds(req.user);
    const leads = await Lead.find({ channelId: { $in: allowedChannelIds } }).sort({ createdAt: -1 });
    if (leads.length === 0) return res.status(404).send('No leads to export');

    const fields = ['authorName', 'whatsappNumber', 'status', 'isHidden', 'whatsappSent', 'videoId', 'channelId', 'createdAt'];
    const csvRows = [fields.join(',')];

    for (const lead of leads) {
      const row = fields.map(field => {
        const val = lead[field];
        if (val instanceof Date) return val.toISOString();
        if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
        return val;
      });
      csvRows.push(row.join(','));
    }

    res.header('Content-Type', 'text/csv');
    res.attachment('leads.csv');
    res.send(csvRows.join('\n'));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
