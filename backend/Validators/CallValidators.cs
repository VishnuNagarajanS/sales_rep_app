using backend.DTOs.Calls;
using FluentValidation;

namespace backend.Validators;

public sealed class LogCallValidator : AbstractValidator<LogCallDto>
{
    public LogCallValidator()
    {
        RuleFor(x => x.ContactName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.ContactPhone).NotEmpty().MaximumLength(40);
        RuleFor(x => x.Direction).Must(x => x.Equals("inbound", StringComparison.OrdinalIgnoreCase) || x.Equals("outbound", StringComparison.OrdinalIgnoreCase));
        RuleFor(x => x.Duration).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Disposition).NotEmpty().MaximumLength(80);
    }
}

public sealed class CallDispositionValidator : AbstractValidator<CallDispositionDto>
{
    public CallDispositionValidator()
    {
        RuleFor(x => x.Disposition).NotEmpty().MaximumLength(80);
        RuleFor(x => x.Duration).GreaterThanOrEqualTo(0);
    }
}
