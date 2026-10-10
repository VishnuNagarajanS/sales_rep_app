using backend.Extensions;
using backend.Middleware;
using backend.Models.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Load .env if present in root directory
var envFilePath = Path.Combine(builder.Environment.ContentRootPath, ".env");
if (File.Exists(envFilePath))
{
    foreach (var line in File.ReadAllLines(envFilePath))
    {
        var trimmed = line.Trim();
        if (string.IsNullOrWhiteSpace(trimmed) || trimmed.StartsWith("#")) continue;
        var separatorIdx = trimmed.IndexOf('=');
        if (separatorIdx > 0)
        {
            var key = trimmed.Substring(0, separatorIdx).Trim();
            var value = trimmed.Substring(separatorIdx + 1).Trim().Trim('"', '\'');
            Environment.SetEnvironmentVariable(key, value);
        }
    }
}
builder.Configuration.AddEnvironmentVariables();

// 1. Add Controllers
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.Converters.Add(new FlexibleDateTimeConverter());
        options.JsonSerializerOptions.Converters.Add(new FlexibleNullableDateTimeConverter());
    });

// 2. Add Layered Application Services & DbContext
builder.Services.AddApplicationServices(builder.Configuration);
builder.Services.AddHostedService<backend.Services.Implementations.JaminHoldExpiryBackgroundService>();

// 3. Add JWT Authentication & Authorization
builder.Services.AddJwtAuthentication(builder.Configuration);
builder.Services.AddAuthorization();

