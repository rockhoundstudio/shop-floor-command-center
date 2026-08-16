import pg from 'pg';
const client = new pg.Client({connectionString: 'postgresql://command_center_db_io6q_user:qO70Q4yIuDVWTnDUz5Lp3e5PGpX5VcP0@dpg-d7n8gshj2pic738mtbf0-a.oregon-postgres.render.com/command_center_db_io6q?sslmode=require'});
client.connect().then(() => client.query('SELECT * FROM "StoneProfile" LIMIT 2').then(r => { console.log(JSON.stringify(r.rows)); client.end(); })).catch(e => console.log(e.message));
