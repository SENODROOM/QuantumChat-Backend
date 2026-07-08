import { Router } from 'express';
import { listUsers, getUser, updatePublicKey } from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.get('/', listUsers);
router.get('/:id', getUser);
router.patch('/me/public-key', updatePublicKey);

export default router;
