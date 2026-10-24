using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using backend.Data;
using backend.Models.Entities;
using backend.DTOs.Common;
using backend.DTOs.Documents;
using System.Security.Claims;

namespace backend.Controllers.SuperAdmin
{
    [ApiController]
    [Authorize(Roles = "super_admin")]
    [Route("api/super-admin/documents")]
    public class PlatformDocumentsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _env;

        private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".ppt", ".pptx",
            ".txt", ".png", ".jpg", ".jpeg", ".webp"
        };
        private const long MaxUploadSizeBytes = 25 * 1024 * 1024; // 25 MB

        public PlatformDocumentsController(ApplicationDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<DocumentDto>>>> GetDocuments(
            [FromQuery] string? tenantId,
            [FromQuery] string? category,
            [FromQuery] string? audience,
            [FromQuery] string? search,
            CancellationToken ct = default)
        {
            var query = _context.Documents
                .Where(d => d.IsPlatformShared || d.EntityType == "platform")
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(tenantId) && !tenantId.Equals("all_tenants", StringComparison.OrdinalIgnoreCase))
            {
                if (tenantId.Equals("global", StringComparison.OrdinalIgnoreCase) || tenantId.Equals("all", StringComparison.OrdinalIgnoreCase))
                {
                    query = query.Where(d => d.EntityId == "all");
                }
                else
                {
                    var tid = tenantId.Trim().ToLowerInvariant();
                    query = query.Where(d => d.EntityId.ToLower() == tid || d.EntityId == "all");
                }
            }

            if (!string.IsNullOrWhiteSpace(category) && !category.Equals("all", StringComparison.OrdinalIgnoreCase))
            {
                var cat = category.Trim().ToLowerInvariant();
                query = query.Where(d => d.Category.ToLower() == cat);
            }

            if (!string.IsNullOrWhiteSpace(audience) && !audience.Equals("all", StringComparison.OrdinalIgnoreCase))
            {
                var aud = audience.Trim().ToLowerInvariant();
                query = query.Where(d => d.TargetAudience.ToLower() == aud);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLowerInvariant();
                query = query.Where(d => 
                    d.Name.ToLower().Contains(term) || 
                    d.Category.ToLower().Contains(term) ||
                    (d.Description != null && d.Description.ToLower().Contains(term)));
            }

            var docs = await query
                .OrderByDescending(d => d.UploadedAt)
                .ToListAsync(ct);

            // Fetch tenants to map names
            var tenants = await _context.Tenants.AsNoTracking().ToListAsync(ct);
            var tenantMap = tenants.ToDictionary(t => t.Id.ToString(), t => t.Name);
            var tenantSlugMap = tenants.ToDictionary(t => t.Slug.ToLowerInvariant(), t => t.Name);

            var dtos = docs.Select(d =>
            {
                string tenantName = "All Companies (Global)";
                if (!string.IsNullOrWhiteSpace(d.EntityId) && d.EntityId != "all")
                {
                    if (tenantMap.TryGetValue(d.EntityId, out var nameById))
                    {
                        tenantName = nameById;
                    }
                    else if (tenantSlugMap.TryGetValue(d.EntityId.ToLowerInvariant(), out var nameBySlug))
                    {
                        tenantName = nameBySlug;
                    }
                    else
                    {
                        tenantName = $"Company #{d.EntityId}";
                    }
                }

                return new DocumentDto
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
                    FileUrl = d.FileUrl,
                    TargetAudience = d.TargetAudience,
                    IsPlatformShared = d.IsPlatformShared,
                    Description = d.Description,
                    TargetTenantName = tenantName
                };
            }).ToList();

            return Ok(ApiResponse<List<DocumentDto>>.SuccessResponse(dtos, "Platform documents retrieved successfully."));
        }

        [HttpGet("tenants")]
        public async Task<IActionResult> GetTenants(CancellationToken ct = default)
        {
            var tenants = await _context.Tenants
                .AsNoTracking()
                .OrderBy(t => t.Name)
                .Select(t => new
                {
                    id = t.Id.ToString(),
                    name = t.Name,
                    slug = t.Slug,
                    isActive = t.IsActive
                })
                .ToListAsync(ct);

            return Ok(ApiResponse<object>.SuccessResponse(tenants, "Tenants list retrieved."));
        }

        [HttpPost]
        public async Task<IActionResult> UploadDocument([FromForm] CreateDocumentDto dto, CancellationToken ct = default)
        {
            if (dto.File == null || dto.File.Length == 0)
            {
                return BadRequest(ApiResponse<object>.ErrorResponse("File is required for upload."));
            }

            if (dto.File.Length > MaxUploadSizeBytes)
            {
                return BadRequest(ApiResponse<object>.ErrorResponse("File size exceeds maximum allowed limit of 25 MB."));
            }

            var ext = Path.GetExtension(dto.File.FileName);
            if (string.IsNullOrWhiteSpace(ext) || !AllowedExtensions.Contains(ext))
            {
                return BadRequest(ApiResponse<object>.ErrorResponse($"File extension '{ext}' is not permitted for security reasons. Allowed: {string.Join(", ", AllowedExtensions)}"));
            }

            var userName = User.FindFirstValue(ClaimTypes.Name) 
                        ?? User.FindFirstValue("name") 
                        ?? "Super Admin";

            var fileName = !string.IsNullOrWhiteSpace(dto.Name)
                ? dto.Name.Trim()
                : Path.GetFileName(dto.File.FileName);

            var fileType = !string.IsNullOrWhiteSpace(dto.Type)
                ? dto.Type
                : dto.File.ContentType;

            var fileSize = dto.Size;
            if (string.IsNullOrWhiteSpace(fileSize))
            {
                fileSize = FormatFileSize(dto.File.Length);
            }

            var targetTenantId = string.IsNullOrWhiteSpace(dto.EntityId) || dto.EntityId == "0" ? "all" : dto.EntityId.Trim();
            var targetAudience = string.IsNullOrWhiteSpace(dto.TargetAudience) ? "all_users" : dto.TargetAudience.Trim().ToLowerInvariant();
            var category = string.IsNullOrWhiteSpace(dto.Category) ? "General Resources" : dto.Category.Trim();

            // Save file
            var uploadsFolder = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads");
            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }

            var uniqueFileName = "platform_" + Guid.NewGuid().ToString("N") + Path.GetExtension(dto.File.FileName);
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await dto.File.CopyToAsync(stream, ct);
            }

            var request = HttpContext.Request;
            var baseUrl = $"{request.Scheme}://{request.Host}{request.PathBase}";
            var fileUrl = $"{baseUrl}/uploads/{uniqueFileName}";

            var doc = new Document
            {
                Name = fileName,
                Size = fileSize,
                Type = fileType,
                Category = category,
                EntityType = "company",
                EntityId = targetTenantId,
                TargetAudience = targetAudience,
                IsPlatformShared = true,
                Description = dto.Description,
                UploadedBy = userName,
                UploadedAt = DateTime.UtcNow,
                FileUrl = fileUrl
            };

            _context.Documents.Add(doc);
            await _context.SaveChangesAsync(ct);

            // Fetch tenant name for response
            string tenantName = "All Companies (Global)";
            if (targetTenantId != "all")
            {
                var tenant = await _context.Tenants.FirstOrDefaultAsync(t => t.Id.ToString() == targetTenantId || t.Slug == targetTenantId, ct);
                if (tenant != null) tenantName = tenant.Name;
            }

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
                FileUrl = doc.FileUrl,
                TargetAudience = doc.TargetAudience,
                IsPlatformShared = doc.IsPlatformShared,
                Description = doc.Description,
                TargetTenantName = tenantName
            };

            return Ok(ApiResponse<DocumentDto>.SuccessResponse(resultDto, "Platform document published successfully."));
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDocument(string id, CancellationToken ct = default)
        {
            if (!int.TryParse(id, out var docId))
            {
                return BadRequest(ApiResponse<object>.ErrorResponse("Invalid document ID."));
            }

            var doc = await _context.Documents.FindAsync(new object[] { docId }, ct);
            if (doc == null)
            {
                return NotFound(ApiResponse<object>.ErrorResponse("Document not found."));
            }

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
            await _context.SaveChangesAsync(ct);

            return Ok(ApiResponse<object?>.SuccessResponse(null, "Document deleted successfully."));
        }

        private static string FormatFileSize(long bytes)
        {
            if (bytes == 0) return "0 B";
            if (bytes < 1024) return $"{bytes} B";
            if (bytes < 1024 * 1024) return $"{(bytes / 1024.0):F1} KB";
            if (bytes < 1024 * 1024 * 1024) return $"{(bytes / (1024.0 * 1024.0)):F1} MB";
            return $"{(bytes / (1024.0 * 1024.0 * 1024.0)):F1} GB";
        }
    }
}
