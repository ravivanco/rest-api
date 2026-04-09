import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import compression from 'compression';

import { env }          from '@config/env';
import { swaggerSpec }  from '@config/swagger';
import { router }       from './routes';
import { globalLimiter } from '@middlewares/rateLimiter';
import { notFound }     from '@middlewares/notFound';
import { errorHandler } from '@middlewares/errorHandler';

/**
 * Crea y configura la aplicación Express.
 * Separado de server.ts para facilitar las pruebas.
 */
export function createApp(): Application {
  const app = express();

// ── Seguridad: cabeceras HTTP ─────────────────────────────────
  app.use(helmet({
    // Para una API pura (sin HTML), podemos relajar algunas políticas
    contentSecurityPolicy: false,
    // El resto de protecciones de Helmet se mantienen activas
  }));

  // No revelar que usamos Express
  app.disable('x-powered-by');

  // ── Compresión de respuestas ──────────────────────────────────
  // Comprime todas las respuestas JSON mayores a 1KB
  app.use(compression({
    level:     6,     // nivel de compresión (0-9, default 6)
    threshold: 1024,  // solo comprimir si la respuesta > 1KB
  }));

  // ── CORS ─────────────────────────────────────────────────────
  // Orígenes permitidos organizados por entorno
  const allowedOrigins: string[] = [

    // ── Producción ──────────────────────────────────────────
    'https://dkfitt.decokasas.com',
    'https://app.dkfitt.decokasas.com',

    // ── Desarrollo local — plataforma web ───────────────────
    // Agrega aquí todos los puertos que usa tu app web local
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:4200',  // Angular
    'http://localhost:5173',  // Vite / React
    'http://localhost:5174',  // Vite alternativo
    'http://localhost:8080',  // Vue CLI / webpack
    'http://localhost:8081',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080',

  ];

  app.use(cors({
    origin: (origin, callback) => {
      // Sin origin: Postman, curl, apps móviles nativas → siempre permitir
      if (!origin) return callback(null, true);

      // Origin en la lista → permitir
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // En desarrollo: permitir cualquier localhost
      // Esto cubre cualquier puerto local sin tener que listarlos todos
      if (
        env.NODE_ENV === 'development' ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        return callback(null, true);
      }

      // Origin no permitido
      console.warn(`⚠️  CORS bloqueado: ${origin}`);
      callback(new Error(`CORS: Origen no permitido — ${origin}`));
    },

    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count'],
    credentials:    true,
    maxAge:         86400,
  }));

  // No revelar que usamos Express
  app.disable('x-powered-by');

  // Rate limiting: máximo 200 peticiones por IP cada 15 minutos
  app.use(globalLimiter);

  // ── Parsers ──────────────────────────────────────────────────
  // Permite leer req.body como JSON
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── Logger HTTP ──────────────────────────────────────────────
  if (env.NODE_ENV === 'test') {
    // En tests no loguear nada — los tests son más limpios
  } else if (env.NODE_ENV === 'production') {
    // Producción: formato combined (IP + timestamp + método + status)
    // Ejemplo: 93.184.216.34 - - [05/Apr/2026:20:00:00] "GET /api/health HTTP/1.1" 200 120
    app.use(morgan('combined'));
  } else {
    // Desarrollo: formato dev (colorido y conciso)
    // Ejemplo: GET /api/health 200 15ms
    app.use(morgan('dev'));
  }

  // ── Swagger UI ───────────────────────────────────────────────
  if (env.NODE_ENV !== 'test') {
    app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec, {
        customSiteTitle: 'DK Fitt API — Documentación',

        // CSS personalizado para mejorar la apariencia
        customCss: `
          .swagger-ui .topbar { background-color: #1a1a2e; padding: 8px 0; }
          .swagger-ui .topbar-wrapper img { display: none; }
          .swagger-ui .topbar-wrapper::before {
            content: '🥗 DK Fitt API';
            color: white;
            font-size: 20px;
            font-weight: bold;
            padding-left: 20px;
          }
          .swagger-ui .info .title { color: #1a1a2e; }
          .swagger-ui .scheme-container { background: #f8f9fa; padding: 15px; border-radius: 8px; }
        `,

        swaggerOptions: {
          // Recuerda el token al recargar la página
          persistAuthorization: true,
          // Muestra la duración de cada request
          displayRequestDuration: true,
          // Expande las operaciones por defecto (list = muestra tags colapsados)
          docExpansion: 'list',
          // Permite filtrar endpoints por texto
          filter: true,
          // Ordena los tags alfabéticamente
          tagsSorter: 'alpha',
          // Muestra el botón "Try it out" automáticamente
          tryItOutEnabled: false,
          // Tiempo máximo de espera para las peticiones
          requestTimeout: 30000,
        },
      }),
    );

    // Endpoint para obtener la spec en JSON (para generadores de clientes)
    app.get('/api-docs.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });

    // eslint-disable-next-line no-console
    console.log(`📚 Swagger UI disponible en http://localhost:${env.PORT}/api-docs`);
  }

  // ── Ruta informativa raíz ────────────────────────────────────
  app.get('/', (_req, res) => {
    res.json({
      name:        'DK Fitt REST API',
      version:     '1.0.0',
      description: 'Sistema de control nutricional — Decokasas S.A.S.',
      docs:        `http://localhost:${env.PORT}/api-docs`,
      health:      `http://localhost:${env.PORT}/api/health`,
      environment: env.NODE_ENV,
    });
  });

  // ── Rutas de la API ──────────────────────────────────────────
  app.use('/api', router);

  // ── Rutas no encontradas ─────────────────────────────────────
  // Debe ir DESPUÉS de todas las rutas y ANTES del errorHandler
  app.use(notFound);

  // ── Manejo global de errores ─────────────────────────────────
  // SIEMPRE debe ser el ÚLTIMO middleware
  app.use(errorHandler);

  return app;
}