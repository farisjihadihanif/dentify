import { Router } from 'express';
import {
  adminCreateArticle,
  adminDeleteArticle,
  adminDeleteUser,
  adminListArticles,
  adminListUsers,
  adminUpdateArticle,
  adminUpdateUserRole,
} from '../controllers/adminController';
import { requireAdmin } from '../middlewares/adminMiddleware';
import { authMiddleware } from '../middlewares/authMiddleware';
import { generalLimiter } from '../middlewares/rateLimiter';
import { validateBody } from '../middlewares/validate';
import {
  createArticleSchema,
  updateArticleSchema,
  updateUserRoleSchema,
} from '../validators/articleValidator';

const router = Router();

router.use(generalLimiter, authMiddleware, requireAdmin);

router.get('/articles', adminListArticles);
router.post('/articles', validateBody(createArticleSchema), adminCreateArticle);
router.patch('/articles/:id', validateBody(updateArticleSchema), adminUpdateArticle);
router.delete('/articles/:id', adminDeleteArticle);

router.get('/users', adminListUsers);
router.patch('/users/:id', validateBody(updateUserRoleSchema), adminUpdateUserRole);
router.delete('/users/:id', adminDeleteUser);

export default router;
