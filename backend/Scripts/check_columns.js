const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgres://neondb_owner:npg_wIWrXLJV9fF3@ep-sparkling-leaf-b3evey2y.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
  });

  await client.connect();
  const res = await client.query("SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = 'jamin_projects' ORDER BY ordinal_position;");
  console.log(JSON.stringify(res.rows, null, 2));

  const countRes = await client.query('SELECT count(*) FROM jamin_projects;');
  console.log('Project count:', countRes.rows[0].count);

  const projects = await client.query('SELECT "Id", "Name", "TotalPlots", "AvailablePlots", "BookedPlots", length("ImageUrl") as img_len FROM jamin_projects LIMIT 5;');
  console.log('Projects:', projects.rows);

  await client.end();
}

main().catch(console.error);
