using backend.Extensions;
using backend.Middleware;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddUserSecrets<Program>(optional: true);

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
builder.Services.AddSignalR();

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
            db.Database.ExecuteSqlRaw(@"
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
                        ALTER TABLE users ADD COLUMN IF NOT EXISTS ""IsProtected"" boolean NOT NULL DEFAULT FALSE;
                        ALTER TABLE users ADD COLUMN IF NOT EXISTS ""IsTwoFactorEnabled"" boolean NOT NULL DEFAULT FALSE;
                        ALTER TABLE users ADD COLUMN IF NOT EXISTS ""TwoFactorSecret"" character varying(128);
                        ALTER TABLE users ADD COLUMN IF NOT EXISTS ""TwoFactorRecoveryCodesJson"" text;
                        UPDATE users SET ""IsProtected"" = TRUE WHERE ""Email"" = 'yanosh@ghlindiaventures.com' OR ""Id"" = 1;
                    END IF;

                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
                        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ""IsProtected"" boolean NOT NULL DEFAULT FALSE;
                        UPDATE tenants SET ""IsProtected"" = TRUE WHERE ""Id"" IN (1, 2) OR ""Slug"" IN ('ghl', 'jamin');
                    END IF;

                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles') THEN
                        UPDATE roles SET ""IsActive"" = FALSE WHERE ""Code"" IN ('sales_manager', 'presales_rep');
                    END IF;

                    CREATE TABLE IF NOT EXISTS user_sessions (
                        ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""UserId"" integer NOT NULL REFERENCES users(""Id"") ON DELETE CASCADE,
                        ""TokenId"" character varying(128) NOT NULL,
                        ""IpAddress"" character varying(64) NOT NULL DEFAULT '',
                        ""UserAgent"" character varying(512) NOT NULL DEFAULT '',
                        ""Device"" character varying(128) NOT NULL DEFAULT 'Desktop / Web Browser',
                        ""Location"" character varying(128) NOT NULL DEFAULT 'India (IST)',
                        ""IsActive"" boolean NOT NULL DEFAULT TRUE,
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
                        ""LastActivityAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
                        ""RevokedAt"" timestamp with time zone NULL,
                        ""RevokedReason"" text NULL
                    );

                    CREATE UNIQUE INDEX IF NOT EXISTS ix_user_sessions_token_id ON user_sessions (""TokenId"");
                    CREATE INDEX IF NOT EXISTS ix_user_sessions_user_id_is_active ON user_sessions (""UserId"", ""IsActive"");
                    CREATE INDEX IF NOT EXISTS ix_users_company_id ON users (""CompanyId"");
                    CREATE INDEX IF NOT EXISTS ix_users_role_id ON users (""RoleId"");
                    CREATE UNIQUE INDEX IF NOT EXISTS ux_broadcast_announcements_single_active_global ON broadcast_announcements (""IsActive"") WHERE ""IsActive"" = TRUE AND ""TargetTenantId"" IS NULL;

                    CREATE TABLE IF NOT EXISTS security_events (
                        ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""UserId"" integer NULL REFERENCES users(""Id"") ON DELETE SET NULL,
                        ""EventType"" character varying(64) NOT NULL,
                        ""ActorEmail"" character varying(255) NOT NULL DEFAULT '',
                        ""IpAddress"" character varying(64) NOT NULL DEFAULT '',
                        ""UserAgent"" character varying(512) NOT NULL DEFAULT '',
                        ""Details"" text NOT NULL DEFAULT '',
                        ""Severity"" character varying(32) NOT NULL DEFAULT 'info',
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT NOW()
                    );

                    CREATE INDEX IF NOT EXISTS ix_security_events_created_at_severity ON security_events (""CreatedAt"", ""Severity"");
                    CREATE INDEX IF NOT EXISTS ix_security_events_event_type ON security_events (""EventType"");
                END $$;
            ");
        }
        catch (Exception ex)
        {
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
            logger.LogWarning(ex, "Database schema sync for security and sessions skipped: {Message}", ex.Message);
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

                    ALTER TABLE users ADD COLUMN IF NOT EXISTS ""MustChangePassword"" boolean NOT NULL DEFAULT FALSE;

                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'followups' AND column_name = 'Status' AND data_type = 'integer') THEN
                        ALTER TABLE followups ALTER COLUMN ""Status"" TYPE character varying(50) USING CASE WHEN ""Status"" = 1 THEN 'Completed' WHEN ""Status"" = 2 THEN 'Cancelled' WHEN ""Status"" = 3 THEN 'Rescheduled' ELSE 'Pending' END;
                    END IF;
                    ALTER TABLE followups ALTER COLUMN ""Status"" DROP NOT NULL;
                    ALTER TABLE followups ALTER COLUMN ""Status"" SET DEFAULT 'Pending';
                    ALTER TABLE followups ALTER COLUMN ""Priority"" DROP NOT NULL;
                    ALTER TABLE followups ALTER COLUMN ""Priority"" SET DEFAULT 'Medium';
                END $$;
            ";
            db.Database.ExecuteSqlRaw(sql);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Database Init Warning] {ex.Message}");
        }

        try
        {
            var irmAndGhlTablesSql = @"
                DO $$
                BEGIN
                    CREATE TABLE IF NOT EXISTS ""GhlInvestors"" (
                        ""Id""                   SERIAL PRIMARY KEY,
                        ""CompanyId""            INTEGER NOT NULL REFERENCES tenants(""Id"") ON DELETE CASCADE,
                        ""AssignedAgentId""      INTEGER NOT NULL REFERENCES users(""Id"") ON DELETE RESTRICT,
                        ""Name""                 VARCHAR(150) NOT NULL DEFAULT '',
                        ""Phone""                VARCHAR(50) NOT NULL DEFAULT '',
                        ""Email""                VARCHAR(255) NOT NULL DEFAULT '',
                        ""Status""               VARCHAR(50) NOT NULL DEFAULT 'Lead',
                        ""InvestmentCapacity""   VARCHAR(100) NOT NULL DEFAULT '',
                        ""PreferredAssetClass""  VARCHAR(100) NOT NULL DEFAULT '',
                        ""ReferralSource""       VARCHAR(150),
                        ""CommittedAUM""         VARCHAR(100),
                        ""InvestmentMandate""    TEXT,
                        ""RiskTolerance""        VARCHAR(50),
                        ""Notes""                TEXT NOT NULL DEFAULT '',
                        ""CreatedAt""            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        ""UpdatedAt""            TIMESTAMPTZ
                    );
                    CREATE INDEX IF NOT EXISTS ""IX_GhlInvestors_CompanyId"" ON ""GhlInvestors"" (""CompanyId"");
                    CREATE INDEX IF NOT EXISTS ""IX_GhlInvestors_AssignedAgentId"" ON ""GhlInvestors"" (""AssignedAgentId"");
                    CREATE INDEX IF NOT EXISTS ""IX_GhlInvestors_Status"" ON ""GhlInvestors"" (""Status"");

                    CREATE TABLE IF NOT EXISTS ""InvestorCalls"" (
                        ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""CompanyId"" integer NOT NULL REFERENCES tenants(""Id"") ON DELETE CASCADE,
                        ""InvestorId"" integer NOT NULL REFERENCES ""Investors""(""Id"") ON DELETE CASCADE,
                        ""IrmId"" integer NOT NULL REFERENCES users(""Id"") ON DELETE CASCADE,
                        ""IrmName"" text NOT NULL DEFAULT '',
                        ""InvestorName"" text NOT NULL DEFAULT '',
                        ""InvestorPhone"" text NOT NULL DEFAULT '',
                        ""CalledAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
                        ""DurationSeconds"" integer NOT NULL DEFAULT 0,
                        ""Outcome"" integer NOT NULL DEFAULT 0,
                        ""Notes"" text NULL,
                        ""RecordingUrl"" text NULL,
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS ""IX_InvestorCalls_CompanyId"" ON ""InvestorCalls"" (""CompanyId"");
                    CREATE INDEX IF NOT EXISTS ""IX_InvestorCalls_InvestorId"" ON ""InvestorCalls"" (""InvestorId"");
                    CREATE INDEX IF NOT EXISTS ""IX_InvestorCalls_IrmId"" ON ""InvestorCalls"" (""IrmId"");

                    CREATE TABLE IF NOT EXISTS ""IrmPipelineCards"" (
                        ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""CompanyId"" integer NOT NULL REFERENCES tenants(""Id"") ON DELETE CASCADE,
                        ""InvestorId"" integer NOT NULL REFERENCES ""Investors""(""Id"") ON DELETE CASCADE,
                        ""AssignedIrmId"" integer NOT NULL REFERENCES users(""Id"") ON DELETE CASCADE,
                        ""AssignedIrmName"" text NOT NULL DEFAULT '',
                        ""InvestorName"" text NOT NULL DEFAULT '',
                        ""InvestorPhone"" text NOT NULL DEFAULT '',
                        ""InvestorEmail"" text NOT NULL DEFAULT '',
                        ""StageId"" text NOT NULL DEFAULT 'leads',
                        ""StageEnteredAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
                        ""LastActionSnippet"" text NULL,
                        ""LastActivityDate"" timestamp with time zone NULL,
                        ""Priority"" text NOT NULL DEFAULT 'Medium',
                        ""Value"" numeric NULL,
                        ""InvestmentAmount"" text NULL,
                        ""PreferredAssetClass"" text NULL,
                        ""ActivityLogsJson"" text NULL,
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
                        ""UpdatedAt"" timestamp with time zone NULL
                    );
                    CREATE INDEX IF NOT EXISTS ""IX_IrmPipelineCards_CompanyId"" ON ""IrmPipelineCards"" (""CompanyId"");
                    CREATE INDEX IF NOT EXISTS ""IX_IrmPipelineCards_InvestorId"" ON ""IrmPipelineCards"" (""InvestorId"");
                    CREATE INDEX IF NOT EXISTS ""IX_IrmPipelineCards_AssignedIrmId"" ON ""IrmPipelineCards"" (""AssignedIrmId"");

                    CREATE TABLE IF NOT EXISTS ""OpportunityPitches"" (
                        ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""OpportunityId"" integer NOT NULL REFERENCES ""InvestmentOpportunities""(""Id"") ON DELETE CASCADE,
                        ""InvestorId"" integer NOT NULL REFERENCES ""Investors""(""Id"") ON DELETE CASCADE,
                        ""PitchedByIrmId"" integer NOT NULL REFERENCES users(""Id"") ON DELETE CASCADE,
                        ""PitchedAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
                        ""PitchNotes"" text NULL,
                        ""IsCommitted"" boolean NOT NULL DEFAULT FALSE,
                        ""CommittedAmount"" numeric NULL,
                        ""CommittedAt"" timestamp with time zone NULL,
                        ""CommitmentNotes"" text NULL
                    );
                    CREATE INDEX IF NOT EXISTS ""IX_OpportunityPitches_OpportunityId"" ON ""OpportunityPitches"" (""OpportunityId"");
                    CREATE INDEX IF NOT EXISTS ""IX_OpportunityPitches_InvestorId"" ON ""OpportunityPitches"" (""InvestorId"");
                    CREATE INDEX IF NOT EXISTS ""IX_OpportunityPitches_PitchedByIrmId"" ON ""OpportunityPitches"" (""PitchedByIrmId"");
                END $$;
            ";
            db.Database.ExecuteSqlRaw(irmAndGhlTablesSql);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Database IRM/GHL Schema Sync Warning] {ex.Message}");
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

        try
        {
            var superAdmin = db.Users.FirstOrDefault(u => u.Id == 1 || u.Email == "yanosh@ghlindiaventures.com");
            if (superAdmin != null && string.IsNullOrWhiteSpace(superAdmin.PasswordHash))
            {
                superAdmin.PasswordHash = backend.Helpers.PasswordHasher.HashPassword("Password@123");
                superAdmin.IsProtected = true;
                db.SaveChanges();
                Console.WriteLine("[Security Init] Initialized empty Super Admin password hash.");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Security Init Warning] {ex.Message}");
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

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<backend.Hubs.PlatformHub>("/hubs/platform");

app.Run();