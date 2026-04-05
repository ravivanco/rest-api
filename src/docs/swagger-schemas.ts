/**
 * Schemas adicionales documentados para Swagger.
 * Este archivo es leído por swagger-jsdoc junto con los archivos de rutas.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *
 *     # ── Respuesta del login completa ────────────────────────
 *     LoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             access_token:
 *               type: string
 *               description: JWT · expira en 15 minutos
 *             refresh_token:
 *               type: string
 *               description: Token de refresco · expira en 7 días
 *             expires_in:
 *               type: integer
 *               example: 900
 *             token_type:
 *               type: string
 *               example: Bearer
 *             user:
 *               type: object
 *               properties:
 *                 id_usuario:
 *                   type: integer
 *                   example: 14
 *                 nombres:
 *                   type: string
 *                   example: Juan
 *                 apellidos:
 *                   type: string
 *                   example: Pérez
 *                 correo_institucional:
 *                   type: string
 *                   example: juan.perez@decokasas.com
 *                 rol:
 *                   type: string
 *                   example: paciente
 *                 formulario_completado:
 *                   type: boolean
 *                   example: false
 *                   description: "false = el paciente debe completar el formulario inicial"
 *                 modulo_habilitado:
 *                   type: boolean
 *                   example: false
 *                   description: "RN-02: false hasta que la nutricionista active el plan"
 *
 *     # ── Plan activo completo (app móvil) ────────────────────
 *     ActivePlanResponse:
 *       type: object
 *       properties:
 *         tiene_plan_activo:
 *           type: boolean
 *           example: true
 *         plan:
 *           type: object
 *           properties:
 *             id_plan:
 *               type: integer
 *             estado:
 *               type: string
 *               example: activo
 *             modulo_habilitado:
 *               type: boolean
 *         semana_actual:
 *           type: object
 *           nullable: true
 *           properties:
 *             id_semana:
 *               type: integer
 *             numero:
 *               type: integer
 *             fecha_inicio_semana:
 *               type: string
 *               format: date
 *         semanas:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               es_semana_actual:
 *                 type: boolean
 *               dias:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     dia:
 *                       type: object
 *                       properties:
 *                         dia_semana:
 *                           type: string
 *                           example: lunes
 *                         fecha:
 *                           type: string
 *                           format: date
 *                         es_hoy:
 *                           type: boolean
 *                         puede_registrar:
 *                           type: boolean
 *                           description: "RN-03: true solo si fecha == hoy en el servidor"
 *                     menus:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id_menu_diario:
 *                             type: integer
 *                           nombre_tiempo:
 *                             type: string
 *                             example: Desayuno
 *                           nombre_plato:
 *                             type: string
 *                             example: Avena con frutas
 *                           calorias_aportadas:
 *                             type: integer
 *                             example: 520
 *                     ejercicios:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           nombre_ejercicio:
 *                             type: string
 *                             example: Caminata rápida
 *                           duracion_min:
 *                             type: integer
 *                             example: 30
 *
 *     # ── Balance calórico ────────────────────────────────────
 *     CalorieBalance:
 *       type: object
 *       properties:
 *         tiene_plan_activo:
 *           type: boolean
 *         fecha:
 *           type: string
 *           format: date
 *         balance:
 *           type: object
 *           properties:
 *             calorias_objetivo:
 *               type: integer
 *               example: 2190
 *             calorias_consumidas_plan:
 *               type: integer
 *               example: 870
 *             calorias_consumidas_adicional:
 *               type: integer
 *               example: 0
 *             calorias_totales_consumidas:
 *               type: integer
 *               example: 870
 *               description: "Columna generada automáticamente por PostgreSQL"
 *             calorias_restantes:
 *               type: integer
 *               example: 1320
 *               description: "Columna generada automáticamente por PostgreSQL. Negativo = exceso"
 *             progreso_pct:
 *               type: integer
 *               example: 40
 *             estado:
 *               type: string
 *               enum: [deficit, exacto, exceso]
 *         ejercicios_compensatorios:
 *           nullable: true
 *           type: object
 *           description: "RN-05: solo presente si calorias_restantes < 0"
 *
 *     # ── Adherencia semanal ───────────────────────────────────
 *     AdherenceResponse:
 *       type: object
 *       properties:
 *         tiene_semana_activa:
 *           type: boolean
 *         semana:
 *           type: object
 *           properties:
 *             numero:
 *               type: integer
 *             fecha_inicio_semana:
 *               type: string
 *               format: date
 *             fecha_fin_semana:
 *               type: string
 *               format: date
 *         adherencia:
 *           type: object
 *           properties:
 *             pct_cumplimiento_alimenticio:
 *               type: integer
 *               example: 74
 *               description: "Porcentaje de comidas realizadas sobre el total del plan"
 *             pct_cumplimiento_ejercicio:
 *               type: integer
 *               example: 60
 *             nivel:
 *               type: string
 *               enum: [alto, medio, bajo]
 *               description: "alto ≥80% · medio 50-79% · bajo <50%"
 *             detalle:
 *               type: object
 *               properties:
 *                 alimenticio:
 *                   type: object
 *                   properties:
 *                     realizadas: { type: integer, example: 18 }
 *                     total:      { type: integer, example: 25 }
 *                     pct:        { type: integer, example: 72 }
 *                 ejercicio:
 *                   type: object
 *                   properties:
 *                     completados: { type: integer, example: 6 }
 *                     total:       { type: integer, example: 10 }
 *                     pct:         { type: integer, example: 60 }
 *
 *     # ── Dashboard nutricionista ──────────────────────────────
 *     NutritionistDashboard:
 *       type: object
 *       properties:
 *         resumen:
 *           type: object
 *           properties:
 *             total_pacientes:        { type: integer, example: 45 }
 *             planes_activos:         { type: integer, example: 32 }
 *             planes_pendientes:      { type: integer, example: 8 }
 *             formularios_pendientes: { type: integer, example: 5 }
 *             alertas_sin_revisar:    { type: integer, example: 7 }
 *         pacientes_por_adherencia:
 *           type: object
 *           properties:
 *             alto:      { type: integer, example: 12 }
 *             medio:     { type: integer, example: 14 }
 *             bajo:      { type: integer, example: 6 }
 *             sin_datos: { type: integer, example: 13 }
 */

export {};