using backend.DTOs.Leads;
using FluentValidation;

namespace backend.Validators.Leads;

public class UpdateLeadValidator : AbstractValidator<UpdateLeadDto>
{
    public UpdateLeadValidator()
    {
        RuleFor(x => x.Name)
            .MaximumLength(150).When(x => !string.IsNullOrEmpty(x.Name))
            .WithMessage("Lead name must not exceed 150 characters.");

        RuleFor(x => x.Phone)
            .MaximumLength(30).When(x => !string.IsNullOrEmpty(x.Phone))
            .WithMessage("Phone number must not exceed 30 characters.");

        RuleFor(x => x.Email)
            .EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email))
            .WithMessage("Invalid email format.");

        RuleFor(x => x.Priority)
            .Must(p => string.IsNullOrEmpty(p) || new[] { "Low", "Medium", "High", "Urgent" }.Contains(p))
            .WithMessage("Priority must be one of: Low, Medium, High, Urgent.");
    }
}
