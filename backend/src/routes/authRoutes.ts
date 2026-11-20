import { Router } from 'express';
import { getMe, login, register, updateMe } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authRateLimiter } from '../middlewares/rateLimiter';
import { validateBody } from '../middlewares/validate';
import { loginSchema, registerSchema, updateProfileSchema } from '../validators/authValidator';

const router = Router();

router.post('/register', authRateLimiter, validateBody(registerSchema), register);
router.post('/login', authRateLimiter, validateBody(loginSchema), login);
router.get('/me', authMiddleware, getMe);
router.put('/me', authMiddleware, validateBody(updateProfileSchema), updateMe);

export default router;
