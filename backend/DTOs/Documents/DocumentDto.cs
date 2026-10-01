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
    }

    public class CreateDocumentDto
    {
        public string Name { get; set; } = null!;
        public string Size { get; set; } = null!;
        public string Type { get; set; } = null!;
        public string Category { get; set; } = null!;
        public string EntityType { get; set; } = null!;
        public string EntityId { get; set; } = null!;
    }
}
