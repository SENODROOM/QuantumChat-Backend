import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getQuantumAIProfile,
  resetQuantumAIContext,
  getQuantumAIUsage,
} from '../controllers/quantumAIController.js';

const router = Router();

router.use(requireAuth);
router.get('/profile', getQuantumAIProfile);
router.post('/reset', resetQuantumAIContext);
router.get('/usage', getQuantumAIUsage);

export default router;
