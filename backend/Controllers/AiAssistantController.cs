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

        public AiAssistantController(AiAssistantService aiService)
        {
            _aiService = aiService;
        }

        [HttpPost("chat")]
        public async Task<IActionResult> Chat([FromBody] AiChatRequestDto request, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest(new ApiResponse<AiChatResponseDto> { Success = false, Message = "Message is required." });
            }

            if (request.Message.Length > 500)
            {
                return BadRequest(new ApiResponse<AiChatResponseDto> { Success = false, Message = "Message is too long (max 500 characters)." });
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
                // In a real scenario, log exception here.
                return StatusCode(500, new ApiResponse<AiChatResponseDto> { Success = false, Message = $"Error: {ex.Message}" });
            }
        }
    }
}
