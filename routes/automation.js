import express from 'express';
import { runCommentAutomation } from '../jobs/commentAutomation.js';

const router = express.Router();

/**
 * @route POST /api/automation/run-now
 * @desc Manually trigger comment automation processing cycle
 * @access Public (or protected depending on project requirements, currently public for manual trigger testing)
 */
router.post('/run-now', async (req, res) => {
  try {
    const result = await runCommentAutomation();

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Comment automation run completed successfully.',
        processedCommentsCount: result.processed
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Comment automation run encountered an error.'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
