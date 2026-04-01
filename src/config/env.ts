import dotenv from 'dotenv';
dotenv.config();

/**
 * Configuración centralizada de variables de entorno.
 * Si una variable requerida no existe, el servidor no arranca.
 * Esto previene errores silenciosos en producción.
 */
export const env = {
  NODE_ENV:   process.env.NODE_ENV   || 'development',
  PORT:       parseInt(process.env.PORT || '3000'),

  // Base de datos
  DB_HOST:    process.env.DB_HOST    || 'localhost',
  DB_PORT:    parseInt(process.env.DB_PORT || '5432'),
  DB_NAME:    process.env.DB_NAME    || 'dk_fitt_db',
  DB_USER:    process.env.DB_USER    || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || '',

  // JWT
  JWT_SECRET:             process.env.JWT_SECRET             || '',
  JWT_EXPIRES_IN:         process.env.JWT_EXPIRES_IN         || '15m',
  JWT_REFRESH_SECRET:     process.env.JWT_REFRESH_SECRET     || '',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // Seguridad
  INSTITUTIONAL_DOMAIN: process.env.INSTITUTIONAL_DOMAIN || 'decokasas.com',
  BCRYPT_SALT_ROUNDS:   parseInt(process.env.BCRYPT_SALT_ROUNDS || '12'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  RATE_LIMIT_MAX:       parseInt(process.env.RATE_LIMIT_MAX       || '200'),
  AUTH_RATE_LIMIT_MAX:  parseInt(process.env.AUTH_RATE_LIMIT_MAX  || '5'),
};

// Verificar variables críticas al arrancar
const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DB_PASSWORD'];
const missing  = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('\n❌ Faltan variables de entorno requeridas:');
  missing.forEach(key => console.error(`   • ${key}`));
  console.error('\nRevisa tu archivo .env\n');
  process.exit(1);
}