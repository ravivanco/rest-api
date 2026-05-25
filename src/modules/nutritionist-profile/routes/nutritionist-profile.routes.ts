import { Router } from 'express';
import { authenticate } from '@middlewares/authenticate';
import { requireRole } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { UpdateNutritionistInfoDto } from '../../admin/dto/admin.dto';
import { nutritionistProfileController } from '../controller/nutritionist-profile.controller';

export const nutritionistProfileRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Nutritionist Profile
 *   description: Perfil de la nutricionista (autogestion)
 */

/**
 * @swagger
 * /nutritionist-profile/me:
 *   get:
 *     summary: Ver mi perfil
 *     tags: [Nutritionist Profile]
 *     responses:
 *       200:
 *         description: Informacion completa de la nutricionista
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
nutritionistProfileRouter.get(
  '/me',
  authenticate,
  requireRole('nutricionista'),
  nutritionistProfileController.getMyProfile,
);

/**
 * @swagger
 * /nutritionist-profile/me:
 *   patch:
 *     summary: Editar mi perfil (campos permitidos)
 *     tags: [Nutritionist Profile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombres:
 *                 type: string
 *               apellidos:
 *                 type: string
 *               fecha_nacimiento:
 *                 type: string
 *                 format: date
 *               sexo:
 *                 type: string
 *                 enum: [M, F, O]
 *               perfil_nutricionista:
 *                 type: object
 *                 properties:
 *                   telefono_contacto:
 *                     type: string
 *                     nullable: true
 *     responses:
 *       200:
 *         description: Perfil actualizado correctamente
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
nutritionistProfileRouter.patch(
  '/me',
  authenticate,
  requireRole('nutricionista'),
  validate(UpdateNutritionistInfoDto),
  nutritionistProfileController.updateMyProfile,
);
