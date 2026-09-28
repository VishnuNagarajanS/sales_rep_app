using backend.DTOs.Profile;
using FluentValidation;

namespace backend.Validators;

public sealed class UpdateProfileValidator : AbstractValidator<UpdateProfileDto>
{
    public UpdateProfileValidator()
    {
        RuleFor(x => x.Name).MaximumLength(200).When(x => x.Name != null);
        RuleFor(x => x.Phone).MaximumLength(40).When(x => x.Phone != null);
        RuleFor(x => x.MaxActiveLeads).GreaterThanOrEqualTo(0).When(x => x.MaxActiveLeads.HasValue);
    }
}
