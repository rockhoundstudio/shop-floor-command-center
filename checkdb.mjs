import pg from 'pg';
const DB = 'postgresql://command_center_db_io6q_user:qO70Q4yIuDVWTnDUz5Lp3e5PGpX5VcP0@dpg-d7n8gshj2pic738mtbf0-a.oregon-postgres.render.com/command_center_db_io6q?sslmode=require';
const client = new pg.Client({connectionString: DB});
const sql = 'SELECT * FROM "StoneCache" LIMIT 2';
client.connect()
  .then(() => client.query(sql))
  .then(r => { console.log(JSON.stringify(r.rows)); client.end(); })
  .catch(e => console.log(e.message));