// 4. Configure CORS
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() 
                     ?? new[] { "http://localhost:5173", "http://localhost:3000" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("DefaultCorsPolicy", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// 5. Configure Swagger with JWT Bearer UI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "NexusSales Platform API",
        Version = "v1",
        Description = "Customer Sales Executive Management Platform & Real-Time Calling Engine API"
    });

    c.CustomSchemaIds(type => type.FullName?.Replace("+", ".") ?? type.Name);

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter: Bearer {token}",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
    var useInMemory = config.GetValue<bool>("UseInMemoryDatabase", false);
    var db = scope.ServiceProvider.GetRequiredService<backend.Data.ApplicationDbContext>();
    if (useInMemory)
    {
        db.Database.EnsureCreated();
    }
    else
    {
        try
        {
            if (db.Database.GetPendingMigrations().Any())
            {
                db.Database.Migrate();
            }
        }
        catch (Exception migrateEx)
        {
            Console.WriteLine($"[Database Migration Warning] {migrateEx.Message}");
        }

        // Schema Auto-Patch: Ensure any added entity columns exist in PostgreSQL tables
        try
        {
            var alterQueries = new[]
            {
                @"ALTER TABLE IF EXISTS ""leads"" ADD COLUMN IF NOT EXISTS ""ReadyToRegister"" VARCHAR(100);",
                @"ALTER TABLE IF EXISTS ""leads"" ADD COLUMN IF NOT EXISTS ""TargetDevelopment"" VARCHAR(200);",
                @"ALTER TABLE IF EXISTS ""leads"" ADD COLUMN IF NOT EXISTS ""BudgetRange"" VARCHAR(100);",
                @"ALTER TABLE IF EXISTS ""leads"" ADD COLUMN IF NOT EXISTS ""InvestmentCapacity"" VARCHAR(100);",
                @"ALTER TABLE IF EXISTS ""leads"" ADD COLUMN IF NOT EXISTS ""AssetClass"" VARCHAR(100);",
                @"ALTER TABLE IF EXISTS ""leads"" ADD COLUMN IF NOT EXISTS ""Horizon"" VARCHAR(100);",
                @"ALTER TABLE IF EXISTS ""leads"" ADD COLUMN IF NOT EXISTS ""InvestorType"" VARCHAR(100);",
                @"ALTER TABLE IF EXISTS ""leads"" ADD COLUMN IF NOT EXISTS ""CustomFieldsJson"" TEXT;",
                @"ALTER TABLE IF EXISTS ""leads"" ADD COLUMN IF NOT EXISTS ""PreferredVisitDate"" VARCHAR(100);",
                @"ALTER TABLE IF EXISTS ""leads"" ADD COLUMN IF NOT EXISTS ""PreferredTimeSlot"" VARCHAR(100);",
                @"ALTER TABLE IF EXISTS ""leads"" ADD COLUMN IF NOT EXISTS ""AnythingWeShouldKnow"" VARCHAR(2000);",
                @"ALTER TABLE IF EXISTS ""leads"" ADD COLUMN IF NOT EXISTS ""WhatAreYouLookingFor"" VARCHAR(2000);",
                @"ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS ""ReadyToRegister"" VARCHAR(100);",
                @"ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS ""TargetDevelopment"" VARCHAR(200);",
                @"ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS ""BudgetRange"" VARCHAR(100);",
                @"ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS ""InvestmentCapacity"" VARCHAR(100);",
                @"ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS ""AssetClass"" VARCHAR(100);",
                @"ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS ""Horizon"" VARCHAR(100);",
                @"ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS ""InvestorType"" VARCHAR(100);",
                @"ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS ""CustomFieldsJson"" TEXT;",
                @"ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS ""PreferredVisitDate"" VARCHAR(100);",
                @"ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS ""PreferredTimeSlot"" VARCHAR(100);",
                @"ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS ""AnythingWeShouldKnow"" VARCHAR(2000);",
                @"ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS ""WhatAreYouLookingFor"" VARCHAR(2000);",
                @"ALTER TABLE IF EXISTS ""followups"" ADD COLUMN IF NOT EXISTS ""FollowupType"" VARCHAR(50);",
                @"ALTER TABLE IF EXISTS followups ADD COLUMN IF NOT EXISTS ""FollowupType"" VARCHAR(50);",
                @"ALTER TABLE IF EXISTS ""followups"" ADD COLUMN IF NOT EXISTS ""LeadId"" integer;",
                @"ALTER TABLE IF EXISTS ""followups"" ADD COLUMN IF NOT EXISTS ""CustomerId"" integer;",
                @"ALTER TABLE IF EXISTS followups ADD COLUMN IF NOT EXISTS ""LeadId"" integer;",
                @"ALTER TABLE IF EXISTS followups ADD COLUMN IF NOT EXISTS ""CustomerId"" integer;",
                @"CREATE INDEX IF NOT EXISTS ""IX_followups_LeadId"" ON ""followups"" (""LeadId"");",
                @"CREATE INDEX IF NOT EXISTS ""IX_followups_CustomerId"" ON ""followups"" (""CustomerId"");",

                @"ALTER TABLE IF EXISTS ""site_visits"" ADD COLUMN IF NOT EXISTS ""LeadId"" integer;",
                @"ALTER TABLE IF EXISTS ""site_visits"" ADD COLUMN IF NOT EXISTS ""CustomerId"" integer;",
                @"ALTER TABLE IF EXISTS site_visits ADD COLUMN IF NOT EXISTS ""LeadId"" integer;",
                @"ALTER TABLE IF EXISTS site_visits ADD COLUMN IF NOT EXISTS ""CustomerId"" integer;",
                @"CREATE INDEX IF NOT EXISTS ""IX_site_visits_LeadId"" ON ""site_visits"" (""LeadId"");",
                @"CREATE INDEX IF NOT EXISTS ""IX_site_visits_CustomerId"" ON ""site_visits"" (""CustomerId"");",

                @"ALTER TABLE IF EXISTS ""jamin_bookings"" ADD COLUMN IF NOT EXISTS ""LeadId"" integer;",
                @"ALTER TABLE IF EXISTS ""jamin_bookings"" ADD COLUMN IF NOT EXISTS ""CustomerId"" integer;",
                @"ALTER TABLE IF EXISTS jamin_bookings ADD COLUMN IF NOT EXISTS ""LeadId"" integer;",
                @"ALTER TABLE IF EXISTS jamin_bookings ADD COLUMN IF NOT EXISTS ""CustomerId"" integer;",
                @"CREATE INDEX IF NOT EXISTS ""IX_jamin_bookings_LeadId"" ON ""jamin_bookings"" (""LeadId"");",
                @"CREATE INDEX IF NOT EXISTS ""IX_jamin_bookings_CustomerId"" ON ""jamin_bookings"" (""CustomerId"");",

                @"ALTER TABLE IF EXISTS ""call_records"" ADD COLUMN IF NOT EXISTS ""LeadId"" integer;",
                @"ALTER TABLE IF EXISTS ""call_records"" ADD COLUMN IF NOT EXISTS ""CustomerId"" integer;",
                @"ALTER TABLE IF EXISTS call_records ADD COLUMN IF NOT EXISTS ""LeadId"" integer;",
                @"ALTER TABLE IF EXISTS call_records ADD COLUMN IF NOT EXISTS ""CustomerId"" integer;",
                @"CREATE INDEX IF NOT EXISTS ""IX_call_records_LeadId"" ON ""call_records"" (""LeadId"");",
                @"CREATE INDEX IF NOT EXISTS ""IX_call_records_CustomerId"" ON ""call_records"" (""CustomerId"");",

                @"ALTER TABLE IF EXISTS ""Notifications"" ADD COLUMN IF NOT EXISTS ""LeadId"" integer;",
                @"ALTER TABLE IF EXISTS ""Notifications"" ADD COLUMN IF NOT EXISTS ""CustomerId"" integer;",
                @"ALTER TABLE IF EXISTS ""notifications"" ADD COLUMN IF NOT EXISTS ""LeadId"" integer;",
                @"ALTER TABLE IF EXISTS ""notifications"" ADD COLUMN IF NOT EXISTS ""CustomerId"" integer;",
                @"CREATE INDEX IF NOT EXISTS ""IX_Notifications_LeadId"" ON ""Notifications"" (""LeadId"");",
                @"CREATE INDEX IF NOT EXISTS ""IX_Notifications_CustomerId"" ON ""Notifications"" (""CustomerId"");",

                @"ALTER TABLE IF EXISTS ""AuditLogs"" ADD COLUMN IF NOT EXISTS ""LeadId"" integer;",
                @"ALTER TABLE IF EXISTS ""AuditLogs"" ADD COLUMN IF NOT EXISTS ""CustomerId"" integer;",
                @"ALTER TABLE IF EXISTS ""audit_logs"" ADD COLUMN IF NOT EXISTS ""LeadId"" integer;",
                @"ALTER TABLE IF EXISTS ""audit_logs"" ADD COLUMN IF NOT EXISTS ""CustomerId"" integer;",
                @"CREATE INDEX IF NOT EXISTS ""IX_AuditLogs_LeadId"" ON ""AuditLogs"" (""LeadId"");",
                @"CREATE INDEX IF NOT EXISTS ""IX_AuditLogs_CustomerId"" ON ""AuditLogs"" (""CustomerId"");",

                // Allow storing full Base64 image data for project master layout blueprints
                @"ALTER TABLE IF EXISTS jamin_projects ALTER COLUMN ""ImageUrl"" TYPE TEXT;",

                // Jamin Bookings: Separate PaymentStatus, Financial Breakdown, and Cancellation Audit
                @"ALTER TABLE IF EXISTS jamin_bookings ADD COLUMN IF NOT EXISTS ""PaymentStatus"" VARCHAR(50) NOT NULL DEFAULT 'Pending';",
                @"ALTER TABLE IF EXISTS jamin_bookings ADD COLUMN IF NOT EXISTS ""HoldExpiresAt"" timestamp with time zone;",
                @"ALTER TABLE IF EXISTS jamin_bookings ADD COLUMN IF NOT EXISTS ""BasePrice"" numeric(18,2) NOT NULL DEFAULT 0;",
                @"ALTER TABLE IF EXISTS jamin_bookings ADD COLUMN IF NOT EXISTS ""DevelopmentCharges"" numeric(18,2) NOT NULL DEFAULT 0;",
                @"ALTER TABLE IF EXISTS jamin_bookings ADD COLUMN IF NOT EXISTS ""ApprovedDiscounts"" numeric(18,2) NOT NULL DEFAULT 0;",
                @"ALTER TABLE IF EXISTS jamin_bookings ADD COLUMN IF NOT EXISTS ""CancelledAt"" timestamp with time zone;",
                @"ALTER TABLE IF EXISTS jamin_bookings ADD COLUMN IF NOT EXISTS ""CancelledByUserId"" integer;",
                @"ALTER TABLE IF EXISTS jamin_bookings ADD COLUMN IF NOT EXISTS ""CancelledByName"" VARCHAR(150);",
                @"ALTER TABLE IF EXISTS jamin_bookings ADD COLUMN IF NOT EXISTS ""CancellationReason"" VARCHAR(2000);",
                @"ALTER TABLE IF EXISTS jamin_bookings ADD COLUMN IF NOT EXISTS ""RefundAmount"" numeric(18,2) NOT NULL DEFAULT 0;",

                // Guard foreign key constraint for CancelledByUserId
                @"DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.table_constraints 
                        WHERE constraint_schema = 'public' AND table_name = 'jamin_bookings' AND constraint_name = 'FK_jamin_bookings_users_CancelledByUserId'
                    ) THEN
                        ALTER TABLE jamin_bookings ADD CONSTRAINT ""FK_jamin_bookings_users_CancelledByUserId"" 
                            FOREIGN KEY (""CancelledByUserId"") REFERENCES users (""Id"") ON DELETE SET NULL;
                    END IF;
                END $$;",

                // PostgreSQL Partial Index: Verify if legacy duplicates exist before enforcing UNIQUE
                @"DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_indexes 
                        WHERE schemaname = 'public' AND tablename = 'jamin_bookings' AND indexname = 'IX_jamin_bookings_CompanyId_PlotId_Active'
                    ) THEN
                        IF NOT EXISTS (
                            SELECT 1 FROM (
                                SELECT ""CompanyId"", ""PlotId"" 
                                FROM jamin_bookings 
                                WHERE ""PlotId"" IS NOT NULL 
                                  AND ""Status"" IN ('Hold', 'Pending Verification', 'Booking Pending Verification', 'Token Paid', 'Token Verified', 'Agreement Signed', 'Registration Completed')
                                GROUP BY ""CompanyId"", ""PlotId"" 
                                HAVING COUNT(*) > 1
                            ) dupes
                        ) THEN
                            CREATE UNIQUE INDEX ""IX_jamin_bookings_CompanyId_PlotId_Active"" 
                            ON jamin_bookings (""CompanyId"", ""PlotId"") 
                            WHERE ""PlotId"" IS NOT NULL AND ""Status"" IN ('Hold', 'Pending Verification', 'Booking Pending Verification', 'Token Paid', 'Token Verified', 'Agreement Signed', 'Registration Completed');
                        ELSE
                            CREATE INDEX ""IX_jamin_bookings_CompanyId_PlotId_Active"" 
                            ON jamin_bookings (""CompanyId"", ""PlotId"") 
                            WHERE ""PlotId"" IS NOT NULL AND ""Status"" IN ('Hold', 'Pending Verification', 'Booking Pending Verification', 'Token Paid', 'Token Verified', 'Agreement Signed', 'Registration Completed');
                        END IF;
                    END IF;
                END $$;",

                // Jamin Payment Ledger Table (with RESTRICT on BookingId to protect audit history)
                @"CREATE TABLE IF NOT EXISTS jamin_payments (
                    ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    ""CompanyId"" integer NOT NULL,
                    ""BookingId"" integer NOT NULL,
                    ""CustomerId"" integer,
                    ""LeadId"" integer,
                    ""Amount"" numeric(18,2) NOT NULL,
                    ""PaymentType"" character varying(50) NOT NULL DEFAULT 'Token',
                    ""PaymentMode"" character varying(100) NOT NULL DEFAULT 'Bank Transfer / NEFT',
                    ""TransactionReference"" character varying(200) NOT NULL DEFAULT '',
                    ""Status"" character varying(50) NOT NULL DEFAULT 'Pending',
                    ""VerifiedAt"" timestamp with time zone,
                    ""VerifiedByUserId"" integer,
                    ""VerifiedByName"" character varying(150),
                    ""ReceiptNumber"" character varying(100),
                    ""Notes"" character varying(2000),
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT (NOW()),
                    ""UpdatedAt"" timestamp with time zone,
                    CONSTRAINT ""FK_jamin_payments_tenants_CompanyId"" FOREIGN KEY (""CompanyId"") REFERENCES tenants (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_jamin_payments_jamin_bookings_BookingId"" FOREIGN KEY (""BookingId"") REFERENCES jamin_bookings (""Id"") ON DELETE RESTRICT,
                    CONSTRAINT ""FK_jamin_payments_customers_CustomerId"" FOREIGN KEY (""CustomerId"") REFERENCES customers (""Id"") ON DELETE SET NULL,
                    CONSTRAINT ""FK_jamin_payments_leads_LeadId"" FOREIGN KEY (""LeadId"") REFERENCES leads (""Id"") ON DELETE SET NULL,
                    CONSTRAINT ""FK_jamin_payments_users_VerifiedByUserId"" FOREIGN KEY (""VerifiedByUserId"") REFERENCES users (""Id"") ON DELETE SET NULL
                );",
                @"CREATE INDEX IF NOT EXISTS ""IX_jamin_payments_BookingId"" ON jamin_payments (""BookingId"");",
                @"CREATE INDEX IF NOT EXISTS ""IX_jamin_payments_CustomerId"" ON jamin_payments (""CustomerId"");",
                @"CREATE INDEX IF NOT EXISTS ""IX_jamin_payments_LeadId"" ON jamin_payments (""LeadId"");",
                @"CREATE INDEX IF NOT EXISTS ""IX_jamin_payments_Status"" ON jamin_payments (""Status"");"
            };

            foreach (var q in alterQueries)
            {
                try { db.Database.ExecuteSqlRaw(q); } catch { }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Schema Auto-Patch Warning] {ex.Message}");
        }
    }

    // Patch: ensure tenants have EnabledFeatures populated
    try
    {
        var tenants = db.Tenants.ToList();
        bool patched = false;
        foreach (var t in tenants)
        {
            if (t.EnabledFeatures == null || t.EnabledFeatures.Count == 0)
            {
                if (t.Slug == "ghl")
                {
                    t.EnabledFeatures = new List<string>
                    {
                        "leads", "customers", "deals", "followups", "calls", "call-recording",
                        "call-transcription", "investors", "consultations", "investment-opportunities",
                        "reports", "users", "roles", "company-settings", "audit-logs"
                    };
                    patched = true;
                }
                else if (t.Slug == "jamin")
                {
                    t.EnabledFeatures = new List<string>
                    {
                        "leads", "customers", "deals", "followups", "calls", "call-recording",
                        "call-transcription", "properties", "site-visits", "bookings",
                        "reports", "users", "roles", "company-settings", "audit-logs"
                    };
                    patched = true;
                }
            }
        }
        if (patched) db.SaveChanges();
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Tenant Feature Patch Warning] {ex.Message}");
    }

    // Patch: ensure roles have Permissions populated
    try
    {
        var allRoles = db.Roles.ToList();
        bool rolePatched = false;
        var allPerms = new[] {
            "leads.view","leads.create","leads.update","leads.delete","leads.assign","leads.export","leads.import","leads.convert",
            "customers.view","customers.create","customers.update","customers.delete",
            "deals.view","deals.create","deals.update","deals.delete",
            "calls.make","calls.receive","calls.view","calls.recordings.play",
            "followups.view","followups.create","followups.update",
            "properties.view","properties.update","site-visits.view","site-visits.create","bookings.view","bookings.create",
            "investors.view","investors.create","investors.update",
            "consultations.view","consultations.create","consultations.update",
            "opportunities.view","opportunities.create","opportunities.update",
            "reports.view","reports.export",
            "users.view","users.manage","roles.view","settings.view","settings.update","audit.view",
            "chat.view","chat.send","kyc.view","kyc.approve"
        };
        foreach (var role in allRoles)
        {
            if (role.Permissions == null || role.Permissions.Count == 0)
            {
                if (role.Code == "super_admin" || role.Code == "company_admin")
                    role.Permissions = allPerms.ToList();
                else if (role.Code == "irm")
                    role.Permissions = new List<string> {
                        "leads.view","leads.create","investors.view","investors.create","investors.update",
                        "consultations.view","consultations.create","consultations.update",
                        "opportunities.view","opportunities.create","opportunities.update",
                        "calls.make","calls.receive","calls.view","reports.view","chat.view","chat.send"
                    };
                else if (role.Code == "sales_manager")
                    role.Permissions = new List<string> {
                        "leads.view","leads.create","leads.update","leads.assign","leads.export","leads.convert",
                        "customers.view","customers.create","customers.update",
                        "deals.view","deals.create","deals.update",
                        "calls.make","calls.receive","calls.view","calls.recordings.play",
                        "followups.view","followups.create","followups.update",
                        "properties.view","properties.update","site-visits.view","site-visits.create","bookings.view","bookings.create",
                        "investors.view","investors.create","consultations.view","consultations.create","opportunities.view","opportunities.create",
                        "reports.view","reports.export","users.view","chat.view","chat.send"
                    };
                else // sales_executive
                    role.Permissions = new List<string> {
                        "leads.view","leads.create","leads.update","leads.convert",
                        "customers.view","customers.create","customers.update",
                        "deals.view","deals.create","deals.update",
                        "calls.make","calls.receive","calls.view",
                        "followups.view","followups.create","followups.update","chat.view","chat.send"
                    };
                rolePatched = true;
            }
        }
        if (rolePatched) db.SaveChanges();
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Role Permissions Patch Warning] {ex.Message}");
    }

    // Patch: ensure real sample follow-ups exist in PostgreSQL if table is empty
    try
    {
        if (!db.Followups.Any())
        {
            var leads = db.Leads.Take(10).ToList();
            var customers = db.Customers.Take(10).ToList();
            var users = db.Users.ToList();

            var seedFollowups = new List<backend.Models.Entities.Followup>();

            // 1. GHL Lead follow-up
            var ghlLead = leads.FirstOrDefault(l => l.CompanyId == 1);
            var ghlAgent = users.FirstOrDefault(u => u.CompanyId == 1 && u.RoleId == 4)
                        ?? users.FirstOrDefault(u => u.CompanyId == 1)
                        ?? users.FirstOrDefault();
            if (ghlLead != null)
            {
                seedFollowups.Add(new backend.Models.Entities.Followup
                {
                    CompanyId = 1,
                    AssignedAgentId = ghlAgent?.Id,
                    AssignedToName = ghlAgent?.Name ?? "Naveen",
                    AssignedToRole = "sales_executive",
                    ContactId = ghlLead.Id.ToString(),
                    ContactType = "lead",
                    ContactName = ghlLead.Name,
                    ContactPhone = ghlLead.Phone,
                    ScheduledAt = DateTime.UtcNow.AddDays(1).Date.AddHours(11), // Tomorrow 11:00 AM UTC
                    Priority = "High",
                    Status = backend.Models.Enums.FollowupStatus.Pending,
                    Notes = "Discussion on portfolio allocation and investment ticket size",
                    FollowupType = "call",
                    CreatedAt = DateTime.UtcNow
                });
            }

            // 2. GHL Customer follow-up
            var ghlCust = customers.FirstOrDefault(c => c.CompanyId == 1);
            if (ghlCust != null)
            {
                seedFollowups.Add(new backend.Models.Entities.Followup
                {
                    CompanyId = 1,
                    AssignedAgentId = ghlAgent?.Id,
                    AssignedToName = ghlAgent?.Name ?? "Naveen",
                    AssignedToRole = "sales_executive",
                    ContactId = ghlCust.Id.ToString(),
                    ContactType = "customer",
                    ContactName = ghlCust.Name,
                    ContactPhone = ghlCust.Phone,
                    ScheduledAt = DateTime.UtcNow.AddDays(2).Date.AddHours(14), // In 2 days 2:00 PM UTC
                    Priority = "Medium",
                    Status = backend.Models.Enums.FollowupStatus.Pending,
                    Notes = "Quarterly wealth check-in and investment strategy review",
                    FollowupType = "meeting",
                    CreatedAt = DateTime.UtcNow
                });
            }

            // 3. Jamin Lead follow-up
            var jaminLead = leads.FirstOrDefault(l => l.CompanyId == 2);
            var jaminAgent = users.FirstOrDefault(u => u.CompanyId == 2 && u.RoleId == 4)
                          ?? users.FirstOrDefault(u => u.CompanyId == 2)
                          ?? users.FirstOrDefault();
            if (jaminLead != null)
            {
                seedFollowups.Add(new backend.Models.Entities.Followup
                {
                    CompanyId = 2,
                    AssignedAgentId = jaminAgent?.Id,
                    AssignedToName = jaminAgent?.Name ?? "Rajesh Sharma",
                    AssignedToRole = "sales_executive",
                    ContactId = jaminLead.Id.ToString(),
                    ContactType = "lead",
                    ContactName = jaminLead.Name,
                    ContactPhone = jaminLead.Phone,
                    ScheduledAt = DateTime.UtcNow.AddHours(18),
                    Priority = "High",
                    Status = backend.Models.Enums.FollowupStatus.Pending,
                    Notes = string.Empty,
                    FollowupType = "whatsapp",
                    CreatedAt = DateTime.UtcNow
                });
            }

            // 4. Completed follow-up record for audit history
            if (ghlLead != null)
            {
                seedFollowups.Add(new backend.Models.Entities.Followup
                {
                    CompanyId = 1,
                    AssignedAgentId = ghlAgent?.Id,
                    AssignedToName = ghlAgent?.Name ?? "Naveen",
                    AssignedToRole = "sales_executive",
                    ContactId = ghlLead.Id.ToString(),
                    ContactType = "lead",
                    ContactName = ghlLead.Name,
                    ContactPhone = ghlLead.Phone,
                    ScheduledAt = DateTime.UtcNow.AddDays(-2),
                    Priority = "Medium",
                    Status = backend.Models.Enums.FollowupStatus.Completed,
                    CompletedAt = DateTime.UtcNow.AddDays(-2).AddMinutes(35),
                    Notes = "Initial introductory call completed successfully",
                    FollowupType = "call",
                    CreatedAt = DateTime.UtcNow.AddDays(-3)
                });
            }

            if (seedFollowups.Any())
            {
                db.Followups.AddRange(seedFollowups);
                db.SaveChanges();
            }
        }
    }
    catch (Exception seedEx)
    {
        Console.WriteLine($"[Followups Seeder Warning] {seedEx.Message}");
    }
}

