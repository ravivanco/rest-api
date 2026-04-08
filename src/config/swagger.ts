import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',

    // ── Información general ──────────────────────────────────────────────
    info: {
      title: 'DK Fitt REST API',
      version: '1.0.0',
      description: `
## Sistema de control nutricional corporativo — Decokasas S.A.S.

### ¿Qué hace esta API?
Gestiona el programa de bienestar nutricional de los empleados de Decokasas.
Conecta la **app móvil** del paciente con la **plataforma web** de la nutricionista.

### Actores del sistema
| Actor | Interfaz | Rol en la API |
|---|---|---|
| Paciente | App móvil | Registra cumplimiento, consulta su plan |
| Nutricionista | Plataforma web | Gestiona planes, evalúa, monitorea |

### Flujo completo del sistema
\`\`\`
1. Paciente se registra → completa formulario inicial
2. Nutricionista registra evaluación clínica (bioimpedancia)
3. Nutricionista crea y activa el plan nutricional
4. Paciente ve su plan en la app móvil
5. Paciente registra cumplimiento diario (comidas, ejercicios, peso)
6. Nutricionista monitorea adherencia y genera alertas
\`\`\`

### Reglas de negocio principales
- **RN-01:** Solo correos \`@decokasas.com\` pueden registrarse
- **RN-02:** El módulo Mi Plan solo se activa cuando la nutricionista lo habilita
- **RN-03:** El seguimiento diario solo puede registrarse en el día actual
- **RN-04:** Consumos adicionales solo impactan el balance si se confirman
- **RN-05:** Exceso calórico genera sugerencia de ejercicios compensatorios
      `,
      contact: {
        name: 'Equipo DK Fitt — Decokasas S.A.S.',
        email: 'dev@decokasas.com',
      },
    },

    // ── Servidores ────────────────────────────────────────────────────────
    servers: [
      {
        url: 'https://dk-fitt-api.onrender.com/api',
        description: '🚀 Servidor de producción (Render)',
      },
    ],

    // ── Tags por módulo ────────────────────────────────────────────────────
    tags: [
      { name: 'Health', description: '❤️  Estado del servidor y base de datos' },
      { name: 'Auth', description: '🔐 Registro, login y gestión de sesiones JWT' },
      { name: 'Patients', description: '👥 Listado y ficha de pacientes' },
      { name: 'Patient Profile', description: '📋 Formulario inicial del paciente' },
      { name: 'Clinical Evaluations', description: '⚖️  Evaluaciones de bioimpedancia' },
      { name: 'Nutrition Plans', description: '🥗 Planes nutricionales y estructura semanal' },
      { name: 'Foods', description: '🍎 Catálogo de alimentos' },
      { name: 'Dishes', description: '🍽️  Catálogo de platos y recetas' },
      { name: 'Exercises', description: '🏃 Catálogo de ejercicios' },
      { name: 'Meal Tracking', description: '✅ Seguimiento diario de comidas' },
      { name: 'Exercise Tracking', description: '🏋️  Seguimiento diario de ejercicios' },
      { name: 'Weight Records', description: '📊 Registro de peso diario' },
      { name: 'Calorie Control', description: '🔥 Balance calórico diario' },
      { name: 'Additional Intake', description: '🍔 Consumos adicionales fuera del plan' },
      { name: 'Adherence', description: '📈 Índice de adherencia semanal' },
      { name: 'Alerts', description: '🔔 Alertas clínicas automáticas' },
      { name: 'Dashboard', description: '📱 Dashboards y métricas consolidadas' },
      { name: 'Appointments', description: '📅 Citas nutricionales' },
    ],

    // ── Seguridad global ───────────────────────────────────────────────────
    security: [{ bearerAuth: [] }],

    // ── Componentes reutilizables ─────────────────────────────────────────
    components: {

      // ── Esquemas de seguridad ────────────────────────────────────────
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Token JWT obtenido en **POST /auth/login**.\n\n' +
            'Formato: `Bearer eyJhbGciOiJIUzI1NiJ9...`\n\n' +
            'El token expira en **15 minutos**. Usa **POST /auth/refresh** para renovarlo.',
        },
      },

      // ── Schemas reutilizables ─────────────────────────────────────────
      schemas: {

        // ── Respuestas estándar ──────────────────────────────────────
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object', description: 'Datos de la respuesta' },
            message: { type: 'string', example: 'Operación exitosa' },
          },
        },

        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Datos de entrada inválidos' },
                details: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      field: { type: 'string', example: 'correo_institucional' },
                      message: { type: 'string', example: 'Email inválido' },
                    },
                  },
                },
              },
            },
          },
        },

        PaginationMeta: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 45 },
            total_pages: { type: 'integer', example: 3 },
          },
        },

        // ── Auth schemas ─────────────────────────────────────────────
        RegisterRequest: {
          type: 'object',
          required: ['correo_institucional', 'contrasena', 'nombres', 'apellidos', 'edad', 'sexo', 'fecha_nacimiento'],
          properties: {
            correo_institucional: { type: 'string', format: 'email', example: 'juan.perez@decokasas.com' },
            contrasena: { type: 'string', minLength: 8, example: 'MiClave123!', description: 'Mínimo 8 chars, mayúscula, minúscula, número y símbolo especial' },
            nombres: { type: 'string', example: 'Juan' },
            apellidos: { type: 'string', example: 'Pérez' },
            edad: { type: 'integer', minimum: 16, example: 32 },
            sexo: { type: 'string', enum: ['M', 'F', 'O'], example: 'M' },
            fecha_nacimiento: { type: 'string', format: 'date', example: '1992-05-15' },
          },
        },

        LoginRequest: {
          type: 'object',
          required: ['correo_institucional', 'contrasena'],
          properties: {
            correo_institucional: { type: 'string', format: 'email', example: 'juan.perez@decokasas.com' },
            contrasena: { type: 'string', example: 'MiClave123!' },
          },
        },

        TokenPair: {
          type: 'object',
          properties: {
            access_token: { type: 'string', description: 'JWT con expiración de 15 minutos' },
            refresh_token: { type: 'string', description: 'Token de refresco con expiración de 7 días' },
            expires_in: { type: 'integer', example: 900, description: 'Segundos hasta expiración del access token' },
            token_type: { type: 'string', example: 'Bearer' },
          },
        },

        // ── Evaluación clínica schema ─────────────────────────────────
        CreateEvaluationRequest: {
          type: 'object',
          required: ['id_perfil', 'peso_kg', 'altura_cm'],
          properties: {
            id_perfil: { type: 'integer', example: 8 },
            peso_kg: { type: 'number', example: 84.5 },
            altura_cm: { type: 'number', example: 175.0 },
            porcentaje_grasa: { type: 'number', example: 28.4 },
            masa_muscular_kg: { type: 'number', example: 35.2 },
            otros_indicadores: {
              type: 'object',
              example: { agua_corporal_pct: 52.1, grasa_visceral: 8 },
            },
            fecha_evaluacion: { type: 'string', format: 'date', example: '2026-04-01' },
          },
        },

        EvaluacionResponse: {
          type: 'object',
          properties: {
            id_evaluacion: { type: 'integer', example: 1 },
            peso_kg: { type: 'number', example: 84.5 },
            altura_cm: { type: 'number', example: 175.0 },
            imc: { type: 'number', example: 27.59, description: 'Calculado automáticamente por PostgreSQL' },
            calorias_diarias_calculadas: { type: 'integer', example: 2190, description: 'Calculadas con fórmula Mifflin-St Jeor' },
            distribucion_carbohidratos_pct: { type: 'integer', example: 40 },
            distribucion_proteinas_pct: { type: 'integer', example: 35 },
            distribucion_grasas_pct: { type: 'integer', example: 25 },
          },
        },

        // ── Plan nutricional schema ───────────────────────────────────
        PlanResponse: {
          type: 'object',
          properties: {
            id_plan: { type: 'integer', example: 3 },
            estado: { type: 'string', enum: ['pendiente', 'activo', 'suspendido', 'finalizado'] },
            modulo_habilitado: { type: 'boolean', example: false, description: 'RN-02: false hasta que la nutricionista active el plan' },
            fecha_inicio: { type: 'string', format: 'date', nullable: true },
            fecha_fin: { type: 'string', format: 'date', nullable: true },
          },
        },

        // ── Alimento schema ───────────────────────────────────────────
        FoodRequest: {
          type: 'object',
          required: ['nombre', 'categoria', 'calorias_por_100g'],
          properties: {
            nombre: { type: 'string', example: 'Pechuga de pollo' },
            categoria: { type: 'string', enum: ['proteinas', 'carbohidratos', 'lacteos', 'vegetales', 'frutas', 'grasas', 'otros'] },
            calorias_por_100g: { type: 'integer', example: 165 },
            carbohidratos_g: { type: 'number', example: 0 },
            proteinas_g: { type: 'number', example: 31 },
            grasas_g: { type: 'number', example: 3.6 },
            vitaminas: { type: 'string', example: 'B3, B6', nullable: true },
            minerales: { type: 'string', example: 'Fósforo, Selenio', nullable: true },
          },
        },

        // ── Plato schema ──────────────────────────────────────────────
        DishRequest: {
          type: 'object',
          required: ['nombre'],
          properties: {
            nombre: { type: 'string', example: 'Ensalada de pollo' },
            descripcion: { type: 'string', example: 'Ensalada fresca y proteica', nullable: true },
            modo_preparacion: { type: 'string', example: '1. Cocinar el pollo...', nullable: true },
            enlace_video: { type: 'string', format: 'uri', nullable: true },
            tiempo_preparacion_min: { type: 'integer', example: 20, nullable: true },
            ingredientes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id_alimento: { type: 'integer', example: 1 },
                  cantidad_g: { type: 'integer', example: 150 },
                },
              },
            },
          },
        },

        // ── Ejercicio schema ──────────────────────────────────────────
        ExerciseRequest: {
          type: 'object',
          required: ['nombre', 'categoria', 'duracion_min', 'frecuencia_semanal', 'intensidad'],
          properties: {
            nombre: { type: 'string', example: 'Caminata rápida' },
            descripcion: { type: 'string', nullable: true },
            categoria: { type: 'string', example: 'Cardiovascular' },
            duracion_min: { type: 'integer', example: 30 },
            frecuencia_semanal: { type: 'integer', minimum: 1, maximum: 7, example: 5 },
            intensidad: { type: 'string', enum: ['baja', 'media', 'alta'] },
            nivel_actividad_recomendado: { type: 'string', enum: ['sedentario', 'bajo', 'medio', 'alto'], nullable: true },
            objetivo_recomendado: { type: 'string', nullable: true },
          },
        },

        // ── Tracking schemas ──────────────────────────────────────────
        TrackMealRequest: {
          type: 'object',
          required: ['id_menu_diario', 'realizado'],
          properties: {
            id_menu_diario: { type: 'integer', example: 1 },
            realizado: { type: 'boolean', example: true },
            hora_registro: { type: 'string', example: '07:30', nullable: true },
          },
        },

        TrackExerciseRequest: {
          type: 'object',
          required: ['id_ejercicio_diario', 'completado'],
          properties: {
            id_ejercicio_diario: { type: 'integer', example: 3 },
            completado: { type: 'boolean', example: true },
            hora_registro: { type: 'string', example: '07:00', nullable: true },
          },
        },

        WeightRecordRequest: {
          type: 'object',
          required: ['peso_kg'],
          properties: {
            peso_kg: { type: 'number', example: 83.8, minimum: 20, maximum: 499 },
          },
        },

        // ── Consumo adicional schemas ─────────────────────────────────
        AdditionalIntakeRequest: {
          type: 'object',
          required: ['descripcion_alimento'],
          properties: {
            descripcion_alimento: { type: 'string', example: 'Hamburguesa con papas fritas' },
            imagen_url: { type: 'string', format: 'uri', nullable: true },
            calorias_estimadas: { type: 'integer', example: 650, nullable: true },
            hora: { type: 'string', example: '15:30', nullable: true },
          },
        },

        ConfirmIntakeRequest: {
          type: 'object',
          required: ['calorias_estimadas'],
          properties: {
            calorias_estimadas: { type: 'integer', example: 700 },
          },
        },

        // ── Citas schema ──────────────────────────────────────────────
        AppointmentRequest: {
          type: 'object',
          required: ['id_perfil', 'fecha_hora'],
          properties: {
            id_perfil: { type: 'integer', example: 1 },
            fecha_hora: { type: 'string', example: '2026-04-15T10:00:00', description: 'Formato ISO 8601. Debe ser fecha futura.' },
            notas: { type: 'string', example: 'Primera consulta mensual', nullable: true },
          },
        },

        ChangeStatusRequest: {
          type: 'object',
          required: ['estado'],
          properties: {
            estado: { type: 'string', enum: ['programada', 'atendida', 'cancelada', 'reprogramada'] },
            notas: { type: 'string', nullable: true },
          },
        },
      },

      // ── Respuestas de error reutilizables ─────────────────────────────
      responses: {

        BadRequest: {
          description: '400 — Datos de entrada inválidos',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Datos de entrada inválidos',
                  details: [
                    { field: 'correo_institucional', message: 'Email inválido' },
                    { field: 'contrasena', message: 'Debe tener al menos 8 caracteres' },
                  ],
                },
              },
            },
          },
        },

        Unauthorized: {
          description: '401 — Token ausente, inválido o expirado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Token de acceso requerido' },
              },
            },
          },
        },

        Forbidden: {
          description: '403 — Sin permiso para esta acción',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: { code: 'FORBIDDEN', message: 'Acceso denegado. Se requiere rol: nutricionista' },
              },
            },
          },
        },

        NotFound: {
          description: '404 — Recurso no encontrado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: { code: 'NOT_FOUND', message: 'Paciente no encontrado' },
              },
            },
          },
        },

        Conflict: {
          description: '409 — El recurso ya existe',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: { code: 'CONFLICT', message: "El alimento 'Pechuga de pollo' ya existe" },
              },
            },
          },
        },

        BusinessRuleViolation: {
          description: '422 — Violación de regla de negocio',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: {
                  code: 'BUSINESS_RULE_VIOLATION',
                  message: 'Solo puedes registrar cumplimiento en el día actual (2026-04-07)',
                },
              },
            },
          },
        },

        TooManyRequests: {
          description: '429 — Demasiadas peticiones',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Demasiadas peticiones. Intenta en 15 minutos.' },
              },
            },
          },
        },

        InternalError: {
          description: '500 — Error interno del servidor',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: { code: 'INTERNAL_SERVER_ERROR', message: 'Ocurrió un error interno. Por favor intenta más tarde.' },
              },
            },
          },
        },
      },
    },
  },

  // Dónde buscar los comentarios JSDoc de las rutas
    apis: [
    './dist/modules/**/routes/*.js',
    './dist/docs/*.js',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);