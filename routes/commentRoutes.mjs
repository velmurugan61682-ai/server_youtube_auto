import express from 'express';
import { 
  getComments, 
  getCommentHistory, 
  takeAction, 
  editComment, 
  reanalyzeComments, 
  manualSync,
  replyToCommentApi,
  likeCommentApi,
  deleteCommentApi
} from '../controllers/commentController.mjs';
import { authMiddleware } from '../middleware/auth.mjs';

const router = express.Router();

router.get('/', authMiddleware, getComments);
router.get('/history', authMiddleware, getCommentHistory);
router.post('/reply', authMiddleware, replyToCommentApi);
router.post('/:commentId/reply', authMiddleware, replyToCommentApi);
router.post('/:commentId/like', authMiddleware, likeCommentApi);
router.delete('/:id', authMiddleware, deleteCommentApi);

router.post('/:id/action', authMiddleware, takeAction);
router.patch('/:id/edit', authMiddleware, editComment);
router.post('/reanalyze', authMiddleware, reanalyzeComments);
router.get('/analyze/:videoId', authMiddleware, manualSync);

export default router;

