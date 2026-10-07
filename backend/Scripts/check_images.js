const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgres://neondb_owner:npg_wIWrXLJV9fF3@ep-sparkling-leaf-b3evey2y.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
  });

  await client.connect();
  console.log('Connected to Neon PostgreSQL.');

  const result = await client.query(`
    SELECT 
      "Id",
      "Name",
      CASE 
        WHEN "ImageUrl" IS NULL THEN 'NULL (no image)'
        WHEN "ImageUrl" = '' THEN 'EMPTY STRING'
        WHEN LENGTH("ImageUrl") > 100 THEN 'BASE64 DATA (' || LENGTH("ImageUrl") || ' chars) - TOO LARGE FOR DB!'
        ELSE 'URL: ' || "ImageUrl"
      END as image_status
    FROM jamin_projects
    ORDER BY "Id"
  `);

  if (result.rows.length === 0) {
    console.log('No projects found in database.');
  } else {
    console.log('\n=== PROJECT IMAGE STATUS IN DATABASE ===');
    result.rows.forEach(row => {
      console.log(`  ID: ${row.Id}  |  Name: ${row.Name}`);
      console.log(`  Image: ${row.image_status}`);
      console.log('');
    });
  }

  await client.end();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
