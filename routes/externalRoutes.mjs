import express from 'express';
import {
  getExternalLeads,
  createExternalLead,
  getExternalUsers,
  getExternalCustomerDetails
} from '../controllers/externalController.mjs';
import { apiKeyAuth, requirePermission } from '../middleware/apiKeyAuth.mjs';

const router = express.Router();

// All routes require a valid API key
// Each route additionally requires a specific permission scope

// ── Leads ─────────────────────────────────────────────────────────────────────
router.get('/leads',
  apiKeyAuth,
  requirePermission('leads:read'),
  getExternalLeads
);

router.post('/leads',
  apiKeyAuth,
  requirePermission('leads:write'),
  createExternalLead
);

// ── Users ─────────────────────────────────────────────────────────────────────
router.get('/users',
  apiKeyAuth,
  requirePermission('users:read'),
  getExternalUsers
);

// ── Customers ─────────────────────────────────────────────────────────────────
router.get('/customers/details',
  apiKeyAuth,
  requirePermission('customers:read'),
  getExternalCustomerDetails
);

export default router;
