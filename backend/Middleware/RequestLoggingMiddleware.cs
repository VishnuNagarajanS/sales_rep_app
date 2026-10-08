using System.Diagnostics;

namespace backend.Middleware;

/// <summary>Writes one concise terminal log entry for every HTTP request.</summary>
public sealed class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingMiddleware> _logger;

    public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "HTTP {Method} {Path} failed. TraceId={TraceId} UserId={UserId} Role={Role}",
                context.Request.Method,
                context.Request.Path,
                context.TraceIdentifier,
                context.User.FindFirst("userId")?.Value,
                context.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value);
            throw;
        }
        finally
        {
            stopwatch.Stop();
            _logger.LogInformation(
                "HTTP {Method} {Path} -> {StatusCode} in {ElapsedMs}ms. TraceId={TraceId} UserId={UserId} Role={Role}",
                context.Request.Method,
                context.Request.Path,
                context.Response.StatusCode,
                stopwatch.ElapsedMilliseconds,
                context.TraceIdentifier,
                context.User.FindFirst("userId")?.Value ?? "anonymous",
                context.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "anonymous");
        }
    }
}
