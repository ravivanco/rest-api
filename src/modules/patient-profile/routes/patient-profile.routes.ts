import { Router }                    from 'express';
import { patientProfileController }  from '../controller/patient-profile.controller';
import { authenticate }              from '@middlewares/authenticate';
import { requireRole }               from '@middlewares/authorize';
import { validate }                  from '@middlewares/validate';
import { SaveProfileFormDto, AddCondicionDto, AddPreferenciaDto, AddDeporteDto } from '../dto/patient-profile.dto';

export const patientProfileRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Patient Profile
 *   description: Formulario inicial del paciente — app móvil y consulta web
 */

/**
 * @swagger
 * /patient-profile/medical-conditions:
 *   get:
 *     summary: Catálogo de condiciones médicas
 *     description: Lista las condiciones médicas disponibles para el formulario inicial.
 *     tags: [Patient Profile]
 *     security: []
 *     responses:
 *       200:
 *         description: Lista de condiciones médicas
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id_condicion: 1
 *                   nombre: Diabetes
 *                   descripcion: Diabetes mellitus tipo 2
 */
patientProfileRouter.get(
  '/medical-conditions',
  patientProfileController.getCatalogo,
);

/**
 * @swagger
 * /patient-profile/options:
 *   get:
 *     summary: Catálogos para onboarding móvil
 *     description: Devuelve condiciones médicas y alimentos activos para mapear selecciones a IDs.
 *     tags: [Patient Profile]
 *     responses:
 *       200:
 *         description: Catálogos de onboarding
 */
patientProfileRouter.get(
  '/options',
  authenticate,
  requireRole('paciente', 'nutricionista', 'administrador'),
  patientProfileController.getOptions,
);

/**
 * @swagger
 * /patient-profile/me:
 *   get:
 *     summary: Ver mi formulario inicial
 *     description: El paciente consulta su propio formulario inicial desde la app móvil.
 *     tags: [Patient Profile]
 *     responses:
 *       200:
 *         description: Formulario completo del paciente
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id_perfil: 8
 *                 nivel_actividad_fisica: medio
 *                 objetivo: Reducir mi peso corporal
 *                 formulario_completado: true
 *                 condiciones:
 *                   - id_condicion: 1
 *                     nombre: Diabetes
 *                 alimentos_preferidos: []
 *                 alimentos_restringidos: []
 *                 deportes:
 *                   - deporte: Caminata
 */
patientProfileRouter.get(
  '/me',
  authenticate,
  requireRole('paciente'),
  patientProfileController.getMyProfile,
);

/**
 * @swagger
 * /patient-profile/me:
 *   put:
 *     summary: Guardar formulario inicial completo
 *     description: |
 *       El paciente guarda su formulario inicial desde la app móvil.
 *       Marca `formulario_completado = true` cuando se guarda con los campos requeridos.
 *     tags: [Patient Profile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             nivel_actividad_fisica: medio
 *             objetivo: Reducir mi peso corporal
 *             alergias_intolerancias: Intolerancia a la lactosa
 *             restricciones_alimenticias: No consumo cerdo
 *             condiciones: [1]
 *             alimentos_preferidos: [12, 34]
 *             alimentos_restringidos: [78]
 *             deportes: ["Caminata", "Gimnasio"]
 *     responses:
 *       200:
 *         description: Formulario guardado exitosamente
 */
patientProfileRouter.put(
  '/me',
  authenticate,
  requireRole('paciente'),
  validate(SaveProfileFormDto),
  patientProfileController.saveMyProfile,
);

/**
 * @swagger
 * /patient-profile/{patientId}:
 *   get:
 *     summary: Ver formulario de un paciente
 *     description: La nutricionista consulta el formulario inicial de un paciente.
 *     tags: [Patient Profile]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Formulario del paciente
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
patientProfileRouter.get(
  '/:patientId',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  patientProfileController.getByPatientId,
);

// ── Endpoints individuales de condiciones, preferencias y deportes ──────────

patientProfileRouter.post(
  '/me/conditions',
  authenticate,
  requireRole('paciente'),
  validate(AddCondicionDto),
  patientProfileController.addCondicion,
);

patientProfileRouter.delete(
  '/me/conditions/:id',
  authenticate,
  requireRole('paciente'),
  patientProfileController.removeCondicion,
);

patientProfileRouter.post(
  '/me/food-preferences',
  authenticate,
  requireRole('paciente'),
  validate(AddPreferenciaDto),
  patientProfileController.addPreferencia,
);

patientProfileRouter.delete(
  '/me/food-preferences/:id',
  authenticate,
  requireRole('paciente'),
  patientProfileController.removePreferencia,
);

patientProfileRouter.post(
  '/me/sports',
  authenticate,
  requireRole('paciente'),
  validate(AddDeporteDto),
  patientProfileController.addDeporte,
);

patientProfileRouter.delete(
  '/me/sports/:id',
  authenticate,
  requireRole('paciente'),
  patientProfileController.removeDeporte,
);