// Global Exception Handling Middleware
app.UseMiddleware<ExceptionHandlingMiddleware>();

// Configure Swagger
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "NexusSales API v1");
    c.RoutePrefix = "swagger";
});

if (app.Environment.IsDevelopment())
{
    // Automatically open Swagger in default browser on startup
    app.Lifetime.ApplicationStarted.Register(() =>
    {
        var address = app.Urls.FirstOrDefault() ?? "http://localhost:5106";
        var swaggerUrl = $"{address.TrimEnd('/')}/swagger";
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = swaggerUrl,
                UseShellExecute = true
            });
        }
        catch { }
    });
}

app.UseCors("DefaultCorsPolicy");

app.UseAuthentication();
app.UseMiddleware<RequestLoggingMiddleware>();
app.UseAuthorization();

app.MapControllers();

app.Run();

/// <summary>
/// Custom DateTime converter that gracefully parses ISO 8601 strings, human-friendly date/times, and unix timestamps.
/// </summary>
public class FlexibleDateTimeConverter : System.Text.Json.Serialization.JsonConverter<DateTime>
{
    public override DateTime Read(ref System.Text.Json.Utf8JsonReader reader, Type typeToConvert, System.Text.Json.JsonSerializerOptions options)
    {
        if (reader.TokenType == System.Text.Json.JsonTokenType.String)
        {
            var str = reader.GetString();
            if (string.IsNullOrWhiteSpace(str)) return default;

            str = str.Replace("•", " ").Trim();
            while (str.Contains("  ")) str = str.Replace("  ", " ");

            if (DateTime.TryParse(str, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal, out var dtUtc))
            {
                return DateTime.SpecifyKind(dtUtc, DateTimeKind.Utc);
            }
            if (DateTime.TryParse(str, out var dtLocal))
            {
                return DateTime.SpecifyKind(dtLocal, DateTimeKind.Utc);
            }
        }
        else if (reader.TokenType == System.Text.Json.JsonTokenType.Number && reader.TryGetInt64(out var ms))
        {
            return DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime;
        }

        return reader.GetDateTime();
    }

