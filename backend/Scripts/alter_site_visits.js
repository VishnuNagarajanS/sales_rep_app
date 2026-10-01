const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgres://neondb_owner:npg_wIWrXLJV9fF3@ep-sparkling-leaf-b3evey2y.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
  });

  await client.connect();
  console.log('Connected to Neon PostgreSQL.');

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'site_visits' 
          AND column_name = 'CustomerId'
      ) THEN
        ALTER TABLE site_visits ADD COLUMN "CustomerId" integer;
        ALTER TABLE site_visits ADD CONSTRAINT "FK_site_visits_customers_CustomerId" 
          FOREIGN KEY ("CustomerId") REFERENCES customers ("Id") ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS "IX_site_visits_CustomerId" ON site_visits ("CustomerId");
        RAISE NOTICE 'Added CustomerId to site_visits';
      END IF;
    END $$;
  `);

  console.log('Successfully updated site_visits schema in Neon PostgreSQL.');
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
