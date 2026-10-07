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
                // Allow storing full Base64 image data for project master layout blueprints
                @"ALTER TABLE IF EXISTS jamin_projects ALTER COLUMN ""ImageUrl"" TYPE TEXT;"
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

app.Run();