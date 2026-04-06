import { Pool } from 'pg';
import { env } from '@config/env';

/**
 * Pool de conexiones PostgreSQL.
 * Un pool mantiene varias conexiones abiertas y las reutiliza.
 * Esto es más eficiente que abrir una conexión por cada petición.
 */
export const pool = new Pool({
  host:     env.DB_HOST,
  port:     env.DB_PORT,
  database: env.DB_NAME,
  user:     env.DB_USER,
  password: env.DB_PASSWORD,
  max:                    20,     // máximo de conexiones simultáneas
  idleTimeoutMillis:      30000,  // cerrar conexión inactiva después de 30s
  connectionTimeoutMillis: 2000,  // esperar máximo 2s para obtener conexión
  ssl: env.NODE_ENV === 'production'
    ? { rejectUnauthorized: true }
    : false,
});

// Loguear errores del pool que ocurran en background
pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err.message);
});

/**
 * Verifica que la conexión a la base de datos funcione.
 * Se llama al arrancar el servidor.
 * Si falla, el proceso termina (mejor fallar rápido que fallar silencioso).
 */
export const checkDatabaseConnection = async (): Promise<void> => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query<{ now: string }>('SELECT NOW() as now');
    console.log(`✅ PostgreSQL conectado — ${result.rows[0].now}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Error conectando a PostgreSQL:', message);
    console.error('   Verifica DB_HOST, DB_PORT, DB_NAME, DB_USER y DB_PASSWORD en .env');
    process.exit(1);
  } finally {
    client?.release();
  }
};