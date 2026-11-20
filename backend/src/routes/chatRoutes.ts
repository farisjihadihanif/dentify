import { Router } from 'express';
import {
  deleteChatSessionById,
  getChatSessionById,
  listChatSessions,
  postChatMessage,
} from '../controllers/chatController';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/authMiddleware';
import { scanAndChatRateLimiter } from '../middlewares/rateLimiter';
import { validateBody, validateQuery } from '../middlewares/validate';
import { chatMessageSchema } from '../validators/chatValidator';
import { paginationQuerySchema } from '../validators/scanValidator';

const router = Router();

router.post(
  '/',
  optionalAuthMiddleware,
  scanAndChatRateLimiter,
  validateBody(chatMessageSchema),
  postChatMessage,
);
router.get('/sessions', authMiddleware, validateQuery(paginationQuerySchema), listChatSessions);
router.get('/sessions/:id', authMiddleware, getChatSessionById);
router.delete('/sessions/:id', authMiddleware, deleteChatSessionById);

export default router;
