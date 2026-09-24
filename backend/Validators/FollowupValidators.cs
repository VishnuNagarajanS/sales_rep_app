using backend.DTOs.Followups;
using FluentValidation;

namespace backend.Validators;

public sealed class CreateFollowupValidator : AbstractValidator<CreateFollowupDto>
{
    public CreateFollowupValidator()
    {
        RuleFor(x => x.ScheduledAt).NotEmpty();
        RuleFor(x => x.Status).NotEmpty().MaximumLength(40);
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}
