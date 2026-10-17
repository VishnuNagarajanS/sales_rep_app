using System.Net;
using System.Text.Json;
using backend.DTOs.Common;

namespace backend.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An unhandled exception occurred: {Message}", ex.Message);
            try
            {
                var innerMsg = ex.InnerException != null ? $" | Inner: {ex.InnerException.Message}" : "";
                var logLine = $"[{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}] {context.Request.Method} {context.Request.Path}: {ex.Message}{innerMsg}\n{ex.StackTrace}\n\n";
                File.AppendAllText("error.log", logLine);
            }
            catch { }
            await HandleExceptionAsync(context, ex);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

        var errors = new List<string> { exception.Message };
        var inner = exception.InnerException;
        while (inner != null)
        {
            errors.Add(inner.Message);
            inner = inner.InnerException;
        }

        var response = ApiResponse<object>.FailureResult(
            exception.Message,
            errors
        );

        var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        await context.Response.WriteAsync(json);
    }
}
