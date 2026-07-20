import Lead from '../models/Lead.mjs';
import User from '../models/User.mjs';

// GET /api/external/users
// Fetch all registered users (Admin API Key required)
export const getExternalUsers = async (req, res) => {
  try {
    if (!req.isAdminKey) {
      return res.status(403).json({ error: 'Forbidden: Admin API key required to view users list.' });
    }

    const users = await User.find({}).select('-password').sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('[External API] Failed to fetch users:', error);
    res.status(500).json({ error: 'Failed to retrieve registered users.' });
  }
};

// GET /api/external/leads
// Fetch customer leads (system-wide for admin keys, scoped for tenant keys)
export const getExternalLeads = async (req, res) => {
  try {
    let leads;
    if (req.isAdminKey) {
      // Admin keys fetch ALL leads across the system and populate owner user details
      leads = await Lead.find({}).populate('userId', 'name email').sort({ createdAt: -1 });
    } else {
      // Scoped keys fetch leads belonging only to the key owner
      leads = await Lead.find({ userId: req.user.id }).sort({ createdAt: -1 });
    }
    
    res.json({
      success: true,
      count: leads.length,
      leads
    });
  } catch (error) {
    console.error('[External API] Failed to fetch leads:', error);
    res.status(500).json({ error: 'Failed to retrieve customer leads.' });
  }
};

// POST /api/external/leads
// Store a new customer lead from an external service
export const createExternalLead = async (req, res) => {
  try {
    const {
      userId,
      name,
      authorName,
      message,
      originalComment,
      email,
      whatsappNumber,
      intent,
      productInterest,
      notes,
      channelId,
      videoId,
      status
    } = req.body;

    // Determine owner ID: admin keys must specify the target user ID in request body
    const targetUserId = req.isAdminKey ? userId : req.user.id;
    if (!targetUserId) {
      return res.status(400).json({ error: 'Missing owner ID. Admin API keys must specify a target userId in the request body.' });
    }

    const leadName = name || authorName || 'External Lead';
    const leadComment = message || originalComment || notes || 'Created via External API';

    const newLead = new Lead({
      userId: targetUserId,
      authorName: leadName,
      originalComment: leadComment,
      email: email || undefined,
      whatsappNumber: whatsappNumber || undefined,
      intent: intent || undefined,
      productInterest: productInterest || undefined,
      notes: notes || undefined,
      channelId: channelId || 'API',
      videoId: videoId || 'API',
      status: status || 'pending'
    });

    await newLead.save();

    res.status(201).json({
      success: true,
      message: 'Lead created successfully.',
      lead: {
        _id: newLead._id,
        userId: newLead.userId,
        authorName: newLead.authorName,
        originalComment: newLead.originalComment,
        email: newLead.email,
        whatsappNumber: newLead.whatsappNumber,
        intent: newLead.intent,
        productInterest: newLead.productInterest,
        notes: newLead.notes,
        channelId: newLead.channelId,
        videoId: newLead.videoId,
        status: newLead.status,
        commentId: newLead.commentId,
        createdAt: newLead.createdAt
      }
    });
  } catch (error) {
    console.error('[External API] Failed to create lead:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Duplicate entry: A lead with this comment ID already exists.' });
    }

    res.status(500).json({ error: 'Failed to store customer lead.' });
  }
};
