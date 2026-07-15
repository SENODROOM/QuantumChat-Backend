import { Router } from 'express';
import {
  sendMessage,
  getConversation,
  deleteMessage,
  reactToMessage,
  editMessage,
} from '../controllers/messageController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.post('/', sendMessage);
router.get('/:userId', getConversation);
router.patch('/:messageId', editMessage);
router.delete('/:messageId', deleteMessage);
router.post('/:messageId/reactions', reactToMessage);

export default router;
