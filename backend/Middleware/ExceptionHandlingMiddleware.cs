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
        catch (OperationCanceledException)
        {
            // Request was aborted by the client (e.g. browser navigation or refresh)
            _logger.LogInformation("Request was canceled by the client.");
        }
        catch (Exception ex) when (context.RequestAborted.IsCancellationRequested)
        {
            // A disconnected client can surface as IOException/NpgsqlException while
            // EF is writing or reading; don't report an aborted request as a server crash.
            _logger.LogInformation(ex, "Request ended after the client disconnected.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CRITICAL UNHANDLED EXCEPTION] {ex}");
            _logger.LogError(ex, "An unhandled exception occurred: {Message}", ex.Message);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        if (context.Response.HasStarted)
        {
            return;
        }

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

        var message = exception.Message;
        var details = new List<string>();
        if (exception.InnerException != null)
        {
            details.Add(exception.InnerException.Message);
        }

        var response = ApiResponse<object>.FailureResult(
            string.IsNullOrWhiteSpace(message) ? "An unexpected error occurred. Please try again later." : message,
            details.Count > 0 ? details : new List<string> { "Internal server error." }
        );

        var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        await context.Response.WriteAsync(json);
    }
}
