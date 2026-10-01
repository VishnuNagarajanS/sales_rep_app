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

        private List<string> GetCompanyAliases(string? entityId)
        {
            var userCompanyId = User.FindFirst("company_id")?.Value 
                             ?? User.FindFirst("companyId")?.Value;

            var target = !string.IsNullOrWhiteSpace(entityId) ? entityId.Trim().ToLowerInvariant() : (userCompanyId ?? "1");

            if (target == "1" || target == "ghl" || target.Contains("ghl"))
            {
                return new List<string> { "1", "ghl", "t-ghl-01", "t-ghl-1" };
            }
            if (target == "2" || target == "jamin" || target.Contains("jamin"))
            {
                return new List<string> { "2", "jamin", "t-jamin-02", "t-jamin-2" };
            }

            return new List<string> { target, target.ToLowerInvariant() };
        }

        [HttpGet]
        public async Task<IActionResult> GetDocuments([FromQuery] string entityType, [FromQuery] string? entityId)
        {
            IQueryable<Document> query = _context.Documents;

            if (string.Equals(entityType, "company", StringComparison.OrdinalIgnoreCase))
            {
                var aliases = GetCompanyAliases(entityId);
                query = query.Where(d => d.EntityType.ToLower() == "company" && aliases.Contains(d.EntityId.ToLower()));
            }
            else
            {
                query = query.Where(d => d.EntityType == entityType && d.EntityId == (entityId ?? ""));
            }

            var docs = await query
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

            var fileName = !string.IsNullOrWhiteSpace(dto.Name)
                ? dto.Name
                : (dto.File != null ? Path.GetFileName(dto.File.FileName) : "Unnamed Document");

            var fileType = !string.IsNullOrWhiteSpace(dto.Type)
                ? dto.Type
                : (dto.File != null ? dto.File.ContentType : "application/octet-stream");

            var fileSize = dto.Size;
            if (string.IsNullOrWhiteSpace(fileSize) && dto.File != null)
            {
                fileSize = FormatFileSize(dto.File.Length);
            }
            if (string.IsNullOrWhiteSpace(fileSize))
            {
                fileSize = "0 B";
            }

            var entityTypeNormalized = dto.EntityType ?? "general";
            var entityIdNormalized = dto.EntityId ?? "0";
            if (string.Equals(entityTypeNormalized, "company", StringComparison.OrdinalIgnoreCase))
            {
                var aliases = GetCompanyAliases(entityIdNormalized);
                entityIdNormalized = aliases[0]; // Store normalized e.g. "1" or "2"
            }

            if (dto.File != null && dto.File.Length > 0)
            {
                var uploadsFolder = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads");
                if (!Directory.Exists(uploadsFolder))
                {
                    Directory.CreateDirectory(uploadsFolder);
                }

                var uniqueFileName = Guid.NewGuid().ToString() + "_" + Path.GetFileName(dto.File.FileName);
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
                Name = fileName,
                Size = fileSize,
                Type = fileType,
                Category = !string.IsNullOrWhiteSpace(dto.Category) ? dto.Category : "Other",
                EntityType = entityTypeNormalized,
                EntityId = entityIdNormalized,
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

        private static string FormatFileSize(long bytes)
        {
            if (bytes == 0) return "0 B";
            if (bytes < 1024) return $"{bytes} B";
            if (bytes < 1024 * 1024) return $"{(bytes / 1024.0):F1} KB";
            if (bytes < 1024 * 1024 * 1024) return $"{(bytes / (1024.0 * 1024.0)):F1} MB";
            return $"{(bytes / (1024.0 * 1024.0 * 1024.0)):F1} GB";
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDocument(string id)
        {
            if (!int.TryParse(id, out var docId))
            {
                return Ok(new { success = true, message = "Document removed successfully" });
            }

            var doc = await _context.Documents.FindAsync(docId);
            if (doc == null) return NotFound(new { success = false, message = "Document not found" });

            if (!string.IsNullOrEmpty(doc.FileUrl))
            {
                try
                {
                    var uri = new Uri(doc.FileUrl);
                    var fileName = Path.GetFileName(uri.LocalPath);
                    var uploadsFolder = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads");
                    var filePath = Path.Combine(uploadsFolder, fileName);
                    if (System.IO.File.Exists(filePath))
                    {
                        System.IO.File.Delete(filePath);
                    }
                }
                catch { }
            }

            _context.Documents.Remove(doc);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Document removed successfully" });
        }
    }
}
