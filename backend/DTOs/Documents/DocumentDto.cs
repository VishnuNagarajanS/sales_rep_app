using System;

namespace backend.DTOs.Documents
{
    public class DocumentDto
    {
        public string Id { get; set; } = null!;
        public string Name { get; set; } = null!;
        public string Size { get; set; } = null!;
        public string Type { get; set; } = null!;
        public string UploadedBy { get; set; } = null!;
        public string UploadedAt { get; set; } = null!;
        public string Category { get; set; } = null!;
        public string EntityType { get; set; } = null!;
        public string EntityId { get; set; } = null!;
        public string? FileUrl { get; set; }
        public string TargetAudience { get; set; } = "all_users";
        public bool IsPlatformShared { get; set; } = false;
        public string? Description { get; set; }
        public string? TargetTenantName { get; set; }
    }

    public class CreateDocumentDto
    {
        public string? Name { get; set; }
        public string? Size { get; set; }
        public string? Type { get; set; }
        public string? Category { get; set; }
        public string? EntityType { get; set; }
        public string? EntityId { get; set; }
        public string? TargetAudience { get; set; }
        public bool? IsPlatformShared { get; set; }
        public string? Description { get; set; }
        public Microsoft.AspNetCore.Http.IFormFile? File { get; set; }
    }
}
