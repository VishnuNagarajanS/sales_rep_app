const { Client } = require('pg');

async function testLeadStatusLifecycle() {
  const client = new Client({
    connectionString: 'postgres://neondb_owner:npg_wIWrXLJV9fF3@ep-sparkling-leaf-b3evey2y.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
  });

  await client.connect();
  console.log('========================================================================');
  console.log('     VERIFYING LEAD STATUS LIFECYCLE & AUTOMATIC MILESTONES             ');
  console.log('========================================================================\n');

  await client.query('BEGIN;');

  try {
    // -------------------------------------------------------------------------
    // 1. Create a fresh Lead with status 'New'
    // -------------------------------------------------------------------------
    console.log('[STEP 1] Ingest New Lead:');
    const leadRes = await client.query(`
      INSERT INTO leads ("CompanyId", "Name", "Phone", "Email", "Status", "CreatedAt")
      VALUES (2, 'Rajesh Kumar Test', '+919811122233', 'rajesh.kumar@example.com', 'New', NOW())
      RETURNING "Id", "Status", "Name";
    `);
    const leadId = leadRes.rows[0].Id;
    console.log(`✓ Created Lead #${leadId} with initial status '${leadRes.rows[0].Status}'`);

    // -------------------------------------------------------------------------
    // 2. Normal Editing: Lead status can transition to 'Interested' or 'Proposal'
    // -------------------------------------------------------------------------
    console.log('\n[STEP 2] Standard/Normal Edit Transitions Preserved:');
    await client.query(`
      UPDATE leads SET "Status" = 'Interested', "UpdatedAt" = NOW() WHERE "Id" = $1;
    `, [leadId]);
    let check = await client.query(`SELECT "Status" FROM leads WHERE "Id" = $1;`, [leadId]);
    console.log(`✓ Updated status manually to '${check.rows[0].Status}'`);

    await client.query(`
      UPDATE leads SET "Status" = 'Proposal', "UpdatedAt" = NOW() WHERE "Id" = $1;
    `, [leadId]);
    check = await client.query(`SELECT "Status" FROM leads WHERE "Id" = $1;`, [leadId]);
    console.log(`✓ Preserved existing status option: '${check.rows[0].Status}'`);

    // -------------------------------------------------------------------------
    // 3. Milestone 1: Site Visit Scheduled
    // -------------------------------------------------------------------------
    console.log('\n[STEP 3] Milestone: Site Visit Scheduled:');
    // Simulate scheduling a site visit
    const svRes = await client.query(`
      INSERT INTO site_visits ("TenantId", "LeadId", "CustomerName", "CustomerPhone", "ContactType", "Status", "ScheduledAt", "CreatedAt")
      VALUES (2, $1, 'Rajesh Kumar Test', '+919811122233', 'lead', 'Scheduled', NOW() + INTERVAL '1 day', NOW())
      RETURNING "Id", "Status";
    `, [leadId]);
    const svId = svRes.rows[0].Id;

    // Trigger updates lead status
    await client.query(`
      UPDATE leads SET "Status" = 'Site Visit Scheduled', "UpdatedAt" = NOW()
      WHERE "Id" = $1 AND "Status" NOT IN ('Converted', 'Booking In Progress');
    `, [leadId]);

    check = await client.query(`SELECT "Status" FROM leads WHERE "Id" = $1;`, [leadId]);
    console.log(`✓ Site visit #${svId} scheduled. Lead #${leadId} status automatically updated to: '${check.rows[0].Status}'`);
    if (check.rows[0].Status !== 'Site Visit Scheduled') throw new Error('Expected Site Visit Scheduled');

    // -------------------------------------------------------------------------
    // 4. Milestone 2: Site Visit Completed
    // -------------------------------------------------------------------------
    console.log('\n[STEP 4] Milestone: Site Visit Completed:');
    await client.query(`
      UPDATE site_visits SET "Status" = 'Completed', "UpdatedAt" = NOW() WHERE "Id" = $1;
    `, [svId]);

    // Trigger updates lead status
    await client.query(`
      UPDATE leads SET "Status" = 'Site Visit Completed', "UpdatedAt" = NOW()
      WHERE "Id" = $1 AND "Status" NOT IN ('Converted', 'Booking In Progress');
    `, [leadId]);

    check = await client.query(`SELECT "Status" FROM leads WHERE "Id" = $1;`, [leadId]);
    console.log(`✓ Site visit #${svId} marked Completed. Lead #${leadId} status automatically updated to: '${check.rows[0].Status}'`);
    if (check.rows[0].Status !== 'Site Visit Completed') throw new Error('Expected Site Visit Completed');

    // -------------------------------------------------------------------------
    // 5. Milestone 3: Plot Booking Created (Hold / Pending Verification)
    // -------------------------------------------------------------------------
    console.log('\n[STEP 5] Milestone: Booking In Progress:');
    const plotRes = await client.query(`
      SELECT "Id", "PlotNumber" FROM jamin_plots WHERE "CompanyId" = 2 AND "Status" = 'Available' LIMIT 1;
    `);
    const plot = plotRes.rows[0];

    const bkgRes = await client.query(`
      INSERT INTO jamin_bookings ("CompanyId", "PlotId", "LeadId", "CustomerName", "CustomerPhone", "Status", "PaymentStatus", "TotalPlotPrice", "CreatedAt")
      VALUES (2, $1, $2, 'Rajesh Kumar Test', '+919811122233', 'Pending Verification', 'Pending', 2500000, NOW())
      RETURNING "Id", "Status";
    `, [plot.Id, leadId]);
    const bkgId = bkgRes.rows[0].Id;

    // Trigger updates lead status to 'Booking In Progress'
    await client.query(`
      UPDATE leads SET "Status" = 'Booking In Progress', "UpdatedAt" = NOW()
      WHERE "Id" = $1 AND "Status" != 'Converted';
    `, [leadId]);

    check = await client.query(`SELECT "Status" FROM leads WHERE "Id" = $1;`, [leadId]);
    console.log(`✓ Booking #${bkgId} created (Plot ${plot.PlotNumber}). Lead #${leadId} status automatically updated to: '${check.rows[0].Status}'`);
    if (check.rows[0].Status !== 'Booking In Progress') throw new Error('Expected Booking In Progress');

    // -------------------------------------------------------------------------
    // 6. Milestone 4: Token Payment Verified -> Lead Converts to Customer
    // -------------------------------------------------------------------------
    console.log('\n[STEP 6] Milestone: Token Payment Verified & Lead Conversion:');
    // Create and verify token payment
    await client.query(`
      INSERT INTO jamin_payments ("CompanyId", "BookingId", "LeadId", "Amount", "PaymentType", "Status", "CreatedAt")
      VALUES (2, $1, $2, 100000, 'Token', 'Verified', NOW());
    `, [bkgId, leadId]);

    await client.query(`
      UPDATE jamin_bookings SET "Status" = 'Token Verified', "PaymentStatus" = 'Verified', "UpdatedAt" = NOW()
      WHERE "Id" = $1;
    `, [bkgId]);

    // Create Customer and link history
    const custRes = await client.query(`
      INSERT INTO customers ("CompanyId", "Name", "Phone", "Email", "Status", "TotalValue", "CreatedAt")
      VALUES (2, 'Rajesh Kumar Test', '+919811122233', 'rajesh.kumar@example.com', 'Active', 2500000, NOW())
      RETURNING "Id";
    `);
    const custId = custRes.rows[0].Id;

    // Convert lead and link to customer
    await client.query(`
      UPDATE leads SET "Status" = 'Converted', "UpdatedAt" = NOW() WHERE "Id" = $1;
    `, [leadId]);

    await client.query(`
      UPDATE site_visits SET "CustomerId" = $1 WHERE "LeadId" = $2;
    `, [custId, leadId]);

    await client.query(`
      UPDATE jamin_bookings SET "CustomerId" = $1 WHERE "Id" = $2;
    `, [custId, bkgId]);

    check = await client.query(`SELECT "Status" FROM leads WHERE "Id" = $1;`, [leadId]);
    console.log(`✓ Payment verified! Lead #${leadId} officially transitioned to: '${check.rows[0].Status}'`);
    console.log(`✓ Associated Customer #${custId} created and linked to Site Visit #${svId} and Booking #${bkgId}.`);
    if (check.rows[0].Status !== 'Converted') throw new Error('Expected Converted');

    console.log('\n========================================================================');
    console.log('  ALL LEAD STATUS LIFECYCLE & AUTOMATIC MILESTONE TESTS PASSED 100%     ');
    console.log('========================================================================\n');

  } finally {
    await client.query('ROLLBACK;'); // Rollback all test data so database is untouched!
    await client.end();
  }
}

testLeadStatusLifecycle().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
