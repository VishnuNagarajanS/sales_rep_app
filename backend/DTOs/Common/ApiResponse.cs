namespace backend.DTOs.Common;

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public T? Data { get; set; }
    public List<string>? Errors { get; set; }

    public static ApiResponse<T> SuccessResult(T data, string message = "Success")
    {
        return new ApiResponse<T>
        {
            Success = true,
            Message = message,
            Data = data
        };
    }

    public static ApiResponse<T> SuccessResponse(T data, string message = "Success") => SuccessResult(data, message);

    public static ApiResponse<T> FailureResult(string message, List<string>? errors = null)
    {
        return new ApiResponse<T>
        {
            Success = false,
            Message = message,
            Errors = errors ?? new List<string>()
        };
    }

    public static ApiResponse<T> FailureResult(string message, T? data, List<string>? errors = null)
    {
        return new ApiResponse<T>
        {
            Success = false,
            Message = message,
            Data = data,
            Errors = errors ?? new List<string>()
        };
    }

    public static ApiResponse<T> ErrorResponse(string message, List<string>? errors = null) => FailureResult(message, errors);
}
