import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

/**
 * Configuración de Swagger UI.
 * Lee los comentarios JSDoc de los archivos de rutas
 * y genera automáticamente la documentación interactiva.
 */
const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title:       'DK Fitt API',
      version:     '1.0.0',
      description: 'REST API del sistema de control nutricional DK Fitt — Decokasas S.A.S.',
    },
    servers: [
      {
        url:         `http://localhost:${env.PORT}/api`,
        description: 'Servidor de desarrollo',
      },
    ],
    components: {
      securitySchemes: {
        // Define el esquema de autenticación JWT
        // Swagger mostrará un botón "Authorize" donde pegar el token
        bearerAuth: {
          type:         'http',
          scheme:       'bearer',
          bearerFormat: 'JWT',
          description:  'Ingresa el token JWT obtenido en POST /api/auth/login',
        },
      },
      // Respuestas de error reutilizables en todos los módulos
      responses: {
        Unauthorized: {
          description: 'Token ausente, inválido o expirado',
          content: {
            'application/json': {
              example: {
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'No autorizado' },
              },
            },
          },
        },
        Forbidden: {
          description: 'Sin permiso para esta acción',
          content: {
            'application/json': {
              example: {
                success: false,
                error: { code: 'FORBIDDEN', message: 'Acceso denegado' },
              },
            },
          },
        },
        NotFound: {
          description: 'Recurso no encontrado',
          content: {
            'application/json': {
              example: {
                success: false,
                error: { code: 'NOT_FOUND', message: 'Recurso no encontrado' },
              },
            },
          },
        },
        ValidationError: {
          description: 'Datos de entrada inválidos',
          content: {
            'application/json': {
              example: {
                success: false,
                error: {
                  code:    'VALIDATION_ERROR',
                  message: 'Datos de entrada inválidos',
                  details: [{ field: 'correo_institucional', message: 'Email inválido' }],
                },
              },
            },
          },
        },
      },
    },
    // Aplicar autenticación JWT por defecto a todos los endpoints
    // Los endpoints públicos lo anulan con security: []
    security: [{ bearerAuth: [] }],
  },
  // Dónde buscar los comentarios JSDoc de las rutas
  apis: ['./src/modules/**/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);