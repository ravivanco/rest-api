const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function main() {
  try {
    const resUsers = await pool.query(`
      SELECT id_usuario, correo_institucional, rol, estado
      FROM usuarios
      LIMIT 10
    `);
    console.log('--- Usuarios ---');
    console.log(resUsers.rows);

    const resProfiles = await pool.query(`
      SELECT pp.id_perfil, pp.id_usuario, u.correo_institucional
      FROM perfiles_paciente pp
      LEFT JOIN usuarios u ON u.id_usuario = pp.id_usuario
      LIMIT 10
    `);
    console.log('--- Perfiles Paciente ---');
    console.log(resProfiles.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
main();
