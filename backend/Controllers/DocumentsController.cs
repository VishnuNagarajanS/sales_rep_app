using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using backend.Data;
using backend.Models.Entities;
using backend.DTOs.Documents;
using System.Security.Claims;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class DocumentsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _env;

        public DocumentsController(ApplicationDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        [HttpGet]
        public async Task<IActionResult> GetDocuments([FromQuery] string entityType, [FromQuery] string entityId)
        {
            var docs = await _context.Documents
                .Where(d => d.EntityType == entityType && d.EntityId == entityId)
                .OrderByDescending(d => d.UploadedAt)
                .ToListAsync();

            var dtos = docs.Select(d => new DocumentDto
            {
                Id = d.Id.ToString(),
                Name = d.Name,
                Size = d.Size,
                Type = d.Type,
                UploadedBy = d.UploadedBy,
                UploadedAt = d.UploadedAt.ToString("dd MMM yyyy"),
                Category = d.Category,
                EntityType = d.EntityType,
                EntityId = d.EntityId,
                FileUrl = d.FileUrl
            });

            return Ok(new { success = true, data = dtos, message = "" });
        }

        [HttpPost]
        public async Task<IActionResult> UploadDocument([FromForm] CreateDocumentDto dto)
        {
            var userName = User.FindFirstValue(ClaimTypes.Name) ?? "Unknown User";
            string? fileUrl = null;

            if (dto.File != null && dto.File.Length > 0)
            {
                var uploadsFolder = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads");
                if (!Directory.Exists(uploadsFolder))
                {
                    Directory.CreateDirectory(uploadsFolder);
                }

                var uniqueFileName = Guid.NewGuid().ToString() + "_" + dto.File.FileName;
                var filePath = Path.Combine(uploadsFolder, uniqueFileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await dto.File.CopyToAsync(stream);
                }

                var request = HttpContext.Request;
                var baseUrl = $"{request.Scheme}://{request.Host}{request.PathBase}";
                fileUrl = $"{baseUrl}/uploads/{uniqueFileName}";
            }
            
            var doc = new Document
            {
                Name = dto.Name,
                Size = dto.Size,
                Type = dto.Type,
                Category = dto.Category,
                EntityType = dto.EntityType,
                EntityId = dto.EntityId,
                UploadedBy = userName,
                UploadedAt = DateTime.UtcNow,
                FileUrl = fileUrl
            };

            _context.Documents.Add(doc);
            await _context.SaveChangesAsync();

            var resultDto = new DocumentDto
            {
                Id = doc.Id.ToString(),
                Name = doc.Name,
                Size = doc.Size,
                Type = doc.Type,
                UploadedBy = doc.UploadedBy,
                UploadedAt = doc.UploadedAt.ToString("dd MMM yyyy"),
                Category = doc.Category,
                EntityType = doc.EntityType,
                EntityId = doc.EntityId,
                FileUrl = doc.FileUrl
            };

            return Ok(new { success = true, data = resultDto, message = "Document uploaded successfully." });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDocument(int id)
        {
            var doc = await _context.Documents.FindAsync(id);
            if (doc == null) return NotFound(new { success = false, message = "Document not found" });

            _context.Documents.Remove(doc);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Document removed successfully" });
        }
    }
}
