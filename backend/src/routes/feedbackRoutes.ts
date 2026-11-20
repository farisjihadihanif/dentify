import { Router } from 'express';
import { createFeedback } from '../controllers/feedbackController';
import { optionalAuthMiddleware } from '../middlewares/authMiddleware';
import { scanAndChatRateLimiter } from '../middlewares/rateLimiter';
import { validateBody } from '../middlewares/validate';
import { createFeedbackSchema } from '../validators/feedbackValidator';

const router = Router();

router.post(
  '/',
  optionalAuthMiddleware,
  scanAndChatRateLimiter,
  validateBody(createFeedbackSchema),
  createFeedback,
);

export default router;
