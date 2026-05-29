const { Pool } = require('pg');

async function testPort(port) {
  console.log(`\n--- Probando Puerto ${port} ---`);
  const pool = new Pool({
    host: 'localhost',
    port: port,
    database: 'dk_fitt_db',
    user: 'postgres',
    password: '12345678',
  });

  try {
    const res = await pool.query('SELECT tablename FROM pg_tables WHERE schemaname = \'public\'');
    console.log(`Conexión exitosa en puerto ${port}. Tablas:`, res.rows.map(r => r.tablename).join(', '));
    
    // Si hay usuarios, mostrarlos
    const userRes = await pool.query('SELECT COUNT(*) FROM usuarios');
    console.log(`Total usuarios en puerto ${port}:`, userRes.rows[0].count);

    if (parseInt(userRes.rows[0].count) > 0) {
      const activeUsers = await pool.query(`
        SELECT pp.id_perfil, u.correo_institucional
        FROM perfiles_paciente pp
        JOIN usuarios u ON u.id_usuario = pp.id_usuario
      `);
      console.log('Pacientes activos:', activeUsers.rows);
    }
  } catch (err) {
    console.log(`❌ Error en puerto ${port}:`, err.message);
  } finally {
    await pool.end();
  }
}

async function main() {
  await testPort(5432);
  await testPort(5433);
}

main();
