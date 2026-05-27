import { pool } from './src/database/pool';

async function main() {
  try {
    console.log('--- Iniciando borrado en tabla "consumos_adicionales" ---');
    
    // NOTA: Cambia la consulta según tus necesidades:
    // Opción A: Borrar TODO
    const query = `DELETE FROM consumos_adicionales`;
    
    // Opción B: Borrar para un perfil específico (descomenta si lo necesitas)
    // const perfilId = 45;
    // const query = `DELETE FROM consumos_adicionales WHERE id_perfil = ${perfilId}`;
    
    const result = await pool.query(query);
    console.log(`✅ Borrado exitoso. Filas eliminadas: ${result.rowCount}`);
  } catch (error) {
    console.error('❌ Error ejecutando el borrado:', error);
  } finally {
    await pool.end();
  }
}

main();
