using backend.Extensions;
using backend.Middleware;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// 1. Add Controllers
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });

// 2. Add Layered Application Services & DbContext
builder.Services.AddApplicationServices(builder.Configuration);

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
    var connectionString = config.GetConnectionString("DefaultConnection");
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        connectionString = config["ConnectionStrings:DefaultConnection"]
            ?? config["ConnectionString:DefaultConnection"];
    }
    var hasValidConnectionString = !string.IsNullOrWhiteSpace(connectionString) && !connectionString.Equals("InMemory", StringComparison.OrdinalIgnoreCase);
    var useInMemory = config.GetValue<bool>("UseInMemoryDatabase", !hasValidConnectionString) || !hasValidConnectionString;
    var db = scope.ServiceProvider.GetRequiredService<backend.Data.ApplicationDbContext>();
    if (useInMemory)
    {
        Console.WriteLine("[Database] WARNING: Running with in-memory database. Password changes and state will not persist across restarts.");
        db.Database.EnsureCreated();
    }
    else
    {
        Console.WriteLine($"[Database] Connected to persistent database provider: {db.Database.ProviderName}");
        try
        {
            db.Database.ExecuteSqlRaw(@"
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles') THEN
                        ALTER TABLE roles ADD COLUMN IF NOT EXISTS ""Description"" text;
                        ALTER TABLE roles ADD COLUMN IF NOT EXISTS ""IsSystemRole"" boolean NOT NULL DEFAULT FALSE;
                        ALTER TABLE roles ADD COLUMN IF NOT EXISTS ""IsActive"" boolean NOT NULL DEFAULT TRUE;
                        ALTER TABLE roles ADD COLUMN IF NOT EXISTS ""CreatedBy"" text;
                        ALTER TABLE roles ADD COLUMN IF NOT EXISTS ""UpdatedAt"" timestamp with time zone;
                        
                        UPDATE roles SET ""IsSystemRole"" = TRUE WHERE ""Code"" IN ('super_admin', 'company_admin', 'sales_executive', 'irm') AND (""IsSystemRole"" IS NULL OR ""IsSystemRole"" = FALSE);
                        UPDATE roles SET ""IsActive"" = TRUE WHERE ""IsActive"" IS NULL;
                        UPDATE roles SET ""Description"" = 'System Administrator with full platform control' WHERE ""Code"" = 'super_admin' AND (""Description"" IS NULL OR ""Description"" = '');
                        UPDATE roles SET ""Description"" = 'Company Administrator managing organization and users' WHERE ""Code"" = 'company_admin' AND (""Description"" IS NULL OR ""Description"" = '');
                        UPDATE roles SET ""Description"" = 'Sales Executive managing leads and client communications' WHERE ""Code"" = 'sales_executive' AND (""Description"" IS NULL OR ""Description"" = '');
                        UPDATE roles SET ""Description"" = 'Investor Relations Manager managing investors, KYC, and deals' WHERE ""Code"" = 'irm' AND (""Description"" IS NULL OR ""Description"" = '');
                    END IF;
                END $$;
            ");
        }
        catch (Exception ex)
        {
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
            logger.LogWarning(ex, "Database schema sync for roles skipped: {Message}", ex.Message);
        }
        try
        {
            var sql = @"
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Followups') THEN
                        ALTER TABLE ""Followups"" RENAME TO followups;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Consultations') THEN
                        ALTER TABLE ""Consultations"" RENAME TO consultations;
                    END IF;
                    
                    CREATE TABLE IF NOT EXISTS followups (
                        ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""CompanyId"" integer NOT NULL,
                        ""AssignedAgentId"" integer NOT NULL DEFAULT 1,
                        ""InvestorId"" integer NULL,
                        ""ContactId"" character varying(100) NULL,
                        ""ContactType"" character varying(50) NOT NULL DEFAULT 'lead',
                        ""ContactName"" character varying(150) NOT NULL,
                        ""ContactPhone"" character varying(50) NOT NULL,
                        ""ScheduledAt"" timestamp with time zone NOT NULL,
                        ""Priority"" character varying(50) NOT NULL DEFAULT 'Medium',
                        ""Status"" character varying(50) NOT NULL DEFAULT 'Pending',
                        ""Notes"" text NOT NULL DEFAULT '',
                        ""Agenda"" text NULL,
                        ""OutcomeNotes"" text NULL,
                        ""AssignedToName"" text NOT NULL DEFAULT '',
                        ""AssignedToRole"" text NOT NULL DEFAULT '',
                        ""InvestorName"" text NULL,
                        ""CompletedAt"" timestamp with time zone NULL,
                        ""RescheduledTo"" timestamp with time zone NULL,
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
                        ""UpdatedAt"" timestamp with time zone NULL
                    );

                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'followups' AND column_name = 'AssignedToId') THEN
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'followups' AND column_name = 'AssignedAgentId') THEN
                            ALTER TABLE followups RENAME COLUMN ""AssignedToId"" TO ""AssignedAgentId"";
                        END IF;
                    END IF;

                    ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""ContactType"" character varying(50) NOT NULL DEFAULT 'lead';
                    ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""ContactEmail"" character varying(255) NULL;
                    ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""Priority"" character varying(50) NOT NULL DEFAULT 'Medium';
                    ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""Notes"" text NOT NULL DEFAULT '';
                    ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""Agenda"" text NULL;
                    ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""OutcomeNotes"" text NULL;
                    ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""AssignedToName"" text NOT NULL DEFAULT '';
                    ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""AssignedToRole"" text NOT NULL DEFAULT '';
                    ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""InvestorName"" text NULL;
                    ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""CompletedAt"" timestamp with time zone NULL;
                    ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""RescheduledTo"" timestamp with time zone NULL;
                    ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT NOW();
                    ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""UpdatedAt"" timestamp with time zone NULL;
                    ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""AssignedAgentId"" integer NOT NULL DEFAULT 1;

                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'followups' AND column_name = 'Status' AND data_type = 'integer') THEN
                        ALTER TABLE followups ALTER COLUMN ""Status"" TYPE character varying(50) USING CASE WHEN ""Status"" = 1 THEN 'Completed' WHEN ""Status"" = 2 THEN 'Cancelled' WHEN ""Status"" = 3 THEN 'Rescheduled' ELSE 'Pending' END;
                    END IF;
                    ALTER TABLE followups ALTER COLUMN ""Status"" DROP NOT NULL;
                    ALTER TABLE followups ALTER COLUMN ""Status"" SET DEFAULT 'Pending';
                    ALTER TABLE followups ALTER COLUMN ""Priority"" DROP NOT NULL;
                    ALTER TABLE followups ALTER COLUMN ""Priority"" SET DEFAULT 'Medium';

                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Leads' AND column_name = 'AssignedAgentId') THEN
                        ALTER TABLE ""Leads"" ALTER COLUMN ""AssignedAgentId"" DROP NOT NULL;
                    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'AssignedAgentId') THEN
                        ALTER TABLE leads ALTER COLUMN ""AssignedAgentId"" DROP NOT NULL;
                    END IF;
                END $$;
            ";
            db.Database.ExecuteSqlRaw(sql);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Database Init Warning] {ex.Message}");
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
                            "leads.view","leads.create","leads.update",
                            "followups.view","followups.create","followups.update",
                            "investors.view","investors.create","investors.update",
                            "consultations.view","consultations.create","consultations.update",
                            "opportunities.view","opportunities.create","opportunities.update",
                            "deals.view","deals.create","deals.update",
                            "kyc.view","kyc.approve",
                            "calls.make","calls.receive","calls.view","reports.view","chat.view","chat.send"
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

        try
        {
            var pendingMigrations = db.Database.GetPendingMigrations().ToList();
            if (pendingMigrations.Any())
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("================================================================================");
                Console.WriteLine($"[WARNING] There are {pendingMigrations.Count} pending EF Core migration(s) not yet applied to the database:");
                foreach (var m in pendingMigrations)
                {
                    Console.WriteLine($"  - {m}");
                }
                Console.WriteLine("Run 'dotnet ef database update' in backend/ to apply pending migrations.");
                Console.WriteLine("================================================================================");
                Console.ResetColor();
            }
            else
            {
                Console.WriteLine("[Database] All EF Core migrations are up to date.");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Database Migration Check Warning] {ex.Message}");

        }
    }

    var helpMeDecide = db.Leads.Count(l => l.CustomFieldsJson != null && l.CustomFieldsJson.Contains("help me decide"));
    var notConfirmed = db.Leads.Count(l => l.CustomFieldsJson != null && (l.CustomFieldsJson.Contains("\"assetClass\":\"") || l.CustomFieldsJson.Contains("\"preferredAssetClass\":\"")) && !l.CustomFieldsJson.Contains("\"irmPreferencesConfirmed\":true"));
    Console.WriteLine($"[DIAGNOSTIC] Count with help me decide: {helpMeDecide}");
    Console.WriteLine($"[DIAGNOSTIC] Count with asset class but not confirmed: {notConfirmed}");
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

app.UseStaticFiles(); // Added to serve uploaded documents

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
