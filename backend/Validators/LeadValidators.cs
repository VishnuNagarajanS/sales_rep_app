using backend.DTOs.Leads;
using FluentValidation;

namespace backend.Validators;

public sealed class CreateLeadValidator : AbstractValidator<CreateLeadDto>
{
    public CreateLeadValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Email).MaximumLength(320).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.Phone).NotEmpty().MaximumLength(40);
        RuleFor(x => x.Status).NotEmpty().MaximumLength(40);
    }
}

public sealed class UpdateLeadValidator : AbstractValidator<UpdateLeadDto>
{
    public UpdateLeadValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Email).MaximumLength(320).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.Phone).NotEmpty().MaximumLength(40);
        RuleFor(x => x.Status).NotEmpty().MaximumLength(40);
    }
}
