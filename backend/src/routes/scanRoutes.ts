import { Router } from 'express';
import {
  createScan,
  deleteScanById,
  getScanById,
  listScans,
} from '../controllers/scanController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { scanAndChatRateLimiter } from '../middlewares/rateLimiter';
import { uploadScanImage } from '../middlewares/uploadMiddleware';
import { validateQuery } from '../middlewares/validate';
import { paginationQuerySchema } from '../validators/scanValidator';

const router = Router();

router.post('/', authMiddleware, scanAndChatRateLimiter, uploadScanImage, createScan);
router.get('/', authMiddleware, validateQuery(paginationQuerySchema), listScans);
router.get('/:id', authMiddleware, getScanById);
router.delete('/:id', authMiddleware, deleteScanById);

export default router;
