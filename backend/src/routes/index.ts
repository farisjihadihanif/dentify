import { Router } from 'express';
import { getHealth } from '../controllers/healthController';
import adminRoutes from './adminRoutes';
import articleRoutes from './articleRoutes';
import authRoutes from './authRoutes';
import chatRoutes from './chatRoutes';
import clinicRoutes from './clinicRoutes';
import feedbackRoutes from './feedbackRoutes';
import scanRoutes from './scanRoutes';

const router = Router();

router.get('/health', getHealth);
router.use('/auth', authRoutes);
router.use('/scans', scanRoutes);
router.use('/chat', chatRoutes);
router.use('/clinics', clinicRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/articles', articleRoutes);
router.use('/admin', adminRoutes);

export default router;
