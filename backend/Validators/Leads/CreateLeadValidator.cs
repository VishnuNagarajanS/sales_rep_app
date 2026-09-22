using backend.DTOs.Leads;
using FluentValidation;

namespace backend.Validators.Leads;

public class CreateLeadValidator : AbstractValidator<CreateLeadDto>
{
    public CreateLeadValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Lead contact name is required.")
            .MaximumLength(150).WithMessage("Lead name must not exceed 150 characters.");

        RuleFor(x => x.Phone)
            .NotEmpty().WithMessage("Contact phone number is required.")
            .MaximumLength(30).WithMessage("Phone number must not exceed 30 characters.");

        RuleFor(x => x.Email)
            .EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email))
            .WithMessage("Invalid email format.");

        RuleFor(x => x.Priority)
            .Must(p => string.IsNullOrEmpty(p) || new[] { "Low", "Medium", "High", "Urgent" }.Contains(p))
            .WithMessage("Priority must be one of: Low, Medium, High, Urgent.");
    }
}
