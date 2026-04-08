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
  // Orígenes permitidos en producción
  // Agregar aquí las URLs reales del frontend cuando estén disponibles
  const allowedOrigins: string[] = [
    // App web de la nutricionista
    // Agregar aquí cuando tengas el frontend listo
    // 'https://dkfitt.decokasas.com',
    // 'https://app.dkfitt.decokasas.com',
    // Para pruebas desde Postman, apps móviles nativas y Render healthcheck
    // (origin undefined = petición sin origen — siempre se permite)
  ];

  app.use(cors({
    origin: (origin, callback) => {
      // Peticiones sin origen: Postman, apps móviles nativas, curl
      if (!origin) return callback(null, true);

      // Desarrollo: permitir todo
      if (env.NODE_ENV !== 'production') return callback(null, true);

      // Producción: solo orígenes de la lista
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Origen no permitido
      callback(new Error(`CORS: Origen no permitido — ${origin}`));
    },
    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials:    true,
    maxAge:         86400, // cache de preflight 24 horas
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