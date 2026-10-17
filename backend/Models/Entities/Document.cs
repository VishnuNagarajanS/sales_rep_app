using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models.Entities
{
    public class Document
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        public string Name { get; set; } = null!;
        public string Size { get; set; } = null!;
        public string Type { get; set; } = null!;
        public string UploadedBy { get; set; } = null!;
        
        public string Category { get; set; } = null!;
        public string EntityType { get; set; } = null!;
        public string EntityId { get; set; } = null!;

        public string? FileUrl { get; set; } // Nullable for backwards compatibility

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

        public string TargetAudience { get; set; } = "all_users"; // "all_users", "admin_only"
        public bool IsPlatformShared { get; set; } = false;
        public string? Description { get; set; }
    }
}