    public override void Write(System.Text.Json.Utf8JsonWriter writer, DateTime value, System.Text.Json.JsonSerializerOptions options)
    {
        writer.WriteStringValue(value.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"));
    }
}

public class FlexibleNullableDateTimeConverter : System.Text.Json.Serialization.JsonConverter<DateTime?>
{
    public override DateTime? Read(ref System.Text.Json.Utf8JsonReader reader, Type typeToConvert, System.Text.Json.JsonSerializerOptions options)
    {
        if (reader.TokenType == System.Text.Json.JsonTokenType.Null) return null;
        if (reader.TokenType == System.Text.Json.JsonTokenType.String)
        {
            var str = reader.GetString();
            if (string.IsNullOrWhiteSpace(str)) return null;

            str = str.Replace("•", " ").Trim();
            while (str.Contains("  ")) str = str.Replace("  ", " ");

            if (DateTime.TryParse(str, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal, out var dtUtc))
            {
                return DateTime.SpecifyKind(dtUtc, DateTimeKind.Utc);
            }
            if (DateTime.TryParse(str, out var dtLocal))
            {
                return DateTime.SpecifyKind(dtLocal, DateTimeKind.Utc);
            }
        }
        else if (reader.TokenType == System.Text.Json.JsonTokenType.Number && reader.TryGetInt64(out var ms))
        {
            return DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime;
        }

        return reader.GetDateTime();
    }

    public override void Write(System.Text.Json.Utf8JsonWriter writer, DateTime? value, System.Text.Json.JsonSerializerOptions options)
    {
        if (value.HasValue)
        {
            writer.WriteStringValue(value.Value.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"));
        }
        else
        {
            writer.WriteNullValue();
        }
    }
}
