import express from 'express';
import { getExternalLeads, createExternalLead, getExternalUsers } from '../controllers/externalController.mjs';
import { apiKeyAuth } from '../middleware/apiKeyAuth.mjs';

const router = express.Router();

// Protected external endpoints (requires valid API key)
router.get('/leads', apiKeyAuth, getExternalLeads);
router.post('/leads', apiKeyAuth, createExternalLead);
router.get('/users', apiKeyAuth, getExternalUsers);

export default router;
