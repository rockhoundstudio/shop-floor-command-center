const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://command_center_db_io6q_user:qO70Q4yIuDVWTnDUz5Lp3e5PGpX5VcP0@dpg-d7n8gshj2pic738mtbf0-a.oregon-postgres.render.com/command_center_db_io6q?sslmode=no-verify', ssl: { rejectUnauthorized: false } });
client.connect().then(() => client.query('SELECT "stoneName" FROM "StoneProfile" ORDER BY "stoneName"')).then(r => { r.rows.forEach(row => console.log(row.stoneName)); client.end(); }).catch(e => { console.error(e.message); client.end(); });
