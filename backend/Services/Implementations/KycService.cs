using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Kyc;
using backend.Models.Entities;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public class KycService : IKycService
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;
    private readonly IWebHostEnvironment _env;

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx"
    };

    public KycService(ApplicationDbContext context, ICurrentUserService currentUser, IWebHostEnvironment env)
    {
        _context = context;
        _currentUser = currentUser;
        _env = env;
    }

    public async Task<ApiResponse<CustomerKycResponseDto>> GetCustomerKycAsync(int customerId, CancellationToken ct)
    {
        var companyId = _currentUser.CompanyId;

        var customer = await _context.Customers
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == customerId && (companyId == 0 || c.CompanyId == companyId), ct);

        if (customer == null)
            return ApiResponse<CustomerKycResponseDto>.FailureResult("Customer not found.");

        var kyc = await _context.CustomerKycs
            .AsNoTracking()
            .Include(k => k.VerifiedByUser)
            .FirstOrDefaultAsync(k => k.CustomerId == customerId && (companyId == 0 || k.CompanyId == companyId), ct);

        var docs = await _context.KycDocuments
            .AsNoTracking()
            .Include(d => d.UploadedByUser)
            .Where(d => d.CustomerId == customerId && (companyId == 0 || d.CompanyId == companyId))
            .OrderByDescending(d => d.UploadedAt)
            .ToListAsync(ct);

        var docDtos = docs.Select(MapDocumentToDto).ToList();

        if (kyc == null)
        {
            // Return baseline draft with customer info
            return ApiResponse<CustomerKycResponseDto>.SuccessResult(new CustomerKycResponseDto
            {
                Id = 0,
                CompanyId = customer.CompanyId,
                CustomerId = customer.Id,
                CustomerName = customer.Name,
                CustomerPhone = customer.Phone,
                CustomerEmail = customer.Email,
                Status = customer.KycStatus ?? "Pending",
                CreatedAt = customer.CreatedAt,
                Documents = docDtos
            });
        }

        var dto = MapKycToDto(kyc, customer, docDtos);
        return ApiResponse<CustomerKycResponseDto>.SuccessResult(dto);
    }

    public async Task<ApiResponse<CustomerKycResponseDto>> SubmitOrUpdateKycAsync(int customerId, SubmitCustomerKycDto dto, CancellationToken ct)
    {
        var companyId = _currentUser.CompanyId;

        var customer = await _context.Customers
            .FirstOrDefaultAsync(c => c.Id == customerId && (companyId == 0 || c.CompanyId == companyId), ct);

        if (customer == null)
            return ApiResponse<CustomerKycResponseDto>.FailureResult("Customer not found.");

        var kyc = await _context.CustomerKycs
            .FirstOrDefaultAsync(k => k.CustomerId == customerId && (companyId == 0 || k.CompanyId == companyId), ct);

        if (kyc == null)
        {
            kyc = new CustomerKyc
            {
                CompanyId = customer.CompanyId,
                CustomerId = customer.Id,
                CreatedAt = DateTime.UtcNow
            };
            _context.CustomerKycs.Add(kyc);
        }

        kyc.DocumentType = dto.DocumentType;
        kyc.DocumentNumber = dto.DocumentNumber;
        kyc.FullNameAsPerDocument = dto.FullNameAsPerDocument ?? customer.Name;
        kyc.DateOfBirth = dto.DateOfBirth.HasValue ? DateTime.SpecifyKind(dto.DateOfBirth.Value, DateTimeKind.Utc) : null;
        kyc.Gender = dto.Gender;
        kyc.Nationality = dto.Nationality ?? "Indian";
        kyc.AddressLine1 = dto.AddressLine1;
        kyc.AddressLine2 = dto.AddressLine2;
        kyc.City = dto.City;
        kyc.State = dto.State;
        kyc.PostalCode = dto.PostalCode;
        kyc.Country = dto.Country ?? "India";
        kyc.VerificationRemarks = dto.Remarks;
        kyc.Status = "Submitted";
        kyc.SubmittedAt = DateTime.UtcNow;
        kyc.UpdatedAt = DateTime.UtcNow;

        customer.KycStatus = "UnderReview";
        customer.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);

        return await GetCustomerKycAsync(customerId, ct);
    }

    public async Task<ApiResponse<CustomerKycResponseDto>> VerifyKycAsync(int kycId, VerifyKycDto dto, CancellationToken ct)
    {
        var companyId = _currentUser.CompanyId;

        var kyc = await _context.CustomerKycs
            .Include(k => k.Customer)
            .FirstOrDefaultAsync(k => k.Id == kycId && (companyId == 0 || k.CompanyId == companyId), ct);

        if (kyc == null)
            return ApiResponse<CustomerKycResponseDto>.FailureResult("KYC record not found.");

        var targetStatus = dto.Status.Trim();
        if (!string.Equals(targetStatus, "Verified", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(targetStatus, "Rejected", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(targetStatus, "UnderReview", StringComparison.OrdinalIgnoreCase))
        {
            return ApiResponse<CustomerKycResponseDto>.FailureResult("Status must be 'Verified', 'Rejected', or 'UnderReview'.");
        }

        kyc.Status = targetStatus;
        kyc.VerificationRemarks = dto.Remarks;
        kyc.UpdatedAt = DateTime.UtcNow;

        if (string.Equals(targetStatus, "Verified", StringComparison.OrdinalIgnoreCase))
        {
            kyc.VerifiedAt = DateTime.UtcNow;
            kyc.VerifiedByUserId = _currentUser.UserId;
            kyc.RejectionReason = null;
            if (kyc.Customer != null)
            {
                kyc.Customer.KycStatus = "Verified";
                kyc.Customer.UpdatedAt = DateTime.UtcNow;
            }
        }
        else if (string.Equals(targetStatus, "Rejected", StringComparison.OrdinalIgnoreCase))
        {
            kyc.VerifiedAt = DateTime.UtcNow;
            kyc.VerifiedByUserId = _currentUser.UserId;
            kyc.RejectionReason = dto.RejectionReason ?? "Document or identity verification failed.";
            if (kyc.Customer != null)
            {
                kyc.Customer.KycStatus = "Rejected";
                kyc.Customer.UpdatedAt = DateTime.UtcNow;
            }
        }
        else
        {
            if (kyc.Customer != null)
            {
                kyc.Customer.KycStatus = "UnderReview";
                kyc.Customer.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _context.SaveChangesAsync(ct);

        return await GetCustomerKycAsync(kyc.CustomerId, ct);
    }

    public async Task<ApiResponse<PagedResult<KycQueueItemDto>>> GetKycQueueAsync(string? status, string? search, int page, int pageSize, CancellationToken ct)
    {
        var companyId = _currentUser.CompanyId;

        var query = _context.CustomerKycs
            .AsNoTracking()
            .Include(k => k.Customer)
                .ThenInclude(c => c!.AssignedToUser)
            .Include(k => k.Documents)
            .Where(k => companyId == 0 || k.CompanyId == companyId);

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(k => k.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(k =>
                (k.Customer != null && k.Customer.Name.ToLower().Contains(term)) ||
                (k.Customer != null && k.Customer.Phone.ToLower().Contains(term)) ||
                k.DocumentNumber.ToLower().Contains(term));
        }

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(k => k.SubmittedAt ?? k.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(k => new KycQueueItemDto
            {
                KycId = k.Id,
                CustomerId = k.CustomerId,
                CustomerName = k.Customer != null ? k.Customer.Name : "Unknown",
                CustomerPhone = k.Customer != null ? k.Customer.Phone : string.Empty,
                CustomerEmail = k.Customer != null ? k.Customer.Email : string.Empty,
                DocumentType = k.DocumentType,
                DocumentNumber = k.DocumentNumber,
                Status = k.Status,
                SubmittedAt = k.SubmittedAt,
                DocumentsCount = k.Documents.Count,
                AssignedAgentName = k.Customer != null && k.Customer.AssignedToUser != null ? k.Customer.AssignedToUser.Name : null
            })
            .ToListAsync(ct);

        var paged = PagedResult<KycQueueItemDto>.Create(items, totalCount, page, pageSize);

        return ApiResponse<PagedResult<KycQueueItemDto>>.SuccessResult(paged);
    }

    public async Task<ApiResponse<KycDocumentResponseDto>> UploadDocumentAsync(int customerId, IFormFile file, string category, string? documentName, CancellationToken ct)
    {
        var companyId = _currentUser.CompanyId;

        if (file == null || file.Length == 0)
            return ApiResponse<KycDocumentResponseDto>.FailureResult("File payload is empty.");

        if (file.Length > 25 * 1024 * 1024)
            return ApiResponse<KycDocumentResponseDto>.FailureResult("File size exceeds 25 MB limit.");

        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(ext) || !AllowedExtensions.Contains(ext))
            return ApiResponse<KycDocumentResponseDto>.FailureResult($"File extension '{ext}' is not permitted. Allowed: {string.Join(", ", AllowedExtensions)}");

        var customer = await _context.Customers
            .FirstOrDefaultAsync(c => c.Id == customerId && (companyId == 0 || c.CompanyId == companyId), ct);

        if (customer == null)
            return ApiResponse<KycDocumentResponseDto>.FailureResult("Customer not found.");

        var uploadDir = Path.Combine(_env.ContentRootPath, "uploads", "kyc", customer.CompanyId.ToString());
        if (!Directory.Exists(uploadDir))
            Directory.CreateDirectory(uploadDir);

        var storedFileName = $"{Guid.NewGuid():N}{ext}";
        var fullPath = Path.Combine(uploadDir, storedFileName);

        using (var stream = new FileStream(fullPath, FileMode.Create))
        {
            await file.CopyToAsync(stream, ct);
        }

        var relativePath = Path.Combine("uploads", "kyc", customer.CompanyId.ToString(), storedFileName).Replace('\\', '/');

        // Check if there is an existing CustomerKyc record
        var kyc = await _context.CustomerKycs
            .FirstOrDefaultAsync(k => k.CustomerId == customerId && (companyId == 0 || k.CompanyId == companyId), ct);

        var doc = new KycDocument
        {
            CompanyId = customer.CompanyId,
            CustomerId = customer.Id,
            CustomerKycId = kyc?.Id,
            EntityType = "customer",
            EntityId = customer.Id,
            Category = string.IsNullOrWhiteSpace(category) ? "KYC" : category.Trim(),
            DocumentName = string.IsNullOrWhiteSpace(documentName) ? file.FileName : documentName.Trim(),
            OriginalFileName = file.FileName,
            StoredFileName = storedFileName,
            ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
            FileSizeBytes = file.Length,
            StoragePath = relativePath,
            Status = "Pending",
            UploadedByUserId = _currentUser.UserId > 0 ? _currentUser.UserId : 1,
            UploadedAt = DateTime.UtcNow
        };

        _context.KycDocuments.Add(doc);
        await _context.SaveChangesAsync(ct);

        var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == doc.UploadedByUserId, ct);
        doc.UploadedByUser = user;

        return ApiResponse<KycDocumentResponseDto>.SuccessResult(MapDocumentToDto(doc));
    }

    public async Task<ApiResponse<List<KycDocumentResponseDto>>> GetCustomerDocumentsAsync(int customerId, string? category, CancellationToken ct)
    {
        var companyId = _currentUser.CompanyId;

        var query = _context.KycDocuments
            .AsNoTracking()
            .Include(d => d.UploadedByUser)
            .Where(d => d.CustomerId == customerId && (companyId == 0 || d.CompanyId == companyId));

        if (!string.IsNullOrWhiteSpace(category) && !category.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(d => d.Category == category);
        }

        var docs = await query.OrderByDescending(d => d.UploadedAt).ToListAsync(ct);
        var dtos = docs.Select(MapDocumentToDto).ToList();

        return ApiResponse<List<KycDocumentResponseDto>>.SuccessResult(dtos);
    }

    public async Task<(byte[] FileBytes, string ContentType, string FileName)?> GetDocumentDownloadAsync(int documentId, CancellationToken ct)
    {
        var companyId = _currentUser.CompanyId;

        var doc = await _context.KycDocuments
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == documentId && (companyId == 0 || d.CompanyId == companyId), ct);

        if (doc == null)
            return null;

        var fullPath = Path.Combine(_env.ContentRootPath, doc.StoragePath.Replace('/', Path.DirectorySeparatorChar));
        if (!File.Exists(fullPath))
            return null;

        var bytes = await File.ReadAllBytesAsync(fullPath, ct);
        return (bytes, doc.ContentType, doc.OriginalFileName);
    }

    public async Task<ApiResponse<bool>> DeleteDocumentAsync(int documentId, CancellationToken ct)
    {
        var companyId = _currentUser.CompanyId;

        var doc = await _context.KycDocuments
            .FirstOrDefaultAsync(d => d.Id == documentId && (companyId == 0 || d.CompanyId == companyId), ct);

        if (doc == null)
            return ApiResponse<bool>.FailureResult("Document record not found.");

        var fullPath = Path.Combine(_env.ContentRootPath, doc.StoragePath.Replace('/', Path.DirectorySeparatorChar));
        if (File.Exists(fullPath))
        {
            try { File.Delete(fullPath); } catch { /* ignore filesystem lock issues on cleanup */ }
        }

        _context.KycDocuments.Remove(doc);
        await _context.SaveChangesAsync(ct);

        return ApiResponse<bool>.SuccessResult(true);
    }

    // ── Helper Mappers ────────────────────────────────────────────────────────
    private static KycDocumentResponseDto MapDocumentToDto(KycDocument doc)
    {
        return new KycDocumentResponseDto
        {
            Id = doc.Id,
            CompanyId = doc.CompanyId,
            CustomerId = doc.CustomerId,
            CustomerKycId = doc.CustomerKycId,
            EntityType = doc.EntityType,
            EntityId = doc.EntityId,
            Category = doc.Category,
            DocumentName = doc.DocumentName,
            OriginalFileName = doc.OriginalFileName,
            ContentType = doc.ContentType,
            FileSizeBytes = doc.FileSizeBytes,
            FormattedSize = FormatBytes(doc.FileSizeBytes),
            Status = doc.Status,
            UploadedByUserId = doc.UploadedByUserId,
            UploadedByUserName = doc.UploadedByUser?.Name ?? "System",
            UploadedAt = doc.UploadedAt,
            VerifiedAt = doc.VerifiedAt,
            RejectionReason = doc.RejectionReason,
            DownloadUrl = $"/api/kyc/documents/{doc.Id}/download"
        };
    }

    private static CustomerKycResponseDto MapKycToDto(CustomerKyc kyc, Customer customer, List<KycDocumentResponseDto> docs)
    {
        return new CustomerKycResponseDto
        {
            Id = kyc.Id,
            CompanyId = kyc.CompanyId,
            CustomerId = kyc.CustomerId,
            CustomerName = customer.Name,
            CustomerPhone = customer.Phone,
            CustomerEmail = customer.Email,
            DocumentType = kyc.DocumentType,
            DocumentNumber = kyc.DocumentNumber,
            FullNameAsPerDocument = kyc.FullNameAsPerDocument,
            DateOfBirth = kyc.DateOfBirth,
            Gender = kyc.Gender,
            Nationality = kyc.Nationality,
            AddressLine1 = kyc.AddressLine1,
            AddressLine2 = kyc.AddressLine2,
            City = kyc.City,
            State = kyc.State,
            PostalCode = kyc.PostalCode,
            Country = kyc.Country,
            Status = kyc.Status,
            SubmittedAt = kyc.SubmittedAt,
            VerifiedAt = kyc.VerifiedAt,
            VerifiedByUserId = kyc.VerifiedByUserId,
            VerifiedByUserName = kyc.VerifiedByUser?.Name,
            RejectionReason = kyc.RejectionReason,
            VerificationRemarks = kyc.VerificationRemarks,
            CreatedAt = kyc.CreatedAt,
            UpdatedAt = kyc.UpdatedAt,
            Documents = docs
        };
    }

    private static string FormatBytes(long bytes)
    {
        if (bytes == 0) return "0 B";
        if (bytes < 1024) return $"{bytes} B";
        if (bytes < 1024 * 1024) return $"{(bytes / 1024.0):F1} KB";
        if (bytes < 1024 * 1024 * 1024) return $"{(bytes / (1024.0 * 1024.0)):F1} MB";
        return $"{(bytes / (1024.0 * 1024.0 * 1024.0)):F1} GB";
    }
}
