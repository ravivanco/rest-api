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
    console.log('Iniciando la corrección de fechas del plan...');

    // 1. Obtener el id_perfil del paciente de pruebas
    const userRes = await pool.query(`
      SELECT pp.id_perfil, u.correo_institucional
      FROM perfiles_paciente pp
      JOIN usuarios u ON u.id_usuario = pp.id_usuario
      WHERE u.correo_institucional = 'paciente.peso@decokasas.com'
    `);
    
    if (userRes.rows.length === 0) {
      console.log('❌ No se encontró el perfil del paciente de prueba "paciente.peso@decokasas.com".');
      return;
    }
    const perfilId = userRes.rows[0].id_perfil;
    console.log(`✅ Perfil encontrado: id_perfil = ${perfilId}`);

    // 2. Obtener el plan activo del paciente
    const planRes = await pool.query(`
      SELECT id_plan, fecha_inicio, fecha_fin 
      FROM planes_nutricionales 
      WHERE id_perfil = $1 AND estado = 'activo'
      LIMIT 1
    `, [perfilId]);

    if (planRes.rows.length === 0) {
      console.log('❌ No se encontró ningún plan activo para este paciente.');
      return;
    }
    const planId = planRes.rows[0].id_plan;
    console.log(`✅ Plan activo encontrado: id_plan = ${planId}`);

    // Corregir fechas del plan maestro para que incluyan el día de hoy (2026-05-29)
    await pool.query(`
      UPDATE planes_nutricionales 
      SET fecha_inicio = '2026-05-25',
          fecha_fin = '2026-06-30'
      WHERE id_plan = $1
    `, [planId]);
    console.log('✅ Fechas del plan nutricional actualizadas (Inicio: 2026-05-25, Fin: 2026-06-30).');

    // 3. Obtener las semanas del plan
    const weeksRes = await pool.query(`
      SELECT id_semana, numero, fecha_inicio_semana, fecha_fin_semana
      FROM planes_semanales 
      WHERE id_plan = $1 
      ORDER BY numero ASC
    `, [planId]);

    if (weeksRes.rows.length === 0) {
      console.log('❌ No se encontraron semanas para este plan.');
      return;
    }

    const week1 = weeksRes.rows[0];
    console.log(`✅ Semana 1 encontrada: id_semana = ${week1.id_semana}`);

    // Actualizar la Semana 1 para que sea la semana actual (2026-05-25 al 2026-05-29)
    await pool.query(`
      UPDATE planes_semanales
      SET fecha_inicio_semana = '2026-05-25',
          fecha_fin_semana = '2026-05-29'
      WHERE id_semana = $1
    `, [week1.id_semana]);
    console.log('✅ Rango de la Semana 1 actualizado a: 2026-05-25 -> 2026-05-29.');

    // 4. Actualizar o crear los días de la semana con las fechas correctas y coherentes con el calendario de 2026
    // Lunes 25 de mayo, Martes 26, Miércoles 27, Jueves 28, Viernes 29.
    const diasCorrectos = [
      { dia: 'lunes', fecha: '2026-05-25' },
      { dia: 'martes', fecha: '2026-05-26' },
      { dia: 'miercoles', fecha: '2026-05-27' },
      { dia: 'jueves', fecha: '2026-05-28' },
      { dia: 'viernes', fecha: '2026-05-29' }
    ];

    for (const d of diasCorrectos) {
      // Buscar si el día ya existe en la semana
      const checkDay = await pool.query(`
        SELECT id_dia_plan 
        FROM dias_plan 
        WHERE id_semana = $1 AND dia_semana = $2
      `, [week1.id_semana, d.dia]);

      if (checkDay.rows.length > 0) {
        // Si existe, actualizamos la fecha
        await pool.query(`
          UPDATE dias_plan
          SET fecha = $1
          WHERE id_dia_plan = $2
        `, [d.fecha, checkDay.rows[0].id_dia_plan]);
        console.log(`   -> Día "${d.dia}" actualizado a la fecha real: ${d.fecha}`);
      } else {
        // Si no existe, lo insertamos
        await pool.query(`
          INSERT INTO dias_plan (id_semana, dia_semana, fecha)
          VALUES ($1, $2, $3)
        `, [week1.id_semana, d.dia, d.fecha]);
        console.log(`   -> Día "${d.dia}" creado con la fecha real: ${d.fecha}`);
      }
    }

    console.log('\n🎉 ¡Todas las correcciones de fechas se aplicaron exitosamente en la base de datos!');
  } catch (err) {
    console.error('❌ Error ejecutando la corrección:', err);
  } finally {
    await pool.end();
  }
}

main();
