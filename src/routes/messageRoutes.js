import { Router } from 'express';
import { sendMessage, getConversation } from '../controllers/messageController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.post('/', sendMessage);
router.get('/:userId', getConversation);

export default router;
