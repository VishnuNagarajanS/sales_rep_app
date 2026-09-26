const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_wIWrXLJV9fF3@ep-sparkling-leaf-b3evey2y.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
});

const sql = `
-- 1. PropertyProjects (Jamin Bazaar)
CREATE TABLE IF NOT EXISTS "PropertyProjects" (
    "Id" TEXT PRIMARY KEY,
    "CompanyId" TEXT NOT NULL DEFAULT 't-jamin-02',
    "Name" TEXT NOT NULL,
    "Location" TEXT NOT NULL,
    "Status" TEXT NOT NULL DEFAULT 'Active',
    "TotalPlots" INT NOT NULL DEFAULT 0,
    "AvailablePlots" INT NOT NULL DEFAULT 0,
    "HoldPlots" INT NOT NULL DEFAULT 0,
    "SoldPlots" INT NOT NULL DEFAULT 0,
    "Description" TEXT NOT NULL DEFAULT '',
    "PriceRange" TEXT NOT NULL DEFAULT '',
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMPTZ
);

-- 2. Plots (Jamin Bazaar)
CREATE TABLE IF NOT EXISTS "Plots" (
    "Id" TEXT PRIMARY KEY,
    "ProjectId" TEXT NOT NULL,
    "ProjectName" TEXT NOT NULL,
    "PlotNumber" TEXT NOT NULL,
    "SizeSqft" NUMERIC NOT NULL DEFAULT 0,
    "PricePerSqft" NUMERIC NOT NULL DEFAULT 0,
    "TotalPrice" NUMERIC NOT NULL DEFAULT 0,
    "Status" TEXT NOT NULL DEFAULT 'Available',
    "Dimension" TEXT,
    "Facing" TEXT,
    "HoldByCustomer" TEXT,
    "HoldByAgent" TEXT,
    "HoldExpiry" TEXT,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMPTZ
);

-- 3. SiteVisits (Jamin Bazaar)
CREATE TABLE IF NOT EXISTS "SiteVisits" (
    "Id" TEXT PRIMARY KEY,
    "CompanyId" TEXT NOT NULL,
    "CustomerId" TEXT NOT NULL,
    "CustomerName" TEXT NOT NULL,
    "CustomerPhone" TEXT NOT NULL,
    "ProjectId" TEXT NOT NULL,
    "ProjectName" TEXT NOT NULL,
    "PlotNumber" TEXT,
    "ScheduledAt" TEXT NOT NULL,
    "AssignedAgentId" TEXT NOT NULL,
    "AssignedAgentName" TEXT NOT NULL,
    "Status" TEXT NOT NULL DEFAULT 'Scheduled',
    "OutcomeNotes" TEXT,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMPTZ
);

-- 4. Bookings (Jamin Bazaar)
CREATE TABLE IF NOT EXISTS "Bookings" (
    "Id" TEXT PRIMARY KEY,
    "CompanyId" TEXT NOT NULL,
    "CustomerId" TEXT NOT NULL,
    "CustomerName" TEXT NOT NULL,
    "CustomerPhone" TEXT NOT NULL,
    "ProjectId" TEXT NOT NULL,
    "ProjectName" TEXT NOT NULL,
    "PlotId" TEXT NOT NULL,
    "PlotNumber" TEXT NOT NULL,
    "BookingDate" TEXT NOT NULL,
    "BookingAmount" NUMERIC NOT NULL DEFAULT 0,
    "TotalAmount" NUMERIC NOT NULL DEFAULT 0,
    "Status" TEXT NOT NULL DEFAULT 'Pending',
    "AgentId" TEXT NOT NULL,
    "AgentName" TEXT NOT NULL,
    "PaymentTerms" TEXT NOT NULL DEFAULT '',
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMPTZ
);

-- 5. DocumentItems
CREATE TABLE IF NOT EXISTS "DocumentItems" (
    "Id" TEXT PRIMARY KEY,
    "Name" TEXT NOT NULL,
    "Size" TEXT NOT NULL DEFAULT '0 KB',
    "Type" TEXT NOT NULL DEFAULT 'application/pdf',
    "UploadedBy" TEXT NOT NULL DEFAULT 'System',
    "UploadedAt" TEXT NOT NULL,
    "Category" TEXT NOT NULL DEFAULT 'General',
    "EntityType" TEXT,
    "EntityId" TEXT,
    "CompanyId" TEXT,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. AppEntityRecords (for custom field definitions, departments, teams, queues, routing rules, lead assignments, agent presence, routing attempts, products/services)
CREATE TABLE IF NOT EXISTS "AppEntityRecords" (
    "EntityType" TEXT NOT NULL,
    "EntityId" TEXT NOT NULL,
    "CompanyId" TEXT NOT NULL DEFAULT '',
    "Payload" JSONB NOT NULL,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMPTZ,
    PRIMARY KEY ("EntityType", "EntityId")
);

CREATE INDEX IF NOT EXISTS "IX_AppEntityRecords_EntityType_CompanyId" ON "AppEntityRecords" ("EntityType", "CompanyId");
CREATE INDEX IF NOT EXISTS "IX_PropertyProjects_CompanyId" ON "PropertyProjects" ("CompanyId");
CREATE INDEX IF NOT EXISTS "IX_Plots_ProjectId" ON "Plots" ("ProjectId");
CREATE INDEX IF NOT EXISTS "IX_SiteVisits_CompanyId" ON "SiteVisits" ("CompanyId");
CREATE INDEX IF NOT EXISTS "IX_Bookings_CompanyId" ON "Bookings" ("CompanyId");
`;

client.connect().then(async () => {
  console.log('Running DDL script to create missing business tables...');
  await client.query(sql);
  console.log('Tables created successfully!');
  await client.end();
}).catch(err => {
  console.error('Error creating tables:', err);
  process.exit(1);
});
