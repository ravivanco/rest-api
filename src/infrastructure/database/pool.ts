import { Pool, Client } from 'pg';
import { env } from '@config/env';

/**
 * Pool de conexiones para PostgreSQL
 */
export const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  max: 20, // máximo de conexiones en el pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Manejo de errores del pool
pool.on('error', (err) => {
  console.error('❌ Error inesperado en el pool de conexiones:', err);
  process.exit(-1);
});

/**
 * Verifica la conexión a la base de datos
 * @throws Error si no puede conectarse a la base de datos
 */
export async function checkDatabaseConnection(): Promise<void> {
  const client = new Client({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Conexión a la base de datos verificada:', result.rows[0]);
  } catch (error) {
    console.error('❌ Error al conectar a la base de datos:', error);
    throw new Error(
      `No se pudo conectar a PostgreSQL en ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`
    );
  } finally {
    await client.end();
  }
}
