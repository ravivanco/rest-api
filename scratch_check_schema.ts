import { pool } from './src/database/pool';

async function main() {
  try {
    console.log('Querying table columns for "ejercicios"...');
    const res = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'ejercicios';
    `);
    console.log('--- Columnas de "ejercicios" ---');
    console.log(JSON.stringify(res.rows, null, 2));

    console.log('\nQuerying check constraints for "ejercicios"...');
    const resCheck = await pool.query(`
      SELECT tc.constraint_name, cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_name = 'ejercicios';
    `);
    console.log('--- Constraints de check de "ejercicios" ---');
    console.log(JSON.stringify(resCheck.rows, null, 2));

    console.log('\nQuerying columns for other tables...');
    const resTables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public';
    `);
    console.log('--- Tablas en la base de datos ---');
    console.log(resTables.rows.map(r => r.table_name).join(', '));

  } catch (err) {
    console.error('Error running query:', err);
  } finally {
    await pool.end();
  }
}

main();
