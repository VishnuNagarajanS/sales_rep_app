using backend.DTOs.Followups;
using FluentValidation;

namespace backend.Validators.Followups;

public class CreateFollowupValidator : AbstractValidator<CreateFollowupDto>
{
    public CreateFollowupValidator()
    {
        RuleFor(x => x.ContactName)
            .NotEmpty().WithMessage("Contact name is required.")
            .MaximumLength(150).WithMessage("Contact name must not exceed 150 characters.");

        RuleFor(x => x.ContactPhone)
            .NotEmpty().WithMessage("Contact phone number is required.")
            .MaximumLength(30).WithMessage("Phone number must not exceed 30 characters.");

        RuleFor(x => x.ScheduledAt)
            .NotEmpty().WithMessage("Scheduled timestamp is required.");

        RuleFor(x => x.Priority)
            .Must(p => string.IsNullOrEmpty(p) || new[] { "Low", "Medium", "High", "Urgent" }.Contains(p))
            .WithMessage("Priority must be one of: Low, Medium, High, Urgent.");
    }
}
