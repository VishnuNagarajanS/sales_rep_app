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

// Ensure database and seed data are initialized
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
