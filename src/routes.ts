import { Router, Request, Response }   from 'express';
import { pool }                        from '@database/pool';
import { authRouter }                  from './modules/auth/routes/auth.routes';
import { patientsRouter }              from './modules/patients/routes/patients.routes';
import { patientProfileRouter }        from './modules/patient-profile/routes/patient-profile.routes';
import { clinicalEvaluationsRouter }   from './modules/clinical-evaluations/routes/clinical-evaluations.routes';
import { nutritionPlansRouter }        from './modules/nutrition-plans/routes/nutrition-plans.routes';
import { foodsRouter }                 from './modules/foods/routes/foods.routes';
import { dishesRouter }                from './modules/dishes/routes/dishes.routes';
import { exercisesRouter }             from './modules/exercises/routes/exercises.routes';
import { mealTrackingRouter }          from './modules/meal-tracking/routes/meal-tracking.routes';
import { exerciseTrackingRouter }      from './modules/exercise-tracking/routes/exercise-tracking.routes';
import { weightRecordsRouter }         from './modules/weight-records/routes/weight-records.routes';
import { calorieControlRouter }        from './modules/calorie-control/routes/calorie-control.routes';
import { additionalIntakeRouter }      from './modules/additional-intake/routes/additional-intake.routes';
import { adherenceRouter }             from './modules/adherence/routes/adherence.routes';
import { alertsRouter }                from './modules/alerts/routes/alerts.routes';
import { dashboardRouter }             from './modules/dashboard/routes/dashboard.routes';
import { appointmentsRouter }          from './modules/appointments/routes/appointments.routes';

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Estado del servidor y base de datos
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Servidor operativo
 */
router.get('/health', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query<{ db_time: string }>('SELECT NOW() as db_time');
    res.status(200).json({
      success: true,
      data: {
        status: 'ok', database: 'connected',
        db_time: result.rows[0].db_time,
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    res.status(503).json({ success: false, data: { status: 'degraded' } });
  }
});

// ── Todos los módulos del sistema ───────────────────────────────────────────
router.use('/auth',                 authRouter);
router.use('/patients',             patientsRouter);
router.use('/patient-profile',      patientProfileRouter);
router.use('/clinical-evaluations', clinicalEvaluationsRouter);
router.use('/nutrition-plans',      nutritionPlansRouter);
router.use('/foods',                foodsRouter);
router.use('/dishes',               dishesRouter);
router.use('/exercises',            exercisesRouter);
router.use('/meal-tracking',        mealTrackingRouter);
router.use('/exercise-tracking',    exerciseTrackingRouter);
router.use('/weight-records',       weightRecordsRouter);
router.use('/calorie-control',      calorieControlRouter);
router.use('/additional-intake',    additionalIntakeRouter);
router.use('/adherence',            adherenceRouter);
router.use('/alerts',               alertsRouter);
router.use('/dashboard',            dashboardRouter);
router.use('/appointments',         appointmentsRouter);

export { router };
// import { calorieControlRouter }      from './modules/calorie-control/routes/calorie-control.routes';
// import { adherenceRouter }           from './modules/adherence/routes/adherence.routes';
// import { alertsRouter }              from './modules/alerts/routes/alerts.routes';
// import { appointmentsRouter }        from './modules/appointments/routes/appointments.routes';
// import { dashboardRouter }           from './modules/dashboard/routes/dashboard.routes';

// router.use('/auth',                 authRouter);
// router.use('/users',                usersRouter);
// router.use('/patients',             patientsRouter);
// router.use('/patient-profile',      patientProfileRouter);
// router.use('/clinical-evaluations', clinicalEvaluationsRouter);
// router.use('/nutrition-plans',      nutritionPlansRouter);
// router.use('/weekly-plans',         weeklyPlansRouter);
// router.use('/foods',                foodsRouter);
// router.use('/dishes',               dishesRouter);
// router.use('/exercises',            exercisesRouter);
// router.use('/meal-tracking',        mealTrackingRouter);
// router.use('/exercise-tracking',    exerciseTrackingRouter);
// router.use('/weight-records',       weightRecordsRouter);
// router.use('/additional-intake',    additionalIntakeRouter);
// router.use('/calorie-control',      calorieControlRouter);
// router.use('/adherence',            adherenceRouter);
// router.use('/alerts',               alertsRouter);
// router.use('/appointments',         appointmentsRouter);
// router.use('/dashboard',            dashboardRouter);