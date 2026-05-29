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
    const userRes = await pool.query(`
      SELECT pp.id_perfil, u.correo_institucional
      FROM perfiles_paciente pp
      JOIN usuarios u ON u.id_usuario = pp.id_usuario
      WHERE u.correo_institucional = 'paciente.peso@decokasas.com'
    `);
    console.log('User profiles:', userRes.rows);
    if (userRes.rows.length === 0) {
       console.log('No user profile found for paciente.peso@decokasas.com');
       return;
    }
    const perfilId = userRes.rows[0].id_perfil;
    const planRes = await pool.query("SELECT * FROM planes_nutricionales WHERE id_perfil = $1 ORDER BY created_at DESC", [perfilId]);
    console.log('Planes:', planRes.rows);
    if (planRes.rows.length > 0) {
      const planId = planRes.rows[0].id_plan;
      const weeksRes = await pool.query("SELECT * FROM planes_semanales WHERE id_plan = $1 ORDER BY numero ASC", [planId]);
      console.log('Weeks:', weeksRes.rows);
      for (const w of weeksRes.rows) {
        const daysRes = await pool.query("SELECT * FROM dias_plan WHERE id_semana = $1 ORDER BY fecha ASC", [w.id_semana]);
        console.log(`Days for week ${w.numero}:`, daysRes.rows.map(d => ({ id_dia_plan: d.id_dia_plan, dia_semana: d.dia_semana, fecha: d.fecha })));
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
main();
