using backend.DTOs.Common;
using backend.DTOs.Ai;
using backend.Services.Ai;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/ai")]
    [Authorize(Roles = "company_admin")] // Strictly admin for now as requested
    public class AiAssistantController : ControllerBase
    {
        private readonly AiAssistantService _aiService;
        private readonly backend.Authentication.Interfaces.ICurrentUserService _currentUser;
        private readonly backend.Data.ApplicationDbContext _db;
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<int, Queue<DateTime>> _rateLimits = new();

        public AiAssistantController(AiAssistantService aiService, backend.Authentication.Interfaces.ICurrentUserService currentUser, backend.Data.ApplicationDbContext db)
        {
            _aiService = aiService;
            _currentUser = currentUser;
            _db = db;
        }

        [HttpPost("chat")]
        public async Task<IActionResult> Chat([FromBody] AiChatRequestDto request, CancellationToken ct)
        {
            var userId = _currentUser.UserId;
            if (userId == null) return Unauthorized();

            var now = DateTime.UtcNow;
            var queue = _rateLimits.GetOrAdd(userId.Value, _ => new Queue<DateTime>());
            lock (queue)
            {
                while (queue.Count > 0 && (now - queue.Peek()).TotalMinutes > 1)
                {
                    queue.Dequeue();
                }
                if (queue.Count >= 20)
                {
                    return StatusCode(429, new ApiResponse<AiChatResponseDto> { Success = false, Message = "Rate limit exceeded. Try again in a minute." });
                }
                queue.Enqueue(now);
            }

            if (string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest(new ApiResponse<AiChatResponseDto> { Success = false, Message = "Message is required." });
            }

            if (request.Message.Length > 500)
            {
                return BadRequest(new ApiResponse<AiChatResponseDto> { Success = false, Message = "Message is too long (max 500 characters)." });
            }

            if (request.ClientContext != null && request.ClientContext.Length > 1000)
            {
                return BadRequest(new ApiResponse<AiChatResponseDto> { Success = false, Message = "ClientContext exceeds 1000 characters." });
            }

            if (request.History != null)
            {
                // Take only the last 4 items instead of failing
                request.History = request.History.TakeLast(4).ToList();
                
                foreach (var h in request.History)
                {
                    if (h.Content != null && h.Content.Length > 250)
                    {
                        h.Content = h.Content.Substring(0, 250); // Gracefully truncate instead of failing
                    }
                }
                
                request.History = request.History.Where(h => h.Role == "user" || h.Role == "assistant").ToList();
            }

            try
            {
                var response = await _aiService.ProcessChatAsync(request, ct);
                return Ok(new ApiResponse<AiChatResponseDto> { Success = true, Data = response });
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AiAssistantController] Error: {ex.Message}");
                return StatusCode(500, new ApiResponse<AiChatResponseDto> { Success = false, Message = "An unexpected error occurred while processing your request." });
            }
        }
    }
}
