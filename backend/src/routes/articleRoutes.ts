import { Router } from 'express';
import {
  getPublishedArticleBySlug,
  listPublishedArticles,
} from '../controllers/articleController';
import { generalLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.get('/', generalLimiter, listPublishedArticles);
router.get('/:slug', generalLimiter, getPublishedArticleBySlug);

export default router;
