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
builder.Services.AddHostedService<backend.Services.Implementations.JaminHoldExpiryBackgroundService>();

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
                        UPDATE tenants SET ""SubscriptionPlan"" = 'Wealth Advisory Enterprise Suite' WHERE ""Id"" IN (1, 2) OR ""Slug"" IN ('ghl', 'jamin');
                    END IF;

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
                        ALTER TABLE call_records ADD COLUMN IF NOT EXISTS ""LeadStatusAtCall"" character varying(50) NULL;
                        ALTER TABLE call_records ADD COLUMN IF NOT EXISTS ""Reason"" text NULL;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CallRecords') THEN
                        ALTER TABLE ""CallRecords"" ADD COLUMN IF NOT EXISTS ""TwilioCallSid"" character varying(64) NULL;
                        ALTER TABLE ""CallRecords"" ADD COLUMN IF NOT EXISTS ""RecordingUrl"" character varying(256) NULL;
                        ALTER TABLE ""CallRecords"" ADD COLUMN IF NOT EXISTS ""Transcript"" text NULL;
                        ALTER TABLE ""CallRecords"" ADD COLUMN IF NOT EXISTS ""CallModule"" character varying(50) NULL;
                        ALTER TABLE ""CallRecords"" ADD COLUMN IF NOT EXISTS ""LeadStatusAtCall"" character varying(50) NULL;
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
            ";
            db.Database.ExecuteSqlRaw(reconcileSql);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Lead Reconciliation Warning] {ex.Message}");
        }

        // ── Jamin Bazaar Database Schema & Initial Data Sync ───────────────────
        try
        {
            var jaminSql = @"
                DO $$
                BEGIN
                    -- 1. Jamin Projects table
                    CREATE TABLE IF NOT EXISTS jamin_projects (
                        ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""CompanyId"" integer NOT NULL,
                        ""Name"" character varying(200) NOT NULL,
                        ""Location"" character varying(300) NOT NULL,
                        ""Status"" character varying(50) NOT NULL DEFAULT 'Active',
                        ""Description"" character varying(2000) NOT NULL DEFAULT '',
                        ""TotalPlots"" integer NOT NULL DEFAULT 0,
                        ""AvailablePlots"" integer NOT NULL DEFAULT 0,
                        ""BookedPlots"" integer NOT NULL DEFAULT 0,
                        ""PriceRange"" character varying(100) NOT NULL DEFAULT '',
                        ""ImageUrl"" text,
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT (NOW()),
                        ""UpdatedAt"" timestamp with time zone,
                        CONSTRAINT ""FK_jamin_projects_tenants_CompanyId"" FOREIGN KEY (""CompanyId"") REFERENCES tenants (""Id"") ON DELETE CASCADE
                    );

                    -- 2. Jamin Plots table
                    CREATE TABLE IF NOT EXISTS jamin_plots (
                        ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""CompanyId"" integer NOT NULL,
                        ""ProjectId"" integer NOT NULL,
                        ""PlotNumber"" character varying(100) NOT NULL,
                        ""Dimensions"" character varying(50) NOT NULL DEFAULT '30 x 40',
                        ""AreaSqFt"" integer NOT NULL DEFAULT 1200,
                        ""Facing"" character varying(50) NOT NULL DEFAULT 'East',
                        ""Status"" character varying(50) NOT NULL DEFAULT 'Available',
                        ""Price"" numeric(18,2) NOT NULL DEFAULT 0,
                        ""PricePerSqft"" numeric(18,2) NOT NULL DEFAULT 0,
                        ""HeldByCustomerId"" integer,
                        ""HeldByCustomerName"" character varying(150),
                        ""HeldByCustomerPhone"" character varying(50),
                        ""HoldByAgent"" character varying(150),
                        ""HoldExpiresAt"" timestamp with time zone,
                        ""Notes"" character varying(2000),
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT (NOW()),
                        ""UpdatedAt"" timestamp with time zone,
                        CONSTRAINT ""FK_jamin_plots_tenants_CompanyId"" FOREIGN KEY (""CompanyId"") REFERENCES tenants (""Id"") ON DELETE CASCADE,
                        CONSTRAINT ""FK_jamin_plots_jamin_projects_ProjectId"" FOREIGN KEY (""ProjectId"") REFERENCES jamin_projects (""Id"") ON DELETE CASCADE
                    );

                    -- 3. Jamin Bookings table
                    CREATE TABLE IF NOT EXISTS jamin_bookings (
                        ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""CompanyId"" integer NOT NULL,
                        ""ProjectId"" integer,
                        ""PlotId"" integer,
                        ""CustomerId"" integer,
                        ""LeadId"" integer,
                        ""CustomerName"" character varying(150) NOT NULL,
                        ""CustomerPhone"" character varying(50) NOT NULL,
                        ""ProjectName"" character varying(200) NOT NULL DEFAULT '',
                        ""PlotNumber"" character varying(100) NOT NULL DEFAULT '',
                        ""BasePrice"" numeric(18,2) NOT NULL DEFAULT 0,
                        ""DevelopmentCharges"" numeric(18,2) NOT NULL DEFAULT 0,
                        ""ApprovedDiscounts"" numeric(18,2) NOT NULL DEFAULT 0,
                        ""TotalPlotPrice"" numeric(18,2) NOT NULL DEFAULT 0,
                        ""TokenAmountPaid"" numeric(18,2) NOT NULL DEFAULT 0,
                        ""PaymentMode"" character varying(100) NOT NULL DEFAULT 'Bank Transfer / NEFT',
                        ""PaymentTerms"" character varying(500),
                        ""PaymentStatus"" character varying(50) NOT NULL DEFAULT 'Pending',
                        ""Status"" character varying(50) NOT NULL DEFAULT 'Token Paid',
                        ""HoldExpiresAt"" timestamp with time zone,
                        ""BookingDate"" timestamp with time zone NOT NULL DEFAULT (NOW()),
                        ""AssignedAgentId"" integer,
                        ""AssignedAgentName"" character varying(150) NOT NULL DEFAULT '',
                        ""CancelledAt"" timestamp with time zone,
                        ""CancelledByUserId"" integer,
                        ""CancelledByName"" character varying(150),
                        ""CancellationReason"" character varying(2000),
                        ""RefundAmount"" numeric(18,2) NOT NULL DEFAULT 0,
                        ""Notes"" character varying(2000),
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT (NOW()),
                        ""UpdatedAt"" timestamp with time zone,
                        CONSTRAINT ""FK_jamin_bookings_tenants_CompanyId"" FOREIGN KEY (""CompanyId"") REFERENCES tenants (""Id"") ON DELETE CASCADE
                    );

                    -- 4. Jamin Payments table
                    CREATE TABLE IF NOT EXISTS jamin_payments (
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
                        CONSTRAINT ""FK_jamin_payments_jamin_bookings_BookingId"" FOREIGN KEY (""BookingId"") REFERENCES jamin_bookings (""Id"") ON DELETE RESTRICT
                    );

                    -- 5. Site Visits table
                    CREATE TABLE IF NOT EXISTS site_visits (
                        ""Id"" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                        ""TenantId"" integer NOT NULL,
                        ""LeadId"" integer,
                        ""CustomerId"" integer,
                        ""ProjectId"" integer,
                        ""PlotId"" integer,
                        ""CustomerName"" character varying(150) NOT NULL,
                        ""CustomerPhone"" character varying(50) NOT NULL,
                        ""ContactType"" character varying(50) DEFAULT 'lead',
                        ""ProjectName"" character varying(200) NOT NULL,
                        ""PlotNumber"" character varying(100),
                        ""ScheduledAt"" character varying(150) NOT NULL,
                        ""AssignedAgentId"" integer,
                        ""AssignedAgentName"" character varying(150),
                        ""Status"" character varying(50) NOT NULL DEFAULT 'Pending',
                        ""VisitorNote"" character varying(2000),
                        ""OutcomeNotes"" character varying(2000),
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT (NOW()),
                        ""UpdatedAt"" timestamp with time zone,
                        CONSTRAINT ""FK_site_visits_tenants_TenantId"" FOREIGN KEY (""TenantId"") REFERENCES tenants (""Id"") ON DELETE CASCADE
                    );

                    -- 6. Ensure Lead columns for Jamin
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads') THEN
                        ALTER TABLE leads ADD COLUMN IF NOT EXISTS ""TargetDevelopment"" text;
                        ALTER TABLE leads ADD COLUMN IF NOT EXISTS ""PreferredVisitDate"" text;
                        ALTER TABLE leads ADD COLUMN IF NOT EXISTS ""PreferredTimeSlot"" text;
                        ALTER TABLE leads ADD COLUMN IF NOT EXISTS ""AnythingWeShouldKnow"" text;
                        ALTER TABLE leads ADD COLUMN IF NOT EXISTS ""WhatAreYouLookingFor"" text;
                        ALTER TABLE leads ADD COLUMN IF NOT EXISTS ""BudgetRange"" text;
                        ALTER TABLE leads ADD COLUMN IF NOT EXISTS ""ReadyToRegister"" text;
                        ALTER TABLE leads ADD COLUMN IF NOT EXISTS ""InvestmentCapacity"" text;
                        ALTER TABLE leads ADD COLUMN IF NOT EXISTS ""AssetClass"" text;
                        ALTER TABLE leads ADD COLUMN IF NOT EXISTS ""Horizon"" text;
                        ALTER TABLE leads ADD COLUMN IF NOT EXISTS ""InvestorType"" text;
                        ALTER TABLE leads ADD COLUMN IF NOT EXISTS ""AssignedAgentName"" text;
                    END IF;

                    -- 7. Ensure Customer columns for Jamin
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
                        ALTER TABLE customers ALTER COLUMN ""AssignedAgentId"" DROP NOT NULL;
                    END IF;

                    -- 8. Ensure Followup columns for Jamin
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'followups') THEN
                        ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""LeadId"" integer;
                        ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""CustomerId"" integer;
                        ALTER TABLE followups ADD COLUMN IF NOT EXISTS ""FollowupType"" character varying(50) DEFAULT 'call';
                    END IF;

                    -- 9. Ensure AuditLog and Notification columns
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
                        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ""LeadId"" integer;
                        ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ""CustomerId"" integer;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
                        ALTER TABLE notifications ADD COLUMN IF NOT EXISTS ""LeadId"" integer;
                        ALTER TABLE notifications ADD COLUMN IF NOT EXISTS ""CustomerId"" integer;
                    END IF;

                    -- 10. Add helpful indexes
                    CREATE INDEX IF NOT EXISTS ""IX_jamin_plots_CompanyId_ProjectId_Status"" ON jamin_plots (""CompanyId"", ""ProjectId"", ""Status"");
                    CREATE INDEX IF NOT EXISTS ""IX_jamin_plots_HeldByCustomerId"" ON jamin_plots (""HeldByCustomerId"");
                    CREATE INDEX IF NOT EXISTS ""IX_jamin_bookings_CompanyId_Status"" ON jamin_bookings (""CompanyId"", ""Status"");
                    CREATE INDEX IF NOT EXISTS ""IX_jamin_bookings_LeadId"" ON jamin_bookings (""LeadId"");
                    CREATE INDEX IF NOT EXISTS ""IX_jamin_bookings_CustomerId"" ON jamin_bookings (""CustomerId"");
                    CREATE INDEX IF NOT EXISTS ""IX_site_visits_TenantId_Status"" ON site_visits (""TenantId"", ""Status"");
                END $$;
            ";
            db.Database.ExecuteSqlRaw(jaminSql);

            // Real Jamin Bazaar Data Initialization: Purge legacy mock data & populate genuine DTCP plots
            try
            {
                // 1. Purge any legacy mock Bangalore data in foreign-key safe order
                db.Database.ExecuteSqlRaw(@"
                    DELETE FROM jamin_payments WHERE ""BookingId"" IN (
                        SELECT ""Id"" FROM jamin_bookings WHERE ""CompanyId"" = 2 AND (
                            ""ProjectName"" LIKE '%Greenfield%' OR ""ProjectId"" IN (
                                SELECT ""Id"" FROM jamin_projects WHERE ""CompanyId"" = 2 AND (
                                    ""Name"" LIKE '%Greenfield%' OR ""Location"" LIKE '%Bengaluru%' OR ""Location"" LIKE '%Devanahalli%'
                                )
                            )
                        )
                    );
                    DELETE FROM jamin_bookings WHERE ""CompanyId"" = 2 AND (
                        ""ProjectName"" LIKE '%Greenfield%' OR ""ProjectId"" IN (
                            SELECT ""Id"" FROM jamin_projects WHERE ""CompanyId"" = 2 AND (
                                ""Name"" LIKE '%Greenfield%' OR ""Location"" LIKE '%Bengaluru%' OR ""Location"" LIKE '%Devanahalli%'
                            )
                        )
                    );
                    DELETE FROM site_visits WHERE ""TenantId"" = 2 AND ""ProjectId"" IN (
                        SELECT ""Id"" FROM jamin_projects WHERE ""CompanyId"" = 2 AND (
                            ""Name"" LIKE '%Greenfield%' OR ""Location"" LIKE '%Bengaluru%' OR ""Location"" LIKE '%Devanahalli%'
                        )
                    );
                    DELETE FROM jamin_plots WHERE ""CompanyId"" = 2 AND ""ProjectId"" IN (
                        SELECT ""Id"" FROM jamin_projects WHERE ""CompanyId"" = 2 AND (
                            ""Name"" LIKE '%Greenfield%' OR ""Location"" LIKE '%Bengaluru%' OR ""Location"" LIKE '%Devanahalli%'
                        )
                    );
                    DELETE FROM jamin_projects WHERE ""CompanyId"" = 2 AND (
                        ""Name"" LIKE '%Greenfield%' OR ""Location"" LIKE '%Bengaluru%' OR ""Location"" LIKE '%Devanahalli%'
                    );
                ");
                Console.WriteLine("[Jamin Bazaar] Purged legacy mock Greenfield plots, bookings, and projects.");

                // 2. Populate Genuine DTCP-Approved Jamin Bazaar Projects if not already present
                if (!db.JaminProjects.Any(p => p.CompanyId == 2 && p.Name.Contains("Shastri Nagar")))
                {
                    // Project 1: Jamin Garden — Shastri Nagar (Erode)
                    var shastriNagar = new backend.Models.Entities.JaminProject
                    {
                        CompanyId = 2,
                        Name = "Jamin Garden — Shastri Nagar",
                        Location = "Old Chennimalai Road, Shastri Nagar, Railway Colony, Erode, Tamil Nadu — 638002",
                        Status = "Active",
                        Description = "DTCP No. 320/2025 approved plotted community in Shastri Nagar, Erode. Extent: 0.81 Acres. Survey Nos: 789/3B2E2A1A2, 789/3B2E2A1A3C. Sheet: SHEET JG-ERD-016. Walking distance to Railway Colony, 30ft/24ft wide tar roads, solar street lighting, underground drainage, water connections, and immediate registration.",
                        TotalPlots = 16,
                        AvailablePlots = 14,
                        BookedPlots = 2,
                        PriceRange = "₹38.2 Lakhs - ₹90.3 Lakhs",
                        ImageUrl = "https://zmxqozvivdluuxvvcegs.supabase.co/storage/v1/object/public/property-media/jamin-garden-erode/docs/dtcp-layout-plan-2026.png",
                        CreatedAt = DateTime.UtcNow
                    };
                    db.JaminProjects.Add(shastriNagar);

                    // Project 2: Jamin Garden — Edappadi (Salem)
                    var edappadi = new backend.Models.Entities.JaminProject
                    {
                        CompanyId = 2,
                        Name = "Jamin Garden — Edappadi",
                        Location = "Edappadi Bypass Road, Salem District, Tamil Nadu — 637101",
                        Status = "Active",
                        Description = "Premier DTCP-Approved 4.0-Acre township 300m off Edappadi Bypass. Survey Nos: 214/1B, 214/2, 215/1. Sheet: SHEET JG-SLM-060. Total 60 residential villa plots, 24ft to 39ft wide internal blacktop roads, park amenities, children play area, immediate bank loan & patta registration.",
                        TotalPlots = 60,
                        AvailablePlots = 58,
                        BookedPlots = 2,
                        PriceRange = "₹14.4 Lakhs - ₹44.5 Lakhs",
                        ImageUrl = "https://jaminbazaar.in/property/gallery/jamin-new-project-jul-2026/01.webp",
                        CreatedAt = DateTime.UtcNow
                    };
                    db.JaminProjects.Add(edappadi);

                    // Project 3: Trichy's Tulip (Tiruchirappalli)
                    var trichy = new backend.Models.Entities.JaminProject
                    {
                        CompanyId = 2,
                        Name = "Trichy's Tulip",
                        Location = "Innam Kolathur, Tiruchirappalli, Tamil Nadu — 621313",
                        Status = "Upcoming",
                        Description = "DTCP-Approved 6.5-Acre integrated gated layout in Innam Kolathur, Tiruchirappalli. Sheet: SHEET JG-TIR-120. 120 residential plots with avenue plantation, blacktop roads, clear titles.",
                        TotalPlots = 120,
                        AvailablePlots = 120,
                        BookedPlots = 0,
                        PriceRange = "₹18 Lakhs - ₹42 Lakhs",
                        ImageUrl = "/project-layout-blueprint.svg",
                        CreatedAt = DateTime.UtcNow
                    };
                    db.JaminProjects.Add(trichy);

                    // Project 4: Jamin Garden — Varapatty (Coimbatore)
                    var varapatty = new backend.Models.Entities.JaminProject
                    {
                        CompanyId = 2,
                        Name = "Jamin Garden — Varapatty",
                        Location = "KamanaickenPalayam, Varapatty, Coimbatore, Tamil Nadu — 641669",
                        Status = "Upcoming",
                        Description = "5.75-Acre scenic development in KamanaickenPalayam / Varapatty, Coimbatore corridor. Sheet: SHEET JG-CBE-116. 116 plots with 30ft roads and park reservation.",
                        TotalPlots = 116,
                        AvailablePlots = 116,
                        BookedPlots = 0,
                        PriceRange = "₹22 Lakhs - ₹55 Lakhs",
                        ImageUrl = "/project-layout-blueprint.svg",
                        CreatedAt = DateTime.UtcNow
                    };
                    db.JaminProjects.Add(varapatty);

                    // Project 5: Jamin Garden — Udumalaipet (Tiruppur)
                    var udumalaipet = new backend.Models.Entities.JaminProject
                    {
                        CompanyId = 2,
                        Name = "Jamin Garden — Udumalaipet",
                        Location = "Udumalaipettai, Udumalaipet, Tiruppur District, Tamil Nadu — 642126",
                        Status = "Completed",
                        Description = "Delivered 4.9-Acre DTCP approved township in Udumalaipettai, Tiruppur. Sheet: SHEET JG-TPR-060. 60 residential plots completely sold out and handed over.",
                        TotalPlots = 60,
                        AvailablePlots = 0,
                        BookedPlots = 60,
                        PriceRange = "₹25 Lakhs - ₹50 Lakhs",
                        ImageUrl = "/project-layout-blueprint.svg",
                        CreatedAt = DateTime.UtcNow
                    };
                    db.JaminProjects.Add(udumalaipet);

                    db.SaveChanges();

                    // Seed Real Plots for Shastri Nagar (16 Plots, DTCP No. 320/2025)
                    var shastriPlots = new (string Num, string Dim, int Area, string Facing, string Status, decimal Price, decimal Rate, string? Notes)[]
                    {
                        ("Plot 1", "30 x 40", 1200, "North", "Available", 4200000m, 3500m, "DTCP 320/2025 Approved. Survey: 789/3B2E2A1A2"),
                        ("Plot 2", "30 x 40", 1200, "North", "Available", 4200000m, 3500m, "DTCP 320/2025 Approved. Road width 30ft"),
                        ("Plot 3", "30 x 45", 1350, "North", "Available", 4725000m, 3500m, "DTCP 320/2025 Approved. Clear Patta"),
                        ("Plot 4", "30 x 50", 1500, "East", "Available", 5250000m, 3500m, "DTCP 320/2025 Approved. East facing auspicious"),
                        ("Plot 5", "30 x 50", 1500, "East", "Hold", 5250000m, 3500m, "DTCP 320/2025 Approved. Client verification underway"),
                        ("Plot 6", "40 x 60", 2400, "East", "Booked", 8400000m, 3500m, "Corner Plot. DTCP 320/2025 Approved"),
                        ("Plot 7", "30 x 36.5", 1094, "North", "Available", 3829000m, 3500m, "DTCP 320/2025 Approved. Compact villa plot"),
                        ("Plot 8", "30 x 40", 1200, "West", "Available", 4200000m, 3500m, "DTCP 320/2025 Approved. 24ft frontage road"),
                        ("Plot 9", "30 x 40", 1200, "West", "Available", 4200000m, 3500m, "DTCP 320/2025 Approved. Direct EB connectivity"),
                        ("Plot 10", "29 x 50", 1450, "West", "Available", 5075000m, 3500m, "DTCP 320/2025 Approved. Survey: 789/3B2E2A1A3C"),
                        ("Plot 11", "32 x 50", 1600, "South", "Available", 5600000m, 3500m, "DTCP 320/2025 Approved. Close to Railway Colony road"),
                        ("Plot 12", "36 x 50", 1800, "North", "Available", 6300000m, 3500m, "DTCP 320/2025 Approved. Premium wide frontage"),
                        ("Plot 13", "30 x 40", 1200, "East", "Available", 4200000m, 3500m, "DTCP 320/2025 Approved. East facing"),
                        ("Plot 14", "30 x 50", 1500, "East", "Available", 5250000m, 3500m, "DTCP 320/2025 Approved. 30ft blacktop road frontage"),
                        ("Plot 15", "35 x 60", 2100, "East", "Available", 7350000m, 3500m, "DTCP 320/2025 Approved. Large luxury plot"),
                        ("Plot 16", "Corner Cut", 2582, "North-East", "Booked", 9037000m, 3500m, "Prime North-East Corner Plot. DTCP 320/2025 Approved"),
                    };

                    foreach (var p in shastriPlots)
                    {
                        db.JaminPlots.Add(new backend.Models.Entities.JaminPlot
                        {
                            CompanyId = 2,
                            ProjectId = shastriNagar.Id,
                            PlotNumber = p.Num,
                            Dimensions = p.Dim,
                            AreaSqFt = p.Area,
                            Facing = p.Facing,
                            Status = p.Status,
                            Price = p.Price,
                            PricePerSqft = p.Rate,
                            Notes = p.Notes,
                            HeldByCustomerName = p.Status == "Hold" ? "Murugesan K" : null,
                            HeldByCustomerPhone = p.Status == "Hold" ? "+91 94433 12456" : null,
                            HoldByAgent = p.Status == "Hold" ? "Jamin Sales Team" : null,
                            HoldExpiresAt = p.Status == "Hold" ? DateTime.UtcNow.AddDays(5) : null,
                            CreatedAt = DateTime.UtcNow
                        });
                    }

                    // Seed Real Plots for Edappadi (60 Plots, DTCP Approved, Sheet JG-SLM-060)
                    for (int i = 1; i <= 60; i++)
                    {
                        int area = (i <= 25) ? 1200 : (i <= 45 ? 1500 : (i <= 55 ? 1800 : 2400));
                        string dim = (i <= 25) ? "30 x 40" : (i <= 45 ? "30 x 50" : (i <= 55 ? "30 x 60" : "40 x 60"));
                        string facing = (i % 3 == 0) ? "North" : ((i % 3 == 1) ? "East" : "West");
                        decimal rate = 1250m;
                        decimal price = area * rate;
                        string status = (i == 12) ? "Hold" : ((i == 25 || i == 60) ? "Booked" : "Available");

                        db.JaminPlots.Add(new backend.Models.Entities.JaminPlot
                        {
                            CompanyId = 2,
                            ProjectId = edappadi.Id,
                            PlotNumber = $"Plot {i}",
                            Dimensions = dim,
                            AreaSqFt = area,
                            Facing = facing,
                            Status = status,
                            Price = price,
                            PricePerSqft = rate,
                            Notes = $"DTCP Approved Layout. Survey Nos: 214/1B, 214/2, 215/1. Sheet: SHEET JG-SLM-060. Internal road 24-39ft.",
                            HeldByCustomerName = status == "Hold" ? "Senthil Kumar S" : null,
                            HeldByCustomerPhone = status == "Hold" ? "+91 98421 87654" : null,
                            HoldByAgent = status == "Hold" ? "Jamin Sales Team" : null,
                            HoldExpiresAt = status == "Hold" ? DateTime.UtcNow.AddDays(6) : null,
                            CreatedAt = DateTime.UtcNow
                        });
                    }

                    // Seed Real Plots for Trichy's Tulip (120 Plots, DTCP Approved, Sheet JG-TIR-120)
                    for (int i = 1; i <= 120; i++)
                    {
                        int area = (i <= 50) ? 1200 : (i <= 90 ? 1500 : (i <= 110 ? 1800 : 2400));
                        string dim = (i <= 50) ? "30 x 40" : (i <= 90 ? "30 x 50" : (i <= 110 ? "30 x 60" : "40 x 60"));
                        string facing = (i % 3 == 0) ? "North" : ((i % 3 == 1) ? "East" : "West");
                        decimal rate = 1100m;
                        decimal price = area * rate;

                        db.JaminPlots.Add(new backend.Models.Entities.JaminPlot
                        {
                            CompanyId = 2,
                            ProjectId = trichy.Id,
                            PlotNumber = $"Plot {i}",
                            Dimensions = dim,
                            AreaSqFt = area,
                            Facing = facing,
                            Status = "Available",
                            Price = price,
                            PricePerSqft = rate,
                            Notes = "DTCP Approved. Innam Kolathur, Tiruchirappalli. Sheet: JG-TIR-120.",
                            CreatedAt = DateTime.UtcNow
                        });
                    }

                    // Seed Real Plots for Varapatty (116 Plots, Sheet JG-CBE-116)
                    for (int i = 1; i <= 116; i++)
                    {
                        int area = (i <= 45) ? 1200 : (i <= 85 ? 1500 : (i <= 105 ? 1800 : 2400));
                        string dim = (i <= 45) ? "30 x 40" : (i <= 85 ? "30 x 50" : (i <= 105 ? "30 x 60" : "40 x 60"));
                        string facing = (i % 3 == 0) ? "North" : ((i % 3 == 1) ? "East" : "West");
                        decimal rate = 1350m;
                        decimal price = area * rate;

                        db.JaminPlots.Add(new backend.Models.Entities.JaminPlot
                        {
                            CompanyId = 2,
                            ProjectId = varapatty.Id,
                            PlotNumber = $"Plot {i}",
                            Dimensions = dim,
                            AreaSqFt = area,
                            Facing = facing,
                            Status = "Available",
                            Price = price,
                            PricePerSqft = rate,
                            Notes = "KamanaickenPalayam, Varapatty, Coimbatore corridor. Sheet: JG-CBE-116.",
                            CreatedAt = DateTime.UtcNow
                        });
                    }

                    // Seed Real Plots for Udumalaipet (60 Plots - 100% Delivered & Sold Out)
                    for (int i = 1; i <= 60; i++)
                    {
                        int area = (i <= 25) ? 1200 : (i <= 45 ? 1500 : (i <= 55 ? 1800 : 2400));
                        string dim = (i <= 25) ? "30 x 40" : (i <= 45 ? "30 x 50" : (i <= 55 ? "30 x 60" : "40 x 60"));
                        string facing = (i % 3 == 0) ? "North" : ((i % 3 == 1) ? "East" : "West");
                        decimal rate = 1200m;
                        decimal price = area * rate;

                        db.JaminPlots.Add(new backend.Models.Entities.JaminPlot
                        {
                            CompanyId = 2,
                            ProjectId = udumalaipet.Id,
                            PlotNumber = $"Plot {i}",
                            Dimensions = dim,
                            AreaSqFt = area,
                            Facing = facing,
                            Status = "Sold",
                            Price = price,
                            PricePerSqft = rate,
                            Notes = "DTCP Approved. Delivered & Registered. Udumalaipettai, Tiruppur. Sheet: JG-TPR-060.",
                            CreatedAt = DateTime.UtcNow
                        });
                    }

                    db.SaveChanges();
                    Console.WriteLine("[Jamin Bazaar] Successfully seeded 5 real DTCP-approved Tamil Nadu projects and plot inventories.");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Jamin Seed Warning] {ex.Message} -> {ex.InnerException?.Message}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Jamin Schema Sync Warning] {ex.Message}");
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
                    db.Roles.Remove(salesManagerRole);
                    db.SaveChanges();
                    Console.WriteLine("[Role Migration] Removed obsolete 'sales_manager' role from database.");
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

app.Run();