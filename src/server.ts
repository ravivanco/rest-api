import { createApp }               from './app';
import { env }                     from '@config/env';
import { checkDatabaseConnection } from '@database/pool';

/**
 * Punto de entrada de la aplicación.
 *
 * Secuencia de arranque:
 * 1. Validar variables de entorno (env.ts ya lo hace al importarse)
 * 2. Verificar conexión a PostgreSQL
 * 3. Crear la app Express
 * 4. Levantar el servidor HTTP
 * 5. Registrar handlers para cierre limpio
 */
async function bootstrap(): Promise<void> {

  // Paso 1: Verificar conexión a BD antes de aceptar peticiones
  try {
    await checkDatabaseConnection();
  } catch (error) {
    const requireDbOnBoot = process.env.REQUIRE_DB_ON_BOOT === 'true';
    const message = error instanceof Error ? error.message : String(error);

    if (requireDbOnBoot) {
      throw new Error(`No se pudo conectar a PostgreSQL al iniciar: ${message}`);
    }

    console.warn('⚠️ Iniciando en modo degradado: PostgreSQL no disponible al arranque.');
    console.warn('   Ajusta DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD o define REQUIRE_DB_ON_BOOT=true para bloquear el arranque.');
  }

  // Paso 2: Crear la aplicación con todos los middlewares y rutas
  const app = createApp();

  // Paso 3: Levantar el servidor
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║         DK FITT API — Iniciada           ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║  Entorno  : ${env.NODE_ENV.padEnd(29)}║`);
    console.log(`║  Puerto   : ${String(env.PORT).padEnd(29)}║`);
    console.log(`║  Health   : http://localhost:${env.PORT}/api/health ${''.padEnd(1)}║`);
    console.log(`║  Docs     : http://localhost:${env.PORT}/api-docs   ${''.padEnd(1)}║`);
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
  });

  // Paso 4: Cierre limpio al recibir señal de parada
  const shutdown = (signal: string) => {
    console.log(`\n⚠️  Señal ${signal} recibida. Cerrando servidor...`);
    server.close(() => {
      console.log('✅ Servidor cerrado correctamente.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  // Capturar errores no manejados
  process.on('unhandledRejection', (reason) => {
    console.error('❌ Promise no manejada:', reason);
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    console.error('❌ Excepción no capturada:', error.message);
    process.exit(1);
  });
}

// Manejar promesa rechazada en bootstrap
bootstrap().catch((error) => {
  console.error('❌ Error fatal en bootstrap:', error.message || error);
  process.exit(1);
});