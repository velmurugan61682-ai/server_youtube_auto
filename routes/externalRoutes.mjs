import express from 'express';
import { getExternalLeads, createExternalLead, getExternalUsers, getExternalCustomerDetails } from '../controllers/externalController.mjs';
import { apiKeyAuth } from '../middleware/apiKeyAuth.mjs';

const router = express.Router();

// Protected external endpoints (requires valid API key)
router.get('/leads', apiKeyAuth, getExternalLeads);
router.post('/leads', apiKeyAuth, createExternalLead);
router.get('/users', apiKeyAuth, getExternalUsers);
router.get('/customers/details', apiKeyAuth, getExternalCustomerDetails);

export default router;
