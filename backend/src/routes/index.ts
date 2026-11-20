import { Router } from 'express';
import { getHealth } from '../controllers/healthController';
import authRoutes from './authRoutes';
import chatRoutes from './chatRoutes';
import clinicRoutes from './clinicRoutes';
import scanRoutes from './scanRoutes';

const router = Router();

router.get('/health', getHealth);
router.use('/auth', authRoutes);
router.use('/scans', scanRoutes);
router.use('/chat', chatRoutes);
router.use('/clinics', clinicRoutes);

export default router;
