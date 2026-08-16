const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://command_center_db_io6q_user:qO70Q4yIuDVWTnDUz5Lp3e5PGpX5VcP0@dpg-d7n8gshj2pic738mtbf0-a.oregon-postgres.render.com/command_center_db_io6q?sslmode=no-verify', ssl: { rejectUnauthorized: false } });
client.connect().then(() => client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")).then(r => { r.rows.forEach(row => console.log(row.table_name)); client.end(); }).catch(e => { console.error(e.message); client.end(); });
