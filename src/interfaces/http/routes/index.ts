import { Router } from 'express';
import { healthRoutes } from './health.routes';

const router = Router();

router.use('/health', healthRoutes);

// Los módulos de negocio se registran aquí conforme se implementen:
// router.use('/auth',        authRoutes);
// router.use('/patients',    patientRoutes);
// router.use('/evaluations', evaluationRoutes);
// router.use('/plans',       planRoutes);
// router.use('/tracking',    trackingRoutes);

export { router };