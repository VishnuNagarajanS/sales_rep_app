using backend.Extensions;
using backend.Middleware;
using backend.Models.Enums;
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
        string? migrationError = null;
        try
        {
            Console.WriteLine("[Database] Applying database migrations to PostgreSQL...");
            db.Database.Migrate();
            Console.WriteLine("[Database] Database migrations applied successfully.");
        }
        catch (Exception migEx)
        {
            migrationError = migEx.Message;
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"[Database Migration Error] {migEx.Message}");
            if (migEx.InnerException != null)
            {
                Console.WriteLine($"[Database Migration Inner Exception] {migEx.InnerException.Message}");
            }
            Console.ResetColor();
        }

        if (!string.IsNullOrEmpty(migrationError))
        {
            throw new InvalidOperationException($"Application startup aborted: Database migration failed ({migrationError}). Background services and seeders will not run on an unmigrated database.", new Exception(migrationError));
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

    // Clean up any old mock follow-ups or legacy mock user accounts
    try
    {
        var mockFollowups = db.Followups
            .Where(f => (f.AssignedToName != null && f.AssignedToName.Contains("Rajesh")) ||
                        (f.Notes != null && f.Notes.Contains("Initial introductory call completed successfully")) ||
                        (f.Notes != null && f.Notes.Contains("Discussion on portfolio allocation and investment ticket size")) ||
                        (f.Notes != null && f.Notes.Contains("Quarterly wealth check-in and investment strategy review")))
            .ToList();
        if (mockFollowups.Any())
        {
            db.Followups.RemoveRange(mockFollowups);
            db.SaveChanges();
            Console.WriteLine($"[Cleanup] Removed {mockFollowups.Count} mock follow-up records.");
        }

        var legacyRajeshUsers = db.Users.Where(u => u.Email.Contains("rajesh@") || u.Name.Contains("Rajesh Sharma")).ToList();
        if (legacyRajeshUsers.Any())
        {
            db.Users.RemoveRange(legacyRajeshUsers);
            db.SaveChanges();
            Console.WriteLine($"[Cleanup] Removed {legacyRajeshUsers.Count} legacy Rajesh user account(s).");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Cleanup Warning] {ex.Message}");
    }

    try
    {
        var helpMeDecide = db.Leads.Count(l => l.CustomFieldsJson != null && l.CustomFieldsJson.Contains("help me decide"));
        var notConfirmed = db.Leads.Count(l => l.CustomFieldsJson != null && (l.CustomFieldsJson.Contains("\"assetClass\":\"") || l.CustomFieldsJson.Contains("\"preferredAssetClass\":\"")) && !l.CustomFieldsJson.Contains("\"irmPreferencesConfirmed\":true"));
        Console.WriteLine($"[DIAGNOSTIC] Count with help me decide: {helpMeDecide}");
        Console.WriteLine($"[DIAGNOSTIC] Count with asset class but not confirmed: {notConfirmed}");
    }
    catch { }
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
app.UseMiddleware<RequestLoggingMiddleware>();
app.UseAuthorization();

app.MapControllers();
app.MapHub<backend.Hubs.PlatformHub>("/hubs/platform");

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
