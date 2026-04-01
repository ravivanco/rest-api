import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

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

  // ── Seguridad ────────────────────────────────────────────────
  // helmet agrega cabeceras HTTP que protegen contra ataques comunes
  app.use(helmet());

  // CORS: quién puede hacer peticiones a esta API
  app.use(cors({
    origin: env.NODE_ENV === 'production'
      ? ['https://dkfitt.decokasas.com']  // solo el dominio de producción
      : '*',                               // cualquier origen en desarrollo
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // No revelar que usamos Express
  app.disable('x-powered-by');

  // Rate limiting: máximo 200 peticiones por IP cada 15 minutos
  app.use(globalLimiter);

  // ── Parsers ──────────────────────────────────────────────────
  // Permite leer req.body como JSON
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── Logger ───────────────────────────────────────────────────
  // Muestra en consola cada petición que llega
  if (env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // ── Swagger UI ───────────────────────────────────────────────
  // Solo disponible en desarrollo — no en producción
  if (env.NODE_ENV === 'development') {
    app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec, {
        customSiteTitle:  'DK Fitt API — Documentación',
        swaggerOptions: {
          persistAuthorization: true, // recuerda el token al recargar
        },
      }),
    );

    // Endpoint para obtener la spec en JSON (útil para clientes Swagger)
    app.get('/api-docs.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });
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