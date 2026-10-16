using backend.Extensions;
using backend.Middleware;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;

// S1: Load .env file (if present) before any configuration is read.
// This allows developers to keep secrets out of appsettings.json by placing
// a backend/.env file with environment-variable-style overrides, e.g.:
//   ConnectionStrings__DefaultConnection=Host=...
//   JwtSettings__SecretKey=...
// The file is optional; if missing, standard env vars / appsettings.json apply.
DotNetEnv.Env.TraversePath().Load();

// Ensure wwwroot directory exists to avoid PhysicalFileProvider DirectoryNotFoundException
var wwwrootDirectory = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
if (!Directory.Exists(wwwrootDirectory))
{
    Directory.CreateDirectory(wwwrootDirectory);
}

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddUserSecrets<Program>(optional: true);

// Support dynamic port for Render / cloud containers
var renderPort = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(renderPort))
{
    builder.WebHost.UseUrls($"http://+:{renderPort}");
}


// 1. Add Controllers
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });

// 2. Add Layered Application Services & DbContext
builder.Services.AddApplicationServices(builder.Configuration);

// 2b. Prevent transient background service errors from stopping the application host
builder.Services.Configure<HostOptions>(options =>
{
    options.BackgroundServiceExceptionBehavior = BackgroundServiceExceptionBehavior.Ignore;
});

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
        var hasWildcard = allowedOrigins.Length == 0 || allowedOrigins.Any(o => o == "*" || string.IsNullOrWhiteSpace(o));
        if (hasWildcard)
        {
            policy.SetIsOriginAllowed(_ => true)
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        }
        else
        {
            policy.WithOrigins(allowedOrigins)
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        }
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
    c.ResolveConflictingActions(apiDescriptions => apiDescriptions.First());

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
            var pendingMigrations = db.Database.GetPendingMigrations().ToList();
            if (pendingMigrations.Any())
            {
                Console.WriteLine($"[Database] Applying {pendingMigrations.Count} pending EF Core migration(s)...");
                try
                {
                    db.Database.ExecuteSqlRaw(@"
                        DO $$
                        BEGIN
                            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles') THEN
                                INSERT INTO roles (""Id"", ""Code"", ""Name"", ""CreatedAt"", ""Permissions"")
                                VALUES
                                    (1, 'super_admin', 'Super Admin', NOW(), '{}'),
                                    (2, 'company_admin', 'Company Admin', NOW(), '{}'),
                                    (3, 'sales_executive', 'Sales Executive', NOW(), '{}'),
                                    (4, 'irm', 'IRM', NOW(), '{}'),
                                    (5, 'sales_manager', 'Sales Manager', NOW(), '{}')
                                ON CONFLICT (""Id"") DO NOTHING;
                            END IF;

                            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'followups' AND column_name = 'ContactEmail') THEN
                                IF NOT EXISTS (SELECT 1 FROM ""__EFMigrationsHistory"" WHERE ""MigrationId"" LIKE '%AddKycOtpVerificationAndIrmCoverage%') THEN
                                    ALTER TABLE followups DROP COLUMN ""ContactEmail"";
                                END IF;
                            END IF;

                            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'call_records' AND column_name = 'CallModule') THEN
                                IF NOT EXISTS (SELECT 1 FROM ""__EFMigrationsHistory"" WHERE ""MigrationId"" LIKE '%AddCallModuleAndReasonToCallRecords%') THEN
                                    ALTER TABLE call_records DROP COLUMN ""CallModule"";
                                END IF;
                            END IF;

                            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'call_records' AND column_name = 'Reason') THEN
                                IF NOT EXISTS (SELECT 1 FROM ""__EFMigrationsHistory"" WHERE ""MigrationId"" LIKE '%AddCallModuleAndReasonToCallRecords%') THEN
                                    ALTER TABLE call_records DROP COLUMN ""Reason"";
                                END IF;
                            END IF;
                        END $$;
                    ");
                }
                catch { }

                db.Database.Migrate();
                Console.WriteLine("[Database] All EF Core migrations applied successfully.");
            }
            else
            {
                Console.WriteLine("[Database] All EF Core migrations are up to date.");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Database Migration Warning] {ex.Message}");
        }

        try
        {
            db.Database.ExecuteSqlRaw(@"
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles') THEN
                        -- Restore system role codes if they were corrupted with temp_ prefixes
                        UPDATE roles SET ""Code"" = 'super_admin' WHERE ""Id"" = 1 OR ""Code"" = 'temp_1';
                        UPDATE roles SET ""Code"" = 'company_admin' WHERE ""Id"" = 2 OR ""Code"" = 'temp_2';
                        UPDATE roles SET ""Code"" = 'sales_executive' WHERE ""Id"" = 3 OR ""Code"" = 'temp_3';
                        UPDATE roles SET ""Code"" = 'irm' WHERE ""Id"" = 4 OR ""Code"" = 'temp_4';
                        UPDATE roles SET ""Code"" = 'sales_manager' WHERE ""Id"" = 5 OR ""Code"" = 'temp_5';

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
                        UPDATE tenants SET ""IsActive"" = TRUE, ""Status"" = 'Active' WHERE ""Id"" IN (1, 2) OR ""Slug"" IN ('ghl', 'jamin');
                        UPDATE tenants SET ""SubscriptionPlan"" = 'Wealth Advisory Enterprise Suite' WHERE ""Id"" IN (1, 2) OR ""Slug"" IN ('ghl', 'jamin');
                    END IF;

                    -- Call records Duration, Timestamp, and CallModule columns
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'call_records') THEN
                        ALTER TABLE call_records ADD COLUMN IF NOT EXISTS ""Timestamp"" timestamp with time zone NOT NULL DEFAULT NOW();
                        ALTER TABLE call_records ADD COLUMN IF NOT EXISTS ""Duration"" integer NOT NULL DEFAULT 0;
                        ALTER TABLE call_records ADD COLUMN IF NOT EXISTS ""CallModule"" character varying(50);
                        ALTER TABLE call_records ADD COLUMN IF NOT EXISTS ""Reason"" text;
                        ALTER TABLE call_records ADD COLUMN IF NOT EXISTS ""TwilioCallSid"" character varying(64);
                        ALTER TABLE call_records ADD COLUMN IF NOT EXISTS ""RecordingUrl"" character varying(256);
                        ALTER TABLE call_records ADD COLUMN IF NOT EXISTS ""Transcript"" text;
                        ALTER TABLE call_records ADD COLUMN IF NOT EXISTS ""LeadId"" integer;
                        ALTER TABLE call_records ADD COLUMN IF NOT EXISTS ""CustomerId"" integer;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'call_records' AND column_name = 'duration') THEN
                            UPDATE call_records SET ""Duration"" = duration WHERE ""Duration"" = 0;
                        END IF;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'call_records' AND column_name = 'DurationSeconds') THEN
                            UPDATE call_records SET ""Duration"" = ""DurationSeconds"" WHERE ""Duration"" = 0;
                        END IF;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'call_records' AND column_name = 'CreatedAt') THEN
                            UPDATE call_records SET ""Timestamp"" = ""CreatedAt"" WHERE ""Timestamp"" = '0001-01-01' OR ""Timestamp"" IS NULL;
                        END IF;
                    END IF;

                    -- Leads columns (CustomFieldsJson, NormalizedPhone, NormalizedEmail, HandoverId, etc.)
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads') THEN
                        ALTER TABLE leads ADD COLUMN IF NOT EXISTS ""CustomFieldsJson"" text;
                        ALTER TABLE leads ADD COLUMN IF NOT EXISTS ""NormalizedPhone"" text;
                        ALTER TABLE leads ADD COLUMN IF NOT EXISTS ""NormalizedEmail"" text;
                        ALTER TABLE leads ADD COLUMN IF NOT EXISTS ""IsDuplicate"" boolean NOT NULL DEFAULT FALSE;
                        ALTER TABLE leads ADD COLUMN IF NOT EXISTS ""NextFollowupDate"" timestamp with time zone;
                        ALTER TABLE leads ADD COLUMN IF NOT EXISTS ""AssignedById"" integer;
                        ALTER TABLE leads ADD COLUMN IF NOT EXISTS ""AssignedAt"" timestamp with time zone;
                        ALTER TABLE leads ADD COLUMN IF NOT EXISTS ""HandoverId"" integer;
                        ALTER TABLE leads ADD COLUMN IF NOT EXISTS ""OriginalOwnerId"" integer;
                    END IF;

                    -- Followups columns
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'followups') THEN
                        ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""ContactEmail"" text;
                        ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""InvestorId"" integer;
                        ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""InvestorName"" text;
                        ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""AssignedToName"" text NOT NULL DEFAULT '';
                        ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""AssignedToRole"" text NOT NULL DEFAULT '';
                        ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""OverdueNotifiedAt"" timestamp with time zone;
                        ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""HandoverId"" integer;
                        ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""OriginalOwnerId"" integer;
                    END IF;

                    -- Customers columns (CustomFieldsJson, NormalizedPhone, NormalizedEmail, etc.)
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
                        ALTER TABLE customers ADD COLUMN IF NOT EXISTS ""CustomFieldsJson"" text;
                        ALTER TABLE customers ADD COLUMN IF NOT EXISTS ""NormalizedPhone"" text;
                        ALTER TABLE customers ADD COLUMN IF NOT EXISTS ""NormalizedEmail"" text;
                        ALTER TABLE customers ADD COLUMN IF NOT EXISTS ""IsDuplicate"" boolean NOT NULL DEFAULT FALSE;
                        ALTER TABLE customers ADD COLUMN IF NOT EXISTS ""LastContactedAt"" timestamp with time zone;
                        ALTER TABLE customers ADD COLUMN IF NOT EXISTS ""TotalValue"" numeric NOT NULL DEFAULT 0;
                        ALTER TABLE customers ADD COLUMN IF NOT EXISTS ""HandoverId"" integer;
                        ALTER TABLE customers ADD COLUMN IF NOT EXISTS ""OriginalOwnerId"" integer;
                    END IF;

                    -- Consultations columns
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'consultations') THEN
                        ALTER TABLE consultations ADD COLUMN IF NOT EXISTS ""IrmUserId"" integer;
                        ALTER TABLE consultations ADD COLUMN IF NOT EXISTS ""IrmUserName"" text;
                        ALTER TABLE consultations ADD COLUMN IF NOT EXISTS ""AssetClass"" text;
                        ALTER TABLE consultations ADD COLUMN IF NOT EXISTS ""InvestmentCapacity"" text;
                        ALTER TABLE consultations ADD COLUMN IF NOT EXISTS ""HandoverId"" integer;
                        ALTER TABLE consultations ADD COLUMN IF NOT EXISTS ""OriginalOwnerId"" integer;
                    END IF;

                    -- Deals columns
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'GhlDeals') THEN
                        ALTER TABLE ""GhlDeals"" ADD COLUMN IF NOT EXISTS ""StageEnteredAt"" timestamp with time zone;
                        ALTER TABLE ""GhlDeals"" ADD COLUMN IF NOT EXISTS ""DealAmountConfirmed"" boolean NOT NULL DEFAULT FALSE;
                        ALTER TABLE ""GhlDeals"" ADD COLUMN IF NOT EXISTS ""KycStatus"" text;
                        ALTER TABLE ""GhlDeals"" ADD COLUMN IF NOT EXISTS ""HandoverId"" integer;
                        ALTER TABLE ""GhlDeals"" ADD COLUMN IF NOT EXISTS ""OriginalOwnerId"" integer;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ghl_deals') THEN
                        ALTER TABLE ghl_deals ADD COLUMN IF NOT EXISTS ""StageEnteredAt"" timestamp with time zone;
                        ALTER TABLE ghl_deals ADD COLUMN IF NOT EXISTS ""DealAmountConfirmed"" boolean NOT NULL DEFAULT FALSE;
                        ALTER TABLE ghl_deals ADD COLUMN IF NOT EXISTS ""KycStatus"" text;
                        ALTER TABLE ghl_deals ADD COLUMN IF NOT EXISTS ""HandoverId"" integer;
                        ALTER TABLE ghl_deals ADD COLUMN IF NOT EXISTS ""OriginalOwnerId"" integer;
                    END IF;

                    -- Investors & Opportunities columns
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Investors') THEN
                        ALTER TABLE ""Investors"" ADD COLUMN IF NOT EXISTS ""HandoverId"" integer;
                        ALTER TABLE ""Investors"" ADD COLUMN IF NOT EXISTS ""OriginalOwnerId"" integer;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'InvestmentOpportunities') THEN
                        ALTER TABLE ""InvestmentOpportunities"" ADD COLUMN IF NOT EXISTS ""HandoverId"" integer;
                        ALTER TABLE ""InvestmentOpportunities"" ADD COLUMN IF NOT EXISTS ""OriginalOwnerId"" integer;
                    END IF;

                    -- Create work_handovers table if not exists
                    CREATE TABLE IF NOT EXISTS work_handovers (
                        ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""CompanyId"" integer NOT NULL,
                        ""RoleCode"" character varying(50) NOT NULL,
                        ""OriginalUserId"" integer NOT NULL,
                        ""CoveringUserId"" integer NOT NULL,
                        ""StartedById"" integer NOT NULL,
                        ""Reason"" character varying(500) NOT NULL,
                        ""StartedAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
                        ""PlannedEndAt"" timestamp with time zone NULL,
                        ""Status"" character varying(50) NOT NULL DEFAULT 'active',
                        ""EndedAt"" timestamp with time zone NULL,
                        ""EndedById"" integer NULL,
                        ""ReturnSummaryJson"" text NULL
                    );

                    -- Create work_handover_items table if not exists
                    CREATE TABLE IF NOT EXISTS work_handover_items (
                        ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""HandoverId"" integer NOT NULL,
                        ""EntityType"" character varying(50) NOT NULL,
                        ""EntityId"" integer NOT NULL,
                        ""Origin"" character varying(50) NOT NULL DEFAULT 'included_at_start',
                        ""ReturnedAt"" timestamp with time zone NULL,
                        ""ReturnOutcome"" character varying(50) NULL,
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT NOW()
                    );

                    -- Create LeaveRequests table if not exists
                    CREATE TABLE IF NOT EXISTS ""LeaveRequests"" (
                        ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""CompanyId"" integer NOT NULL,
                        ""UserId"" integer NOT NULL,
                        ""StartDate"" timestamp with time zone NOT NULL,
                        ""EndDate"" timestamp with time zone NOT NULL,
                        ""Reason"" character varying(500) NOT NULL,
                        ""Status"" character varying(20) NOT NULL DEFAULT 'Pending',
                        ""WorkHandoverId"" integer NULL,
                        ""ApprovedById"" integer NULL,
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
                        ""UpdatedAt"" timestamp with time zone NULL
                    );

                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles') THEN
                        UPDATE roles SET ""IsActive"" = FALSE WHERE ""Code"" IN ('sales_manager', 'presales_rep');
                    END IF;

                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Documents') THEN
                        ALTER TABLE ""Documents"" ADD COLUMN IF NOT EXISTS ""TargetAudience"" text NOT NULL DEFAULT 'all_users';
                        ALTER TABLE ""Documents"" ADD COLUMN IF NOT EXISTS ""IsPlatformShared"" boolean NOT NULL DEFAULT FALSE;
                        ALTER TABLE ""Documents"" ADD COLUMN IF NOT EXISTS ""Description"" text;
                    END IF;

                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents') THEN
                        ALTER TABLE documents ADD COLUMN IF NOT EXISTS ""TargetAudience"" text NOT NULL DEFAULT 'all_users';
                        ALTER TABLE documents ADD COLUMN IF NOT EXISTS ""IsPlatformShared"" boolean NOT NULL DEFAULT FALSE;
                        ALTER TABLE documents ADD COLUMN IF NOT EXISTS ""Description"" text;
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

                    -- ── Team Chat Tables ────────────────────────────────────────────────
                    CREATE TABLE IF NOT EXISTS ""ChatConversations"" (
                        ""Id"" text NOT NULL PRIMARY KEY,
                        ""CompanyId"" integer NOT NULL,
                        ""Type"" text NOT NULL DEFAULT 'dm',
                        ""Name"" text NULL,
                        ""Description"" text NULL,
                        ""CreatedByUserId"" integer NOT NULL DEFAULT 1,
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
                        ""UpdatedAt"" timestamp with time zone NOT NULL DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS ix_chat_conversations_company_type ON ""ChatConversations"" (""CompanyId"", ""Type"");

                    CREATE TABLE IF NOT EXISTS ""ChatParticipants"" (
                        ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""ConversationId"" text NOT NULL REFERENCES ""ChatConversations""(""Id"") ON DELETE CASCADE,
                        ""UserId"" integer NOT NULL REFERENCES users(""Id"") ON DELETE CASCADE,
                        ""JoinedAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
                        ""LastReadMessageId"" text NULL,
                        ""IsPinned"" boolean NOT NULL DEFAULT FALSE,
                        ""IsMuted"" boolean NOT NULL DEFAULT FALSE
                    );
                    CREATE UNIQUE INDEX IF NOT EXISTS ux_chat_participants_conv_user ON ""ChatParticipants"" (""ConversationId"", ""UserId"");

                    CREATE TABLE IF NOT EXISTS ""ChatMessages"" (
                        ""Id"" text NOT NULL PRIMARY KEY,
                        ""ConversationId"" text NOT NULL REFERENCES ""ChatConversations""(""Id"") ON DELETE CASCADE,
                        ""SenderId"" integer NOT NULL,
                        ""SenderName"" text NOT NULL DEFAULT '',
                        ""Content"" text NOT NULL DEFAULT '',
                        ""MessageType"" text NOT NULL DEFAULT 'text',
                        ""ReplyToMessageId"" text NULL,
                        ""IsEdited"" boolean NOT NULL DEFAULT FALSE,
                        ""IsDeleted"" boolean NOT NULL DEFAULT FALSE,
                        ""ReactionsJson"" text NULL,
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
                        ""UpdatedAt"" timestamp with time zone NOT NULL DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS ix_chat_messages_conv_created ON ""ChatMessages"" (""ConversationId"", ""CreatedAt"");

                    CREATE TABLE IF NOT EXISTS ""ChatAttachments"" (
                        ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""MessageId"" text NOT NULL REFERENCES ""ChatMessages""(""Id"") ON DELETE CASCADE,
                        ""FileName"" text NOT NULL DEFAULT '',
                        ""FileUrl"" text NOT NULL DEFAULT '',
                        ""FileSize"" bigint NOT NULL DEFAULT 0,
                        ""MimeType"" text NOT NULL DEFAULT 'application/octet-stream',
                        ""Category"" text NULL,
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS ix_chat_attachments_message_id ON ""ChatAttachments"" (""MessageId"");

                    -- ── MFA Security Tables ─────────────────────────────────────────────
                    CREATE TABLE IF NOT EXISTS user_mfa_settings (
                        ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""UserId"" integer NOT NULL REFERENCES users(""Id"") ON DELETE CASCADE,
                        ""IsEnabled"" boolean NOT NULL DEFAULT FALSE,
                        ""SecretEncrypted"" text NOT NULL DEFAULT '',
                        ""PendingSecretEncrypted"" text NULL,
                        ""EnabledAt"" timestamp with time zone NULL,
                        ""LastUsedAt"" timestamp with time zone NULL,
                        ""FailedAttempts"" integer NOT NULL DEFAULT 0,
                        ""LockedUntil"" timestamp with time zone NULL,
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
                        ""UpdatedAt"" timestamp with time zone NULL
                    );
                    CREATE UNIQUE INDEX IF NOT EXISTS ix_user_mfa_settings_user_id ON user_mfa_settings (""UserId"");

                    CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
                        ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""UserId"" integer NOT NULL REFERENCES users(""Id"") ON DELETE CASCADE,
                        ""CodeHash"" character varying(128) NOT NULL,
                        ""UsedAt"" timestamp with time zone NULL,
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS ix_mfa_recovery_codes_user_id ON mfa_recovery_codes (""UserId"");
                    CREATE INDEX IF NOT EXISTS ix_mfa_recovery_codes_user_code_hash ON mfa_recovery_codes (""UserId"", ""CodeHash"");

                    CREATE TABLE IF NOT EXISTS mfa_challenges (
                        ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""UserId"" integer NOT NULL REFERENCES users(""Id"") ON DELETE CASCADE,
                        ""ChallengeTokenHash"" character varying(128) NOT NULL,
                        ""ExpiresAt"" timestamp with time zone NOT NULL,
                        ""AttemptCount"" integer NOT NULL DEFAULT 0,
                        ""CompletedAt"" timestamp with time zone NULL,
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
                        ""IpAddress"" character varying(64) NULL,
                        ""UserAgent"" character varying(512) NULL
                    );
                    CREATE UNIQUE INDEX IF NOT EXISTS ix_mfa_challenges_token_hash ON mfa_challenges (""ChallengeTokenHash"");
                    CREATE INDEX IF NOT EXISTS ix_mfa_challenges_user_expires ON mfa_challenges (""UserId"", ""ExpiresAt"");

                    CREATE TABLE IF NOT EXISTS platform_tickets (
                        ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""TicketNumber"" character varying(32) NOT NULL,
                        ""Title"" character varying(255) NOT NULL,
                        ""Description"" text NOT NULL,
                        ""Category"" character varying(100) NOT NULL DEFAULT 'Telephony / Carrier Trunk',
                        ""Priority"" character varying(32) NOT NULL DEFAULT 'medium',
                        ""Status"" character varying(32) NOT NULL DEFAULT 'open',
                        ""TenantId"" integer NULL REFERENCES tenants(""Id"") ON DELETE SET NULL,
                        ""TenantName"" character varying(150) NULL,
                        ""TenantSlug"" character varying(100) NULL,
                        ""ReportedByName"" character varying(150) NOT NULL DEFAULT 'Super Admin',
                        ""ReportedByEmail"" character varying(255) NOT NULL DEFAULT 'superadmin@nexusplatform.io',
                        ""AssignedToName"" character varying(150) NULL DEFAULT 'Platform Operations',
                        ""AssignedToEmail"" character varying(255) NULL,
                        ""ResolutionNotes"" text NULL,
                        ""ResolvedAt"" timestamp with time zone NULL,
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
                        ""UpdatedAt"" timestamp with time zone NOT NULL DEFAULT NOW()
                    );

                    CREATE UNIQUE INDEX IF NOT EXISTS ux_platform_tickets_ticket_number ON platform_tickets (""TicketNumber"");
                    CREATE INDEX IF NOT EXISTS ix_platform_tickets_status ON platform_tickets (""Status"");
                    CREATE INDEX IF NOT EXISTS ix_platform_tickets_priority ON platform_tickets (""Priority"");
                    CREATE INDEX IF NOT EXISTS ix_platform_tickets_tenant_id ON platform_tickets (""TenantId"");
                    CREATE INDEX IF NOT EXISTS ix_platform_tickets_created_at ON platform_tickets (""CreatedAt"");

                    CREATE TABLE IF NOT EXISTS platform_ticket_events (
                        ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""TicketId"" integer NOT NULL REFERENCES platform_tickets(""Id"") ON DELETE CASCADE,
                        ""AuthorName"" character varying(150) NOT NULL DEFAULT 'Super Admin',
                        ""AuthorEmail"" character varying(255) NOT NULL DEFAULT '',
                        ""Message"" text NOT NULL DEFAULT '',
                        ""Type"" character varying(50) NOT NULL DEFAULT 'note',
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT NOW()
                    );

                    CREATE INDEX IF NOT EXISTS ix_platform_ticket_events_ticket_id ON platform_ticket_events (""TicketId"");
                    CREATE INDEX IF NOT EXISTS ix_platform_ticket_events_created_at ON platform_ticket_events (""CreatedAt"");

                    -- Purge obsolete mock tickets setting
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PlatformSettings') THEN
                        DELETE FROM ""PlatformSettings"" WHERE ""Key"" = 'platform_support_tickets';
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_settings') THEN
                        DELETE FROM platform_settings WHERE ""Key"" = 'platform_support_tickets';
                    END IF;
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

                    ALTER TABLE users ADD COLUMN IF NOT EXISTS ""MustChangePassword"" boolean NOT NULL DEFAULT FALSE;

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

                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'call_records') THEN
                        ALTER TABLE call_records ADD COLUMN IF NOT EXISTS ""TwilioCallSid"" character varying(64) NULL;
                        ALTER TABLE call_records ADD COLUMN IF NOT EXISTS ""RecordingUrl"" character varying(256) NULL;
                        ALTER TABLE call_records ADD COLUMN IF NOT EXISTS ""Transcript"" text NULL;
                        ALTER TABLE call_records ADD COLUMN IF NOT EXISTS ""CallModule"" character varying(50) NULL;
                        ALTER TABLE call_records ADD COLUMN IF NOT EXISTS ""Reason"" text NULL;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CallRecords') THEN
                        ALTER TABLE ""CallRecords"" ADD COLUMN IF NOT EXISTS ""TwilioCallSid"" character varying(64) NULL;
                        ALTER TABLE ""CallRecords"" ADD COLUMN IF NOT EXISTS ""RecordingUrl"" character varying(256) NULL;
                        ALTER TABLE ""CallRecords"" ADD COLUMN IF NOT EXISTS ""Transcript"" text NULL;
                        ALTER TABLE ""CallRecords"" ADD COLUMN IF NOT EXISTS ""CallModule"" character varying(50) NULL;
                        ALTER TABLE ""CallRecords"" ADD COLUMN IF NOT EXISTS ""Reason"" text NULL;
                    END IF;

                    -- Backfill followups AssignedToName and AssignedToRole if empty
                    UPDATE followups f
                    SET ""AssignedToName"" = u.""Name"",
                        ""AssignedToRole"" = COALESCE(r.""Code"", 'sales_executive')
                    FROM users u
                    LEFT JOIN roles r ON r.""Id"" = u.""RoleId""
                    WHERE f.""AssignedAgentId"" = u.""Id""
                      AND (f.""AssignedToName"" IS NULL OR f.""AssignedToName"" = '' OR f.""AssignedToRole"" IS NULL OR f.""AssignedToRole"" = '');
                END $$;
            ";
            db.Database.ExecuteSqlRaw(sql);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Database Init Warning] {ex.Message}");
        }

        // Patch: reconcile leads whose KYC/Investor records are Approved
        try
        {
            var reconcileSql = @"
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ghl_deals') THEN
                        -- 1. Active Opportunities
                        UPDATE leads
                        SET ""Status"" = 'In Opportunity', ""UpdatedAt"" = NOW()
                        WHERE ""Status"" != 'In Opportunity'
                          AND EXISTS (
                            SELECT 1 FROM ghl_deals d
                            WHERE d.""CompanyId"" = leads.""CompanyId""
                              AND LOWER(TRIM(d.""Stage"")) IN ('investment_opportunity', 'opportunity', 'term_sheet', 'committed')
                              AND (
                                (d.""CustomerId"" IS NOT NULL AND d.""CustomerId"" = leads.""Id"")
                                OR LOWER(TRIM(d.""CustomerName"")) = LOWER(TRIM(leads.""Name""))
                              )
                          );

                        -- 2. Active KYC In Progress
                        UPDATE leads
                        SET ""Status"" = 'KYC In Progress', ""UpdatedAt"" = NOW()
                        WHERE ""Status"" NOT IN ('In Opportunity', 'Converted', 'KYC In Progress')
                          AND (
                            EXISTS (
                                SELECT 1 FROM ghl_deals d
                                WHERE d.""CompanyId"" = leads.""CompanyId""
                                  AND LOWER(TRIM(d.""Stage"")) IN ('qualified_investor', 'qualified')
                                  AND (
                                    (d.""CustomerId"" IS NOT NULL AND d.""CustomerId"" = leads.""Id"")
                                    OR LOWER(TRIM(d.""CustomerName"")) = LOWER(TRIM(leads.""Name""))
                                  )
                            )
                            OR EXISTS (
                                SELECT 1 FROM ""InvestorKycs"" k
                                WHERE k.""CompanyId"" = leads.""CompanyId""
                                  AND k.""Status"" IN (0, 1, 2)
                                  AND (
                                    (k.""Phone"" IS NOT NULL AND RIGHT(REGEXP_REPLACE(k.""Phone"", '\D', '', 'g'), 10) = RIGHT(REGEXP_REPLACE(leads.""Phone"", '\D', '', 'g'), 10))
                                    OR (k.""Email"" IS NOT NULL AND LOWER(TRIM(k.""Email"")) = LOWER(TRIM(leads.""Email"")))
                                    OR LOWER(TRIM(k.""InvestorName"")) = LOWER(TRIM(leads.""Name""))
                                  )
                            )
                          );

                        -- 3. Won / Converted Investors (without active opportunity)
                        UPDATE leads
                        SET ""Status"" = 'Converted', ""UpdatedAt"" = NOW()
                        WHERE ""Status"" NOT IN ('In Opportunity', 'Converted')
                          AND (
                            EXISTS (
                                SELECT 1 FROM ghl_deals d
                                WHERE d.""CompanyId"" = leads.""CompanyId""
                                  AND LOWER(TRIM(d.""Stage"")) IN ('converted', 'won')
                                  AND (
                                    (d.""CustomerId"" IS NOT NULL AND d.""CustomerId"" = leads.""Id"")
                                    OR LOWER(TRIM(d.""CustomerName"")) = LOWER(TRIM(leads.""Name""))
                                  )
                            )
                            OR EXISTS (
                                SELECT 1 FROM ""Investors"" i
                                WHERE i.""CompanyId"" = leads.""CompanyId""
                                  AND i.""Status"" = 1
                                  AND (
                                    (i.""Phone"" IS NOT NULL AND RIGHT(REGEXP_REPLACE(i.""Phone"", '\D', '', 'g'), 10) = RIGHT(REGEXP_REPLACE(leads.""Phone"", '\D', '', 'g'), 10))
                                    OR (i.""Email"" IS NOT NULL AND LOWER(TRIM(i.""Email"")) = LOWER(TRIM(leads.""Email"")))
                                    OR LOWER(TRIM(i.""Name"")) = LOWER(TRIM(leads.""Name""))
                                  )
                            )
                            OR EXISTS (
                                SELECT 1 FROM ""InvestorKycs"" k
                                WHERE k.""CompanyId"" = leads.""CompanyId""
                                  AND k.""Status"" = 3
                                  AND (
                                    (k.""Phone"" IS NOT NULL AND RIGHT(REGEXP_REPLACE(k.""Phone"", '\D', '', 'g'), 10) = RIGHT(REGEXP_REPLACE(leads.""Phone"", '\D', '', 'g'), 10))
                                    OR (k.""Email"" IS NOT NULL AND LOWER(TRIM(k.""Email"")) = LOWER(TRIM(leads.""Email"")))
                                    OR LOWER(TRIM(k.""InvestorName"")) = LOWER(TRIM(leads.""Name""))
                                  )
                            )
                          );
                    END IF;
                END $$;
            ";
            db.Database.ExecuteSqlRaw(reconcileSql);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Lead Reconciliation Warning] {ex.Message}");
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

        // Patch: remove sales_manager role and migrate any users with sales_manager to sales_executive
        try
        {
            var salesManagerRole = db.Roles.FirstOrDefault(r => r.Code == "sales_manager" || r.Id == 5);
            var salesExecutiveRole = db.Roles.FirstOrDefault(r => r.Code == "sales_executive" || r.Id == 3);

            if (salesExecutiveRole != null)
            {
                var managerUsers = db.Users.Where(u => u.RoleId == 5 || (salesManagerRole != null && u.RoleId == salesManagerRole.Id)).ToList();
                if (managerUsers.Any())
                {
                    foreach (var u in managerUsers)
                    {
                        u.RoleId = salesExecutiveRole.Id;
                        Console.WriteLine($"[Role Migration] Migrated user '{u.Email}' (ID: {u.Id}) from sales_manager to sales_executive.");
                    }
                    db.SaveChanges();
                }

                if (salesManagerRole != null)
                {
                    salesManagerRole.IsActive = false;
                    db.SaveChanges();
                    Console.WriteLine("[Role Migration] Deactivated obsolete 'sales_manager' role in database.");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Role Migration Warning] {ex.Message}");
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

        // Startup deduplication & cleanup for followups table
        try
        {
            // 1. Remove all old superseded placeholder rows created by superseded loops
            var supersededFollowups = db.Followups.Where(f => f.Notes != null && f.Notes.Contains("Superseded by follow-up scheduled for")).ToList();
            if (supersededFollowups.Any())
            {
                db.Followups.RemoveRange(supersededFollowups);
                db.SaveChanges();
                Console.WriteLine($"[Followup Cleanup] Removed {supersededFollowups.Count} superseded placeholder follow-up rows.");
            }

            // 2. Deduplicate pending followups per company & contact/phone
            var allPendingFollowups = db.Followups.Where(f => f.Status == backend.Models.Enums.FollowupStatus.Pending).ToList();
            var groupedPending = allPendingFollowups
                .GroupBy(f => new
                {
                    f.CompanyId,
                    Key = !string.IsNullOrWhiteSpace(f.ContactId) && f.ContactId != "contact-new" ? f.ContactId.Trim() : (f.ContactPhone != null && f.ContactPhone.Length >= 10 ? f.ContactPhone[^10..] : (f.ContactPhone ?? string.Empty))
                })
                .Where(g => !string.IsNullOrEmpty(g.Key.Key) && g.Count() > 1);

            bool dupsCleaned = false;
            foreach (var group in groupedPending)
            {
                var sorted = group.OrderByDescending(f => f.UpdatedAt ?? f.CreatedAt).ThenByDescending(f => f.Id).ToList();
                var toRemove = sorted.Skip(1).ToList();
                db.Followups.RemoveRange(toRemove);
                dupsCleaned = true;
            }
            if (dupsCleaned)
            {
                db.SaveChanges();
                Console.WriteLine("[Followup Cleanup] Deduplicated multiple pending follow-up records.");
            }

            // 3. For any lead that is currently in 'Callback' or 'No Response' or 'New' or 'Contacted',
            // remove any followup record mistakenly created for it so the lead stays strictly in My Leads.
            var myLeadsStatuses = new[] { "Callback", "No Response", "New", "Contacted" };
            var activeMyLeads = db.Leads.Where(l => myLeadsStatuses.Contains(l.Status)).ToList();
            var activeMyLeadPhones = activeMyLeads.Select(l => l.Phone?.Length >= 10 ? l.Phone[^10..] : l.Phone ?? "").Where(p => !string.IsNullOrEmpty(p)).ToHashSet();
            var activeMyLeadIds = activeMyLeads.Select(l => l.Id.ToString()).ToHashSet();

            var strayFollowups = db.Followups
                .Where(f =>
                    (f.ContactId != null && activeMyLeadIds.Contains(f.ContactId)) ||
                    (f.ContactPhone != null && activeMyLeadPhones.Contains(f.ContactPhone.Length >= 10 ? f.ContactPhone.Substring(f.ContactPhone.Length - 10) : f.ContactPhone)))
                .ToList();

            if (strayFollowups.Any())
            {
                db.Followups.RemoveRange(strayFollowups);
                db.SaveChanges();
                Console.WriteLine($"[Followup Cleanup] Removed {strayFollowups.Count} stray follow-up records for leads that belong in My Leads.");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Followup Cleanup Warning] {ex.Message}");
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

    try
    {
        var helpMeDecide = db.Leads.Count(l => l.CustomFieldsJson != null && l.CustomFieldsJson.Contains("help me decide"));
        var notConfirmed = db.Leads.Count(l => l.CustomFieldsJson != null && (l.CustomFieldsJson.Contains("\"assetClass\":\"") || l.CustomFieldsJson.Contains("\"preferredAssetClass\":\"")) && !l.CustomFieldsJson.Contains("\"irmPreferencesConfirmed\":true"));
        Console.WriteLine($"[DIAGNOSTIC] Count with help me decide: {helpMeDecide}");
        Console.WriteLine($"[DIAGNOSTIC] Count with asset class but not confirmed: {notConfirmed}");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Diagnostic Count Warning] {ex.Message}");
    }
}

app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor 
                     | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto 
                     | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedHost
});

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

// Serve uploaded documents, but never let the browser render them inline as HTML/scripts.
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var path = ctx.Context.Request.Path.Value ?? string.Empty;
        if (path.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase))
        {
            ctx.Context.Response.Headers["X-Content-Type-Options"] = "nosniff";
            ctx.Context.Response.Headers["Content-Security-Policy"] = "default-src 'none'; sandbox";
            ctx.Context.Response.Headers["Content-Disposition"] = "attachment";
        }
    }
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<backend.Hubs.PlatformHub>("/hubs/platform");

// Redirect root to Swagger UI
app.MapGet("/", () => Results.Redirect("/swagger"));

app.Run();