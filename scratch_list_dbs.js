const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: 'postgres', // connect to main postgres db to list all
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function main() {
  try {
    const res = await pool.query('SELECT datname FROM pg_database WHERE datistemplate = false');
    console.log('Databases available:', res.rows.map(r => r.datname));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
main();
